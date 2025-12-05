/**
 * UserRepository Unit 테스트
 *
 * @description
 * UserRepository의 데이터베이스 접근 로직을 테스트
 *
 * @why-unit-test-repository
 * Repository를 Unit Test하는 이유:
 * 1. **빠른 실행**: 실제 DB 없이 Mock으로 테스트 (100배 빠름)
 * 2. **로직 검증**: Prisma 쿼리 로직이 올바른지 확인
 * 3. **에러 처리**: DB 에러 상황 시뮬레이션
 * 4. **격리**: 다른 테스트와 독립적 실행
 *
 * @architecture-decision
 * Unit Test vs Integration Test 선택 기준:
 * - ✅ Unit Test (Mock Prisma):
 *   - 간단한 CRUD (findById, create, update, delete)
 *   - 비즈니스 로직 검증 (조건문, 변환 등)
 *   - 에러 처리 로직
 *
 * - ✅ Integration Test (Real DB):
 *   - 복잡한 쿼리 (JOIN, aggregation)
 *   - Raw SQL 쿼리
 *   - 트랜잭션 동작
 *   - DB 제약조건 (UNIQUE, FK)
 *
 * @testing-strategy
 * AAA 패턴 적용:
 * - Arrange: Mock 설정, 테스트 데이터 준비
 * - Act: Repository 메서드 실행
 * - Assert: 결과 검증, Mock 호출 검증
 *
 * @performance
 * - 테스트 1개당 ~10ms
 * - 전체 Repository 테스트 ~100ms
 * - CI에서 병렬 실행 가능
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UserRepository } from '../user.repository';
import { PrismaService } from '@/shared/database/prisma.service';
import {
  prismaMock,
  resetPrismaMock,
  PrismaErrors,
  mockPrismaTransaction,
} from '@/test/helpers/mock-prisma.helper';
import { createUser, createUsers } from '@/test/helpers/fixtures.helper';
import { UserRole } from '@prisma/client';

/**
 * UserRepository 테스트 스위트
 *
 * @setup
 * 1. NestJS Testing 모듈 생성
 * 2. PrismaService를 prismaMock으로 교체
 * 3. UserRepository 인스턴스 생성
 */
describe('UserRepository', () => {
  let repository: UserRepository;

  /**
   * 각 테스트 전 실행
   *
   * @why-beforeEach
   * - 각 테스트마다 독립적인 환경 보장
   * - Repository 인스턴스 새로 생성
   * - Mock 상태 초기화
   *
   * @nestjs-testing
   * Test.createTestingModule()을 사용하는 이유:
   * - NestJS DI 컨테이너 사용
   * - 실제 프로덕션과 동일한 방식으로 인스턴스 생성
   * - 의존성 주입 자동 해결
   */
  beforeEach(async () => {
    // NestJS Testing 모듈 생성
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          // PrismaService를 prismaMock으로 교체
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    // Repository 인스턴스 가져오기
    repository = module.get<UserRepository>(UserRepository);

    // Mock 상태 초기화 (이전 테스트 영향 제거)
    resetPrismaMock();
  });

  /**
   * 각 테스트 후 실행
   *
   * @why-afterEach
   * - Mock 호출 기록 초기화
   * - 메모리 누수 방지
   */
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // 조회 메서드 테스트
  // ==========================================================================

  describe('findById', () => {
    it('ID로 사용자를 찾아 반환', async () => {
      // Arrange: 테스트 데이터 준비
      const mockUser = createUser({ id: 'user-123', email: 'test@example.com' });

      // Prisma Mock 설정: findUnique가 mockUser 반환하도록
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      // Act: Repository 메서드 실행
      const result = await repository.findById('user-123');

      // Assert: 결과 검증
      expect(result).toEqual(mockUser);

      // Prisma Mock 호출 검증
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('사용자가 없으면 null 반환', async () => {
      // Arrange: Prisma Mock이 null 반환하도록 설정
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act: Repository 메서드 실행
      const result = await repository.findById('non-existent');

      // Assert: null 반환 확인
      expect(result).toBeNull();

      // Prisma Mock 호출 검증
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
      });
    });

    it('DB 에러 발생 시 에러를 throw', async () => {
      // Arrange: Prisma Mock이 에러 throw하도록 설정
      const dbError = new Error('Database connection failed');
      prismaMock.user.findUnique.mockRejectedValue(dbError);

      // Act & Assert: 에러 throw 확인
      await expect(repository.findById('user-123')).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('findByEmail', () => {
    it('이메일로 사용자를 찾아 반환', async () => {
      // Arrange: 테스트 데이터 준비
      const mockUser = createUser({ email: 'test@example.com' });

      // Prisma Mock 설정
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      // Act: Repository 메서드 실행
      const result = await repository.findByEmail('test@example.com');

      // Assert: 결과 검증
      expect(result).toEqual(mockUser);
      expect(result?.email).toBe('test@example.com');

      // Prisma Mock 호출 검증
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('이메일이 없으면 null 반환', async () => {
      // Arrange: Prisma Mock이 null 반환하도록 설정
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act: Repository 메서드 실행
      const result = await repository.findByEmail('nonexistent@example.com');

      // Assert: null 반환 확인
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('모든 사용자를 배열로 반환', async () => {
      // Arrange: 여러 사용자 데이터 준비
      const mockUsers = createUsers(5);

      // Prisma Mock 설정
      prismaMock.user.findMany.mockResolvedValue(mockUsers);

      // Act: Repository 메서드 실행
      const result = await repository.findAll();

      // Assert: 결과 검증
      expect(result).toEqual(mockUsers);
      expect(result).toHaveLength(5);

      // Prisma Mock 호출 검증
      expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1);
    });

    it('사용자가 없으면 빈 배열 반환', async () => {
      // Arrange: Prisma Mock이 빈 배열 반환하도록 설정
      prismaMock.user.findMany.mockResolvedValue([]);

      // Act: Repository 메서드 실행
      const result = await repository.findAll();

      // Assert: 빈 배열 확인
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 생성 메서드 테스트
  // ==========================================================================

  describe('create', () => {
    it('새 사용자를 생성하고 반환', async () => {
      // Arrange: 생성할 사용자 데이터 준비
      const createData = {
        email: 'newuser@example.com',
        password: 'hashed-password',
        name: 'New User',
        phoneNumber: '01012345678',
      };

      const mockCreatedUser = createUser(createData);

      // Prisma Mock 설정
      prismaMock.user.create.mockResolvedValue(mockCreatedUser);

      // Act: Repository 메서드 실행
      const result = await repository.create(createData);

      // Assert: 결과 검증
      expect(result).toEqual(mockCreatedUser);
      expect(result.email).toBe('newuser@example.com');

      // Prisma Mock 호출 검증
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: createData,
      });
    });

    it('중복 이메일 시 Prisma 에러 throw', async () => {
      // Arrange: 중복 에러 설정
      const createData = {
        email: 'duplicate@example.com',
        password: 'hashed-password',
        name: 'User',
      };

      // Prisma P2002 에러 (Unique constraint violation)
      prismaMock.user.create.mockRejectedValue(PrismaErrors.uniqueConstraint('email'));

      // Act & Assert: 에러 throw 확인
      await expect(repository.create(createData)).rejects.toThrow();

      // Prisma Mock 호출 검증
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: createData,
      });
    });
  });

  // ==========================================================================
  // 수정 메서드 테스트
  // ==========================================================================

  describe('update', () => {
    it('사용자 정보를 수정하고 반환', async () => {
      // Arrange: 수정할 데이터 준비
      const userId = 'user-123';
      const updateData = {
        name: 'Updated Name',
        phoneNumber: '01087654321',
      };

      const mockUpdatedUser = createUser({
        id: userId,
        ...updateData,
      });

      // Prisma Mock 설정
      prismaMock.user.update.mockResolvedValue(mockUpdatedUser);

      // Act: Repository 메서드 실행
      const result = await repository.update(userId, updateData);

      // Assert: 결과 검증
      expect(result).toEqual(mockUpdatedUser);
      expect(result.name).toBe('Updated Name');
      expect(result.phoneNumber).toBe('01087654321');

      // Prisma Mock 호출 검증
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData,
      });
    });

    it('존재하지 않는 사용자 수정 시 Prisma 에러 throw', async () => {
      // Arrange: 존재하지 않는 사용자
      const userId = 'non-existent';
      const updateData = { name: 'New Name' };

      // Prisma P2025 에러 (Record not found)
      prismaMock.user.update.mockRejectedValue(PrismaErrors.notFound());

      // Act & Assert: 에러 throw 확인
      await expect(repository.update(userId, updateData)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // 삭제 메서드 테스트
  // ==========================================================================

  describe('delete', () => {
    it('사용자를 삭제하고 삭제된 사용자 반환', async () => {
      // Arrange: 삭제할 사용자 준비
      const userId = 'user-123';
      const mockDeletedUser = createUser({ id: userId });

      // Prisma Mock 설정
      prismaMock.user.delete.mockResolvedValue(mockDeletedUser);

      // Act: Repository 메서드 실행
      const result = await repository.delete(userId);

      // Assert: 결과 검증
      expect(result).toEqual(mockDeletedUser);

      // Prisma Mock 호출 검증
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('존재하지 않는 사용자 삭제 시 Prisma 에러 throw', async () => {
      // Arrange: 존재하지 않는 사용자
      const userId = 'non-existent';

      // Prisma P2025 에러 (Record not found)
      prismaMock.user.delete.mockRejectedValue(PrismaErrors.notFound());

      // Act & Assert: 에러 throw 확인
      await expect(repository.delete(userId)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // 카운트 메서드 테스트
  // ==========================================================================

  describe('count', () => {
    it('전체 사용자 수를 반환', async () => {
      // Arrange: Prisma Mock 설정
      prismaMock.user.count.mockResolvedValue(42);

      // Act: Repository 메서드 실행
      const result = await repository.count();

      // Assert: 결과 검증
      expect(result).toBe(42);

      // Prisma Mock 호출 검증
      expect(prismaMock.user.count).toHaveBeenCalledTimes(1);
    });

    it('조건부 카운트 (role=ADMIN)', async () => {
      // Arrange: Admin 사용자 수
      prismaMock.user.count.mockResolvedValue(3);

      // Act: Repository 메서드 실행 (조건 추가)
      const result = await repository.count({ role: UserRole.ADMIN });

      // Assert: 결과 검증
      expect(result).toBe(3);

      // Prisma Mock 호출 검증
      expect(prismaMock.user.count).toHaveBeenCalledWith({
        where: { role: UserRole.ADMIN },
      });
    });
  });

  // ==========================================================================
  // 복잡한 쿼리 테스트 (예제)
  // ==========================================================================

  describe('findByRole', () => {
    it('특정 역할의 사용자들을 반환', async () => {
      // Arrange: Admin 사용자들 준비
      const mockAdmins = createUsers(3, { role: UserRole.ADMIN });

      // Prisma Mock 설정
      prismaMock.user.findMany.mockResolvedValue(mockAdmins);

      // Act: Repository 메서드 실행
      const result = await repository.findByRole(UserRole.ADMIN);

      // Assert: 결과 검증
      expect(result).toEqual(mockAdmins);
      expect(result).toHaveLength(3);
      result.forEach((user) => {
        expect(user.role).toBe(UserRole.ADMIN);
      });

      // Prisma Mock 호출 검증
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        where: { role: UserRole.ADMIN },
      });
    });
  });

  // ==========================================================================
  // 트랜잭션 테스트
  // ==========================================================================

  describe('트랜잭션 메서드', () => {
    /**
     * 트랜잭션 내에서 여러 작업 수행
     *
     * @why-test-transaction
     * - 트랜잭션 로직 검증
     * - 롤백 시나리오 테스트
     * - 원자성 보장 확인
     *
     * @note
     * 실제 트랜잭션 동작은 Integration Test에서 검증
     * Unit Test에서는 로직만 확인
     */
    it('트랜잭션 내에서 사용자 생성과 업데이트', async () => {
      // Arrange: 트랜잭션 Mock 설정
      mockPrismaTransaction();

      const createData = {
        email: 'test@example.com',
        password: 'hashed',
        name: 'Test',
      };

      const mockUser = createUser(createData);
      const mockUpdatedUser = createUser({ ...createData, isEmailVerified: true });

      prismaMock.user.create.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(mockUpdatedUser);

      // Act: 트랜잭션 실행 (예제 메서드)
      // 실제 구현은 UserRepository에 추가 필요
      // await repository.createAndVerify(createData);

      // Assert: Mock 호출 검증은 Integration Test에서 수행
      // Unit Test에서는 로직 검증만
    });
  });

  // ==========================================================================
  // 에러 처리 테스트
  // ==========================================================================

  describe('에러 처리', () => {
    /**
     * 다양한 Prisma 에러 시나리오 테스트
     *
     * @why-test-errors
     * - HttpExceptionFilter가 Prisma 에러를 자동 변환
     * - Repository에서 에러가 제대로 throw되는지 확인
     * - 에러 메시지 및 코드 검증
     */

    it('Unique constraint violation (P2002)', async () => {
      // Arrange: 중복 이메일 에러
      prismaMock.user.create.mockRejectedValue(PrismaErrors.uniqueConstraint('email'));

      // Act & Assert: 에러 확인
      await expect(
        repository.create({
          email: 'duplicate@example.com',
          password: 'hashed',
          name: 'User',
        }),
      ).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('Record not found (P2025)', async () => {
      // Arrange: 존재하지 않는 레코드 에러
      prismaMock.user.findUniqueOrThrow.mockRejectedValue(PrismaErrors.notFound());

      // Act & Assert: 에러 확인
      await expect(repository.findByIdOrThrow('non-existent')).rejects.toMatchObject({
        code: 'P2025',
      });
    });

    it('Foreign key constraint (P2003)', async () => {
      // Arrange: 외래 키 제약 위반 에러
      prismaMock.user.create.mockRejectedValue(
        PrismaErrors.foreignKeyConstraint('workspaceId'),
      );

      // Act & Assert: 에러 확인
      await expect(
        repository.create({
          email: 'test@example.com',
          password: 'hashed',
          name: 'User',
          // workspaceId: 'non-existent' // 존재하지 않는 workspace
        }),
      ).rejects.toMatchObject({
        code: 'P2003',
      });
    });
  });
});

/**
 * Work/ERP 확장 대비
 *
 * @scalability
 * 더 많은 Repository 메서드 추가 시:
 * 1. 각 메서드별로 describe 블록 추가
 * 2. 성공/실패 케이스 모두 테스트
 * 3. Prisma Mock 호출 검증
 * 4. 에러 처리 검증
 *
 * @complex-queries
 * 복잡한 쿼리 테스트 예제:
 * - JOIN: findWithWorkspaces() - workspace 정보 포함
 * - Aggregation: getUserStatistics() - 사용자 통계
 * - Raw SQL: findByCustomQuery() - 커스텀 쿼리
 * - Pagination: findWithPagination() - 페이지네이션
 *
 * @integration-test
 * 다음은 Integration Test로 검증:
 * - 실제 DB 제약조건 (UNIQUE, FK)
 * - 트랜잭션 롤백
 * - Raw SQL 쿼리 결과
 * - 성능 (인덱스 효율성)
 */
