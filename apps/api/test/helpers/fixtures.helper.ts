/**
 * 테스트 Fixture 헬퍼
 *
 * @description
 * 테스트에서 자주 사용하는 데이터 객체를 쉽게 생성하는 Factory 함수들
 *
 * @why-fixtures
 * Fixture를 사용하는 이유:
 * 1. **DRY 원칙**: 테스트마다 동일한 데이터 객체 생성 방지
 * 2. **일관성**: 모든 테스트에서 동일한 형식의 데이터 사용
 * 3. **유지보수**: 데이터 구조 변경 시 한 곳만 수정
 * 4. **가독성**: createUser() > { id: '1', email: '...', ...}
 *
 * @architecture-decision
 * Builder Pattern vs Factory Function:
 * - ❌ Builder: user().withEmail('...').withName('...').build()
 *   - 장점: 유연함, 메서드 체이닝
 *   - 단점: 코드 길어짐, 복잡함
 * - ✅ Factory Function: createUser({ email: '...' })
 *   - 장점: 간결함, 직관적
 *   - 단점: 복잡한 객체 생성 시 제한적
 *
 * @performance
 * - Fixture 생성은 메모리에서만 동작 (DB 접근 없음)
 * - 테스트당 수백 개 Fixture 생성해도 밀리초 이내
 *
 * @testing-strategy
 * - Unit Test: Fixture만 사용 (DB 없이 빠르게)
 * - Integration Test: Fixture + 실제 DB INSERT
 * - E2E Test: 실제 API 호출 + DB 검증
 */

import { User, Workspace, Project, Task, UserRole, MemberRole, ProjectStatus, TaskStatus, TaskPriority } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Partial 타입을 통한 선택적 필드 덮어쓰기
 *
 * @why-partial
 * - 테스트마다 필요한 필드만 커스터마이징
 * - 나머지 필드는 기본값 사용
 *
 * @example
 * const user = createUser({ email: 'custom@example.com' });
 * // id, name, password 등은 기본값 사용
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// User Fixtures
// ============================================================================

/**
 * 테스트용 User 객체 생성
 *
 * @why-default-values
 * - 대부분의 테스트에서 필요한 최소 필드만 설정
 * - 특정 테스트에서만 필요한 필드는 인자로 덮어쓰기
 *
 * @usage
 * ```typescript
 * // 기본 사용자
 * const user = createUser();
 *
 * // 이메일만 커스텀
 * const user = createUser({ email: 'admin@example.com' });
 *
 * // 여러 필드 커스텀
 * const user = createUser({
 *   email: 'admin@example.com',
 *   role: UserRole.ADMIN,
 *   name: 'Admin User',
 * });
 * ```
 */
export const createUser = (overrides?: DeepPartial<User>): User => {
  const now = new Date();

  return {
    id: randomUUID(),
    email: `test-${Date.now()}@example.com`,
    password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7eqvp7vWLy', // "password123"
    name: 'Test User',
    phoneNumber: null,
    role: UserRole.USER,
    isEmailVerified: false,
    emailVerifiedAt: null,
    marketingConsent: false,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

/**
 * Admin 사용자 생성
 *
 * @why-specific-fixtures
 * - 자주 사용하는 특정 타입의 사용자 간편 생성
 * - 권한 관련 테스트에서 유용
 */
export const createAdminUser = (overrides?: DeepPartial<User>): User => {
  return createUser({
    role: UserRole.ADMIN,
    name: 'Admin User',
    email: `admin-${Date.now()}@example.com`,
    ...overrides,
  });
};

/**
 * 이메일 인증된 사용자 생성
 *
 * @why
 * 일부 기능은 이메일 인증 필수
 */
export const createVerifiedUser = (overrides?: DeepPartial<User>): User => {
  return createUser({
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    ...overrides,
  });
};

/**
 * 여러 사용자 생성
 *
 * @why-bulk-creation
 * - 목록 조회 테스트
 * - 페이지네이션 테스트
 * - 검색 테스트
 *
 * @usage
 * ```typescript
 * const users = createUsers(10);
 * expect(users).toHaveLength(10);
 * ```
 */
export const createUsers = (count: number, overrides?: DeepPartial<User>): User[] => {
  return Array.from({ length: count }, (_, i) =>
    createUser({
      email: `test-user-${i}@example.com`,
      name: `Test User ${i}`,
      ...overrides,
    }),
  );
};

// ============================================================================
// Workspace Fixtures
// ============================================================================

/**
 * 테스트용 Workspace 객체 생성
 *
 * @why-workspace
 * 협업 플랫폼의 핵심 도메인
 * - 대부분의 기능이 workspace 내에서 동작
 * - 권한 관리의 기준 (workspace member)
 *
 * @usage
 * ```typescript
 * const workspace = createWorkspace({ ownerId: user.id });
 * ```
 */
export const createWorkspace = (overrides?: DeepPartial<Workspace>): Workspace => {
  const now = new Date();

  return {
    id: randomUUID(),
    name: `Test Workspace ${Date.now()}`,
    slug: `test-workspace-${Date.now()}`,
    description: 'Test workspace for unit testing',
    ownerId: randomUUID(), // 실제 테스트에서는 createUser().id 사용
    settings: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

/**
 * 여러 workspace 생성
 */
export const createWorkspaces = (count: number, overrides?: DeepPartial<Workspace>): Workspace[] => {
  return Array.from({ length: count }, (_, i) =>
    createWorkspace({
      name: `Test Workspace ${i}`,
      slug: `test-workspace-${i}-${Date.now()}`,
      ...overrides,
    }),
  );
};

// ============================================================================
// Project Fixtures
// ============================================================================

/**
 * 테스트용 Project 객체 생성
 *
 * @why-project
 * - Workspace 내 주요 작업 단위
 * - Task의 상위 개념
 * - 상태 관리 (진행중, 완료 등)
 *
 * @usage
 * ```typescript
 * const project = createProject({
 *   workspaceId: workspace.id,
 *   ownerId: user.id,
 * });
 * ```
 */
export const createProject = (overrides?: DeepPartial<Project>): Project => {
  const now = new Date();

  return {
    id: randomUUID(),
    name: `Test Project ${Date.now()}`,
    description: 'Test project for unit testing',
    workspaceId: randomUUID(), // 실제 테스트에서는 createWorkspace().id 사용
    ownerId: randomUUID(), // 실제 테스트에서는 createUser().id 사용
    status: ProjectStatus.IN_PROGRESS,
    startDate: now,
    dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30일 후
    completedAt: null,
    settings: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

/**
 * 완료된 프로젝트 생성
 *
 * @why
 * - 프로젝트 완료 로직 테스트
 * - 통계 집계 테스트
 */
export const createCompletedProject = (overrides?: DeepPartial<Project>): Project => {
  return createProject({
    status: ProjectStatus.COMPLETED,
    completedAt: new Date(),
    ...overrides,
  });
};

/**
 * 여러 프로젝트 생성
 */
export const createProjects = (count: number, overrides?: DeepPartial<Project>): Project[] => {
  return Array.from({ length: count }, (_, i) =>
    createProject({
      name: `Test Project ${i}`,
      ...overrides,
    }),
  );
};

// ============================================================================
// Task Fixtures
// ============================================================================

/**
 * 테스트용 Task 객체 생성
 *
 * @why-task
 * - 가장 세부적인 작업 단위
 * - 할당자, 우선순위, 마감일 등 복잡한 필드
 * - Work/ERP 확장 시 워크플로우 엔진과 통합
 *
 * @usage
 * ```typescript
 * const task = createTask({
 *   projectId: project.id,
 *   createdById: user.id,
 *   assigneeId: user.id,
 * });
 * ```
 */
export const createTask = (overrides?: DeepPartial<Task>): Task => {
  const now = new Date();

  return {
    id: randomUUID(),
    title: `Test Task ${Date.now()}`,
    description: 'Test task for unit testing',
    projectId: randomUUID(), // 실제 테스트에서는 createProject().id 사용
    createdById: randomUUID(), // 실제 테스트에서는 createUser().id 사용
    assigneeId: null,
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7일 후
    startedAt: null,
    completedAt: null,
    order: 0,
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

/**
 * 할당된 태스크 생성
 *
 * @why
 * - 태스크 할당 로직 테스트
 * - 사용자별 태스크 조회 테스트
 */
export const createAssignedTask = (assigneeId: string, overrides?: DeepPartial<Task>): Task => {
  return createTask({
    assigneeId,
    status: TaskStatus.IN_PROGRESS,
    startedAt: new Date(),
    ...overrides,
  });
};

/**
 * 완료된 태스크 생성
 *
 * @why
 * - 태스크 완료 로직 테스트
 * - 진행률 계산 테스트
 */
export const createCompletedTask = (overrides?: DeepPartial<Task>): Task => {
  const completedAt = new Date();
  return createTask({
    status: TaskStatus.DONE,
    startedAt: new Date(completedAt.getTime() - 24 * 60 * 60 * 1000), // 1일 전 시작
    completedAt,
    ...overrides,
  });
};

/**
 * 우선순위 높은 태스크 생성
 *
 * @why
 * - 우선순위 정렬 테스트
 * - 알림 발송 테스트 (긴급 태스크)
 */
export const createHighPriorityTask = (overrides?: DeepPartial<Task>): Task => {
  return createTask({
    priority: TaskPriority.HIGH,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1일 후 (긴급)
    ...overrides,
  });
};

/**
 * 여러 태스크 생성
 */
export const createTasks = (count: number, overrides?: DeepPartial<Task>): Task[] => {
  return Array.from({ length: count }, (_, i) =>
    createTask({
      title: `Test Task ${i}`,
      order: i,
      ...overrides,
    }),
  );
};

// ============================================================================
// DTO Fixtures (API Request)
// ============================================================================

/**
 * CreateUserDto Fixture
 *
 * @why-dto-fixtures
 * - API 요청 테스트에서 사용
 * - Validation 테스트
 * - E2E 테스트
 *
 * @usage
 * ```typescript
 * const dto = createUserDto();
 * const response = await request(app.getHttpServer())
 *   .post('/api/v1/users/register')
 *   .send(dto);
 * ```
 */
export const createUserDto = (overrides?: any) => {
  return {
    email: `test-${Date.now()}@example.com`,
    password: 'Test@1234',
    passwordConfirm: 'Test@1234',
    name: 'Test User',
    phoneNumber: '010-1234-5678',
    marketingConsent: false,
    ...overrides,
  };
};

/**
 * 유효하지 않은 CreateUserDto Fixture
 *
 * @why-invalid-fixtures
 * - Validation 에러 테스트
 * - 에러 메시지 검증
 *
 * @usage
 * ```typescript
 * const dto = createInvalidUserDto({ email: 'invalid-email' });
 * await expect(service.create(dto)).rejects.toThrow();
 * ```
 */
export const createInvalidUserDto = (overrides?: any) => {
  return {
    email: 'invalid-email', // 잘못된 이메일 형식
    password: '123', // 너무 짧은 비밀번호
    passwordConfirm: '456', // 비밀번호 불일치
    name: 'A', // 너무 짧은 이름
    phoneNumber: '123', // 잘못된 전화번호
    ...overrides,
  };
};

/**
 * CreateWorkspaceDto Fixture
 */
export const createWorkspaceDto = (overrides?: any) => {
  return {
    name: `Test Workspace ${Date.now()}`,
    slug: `test-workspace-${Date.now()}`,
    description: 'Test workspace description',
    ...overrides,
  };
};

/**
 * CreateProjectDto Fixture
 */
export const createProjectDto = (overrides?: any) => {
  const now = new Date();
  return {
    name: `Test Project ${Date.now()}`,
    description: 'Test project description',
    startDate: now.toISOString(),
    dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
};

/**
 * CreateTaskDto Fixture
 */
export const createTaskDto = (overrides?: any) => {
  const now = new Date();
  return {
    title: `Test Task ${Date.now()}`,
    description: 'Test task description',
    priority: TaskPriority.MEDIUM,
    dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    tags: [],
    ...overrides,
  };
};

// ============================================================================
// Work/ERP 확장 대비
// ============================================================================

/**
 * 마이크로서비스 확장 시 고려사항
 *
 * @scalability
 * 1. 서비스별 Fixture 분리:
 *    - packages/test-utils/fixtures/user.fixtures.ts
 *    - packages/test-utils/fixtures/project.fixtures.ts
 *    - packages/test-utils/fixtures/erp.fixtures.ts
 *
 * 2. Domain-Specific Fixtures:
 *    - ERP: createInvoice(), createPurchaseOrder()
 *    - HR: createEmployee(), createPayroll()
 *    - Accounting: createAccount(), createTransaction()
 *
 * 3. Fixture Factory 패턴:
 *    - 복잡한 객체 그래프 생성
 *    - 연관 객체 자동 생성
 *    ```typescript
 *    const { workspace, owner, members, projects } = createWorkspaceWithTeam({
 *      memberCount: 5,
 *      projectCount: 3,
 *    });
 *    ```
 *
 * 4. Fixture 데이터베이스 Seeding:
 *    - Integration/E2E 테스트 전 DB에 Fixture 삽입
 *    - 트랜잭션 롤백으로 테스트 후 정리
 *    ```typescript
 *    beforeAll(async () => {
 *      await seedDatabase(fixtures);
 *    });
 *    ```
 */

/**
 * 복잡한 객체 그래프 생성 예제
 *
 * @why-complex-fixtures
 * - 실제 사용 시나리오 재현
 * - 통합 테스트에서 유용
 * - 연관 관계 검증
 *
 * @usage
 * ```typescript
 * const scenario = createWorkspaceScenario();
 * // workspace, owner, members, projects, tasks 모두 생성됨
 * ```
 */
export const createWorkspaceScenario = () => {
  const owner = createUser({ email: 'owner@example.com' });
  const workspace = createWorkspace({ ownerId: owner.id });
  const members = createUsers(3).map((user, i) => ({
    ...user,
    email: `member-${i}@example.com`,
  }));

  const projects = createProjects(2, { workspaceId: workspace.id, ownerId: owner.id });

  const tasks = projects.flatMap((project, i) =>
    createTasks(3, {
      projectId: project.id,
      createdById: owner.id,
      assigneeId: members[i % members.length].id,
    }),
  );

  return {
    owner,
    workspace,
    members,
    projects,
    tasks,
  };
};
