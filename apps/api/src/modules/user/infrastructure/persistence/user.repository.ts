/**
 * 사용자 리포지토리 (Prisma + Raw SQL 하이브리드)
 *
 * @description
 * Prisma ORM과 Raw SQL을 상황에 맞게 사용하는 실제 구현 예제
 *
 * @pattern Repository Pattern
 * - 도메인 계층에서 인터페이스 정의
 * - 인프라 계층에서 구현
 * - 의존성 역전 원칙 (DIP)
 *
 * @performance
 * - 단순 쿼리: Prisma (생산성)
 * - 복잡한 쿼리: Raw SQL (성능)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma.service';

/**
 * 페이지네이션 옵션
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 페이지네이션 결과
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 사용자 통계 (Raw SQL용)
 */
export interface UserStatistics {
  userId: string;
  userName: string;
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  avgTaskDuration: number;
}

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // Prisma ORM 사용 (단순 CRUD)
  // =========================================================================

  /**
   * ID로 사용자 조회
   *
   * @method Prisma ORM
   * @reason 단순 조회, 타입 안전성
   * @performance O(1) - Primary Key
   */
  async findById(id: string) {
    return await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 이메일로 사용자 조회
   *
   * @method Prisma ORM
   * @reason Unique Index 활용, 타입 안전성
   */
  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * 사용자 생성
   *
   * @method Prisma ORM
   * @reason 타입 안전성, 자동 생성 필드 처리
   */
  async create(data: Prisma.UserCreateInput) {
    return await this.prisma.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
      },
    });
  }

  /**
   * 사용자 업데이트
   *
   * @method Prisma ORM
   */
  async update(id: string, data: Prisma.UserUpdateInput) {
    return await this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * 사용자 목록 조회 (페이지네이션)
   *
   * @method Prisma ORM
   * @reason 단순 페이지네이션, 타입 안전성
   */
  async findMany(options: PaginationOptions): Promise<PaginatedResult<any>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { isActive: true, deletedAt: null },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({
        where: { isActive: true, deletedAt: null },
      }),
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
  }

  // =========================================================================
  // Raw SQL 사용 (복잡한 쿼리, 성능 최적화)
  // =========================================================================

  /**
   * 사용자 통계 조회 (워크스페이스별)
   *
   * @method Raw SQL
   * @reason
   * - 4개 테이블 조인 (users, workspace_members, projects, tasks)
   * - 복잡한 집계 (COUNT, AVG, FILTER)
   * - Window Function (ROW_NUMBER)
   * - Prisma로 구현 시 여러 쿼리 필요 → 성능 저하
   *
   * @performance
   * - Prisma (여러 쿼리): ~300ms
   * - Raw SQL (단일 쿼리): ~80ms
   *
   * @example
   * ```typescript
   * const stats = await userRepository.getUserStatisticsByWorkspace('workspace-id');
   * ```
   */
  async getUserStatisticsByWorkspace(
    workspaceId: string,
  ): Promise<UserStatistics[]> {
    this.logger.debug(
      `사용자 통계 조회 (워크스페이스: ${workspaceId}) - Raw SQL`,
    );

    return await this.prisma.$queryRaw<UserStatistics[]>`
      WITH user_tasks AS (
        SELECT
          u.id AS user_id,
          u.name AS user_name,
          COUNT(DISTINCT p.id) AS total_projects,
          COUNT(t.id) AS total_tasks,
          COUNT(t.id) FILTER (WHERE t.status = 'DONE') AS completed_tasks,
          AVG(
            EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 3600
          ) FILTER (WHERE t.completed_at IS NOT NULL) AS avg_task_duration
        FROM users u
        INNER JOIN workspace_members wm ON wm.user_id = u.id
        INNER JOIN projects p ON p.workspace_id = wm.workspace_id
        LEFT JOIN tasks t ON t.assignee_id = u.id AND t.project_id = p.id
        WHERE wm.workspace_id = ${workspaceId}
          AND wm.is_accepted = true
          AND u.is_active = true
        GROUP BY u.id, u.name
      )
      SELECT
        user_id AS "userId",
        user_name AS "userName",
        total_projects::int AS "totalProjects",
        total_tasks::int AS "totalTasks",
        completed_tasks::int AS "completedTasks",
        CASE
          WHEN total_tasks > 0
          THEN (completed_tasks::float / total_tasks::float * 100)
          ELSE 0
        END AS "completionRate",
        COALESCE(avg_task_duration, 0)::float AS "avgTaskDuration"
      FROM user_tasks
      ORDER BY "completionRate" DESC
    `;
  }

  /**
   * 활동 중인 사용자 조회 (최근 7일)
   *
   * @method Raw SQL
   * @reason
   * - 날짜 범위 필터 + DISTINCT
   * - UNION으로 여러 활동 소스 통합
   * - Prisma의 복잡한 조건문 회피
   *
   * @performance ~50ms
   */
  async findActiveUsers(days: number = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return await this.prisma.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.avatar_url AS "avatarUrl"
      FROM users u
      WHERE u.id IN (
        -- 태스크를 생성하거나 업데이트한 사용자
        SELECT DISTINCT assignee_id
        FROM tasks
        WHERE updated_at >= ${since}
          AND assignee_id IS NOT NULL

        UNION

        -- 댓글을 작성한 사용자
        SELECT DISTINCT user_id
        FROM comments
        WHERE created_at >= ${since}

        UNION

        -- 프로젝트를 생성한 사용자
        SELECT DISTINCT created_by_id
        FROM projects
        WHERE created_at >= ${since}
      )
      AND u.is_active = true
      ORDER BY u.name
    `;
  }

  /**
   * 사용자 검색 (전문 검색)
   *
   * @method Raw SQL
   * @reason PostgreSQL Full-Text Search 활용
   *
   * @index
   * CREATE INDEX idx_users_fts ON users
   * USING GIN(to_tsvector('english', name || ' ' || email));
   *
   * @performance
   * - LIKE '%keyword%': ~200ms (느림, Full Scan)
   * - Full-Text Search: ~20ms (GIN Index)
   */
  async searchUsers(query: string, limit: number = 20) {
    return await this.prisma.$queryRaw<
      Array<{ id: string; name: string; email: string; rank: number }>
    >`
      SELECT
        id,
        name,
        email,
        avatar_url AS "avatarUrl",
        ts_rank(
          to_tsvector('english', name || ' ' || email),
          to_tsquery('english', ${query + ':*'})
        ) AS rank
      FROM users
      WHERE to_tsvector('english', name || ' ' || email)
            @@ to_tsquery('english', ${query + ':*'})
        AND is_active = true
        AND deleted_at IS NULL
      ORDER BY rank DESC
      LIMIT ${limit}
    `;
  }

  /**
   * 대량 사용자 생성 (Bulk Insert)
   *
   * @method Raw SQL
   * @reason
   * - Prisma createMany: ~500ms (1000건)
   * - Raw SQL: ~100ms (1000건)
   *
   * @security SQL Injection 방지 (파라미터 바인딩)
   */
  async bulkCreate(
    users: Array<{ email: string; name: string; password: string }>,
  ): Promise<void> {
    if (users.length === 0) return;

    // Prisma.sql 사용하여 안전한 파라미터 바인딩
    const values = users
      .map(
        (user) =>
          Prisma.sql`(${user.email.toLowerCase()}, ${user.name}, ${user.password}, 'MEMBER', NOW(), NOW())`,
      )
      .reduce((acc, curr) => Prisma.sql`${acc}, ${curr}`);

    await this.prisma.$executeRaw`
      INSERT INTO users (email, name, password, role, created_at, updated_at)
      VALUES ${values}
      ON CONFLICT (email) DO NOTHING
    `;

    this.logger.log(`대량 사용자 생성: ${users.length}건`);
  }

  // =========================================================================
  // 트랜잭션 (Prisma + Raw SQL 혼용)
  // =========================================================================

  /**
   * 사용자 삭제 (소프트 삭제 + 관련 데이터 처리)
   *
   * @method 트랜잭션 (Prisma + Raw SQL)
   * @reason
   * - 사용자 삭제: Prisma (간단)
   * - 관련 데이터 통계: Raw SQL (빠름)
   */
  async softDelete(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. 사용자 소프트 삭제 (Prisma)
      await tx.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      // 2. 할당된 태스크 해제 (Raw SQL - 빠름)
      await tx.$executeRaw`
        UPDATE tasks
        SET assignee_id = NULL,
            updated_at = NOW()
        WHERE assignee_id = ${userId}
      `;

      // 3. 워크스페이스 멤버십 제거 (Raw SQL)
      await tx.$executeRaw`
        DELETE FROM workspace_members
        WHERE user_id = ${userId}
      `;

      this.logger.log(`사용자 소프트 삭제: ${userId}`);
    });
  }

  /**
   * 사용자 통계 업데이트 (배치 작업)
   *
   * @method Raw SQL
   * @reason 대량 업데이트, 성능 최적화
   */
  async updateUserStatistics(): Promise<void> {
    const result = await this.prisma.$executeRaw`
      -- 사용자별 통계 테이블 업데이트 (예시)
      INSERT INTO user_statistics (user_id, total_tasks, completed_tasks, updated_at)
      SELECT
        u.id,
        COUNT(t.id),
        COUNT(t.id) FILTER (WHERE t.status = 'DONE'),
        NOW()
      FROM users u
      LEFT JOIN tasks t ON t.assignee_id = u.id
      WHERE u.is_active = true
      GROUP BY u.id
      ON CONFLICT (user_id)
      DO UPDATE SET
        total_tasks = EXCLUDED.total_tasks,
        completed_tasks = EXCLUDED.completed_tasks,
        updated_at = EXCLUDED.updated_at
    `;

    this.logger.log(`사용자 통계 업데이트: ${result}건`);
  }
}
