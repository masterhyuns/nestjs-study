/**
 * Prisma Mock 헬퍼
 *
 * @description
 * 테스트에서 실제 데이터베이스 없이 Prisma를 사용할 수 있게 하는 Mock 객체
 *
 * @why-mock-prisma
 * Prisma를 Mock하는 이유:
 * 1. **속도**: 실제 DB 연결 없이 메모리에서 테스트 (10-100배 빠름)
 * 2. **격리**: 테스트 간 독립성 보장 (DB 상태에 영향 없음)
 * 3. **간편함**: 테스트 데이터베이스 셋업/클린업 불필요
 * 4. **CI 효율**: Docker DB 없이도 테스트 실행 가능
 *
 * @when-to-use-real-db
 * Integration 테스트에서는 실제 DB 사용:
 * - 복잡한 쿼리 (JOIN, aggregation)
 * - 트랜잭션 동작 검증
 * - DB 제약조건 검증 (UNIQUE, FK)
 * - Raw SQL 쿼리 테스트
 *
 * @architecture-decision
 * Mock 전략 선택:
 * - ❌ jest-mock-extended: 타입 안전하지만 설정 복잡
 * - ❌ prisma-mock: 편리하지만 최신 Prisma 미지원
 * - ✅ 직접 Mock 구현: 완전한 제어, 팀 요구사항 맞춤
 *
 * @performance
 * - Unit Test: Mock Prisma (100ms 이내)
 * - Integration Test: 실제 DB (1-2초)
 * - E2E Test: 실제 DB + API (5-10초)
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

/**
 * Prisma Mock 타입
 *
 * @why-DeepMockProxy
 * - PrismaClient의 모든 메서드를 Mock으로 변환
 * - user.findUnique, workspace.create 등 모두 jest.fn()
 * - 타입 안전성 유지 (TypeScript 자동완성)
 */
export type MockPrisma = DeepMockProxy<PrismaClient>;

/**
 * Prisma Mock 인스턴스 생성
 *
 * @why-singleton-pattern
 * - 모든 테스트에서 동일한 Mock 인스턴스 사용
 * - 메모리 절약
 * - afterEach에서 한 번만 리셋하면 됨
 *
 * @usage
 * ```typescript
 * import { prismaMock } from '@/test/helpers/mock-prisma.helper';
 *
 * it('should find user by email', async () => {
 *   prismaMock.user.findUnique.mockResolvedValue({
 *     id: '1',
 *     email: 'test@example.com',
 *     name: 'Test User',
 *   });
 *
 *   const user = await userService.findByEmail('test@example.com');
 *   expect(user.email).toBe('test@example.com');
 * });
 * ```
 */
export const prismaMock = mockDeep<PrismaClient>();

/**
 * Prisma Mock 리셋
 *
 * @why-reset-needed
 * - 테스트 간 독립성 보장
 * - 이전 테스트의 Mock 데이터가 다음 테스트에 영향 방지
 * - Mock 호출 카운트 초기화
 *
 * @auto-reset
 * test/setup.ts의 afterEach에서 자동으로 호출됨
 *
 * @manual-reset
 * 특정 테스트 중간에 리셋 필요 시:
 * ```typescript
 * it('should handle multiple operations', async () => {
 *   // 첫 번째 작업
 *   prismaMock.user.create.mockResolvedValue(user1);
 *   await service.createUser(user1);
 *
 *   // Mock 리셋 후 두 번째 작업
 *   resetPrismaMock();
 *   prismaMock.user.create.mockResolvedValue(user2);
 *   await service.createUser(user2);
 * });
 * ```
 */
export const resetPrismaMock = (): void => {
  mockReset(prismaMock);
};

/**
 * Prisma Error Mock
 *
 * @why-error-testing
 * HttpExceptionFilter에서 Prisma 에러를 자동 변환하므로
 * 다양한 Prisma 에러 상황을 테스트해야 함
 *
 * @prisma-error-codes
 * - P2002: Unique constraint violation (중복 이메일)
 * - P2025: Record not found (존재하지 않는 사용자)
 * - P2003: Foreign key constraint (존재하지 않는 workspace)
 * - P2014: Relation violation (삭제 시 관련 데이터 존재)
 *
 * @usage
 * ```typescript
 * it('should handle duplicate email', async () => {
 *   prismaMock.user.create.mockRejectedValue(
 *     createPrismaError('P2002', 'email')
 *   );
 *
 *   await expect(service.createUser(dto)).rejects.toThrow(
 *     DuplicateEmailException
 *   );
 * });
 * ```
 */
export const createPrismaError = (code: string, target?: string): any => {
  const error: any = new Error(`Prisma error: ${code}`);
  error.code = code;

  if (target) {
    error.meta = { target: [target] };
  }

  return error;
};

/**
 * 자주 사용하는 Prisma 에러들
 *
 * @why-predefined-errors
 * - 코드 중복 방지
 * - 일관된 에러 테스트
 * - 가독성 향상
 */
export const PrismaErrors = {
  /**
   * 중복 제약조건 위반
   *
   * @example
   * 이메일 중복 가입 시도
   */
  uniqueConstraint: (field: string) => createPrismaError('P2002', field),

  /**
   * 레코드를 찾을 수 없음
   *
   * @example
   * 존재하지 않는 사용자 조회
   */
  notFound: () => createPrismaError('P2025'),

  /**
   * 외래 키 제약조건 위반
   *
   * @example
   * 존재하지 않는 workspace에 사용자 추가
   */
  foreignKeyConstraint: (field: string) => createPrismaError('P2003', field),

  /**
   * 관계 위반
   *
   * @example
   * 멤버가 있는 workspace 삭제 시도
   */
  relationViolation: () => createPrismaError('P2014'),
};

/**
 * Prisma Transaction Mock
 *
 * @why-transaction-mock
 * - 트랜잭션 내부 로직 테스트
 * - 롤백 시나리오 테스트
 * - 복잡한 비즈니스 로직 검증
 *
 * @architecture
 * Prisma의 $transaction은 콜백 함수를 받아서 실행:
 * await prisma.$transaction(async (tx) => {
 *   await tx.user.create(...);
 *   await tx.workspace.create(...);
 * });
 *
 * Mock에서는 콜백을 즉시 실행하고 prismaMock을 전달:
 *
 * @usage
 * ```typescript
 * it('should create user and workspace in transaction', async () => {
 *   mockPrismaTransaction();
 *
 *   prismaMock.user.create.mockResolvedValue(user);
 *   prismaMock.workspace.create.mockResolvedValue(workspace);
 *
 *   await service.createUserWithWorkspace(dto);
 *
 *   expect(prismaMock.user.create).toHaveBeenCalled();
 *   expect(prismaMock.workspace.create).toHaveBeenCalled();
 * });
 * ```
 */
export const mockPrismaTransaction = (): void => {
  prismaMock.$transaction.mockImplementation(
    async (callback: any) => await callback(prismaMock),
  );
};

/**
 * Prisma Query 호출 검증 헬퍼
 *
 * @why-verification-helpers
 * - 테스트 가독성 향상
 * - 일관된 검증 패턴
 * - 에러 메시지 명확화
 *
 * @usage
 * ```typescript
 * it('should call findUnique with correct params', async () => {
 *   await service.findByEmail('test@example.com');
 *
 *   expectPrismaToHaveBeenCalledWith('user', 'findUnique', {
 *     where: { email: 'test@example.com' },
 *   });
 * });
 * ```
 */
export const expectPrismaToHaveBeenCalledWith = (
  model: keyof PrismaClient,
  method: string,
  args?: any,
): void => {
  const mockModel = prismaMock[model] as any;
  const mockMethod = mockModel[method];

  if (args) {
    expect(mockMethod).toHaveBeenCalledWith(args);
  } else {
    expect(mockMethod).toHaveBeenCalled();
  }
};

/**
 * Prisma Query 호출 횟수 검증
 *
 * @usage
 * ```typescript
 * it('should call create exactly once', async () => {
 *   await service.createUser(dto);
 *   expectPrismaToHaveBeenCalledTimes('user', 'create', 1);
 * });
 * ```
 */
export const expectPrismaToHaveBeenCalledTimes = (
  model: keyof PrismaClient,
  method: string,
  times: number,
): void => {
  const mockModel = prismaMock[model] as any;
  const mockMethod = mockModel[method];

  expect(mockMethod).toHaveBeenCalledTimes(times);
};

// ============================================================================
// Work/ERP 확장 대비
// ============================================================================

/**
 * 마이크로서비스 확장 시 고려사항
 *
 * @scalability
 * 1. 서비스별 Prisma Mock:
 *    - user-service: UserPrismaClient Mock
 *    - project-service: ProjectPrismaClient Mock
 *    - erp-service: ERPPrismaClient Mock
 *
 * 2. 공통 Mock 유틸 분리:
 *    - packages/test-utils/prisma/
 *    - 모든 서비스에서 재사용
 *
 * 3. 통합 테스트에서는 실제 DB:
 *    - Docker Compose로 모든 서비스 DB 실행
 *    - 트랜잭션 롤백으로 테스트 격리
 *
 * @alternative-strategies
 * 다른 Mock 전략들:
 * 1. In-Memory Database (SQLite):
 *    - 장점: 실제 SQL 실행, 제약조건 검증
 *    - 단점: PostgreSQL과 문법 차이, 느림
 *
 * 2. Test Containers:
 *    - 장점: 실제 PostgreSQL, 완벽한 호환성
 *    - 단점: Docker 필요, 느림 (10-30초)
 *
 * 3. Shared Test Database:
 *    - 장점: 빠름, 실제 DB
 *    - 단점: 테스트 간 격리 어려움
 */
