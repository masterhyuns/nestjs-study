# 엔터프라이즈 협업 플랫폼

> NestJS 기반 엔터프라이즈급 백엔드 아키텍처
> Prisma ORM + Raw SQL 하이브리드 전략

## ✨ 주요 특징

- ✅ **DDD + Clean Architecture**: 도메인 중심 설계, 확장 가능한 구조
- ✅ **Prisma ORM + Raw SQL**: 타입 안전성 + 성능 최적화 병행
- ✅ **상세한 주석**: 모든 코드에 JSDoc 주석 (비즈니스 로직, 성능, 확장성)
- ✅ **명확한 컨벤션**: 파일 명명, 코드 스타일, Git Commit 규칙
- ✅ **모노레포**: Turborepo로 확장 가능한 구조
- ✅ **Work/ERP 대비**: 멀티 테넌시, 워크플로우 엔진 준비

## 🏗️ 아키텍처

### 기술 스택

```yaml
Backend:
  Framework: NestJS 10+
  Language: TypeScript 5.3+ (strict mode)
  Runtime: Node.js 20 LTS

Database:
  Primary: PostgreSQL 16
  ORM: Prisma 5+ (타입 안전성)
  Raw SQL: 복잡한 쿼리, 성능 최적화

Cache & Queue:
  Cache: Redis 7
  Queue: BullMQ (향후)

Storage:
  Files: MinIO (S3 호환)

Auth:
  Strategy: Passport.js (JWT, OAuth2)

Monitoring:
  Logging: Winston
  APM: Sentry (향후)

Monorepo:
  Tool: Turborepo 2.0
  Package Manager: pnpm 9.0+
```

### 디자인 패턴

- **DDD (Domain-Driven Design)**: Bounded Context, Aggregate, Repository
- **Clean Architecture**: 도메인 → 애플리케이션 → 인프라 → 프레젠테이션 계층 분리
- **CQRS**: Command/Query 분리 (향후)
- **Event-Driven**: 도메인 이벤트 (향후)

## 📂 프로젝트 구조

```
fullstack-nextjs/
├── apps/
│   └── api/                    # NestJS API 서버
│       ├── src/
│       │   ├── modules/        # 비즈니스 모듈 (DDD)
│       │   │   └── user/
│       │   │       ├── domain/              # 도메인 계층
│       │   │       ├── application/         # 애플리케이션 계층
│       │   │       ├── infrastructure/      # 인프라 계층
│       │   │       ├── presentation/        # 프레젠테이션 계층
│       │   │       └── types.ts             # 타입 정의
│       │   ├── shared/         # 공통 모듈
│       │   │   └── database/
│       │   │       ├── prisma.service.ts
│       │   │       └── database.module.ts
│       │   └── common/         # 유틸리티
│       └── prisma/
│           └── schema.prisma   # DB 스키마
│
├── packages/
│   └── types/                  # 공통 TypeScript 타입
│       └── src/
│           ├── user/
│           └── common/
│
├── docs/
│   └── guides/
│       ├── getting-started.md           # 시작 가이드
│       ├── conventions.md               # 개발 컨벤션
│       └── database-query-guide.md      # 쿼리 작성 가이드 ⭐
│
├── infrastructure/
│   └── docker/
│       └── postgres/
│
├── docker-compose.yml          # PostgreSQL, Redis, MinIO
├── turbo.json                  # Turborepo 설정
└── pnpm-workspace.yaml         # pnpm 워크스페이스
```

## 🚀 빠른 시작

### 사전 요구사항

- **Node.js**: 20.0.0 이상
- **pnpm**: 9.0.0 이상
  ```bash
  npm install -g pnpm
  ```
- **Docker**: 최신 버전
- **Docker Compose**: 최신 버전

### 설치 및 실행

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경 변수 설정
cp .env.example apps/api/.env

# 3. Docker 컨테이너 시작 (PostgreSQL, Redis, MinIO)
docker-compose up -d

# 4. Prisma 설정
cd apps/api
pnpm prisma generate
pnpm prisma migrate dev

# 5. 개발 서버 시작
cd ../..
pnpm dev
```

### 접속 정보

| 서비스 | URL | 설명 |
|--------|-----|------|
| **API 서버** | http://localhost:3000/api/v1 | REST API |
| **API 문서** | http://localhost:3000/api/v1/docs | Swagger UI |
| **헬스 체크** | http://localhost:3000/api/v1/health | 상태 확인 |
| **Prisma Studio** | http://localhost:5555 | DB GUI |
| **pgAdmin** | http://localhost:5050 | PostgreSQL 관리 |
| **MinIO Console** | http://localhost:9001 | 파일 스토리지 |

## 💡 핵심 가이드

### 1. 데이터베이스 쿼리 전략 (⭐ 중요)

#### Prisma vs Raw SQL 선택 기준

| 상황 | 사용 도구 | 이유 |
|------|----------|------|
| **단순 CRUD** | Prisma ORM | 타입 안전성, 생산성 |
| **단순 JOIN (1-2개)** | Prisma ORM | 관계 자동 해결 |
| **복잡한 JOIN (3개 이상)** | Raw SQL | 성능, 명확성 |
| **집계/분석** | Raw SQL | Window Function, CTE |
| **대량 작업** | Raw SQL | Bulk Insert/Update |
| **동적 필터** | Kysely | 타입 안전 유지 |

#### 예제 코드

```typescript
// ✅ Prisma 사용 (단순 조회)
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true },
});

// ✅ Raw SQL 사용 (복잡한 집계)
const stats = await prisma.$queryRaw<UserStatistics[]>`
  WITH user_tasks AS (
    SELECT
      u.id,
      COUNT(t.id) AS total_tasks,
      AVG(t.completion_time) AS avg_time
    FROM users u
    LEFT JOIN tasks t ON t.assignee_id = u.id
    GROUP BY u.id
  )
  SELECT * FROM user_tasks
`;
```

**📖 상세 가이드**: [데이터베이스 쿼리 가이드](./docs/guides/database-query-guide.md)

### 2. 개발 컨벤션

#### 파일 명명 규칙

```
✅ 올바른 예:
- user.controller.ts
- user.service.ts
- user.repository.ts
- create-user.dto.ts
- types.ts

❌ 잘못된 예:
- UserController.ts
- CreateUserDTO.ts
```

#### 함수 스타일

```typescript
// ✅ 올바른 예 (화살표 함수)
export const createUser = async (data: CreateUserDto): Promise<User> => {
  // 구현...
};

// ❌ 잘못된 예 (일반 function)
export async function createUser(data: CreateUserDto): Promise<User> {
  // ...
}
```

#### Git Commit Convention

```bash
# 형식: type(scope): 제목
feat(user): 사용자 프로필 편집 기능 추가
fix(auth): JWT 토큰 갱신 오류 수정
refactor(db): 리포지토리 패턴 적용
perf(query): 사용자 통계 쿼리 최적화 (Raw SQL)
docs(api): Swagger 문서 업데이트
test(user): 사용자 서비스 단위 테스트 추가

# ❌ Claude Code 정보 제외 (AI 생성 정보 커밋 금지)
```

**📖 상세 가이드**: [개발 컨벤션](./docs/guides/conventions.md)

### 3. 주석 작성 규칙

모든 public 함수/클래스에 JSDoc 필수:

```typescript
/**
 * 사용자 통계 조회 (워크스페이스별)
 *
 * @description
 * 4개 테이블 조인 + 복잡한 집계
 * Prisma로 구현 시 여러 쿼리 필요 → Raw SQL 사용
 *
 * @method Raw SQL
 * @reason 복잡한 JOIN, Window Function, 성능 최적화
 *
 * @performance
 * - Prisma (여러 쿼리): ~300ms
 * - Raw SQL (단일 쿼리): ~80ms
 *
 * @scalability
 * - Work/ERP 확장: 워크플로우 통계 추가 가능
 *
 * @param workspaceId - 워크스페이스 ID
 * @returns 사용자 통계 배열
 *
 * @example
 * ```typescript
 * const stats = await userRepository.getUserStatistics('workspace-id');
 * ```
 */
async getUserStatistics(workspaceId: string): Promise<UserStatistics[]> {
  // 구현...
}
```

## 🛠️ 개발 명령어

```bash
# 개발
pnpm dev              # 개발 서버 (Hot Reload)
pnpm build            # 프로덕션 빌드

# 테스트
pnpm test             # 단위 테스트
pnpm test:e2e         # E2E 테스트
pnpm test:cov         # 커버리지

# 코드 품질
pnpm lint             # ESLint 검사
pnpm format           # Prettier 포맷팅

# 데이터베이스
pnpm db:migrate       # Prisma 마이그레이션
pnpm db:seed          # 시드 데이터
pnpm db:studio        # Prisma Studio (DB GUI)
```

## 📚 문서

| 문서 | 설명 |
|------|------|
| **[시작 가이드](./docs/guides/getting-started.md)** | 프로젝트 설치 및 실행 |
| **[개발 컨벤션](./docs/guides/conventions.md)** | 코드 스타일, 명명 규칙, Git Commit |
| **[데이터베이스 쿼리 가이드](./docs/guides/database-query-guide.md)** ⭐ | Prisma vs Raw SQL 선택 기준, 예제 |
| **[API 문서](http://localhost:3000/api/v1/docs)** | Swagger UI (dev 환경) |

## 🔧 기술적 특징

### 1. Prisma + Raw SQL 하이브리드

- **Prisma ORM**: 단순 CRUD, 타입 안전성
- **Raw SQL**: 복잡한 JOIN, 집계, 성능 최적화
- **트랜잭션**: 두 방식 혼용 가능

**예제**: [user.repository.ts](./apps/api/src/modules/user/infrastructure/persistence/user.repository.ts)

### 2. DDD + Clean Architecture

- **Domain Layer**: 비즈니스 로직, 엔티티, 리포지토리 인터페이스
- **Application Layer**: 유스케이스, Commands, Queries (CQRS)
- **Infrastructure Layer**: 리포지토리 구현, 외부 서비스 연동
- **Presentation Layer**: Controller, DTO, Validators

### 3. 모노레포 구조

- **Turborepo**: 빌드 캐싱, 병렬 실행
- **pnpm Workspaces**: 패키지 공유
- **공통 패키지**: @repo/types, @repo/shared

## 🚀 향후 확장 계획

### Phase 1 (현재)
- ✅ 기본 인프라 (Prisma, Docker, Turborepo)
- ✅ 데이터베이스 쿼리 전략 (ORM + Raw SQL)
- ✅ 개발 컨벤션 문서화

### Phase 2 (진행 중)
- ⏳ 인증 시스템 (JWT, Passport)
- ⏳ 사용자 모듈 (DDD 패턴)
- ⏳ API 문서 자동화 (Swagger)

### Phase 3 (계획)
- 📋 워크스페이스, 프로젝트, 태스크 모듈
- 📋 실시간 알림 (WebSocket)
- 📋 파일 업로드 (MinIO)

### Phase 4 (Work/ERP 확장)
- 📋 워크플로우 엔진
- 📋 리포팅 시스템
- 📋 외부 연동 (SSO, Webhook)

## 🤝 기여 가이드

1. 컨벤션 문서 숙지: [개발 컨벤션](./docs/guides/conventions.md)
2. 쿼리 가이드 참고: [데이터베이스 쿼리 가이드](./docs/guides/database-query-guide.md)
3. Git Commit Convention 준수
4. PR 생성 전 테스트 및 린트 통과

## 📝 라이선스

Proprietary

---

**마지막 업데이트**: 2025-12-05
**버전**: 1.0.0
