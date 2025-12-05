# 데이터베이스 쿼리 작성 가이드

## 개요

본 프로젝트는 **Prisma ORM**과 **Raw SQL**을 하이브리드로 사용하여 **타입 안전성**과 **성능 최적화**를 모두 달성합니다.

## Prisma vs Raw SQL 사용 기준

### 📋 의사결정 매트릭스

| 상황 | 사용 도구 | 이유 | 예시 |
|------|----------|------|------|
| **단순 CRUD** | Prisma ORM | 타입 안전성, 생산성 | `findMany()`, `create()` |
| **단순 조인 (1-2개)** | Prisma ORM | 관계 자동 해결 | `include: { user: true }` |
| **복잡한 JOIN (3개 이상)** | Raw SQL | 성능, 명확성 | 여러 테이블 조인 |
| **집계/분석 쿼리** | Raw SQL | Window Function, CTE | `SUM()`, `AVG()`, `ROW_NUMBER()` |
| **대용량 배치** | Raw SQL | Bulk Insert/Update | 1000건 이상 한번에 |
| **동적 필터** | Kysely | 타입 안전한 쿼리 빌더 | 검색 조건 동적 생성 |
| **Full-Text Search** | Raw SQL | PostgreSQL 전문 검색 | `to_tsvector()` |
| **통계/리포팅** | Raw SQL | 복잡한 집계 | Dashboard 데이터 |

## 1. Prisma ORM 사용법

### 1.1 기본 CRUD

```typescript
/**
 * 사용자 조회 (Prisma)
 *
 * @performance O(1) - Primary Key 조회
 */
const findUserById = async (id: string): Promise<User | null> => {
  return await prisma.user.findUnique({
    where: { id },
    // 필요한 필드만 선택 (성능 최적화)
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
    },
  });
};

/**
 * 사용자 목록 조회 (페이지네이션)
 *
 * @performance O(n) - Full Table Scan 회피 (Index 사용)
 */
const findUsers = async (page: number, limit: number) => {
  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    }),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * 사용자 생성 (트랜잭션)
 *
 * @throws {PrismaClientKnownRequestError} P2002 - Unique constraint
 */
const createUser = async (data: CreateUserInput): Promise<User> => {
  return await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      password: await hashPassword(data.password),
      name: data.name,
      role: 'MEMBER',
    },
  });
};
```

### 1.2 관계 조회 (Include vs Select)

```typescript
/**
 * 워크스페이스 + 멤버 조회
 *
 * ✅ 올바른 예: include 사용
 * - 관계 데이터 자동 로딩
 * - N+1 문제 자동 해결 (JOIN)
 */
const getWorkspaceWithMembers = async (id: string) => {
  return await prisma.workspace.findUnique({
    where: { id },
    include: {
      members: {
        where: { isAccepted: true },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });
};

/**
 * 프로젝트 + 태스크 통계
 *
 * ⚠️  Prisma 한계: 복잡한 집계는 Raw SQL 권장
 */
const getProjectWithTaskStats = async (id: string) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          tasks: true,
        },
      },
    },
  });

  // 추가 집계는 별도 쿼리 필요 (비효율)
  const taskStats = await prisma.task.groupBy({
    by: ['status'],
    where: { projectId: id },
    _count: true,
  });

  return { project, taskStats };
};
```

## 2. Raw SQL 사용법

### 2.1 기본 Raw Query

```typescript
import { Prisma } from '@prisma/client';

/**
 * Raw SQL 쿼리 실행
 *
 * @security
 * - ✅ 파라미터 바인딩 사용 (SQL Injection 방지)
 * - ❌ 문자열 concatenation 금지
 *
 * @performance
 * - 복잡한 JOIN: Prisma보다 2-3배 빠름
 * - 인덱스 활용: EXPLAIN ANALYZE로 검증
 */

// ✅ 올바른 예: 파라미터 바인딩
const getUsersByRole = async (role: string): Promise<User[]> => {
  return await prisma.$queryRaw<User[]>`
    SELECT
      id,
      email,
      name,
      avatar_url AS "avatarUrl",
      role,
      created_at AS "createdAt"
    FROM users
    WHERE role = ${role}
      AND is_active = true
      AND deleted_at IS NULL
    ORDER BY created_at DESC
  `;
};

// ❌ 잘못된 예: SQL Injection 취약
// const query = `SELECT * FROM users WHERE email = '${email}'`;  // 절대 금지!

/**
 * Raw SQL with Type Safety
 *
 * Prisma.sql 템플릿 태그 사용
 */
const findUserByEmail = async (email: string): Promise<User | null> => {
  const users = await prisma.$queryRaw<User[]>(
    Prisma.sql`
      SELECT * FROM users
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `
  );

  return users[0] || null;
};
```

### 2.2 복잡한 JOIN 쿼리

```typescript
/**
 * 프로젝트 대시보드 데이터
 *
 * @description
 * 4개 테이블 조인 + 집계 + Window Function
 * Prisma로 구현 시 여러 쿼리 필요 → Raw SQL로 한 번에
 *
 * @performance
 * - Prisma (여러 쿼리): ~200ms
 * - Raw SQL (단일 쿼리): ~50ms
 */
interface ProjectDashboard {
  projectId: string;
  projectName: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  avgCompletionTime: number;
  recentActivity: string;
}

const getProjectDashboard = async (
  workspaceId: string,
): Promise<ProjectDashboard[]> => {
  return await prisma.$queryRaw<ProjectDashboard[]>`
    WITH task_stats AS (
      SELECT
        project_id,
        COUNT(*) AS total_tasks,
        COUNT(*) FILTER (WHERE status = 'DONE') AS completed_tasks,
        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress_tasks,
        AVG(
          EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600
        ) FILTER (WHERE completed_at IS NOT NULL) AS avg_completion_time
      FROM tasks
      GROUP BY project_id
    ),
    recent_activity AS (
      SELECT
        project_id,
        MAX(updated_at) AS last_updated
      FROM tasks
      GROUP BY project_id
    )
    SELECT
      p.id AS "projectId",
      p.name AS "projectName",
      COALESCE(ts.total_tasks, 0)::int AS "totalTasks",
      COALESCE(ts.completed_tasks, 0)::int AS "completedTasks",
      COALESCE(ts.in_progress_tasks, 0)::int AS "inProgressTasks",
      COALESCE(ts.avg_completion_time, 0)::float AS "avgCompletionTime",
      COALESCE(ra.last_updated::text, '') AS "recentActivity"
    FROM projects p
    LEFT JOIN task_stats ts ON ts.project_id = p.id
    LEFT JOIN recent_activity ra ON ra.project_id = p.id
    WHERE p.workspace_id = ${workspaceId}
      AND p.status = 'ACTIVE'
    ORDER BY ra.last_updated DESC NULLS LAST
  `;
};
```

### 2.3 Window Function (분석 쿼리)

```typescript
/**
 * 사용자별 태스크 완료율 순위
 *
 * @description
 * Window Function (ROW_NUMBER, RANK, PERCENT_RANK)
 * Prisma 미지원 → Raw SQL 필수
 */
interface UserTaskRanking {
  userId: string;
  userName: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  rank: number;
  percentile: number;
}

const getUserTaskRankings = async (
  workspaceId: string,
): Promise<UserTaskRanking[]> => {
  return await prisma.$queryRaw<UserTaskRanking[]>`
    WITH user_stats AS (
      SELECT
        u.id AS user_id,
        u.name AS user_name,
        COUNT(t.id) AS total_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'DONE') AS completed_tasks,
        CASE
          WHEN COUNT(t.id) > 0
          THEN (COUNT(t.id) FILTER (WHERE t.status = 'DONE')::float / COUNT(t.id)::float * 100)
          ELSE 0
        END AS completion_rate
      FROM users u
      INNER JOIN workspace_members wm ON wm.user_id = u.id
      LEFT JOIN tasks t ON t.assignee_id = u.id
      WHERE wm.workspace_id = ${workspaceId}
        AND wm.is_accepted = true
      GROUP BY u.id, u.name
    )
    SELECT
      user_id AS "userId",
      user_name AS "userName",
      total_tasks::int AS "totalTasks",
      completed_tasks::int AS "completedTasks",
      completion_rate::float AS "completionRate",
      RANK() OVER (ORDER BY completion_rate DESC)::int AS rank,
      PERCENT_RANK() OVER (ORDER BY completion_rate DESC)::float AS percentile
    FROM user_stats
    ORDER BY completion_rate DESC
  `;
};
```

### 2.4 Full-Text Search (전문 검색)

```typescript
/**
 * 태스크 전문 검색
 *
 * @description
 * PostgreSQL Full-Text Search
 * - to_tsvector: 텍스트 → 검색 가능한 벡터 변환
 * - to_tsquery: 검색어 → 쿼리 변환
 * - ts_rank: 관련도 점수
 *
 * @index
 * CREATE INDEX idx_tasks_fts ON tasks
 * USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));
 */
interface TaskSearchResult {
  id: string;
  title: string;
  description: string;
  rank: number;
}

const searchTasks = async (
  projectId: string,
  searchQuery: string,
): Promise<TaskSearchResult[]> => {
  return await prisma.$queryRaw<TaskSearchResult[]>`
    SELECT
      id,
      title,
      description,
      ts_rank(
        to_tsvector('english', title || ' ' || COALESCE(description, '')),
        to_tsquery('english', ${searchQuery})
      ) AS rank
    FROM tasks
    WHERE project_id = ${projectId}
      AND to_tsvector('english', title || ' ' || COALESCE(description, ''))
          @@ to_tsquery('english', ${searchQuery})
    ORDER BY rank DESC
    LIMIT 50
  `;
};
```

### 2.5 Bulk Insert/Update

```typescript
/**
 * 대량 삽입 (Bulk Insert)
 *
 * @performance
 * - Prisma createMany: ~500ms (1000건)
 * - Raw SQL INSERT: ~50ms (1000건)
 *
 * @description
 * VALUES 절에 여러 행 삽입
 */
const bulkInsertTasks = async (
  tasks: Array<{ title: string; projectId: string }>,
): Promise<void> => {
  if (tasks.length === 0) return;

  // VALUES 생성: ($1, $2), ($3, $4), ...
  const values = tasks
    .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
    .join(', ');

  const params = tasks.flatMap((task) => [task.title, task.projectId]);

  await prisma.$executeRaw(
    Prisma.sql([
      `INSERT INTO tasks (title, project_id, status, priority, created_at, updated_at)
       VALUES ${values}
       ON CONFLICT DO NOTHING
      `,
      ...params,
    ]),
  );
};

/**
 * Bulk Update with CASE
 *
 * @description
 * 여러 행을 한 번에 업데이트
 */
const bulkUpdateTaskStatus = async (
  updates: Array<{ id: string; status: string }>,
): Promise<void> => {
  if (updates.length === 0) return;

  const ids = updates.map((u) => u.id);
  const caseStatements = updates
    .map((u) => `WHEN id = '${u.id}' THEN '${u.status}'`)
    .join(' ');

  await prisma.$executeRaw`
    UPDATE tasks
    SET status = (CASE ${Prisma.raw(caseStatements)} END),
        updated_at = NOW()
    WHERE id = ANY(${ids})
  `;
};
```

## 3. Kysely (타입 안전한 SQL 빌더)

### 3.1 동적 쿼리 구성

```typescript
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

// Kysely 인스턴스 (선택적)
const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});

/**
 * 동적 필터 쿼리
 *
 * @description
 * 검색 조건이 동적으로 변하는 경우
 * Prisma: 조건별로 where 객체 구성 (복잡)
 * Kysely: 체이닝으로 간단 + 타입 안전
 */
interface TaskFilter {
  status?: string[];
  priority?: string[];
  assigneeId?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
}

const findTasksWithDynamicFilter = async (filter: TaskFilter) => {
  let query = db.selectFrom('tasks').selectAll();

  if (filter.status && filter.status.length > 0) {
    query = query.where('status', 'in', filter.status);
  }

  if (filter.priority && filter.priority.length > 0) {
    query = query.where('priority', 'in', filter.priority);
  }

  if (filter.assigneeId) {
    query = query.where('assignee_id', '=', filter.assigneeId);
  }

  if (filter.dueDateFrom) {
    query = query.where('due_date', '>=', filter.dueDateFrom);
  }

  if (filter.dueDateTo) {
    query = query.where('due_date', '<=', filter.dueDateTo);
  }

  return await query.execute();
};
```

## 4. 트랜잭션 처리

### 4.1 Prisma 트랜잭션

```typescript
/**
 * Prisma 트랜잭션 (Interactive Transaction)
 *
 * @description
 * 여러 작업을 원자적으로 수행
 *
 * @timeout 기본 5초 (변경 가능)
 */
const transferProjectOwnership = async (
  projectId: string,
  newOwnerId: string,
) => {
  return await prisma.$transaction(
    async (tx) => {
      // 1. 프로젝트 소유자 변경
      const project = await tx.project.update({
        where: { id: projectId },
        data: { createdById: newOwnerId },
      });

      // 2. 기존 소유자 권한 변경
      await tx.workspaceMember.updateMany({
        where: {
          workspaceId: project.workspaceId,
          userId: project.createdById,
          role: 'OWNER',
        },
        data: { role: 'ADMIN' },
      });

      // 3. 새 소유자 권한 부여
      await tx.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId: project.workspaceId,
            userId: newOwnerId,
          },
        },
        data: { role: 'OWNER' },
      });

      return project;
    },
    {
      maxWait: 5000, // 최대 대기 시간
      timeout: 10000, // 최대 실행 시간
    },
  );
};
```

### 4.2 Raw SQL in Transaction

```typescript
/**
 * Raw SQL + Prisma 혼용 트랜잭션
 *
 * @description
 * 복잡한 쿼리는 Raw SQL, 단순한 작업은 Prisma
 */
const completeProjectWithStats = async (projectId: string) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Raw SQL: 통계 계산
    const stats = await tx.$queryRaw<{ total: number; completed: number }[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'DONE')::int AS completed
      FROM tasks
      WHERE project_id = ${projectId}
    `;

    const { total, completed } = stats[0];

    // 2. Prisma: 프로젝트 상태 업데이트
    const project = await tx.project.update({
      where: { id: projectId },
      data: {
        status: completed === total ? 'COMPLETED' : 'ACTIVE',
      },
    });

    return { project, stats: { total, completed } };
  });
};
```

## 5. 성능 최적화 가이드

### 5.1 인덱스 전략

```sql
-- 단일 컬럼 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- 복합 인덱스 (WHERE + ORDER BY)
CREATE INDEX idx_tasks_project_status_due ON tasks(project_id, status, due_date);

-- 부분 인덱스 (Partial Index)
CREATE INDEX idx_active_users ON users(id) WHERE is_active = true AND deleted_at IS NULL;

-- GIN 인덱스 (Full-Text Search)
CREATE INDEX idx_tasks_fts ON tasks USING GIN(
  to_tsvector('english', title || ' ' || COALESCE(description, ''))
);

-- JSONB 인덱스 (향후 확장)
CREATE INDEX idx_metadata_gin ON some_table USING GIN(metadata);
```

### 5.2 쿼리 성능 분석

```typescript
/**
 * 쿼리 성능 측정
 *
 * @description
 * EXPLAIN ANALYZE로 실행 계획 확인
 */
const analyzeQuery = async () => {
  const result = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT * FROM users WHERE email = 'test@example.com'
  `);

  console.log(JSON.stringify(result, null, 2));

  // 확인 사항:
  // - Seq Scan (❌) vs Index Scan (✅)
  // - Execution Time
  // - Buffers (shared hit/read)
};
```

## 6. 컨벤션 요약

### ✅ DO (권장 사항)

- **Prisma 사용**: 단순 CRUD, 1-2개 테이블 조인
- **Raw SQL 사용**: 3개 이상 조인, 집계/분석, 대량 작업
- **파라미터 바인딩**: SQL Injection 방지 필수
- **AS 별칭**: snake_case → camelCase 변환
- **트랜잭션**: 일관성이 필요한 작업
- **인덱스**: WHERE, JOIN, ORDER BY 컬럼
- **EXPLAIN**: 성능 문제 시 실행 계획 확인

### ❌ DON'T (금지 사항)

- ❌ 문자열 concatenation으로 SQL 구성
- ❌ Prisma로 복잡한 집계 (성능 저하)
- ❌ N+1 문제 무시
- ❌ SELECT * (필요한 컬럼만 조회)
- ❌ 인덱스 없이 대량 데이터 조회
- ❌ 트랜잭션 내 외부 API 호출

## 7. 예제 코드 위치

- **Prisma 예제**: `apps/api/src/modules/user/infrastructure/persistence/prisma/user.repository.ts`
- **Raw SQL 예제**: `apps/api/src/modules/project/infrastructure/persistence/project-analytics.repository.ts`
- **Kysely 예제**: `apps/api/src/shared/database/kysely-query.builder.ts`

---

**마지막 업데이트**: 2025-12-05
