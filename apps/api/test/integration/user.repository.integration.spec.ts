/**
 * UserRepository Integration 테스트
 *
 * @description
 * 실제 데이터베이스와 연동하여 UserRepository의 동작을 검증
 *
 * @why-integration-test
 * Integration Test가 필요한 이유:
 * 1. **실제 DB 동작 검증**: Mock이 아닌 실제 PostgreSQL에서 테스트
 * 2. **SQL 문법 검증**: Prisma 쿼리가 실제 SQL로 올바르게 변환되는지 확인
 * 3. **제약조건 검증**: UNIQUE, FOREIGN KEY, CHECK 등 DB 제약조건 동작 확인
 * 4. **트랜잭션 검증**: ACID 속성, 롤백/커밋 동작 확인
 * 5. **성능 테스트**: 인덱스 효율성, 쿼리 최적화 확인
 *
 * @architecture-decision
 * 왜 실제 DB를 사용하는가:
 * - ❌ In-Memory DB (SQLite): PostgreSQL과 문법/기능 차이
 * - ❌ Mock: DB 제약조건, 트랜잭션 동작 검증 불가
 * - ✅ 실제 Test DB: 프로덕션과 동일한 환경, 완벽한 검증
 *
 * @test-database-setup
 * 테스트 DB 설정 방법:
 * 1. Docker Compose로 Test DB 실행
 *    docker-compose up -d postgres
 * 2. 환경변수 설정 (.env.test)
 *    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/collaboration_test
 * 3. Prisma Migration 실행
 *    pnpm prisma migrate deploy
 * 4. 테스트 실행
 *    pnpm test:integration
 *
 * @performance
 * - 테스트 1개당 ~100-500ms (DB I/O 포함)
 * - 전체 Integration 테스트 ~5-10초
 * - CI에서는 병렬 실행 주의 (DB 충돌 가능)
 *
 * @scalability
 * Work/ERP 확장 시:
 * - 서비스별 Test DB 분리 (user_test, project_test, erp_test)
 * - 또는 스키마 분리 (public, user_schema, erp_schema)
 * - Test Containers 사용 (Docker에서 독립 DB 생성)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/shared/database/prisma.service';
import { UserRepository } from '@/modules/user/infrastructure/persistence/user.repository';
import { createUser } from '@/test/helpers/fixtures.helper';
import { UserRole } from '@prisma/client';

/**
 * UserRepository Integration 테스트 스위트
 *
 * @setup
 * 1. 실제 PrismaService 사용 (Mock 아님)
 * 2. 각 테스트 전/후 DB 클린업
 * 3. 트랜잭션 롤백으로 테스트 격리
 */
describe('UserRepository Integration Test', () => {
  let module: TestingModule;
  let repository: UserRepository;
  let prisma: PrismaService;

  /**
   * 모든 테스트 전 실행
   *
   * @why-beforeAll
   * - Testing 모듈 생성 (한 번만)
   * - DB 연결 설정
   * - Prisma Client 초기화
   */
  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        PrismaService,
        UserRepository,
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
    prisma = module.get<PrismaService>(PrismaService);

    // DB 연결 확인
    await prisma.$connect();
  });

  /**
   * 각 테스트 후 실행
   *
   * @why-cleanup
   * - 테스트 간 독립성 보장
   * - DB 데이터 정리 (다음 테스트에 영향 없도록)
   *
   * @cleanup-strategy
   * 전략 1: DELETE ALL (빠름, 간단)
   * 전략 2: TRUNCATE (더 빠름, FK 주의)
   * 전략 3: Transaction Rollback (가장 빠름, 복잡)
   *
   * @chosen-strategy
   * DELETE ALL 사용:
   * - 간단하고 안전
   * - FK 순서대로 삭제
   * - 테스트 데이터가 많지 않아 성능 문제 없음
   */
  afterEach(async () => {
    // 외래 키 순서 고려하여 삭제
    // Task → Project → Workspace → User 순서
    await prisma.task.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.workspaceMember.deleteMany({});
    await prisma.workspace.deleteMany({});
    await prisma.user.deleteMany({});
  });

  /**
   * 모든 테스트 후 실행
   *
   * @why-afterAll
   * - DB 연결 종료
   * - 리소스 정리
   * - 메모리 누수 방지
   */
  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  // ==========================================================================
  // 생성 (CREATE) 테스트
  // ==========================================================================

  describe('create', () => {
    /**
     * 사용자 생성 성공
     *
     * @why-test-create
     * - 가장 기본적인 CRUD 작업
     * - 기본값 설정 확인 (createdAt, updatedAt, role)
     * - ID 자동 생성 확인 (UUID)
     */
    it('새 사용자를 DB에 생성하고 반환', async () => {
      // Arrange: 생성할 사용자 데이터
      const createData = {
        email: 'newuser@example.com',
        password: 'hashed-password-123',
        name: 'New User',
      };

      // Act: Repository로 사용자 생성
      const result = await repository.create(createData);

      // Assert: 생성된 사용자 검증
      expect(result).toBeDefined();
      expect(result.id).toBeDefined(); // UUID 자동 생성
      expect(result.email).toBe('newuser@example.com');
      expect(result.name).toBe('New User');
      expect(result.password).toBe('hashed-password-123');
      expect(result.role).toBe(UserRole.USER); // 기본값
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      // DB에서 직접 조회하여 확인
      const savedUser = await prisma.user.findUnique({
        where: { id: result.id },
      });

      expect(savedUser).not.toBeNull();
      expect(savedUser?.email).toBe('newuser@example.com');
    });

    /**
     * 중복 이메일 검증
     *
     * @why-test-unique-constraint
     * - DB UNIQUE 제약조건 동작 확인
     * - Prisma Error Code 확인 (P2002)
     * - HttpExceptionFilter에서 자동 변환되는 에러
     */
    it('중복 이메일로 생성 시 Prisma 에러 발생', async () => {
      // Arrange: 첫 번째 사용자 생성
      await repository.create({
        email: 'duplicate@example.com',
        password: 'hashed',
        name: 'First User',
      });

      // Act & Assert: 같은 이메일로 두 번째 사용자 생성 시도
      await expect(
        repository.create({
          email: 'duplicate@example.com', // 중복!
          password: 'hashed2',
          name: 'Second User',
        }),
      ).rejects.toMatchObject({
        code: 'P2002', // Prisma Unique constraint error
      });
    });

    /**
     * 선택 필드 생략 가능 확인
     *
     * @why
     * - phoneNumber, marketingConsent는 선택 필드
     * - null 허용 확인
     */
    it('선택 필드 없이 사용자 생성 가능', async () => {
      // Arrange: 필수 필드만 있는 데이터
      const createData = {
        email: 'minimal@example.com',
        password: 'hashed',
        name: 'Minimal User',
      };

      // Act: 사용자 생성
      const result = await repository.create(createData);

      // Assert: 선택 필드는 null 또는 기본값
      expect(result.phoneNumber).toBeNull();
      expect(result.marketingConsent).toBe(false);
      expect(result.isEmailVerified).toBe(false);
    });
  });

  // ==========================================================================
  // 조회 (READ) 테스트
  // ==========================================================================

  describe('findById', () => {
    it('ID로 사용자를 조회하여 반환', async () => {
      // Arrange: 사용자 생성
      const created = await repository.create({
        email: 'find@example.com',
        password: 'hashed',
        name: 'Find Me',
      });

      // Act: ID로 조회
      const result = await repository.findById(created.id);

      // Assert: 조회 성공
      expect(result).not.toBeNull();
      expect(result?.id).toBe(created.id);
      expect(result?.email).toBe('find@example.com');
    });

    it('존재하지 않는 ID는 null 반환', async () => {
      // Arrange: 존재하지 않는 UUID
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // Act: 조회 시도
      const result = await repository.findById(nonExistentId);

      // Assert: null 반환
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('이메일로 사용자를 조회하여 반환', async () => {
      // Arrange: 사용자 생성
      await repository.create({
        email: 'email-search@example.com',
        password: 'hashed',
        name: 'Email User',
      });

      // Act: 이메일로 조회
      const result = await repository.findByEmail('email-search@example.com');

      // Assert: 조회 성공
      expect(result).not.toBeNull();
      expect(result?.email).toBe('email-search@example.com');
    });

    it('존재하지 않는 이메일은 null 반환', async () => {
      // Act: 조회 시도
      const result = await repository.findByEmail('nonexistent@example.com');

      // Assert: null 반환
      expect(result).toBeNull();
    });

    /**
     * 대소문자 구분 확인
     *
     * @why
     * - PostgreSQL에서 이메일은 대소문자 구분
     * - CreateUserDto에서 소문자 변환하므로 일관성 유지
     */
    it('이메일은 대소문자 구분', async () => {
      // Arrange: 소문자 이메일로 생성
      await repository.create({
        email: 'lowercase@example.com',
        password: 'hashed',
        name: 'User',
      });

      // Act: 대문자로 조회
      const result = await repository.findByEmail('LOWERCASE@EXAMPLE.COM');

      // Assert: 찾지 못함 (PostgreSQL default behavior)
      // 참고: CreateUserDto의 @Transform으로 소문자 변환되므로
      // 실제로는 항상 소문자로 저장됨
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('모든 사용자를 조회하여 배열로 반환', async () => {
      // Arrange: 여러 사용자 생성
      await repository.create({
        email: 'user1@example.com',
        password: 'hashed',
        name: 'User 1',
      });

      await repository.create({
        email: 'user2@example.com',
        password: 'hashed',
        name: 'User 2',
      });

      await repository.create({
        email: 'user3@example.com',
        password: 'hashed',
        name: 'User 3',
      });

      // Act: 전체 조회
      const result = await repository.findAll();

      // Assert: 3명 조회됨
      expect(result).toHaveLength(3);
      expect(result.map((u) => u.email)).toContain('user1@example.com');
      expect(result.map((u) => u.email)).toContain('user2@example.com');
      expect(result.map((u) => u.email)).toContain('user3@example.com');
    });

    it('사용자가 없으면 빈 배열 반환', async () => {
      // Act: 조회 (DB가 비어있음)
      const result = await repository.findAll();

      // Assert: 빈 배열
      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // 수정 (UPDATE) 테스트
  // ==========================================================================

  describe('update', () => {
    it('사용자 정보를 수정하고 반환', async () => {
      // Arrange: 사용자 생성
      const created = await repository.create({
        email: 'update@example.com',
        password: 'original',
        name: 'Original Name',
      });

      // Act: 이름 수정
      const result = await repository.update(created.id, {
        name: 'Updated Name',
      });

      // Assert: 수정 성공
      expect(result.name).toBe('Updated Name');
      expect(result.email).toBe('update@example.com'); // 변경 안됨
      expect(result.updatedAt.getTime()).toBeGreaterThan(
        created.updatedAt.getTime(),
      ); // updatedAt 자동 갱신

      // DB에서 직접 조회하여 확인
      const updated = await prisma.user.findUnique({
        where: { id: created.id },
      });

      expect(updated?.name).toBe('Updated Name');
    });

    it('여러 필드를 동시에 수정 가능', async () => {
      // Arrange: 사용자 생성
      const created = await repository.create({
        email: 'multi-update@example.com',
        password: 'original',
        name: 'Original',
      });

      // Act: 여러 필드 수정
      const result = await repository.update(created.id, {
        name: 'Updated Name',
        phoneNumber: '01012345678',
        marketingConsent: true,
      });

      // Assert: 모든 필드 수정됨
      expect(result.name).toBe('Updated Name');
      expect(result.phoneNumber).toBe('01012345678');
      expect(result.marketingConsent).toBe(true);
    });

    it('존재하지 않는 사용자 수정 시 에러 발생', async () => {
      // Arrange: 존재하지 않는 ID
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // Act & Assert: 에러 발생
      await expect(
        repository.update(nonExistentId, { name: 'New Name' }),
      ).rejects.toMatchObject({
        code: 'P2025', // Prisma Record not found
      });
    });
  });

  // ==========================================================================
  // 삭제 (DELETE) 테스트
  // ==========================================================================

  describe('delete', () => {
    it('사용자를 삭제하고 삭제된 사용자 반환', async () => {
      // Arrange: 사용자 생성
      const created = await repository.create({
        email: 'delete@example.com',
        password: 'hashed',
        name: 'To Delete',
      });

      // Act: 삭제
      const result = await repository.delete(created.id);

      // Assert: 삭제된 사용자 정보 반환
      expect(result.id).toBe(created.id);
      expect(result.email).toBe('delete@example.com');

      // DB에서 조회 시 null
      const deleted = await prisma.user.findUnique({
        where: { id: created.id },
      });

      expect(deleted).toBeNull();
    });

    it('존재하지 않는 사용자 삭제 시 에러 발생', async () => {
      // Arrange: 존재하지 않는 ID
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // Act & Assert: 에러 발생
      await expect(repository.delete(nonExistentId)).rejects.toMatchObject({
        code: 'P2025', // Prisma Record not found
      });
    });
  });

  // ==========================================================================
  // 카운트 테스트
  // ==========================================================================

  describe('count', () => {
    it('전체 사용자 수를 반환', async () => {
      // Arrange: 여러 사용자 생성
      await repository.create({
        email: 'count1@example.com',
        password: 'hashed',
        name: 'User 1',
      });

      await repository.create({
        email: 'count2@example.com',
        password: 'hashed',
        name: 'User 2',
      });

      // Act: 카운트
      const result = await repository.count();

      // Assert: 2명
      expect(result).toBe(2);
    });

    it('조건부 카운트 - Admin 사용자', async () => {
      // Arrange: 일반 사용자 2명, Admin 1명 생성
      await repository.create({
        email: 'user1@example.com',
        password: 'hashed',
        name: 'User 1',
        role: UserRole.USER,
      });

      await repository.create({
        email: 'user2@example.com',
        password: 'hashed',
        name: 'User 2',
        role: UserRole.USER,
      });

      await repository.create({
        email: 'admin@example.com',
        password: 'hashed',
        name: 'Admin',
        role: UserRole.ADMIN,
      });

      // Act: Admin 카운트
      const result = await repository.count({ role: UserRole.ADMIN });

      // Assert: 1명
      expect(result).toBe(1);
    });
  });

  // ==========================================================================
  // 트랜잭션 테스트
  // ==========================================================================

  describe('트랜잭션', () => {
    /**
     * 트랜잭션 성공 시나리오
     *
     * @why-test-transaction
     * - 여러 작업이 원자적으로 실행되는지 확인
     * - 모두 성공하면 커밋
     * - 하나라도 실패하면 롤백
     */
    it('트랜잭션 내 모든 작업이 성공하면 커밋', async () => {
      // Act: 트랜잭션 실행
      await prisma.$transaction(async (tx) => {
        // 첫 번째 사용자 생성
        await tx.user.create({
          data: {
            email: 'tx-user1@example.com',
            password: 'hashed',
            name: 'TX User 1',
          },
        });

        // 두 번째 사용자 생성
        await tx.user.create({
          data: {
            email: 'tx-user2@example.com',
            password: 'hashed',
            name: 'TX User 2',
          },
        });
      });

      // Assert: 두 사용자 모두 생성됨
      const count = await repository.count();
      expect(count).toBe(2);
    });

    /**
     * 트랜잭션 롤백 시나리오
     *
     * @why-test-rollback
     * - 중간에 에러 발생 시 모든 작업 롤백 확인
     * - ACID 속성 중 Atomicity 검증
     */
    it('트랜잭션 중 에러 발생 시 모든 작업 롤백', async () => {
      // Act & Assert: 트랜잭션 실행 (에러 예상)
      await expect(
        prisma.$transaction(async (tx) => {
          // 첫 번째 사용자 생성 (성공)
          await tx.user.create({
            data: {
              email: 'rollback-user1@example.com',
              password: 'hashed',
              name: 'Rollback User 1',
            },
          });

          // 두 번째 사용자 생성 (실패 - 중복 이메일)
          await tx.user.create({
            data: {
              email: 'rollback-user1@example.com', // 중복!
              password: 'hashed',
              name: 'Rollback User 2',
            },
          });
        }),
      ).rejects.toThrow();

      // Assert: 두 사용자 모두 생성되지 않음 (롤백됨)
      const count = await repository.count();
      expect(count).toBe(0);
    });
  });

  // ==========================================================================
  // 성능 테스트 (간단한 예제)
  // ==========================================================================

  describe('성능 테스트', () => {
    /**
     * 대량 데이터 조회 성능
     *
     * @why-performance-test
     * - 인덱스 효율성 확인
     * - 쿼리 최적화 필요성 판단
     * - Work/ERP 확장 시 성능 기준선 설정
     */
    it('100명의 사용자를 1초 이내에 조회', async () => {
      // Arrange: 100명 사용자 생성
      const createPromises = Array.from({ length: 100 }, (_, i) =>
        repository.create({
          email: `perf-user-${i}@example.com`,
          password: 'hashed',
          name: `Perf User ${i}`,
        }),
      );

      await Promise.all(createPromises);

      // Act: 전체 조회 (시간 측정)
      const startTime = Date.now();
      const result = await repository.findAll();
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Assert: 결과 및 성능 검증
      expect(result).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // 1초 이내

      console.log(`✅ 100명 조회 성능: ${duration}ms`);
    });
  });
});

/**
 * Work/ERP 확장 대비
 *
 * @scalability
 * 더 많은 Integration 테스트 추가:
 * 1. 복잡한 JOIN 쿼리 테스트
 *    - findWithWorkspaces() - workspace 정보 포함 조회
 *    - findWithProjects() - 참여 프로젝트 포함
 *
 * 2. Raw SQL 쿼리 테스트
 *    - getUserStatistics() - 사용자 통계 집계
 *    - bulkCreate() - 대량 삽입
 *
 * 3. 페이지네이션 테스트
 *    - findWithPagination() - offset/limit
 *    - findWithCursor() - cursor-based pagination
 *
 * 4. Full-Text Search 테스트
 *    - searchByName() - 이름 검색
 *    - PostgreSQL의 to_tsvector, to_tsquery 활용
 *
 * @ci-optimization
 * CI에서 Integration 테스트 최적화:
 * 1. Test Containers 사용
 *    - 각 테스트 실행마다 독립 DB 생성
 *    - 병렬 실행 가능
 *
 * 2. DB Migration Cache
 *    - Migration 결과 캐싱
 *    - 테스트 시작 시간 단축
 *
 * 3. Seed Data 활용
 *    - 자주 사용하는 테스트 데이터 미리 삽입
 *    - 각 테스트는 트랜잭션 롤백으로 격리
 */
