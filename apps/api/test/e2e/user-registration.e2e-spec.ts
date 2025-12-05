/**
 * User Registration E2E 테스트
 *
 * @description
 * 사용자 회원가입 전체 워크플로우를 HTTP API를 통해 검증
 *
 * @why-e2e-test
 * E2E (End-to-End) 테스트가 필요한 이유:
 * 1. **실제 사용자 경험 검증**: HTTP → Controller → Service → Repository → DB
 * 2. **통합 검증**: 모든 레이어가 함께 올바르게 동작하는지 확인
 * 3. **미들웨어/인터셉터/필터 검증**: 전역 설정들이 실제로 적용되는지
 * 4. **API 계약 검증**: Swagger 문서와 실제 동작이 일치하는지
 * 5. **회귀 방지**: 주요 워크플로우가 깨지지 않았는지 자동 검증
 *
 * @architecture-decision
 * 왜 전체 앱을 띄우는가:
 * - ❌ Mock: 실제 통합 동작 검증 불가
 * - ❌ Unit Test: 개별 컴포넌트만 테스트
 * - ✅ E2E: 프로덕션과 동일한 환경에서 전체 플로우 검증
 *
 * @testing-strategy
 * E2E 테스트 전략:
 * 1. **Happy Path**: 정상적인 사용자 시나리오
 * 2. **Validation Errors**: 잘못된 입력 처리
 * 3. **Business Errors**: 비즈니스 규칙 위반 (중복 이메일 등)
 * 4. **Edge Cases**: 경계 조건, 예외 상황
 *
 * @performance
 * - 테스트 1개당 ~500-1000ms (전체 앱 초기화 + HTTP + DB)
 * - 전체 E2E 테스트 ~10-30초
 * - CI에서 병렬 실행 주의 (포트 충돌)
 *
 * @scalability
 * Work/ERP 확장 시:
 * - 핵심 워크플로우만 E2E 테스트 (회원가입, 로그인, 주요 기능)
 * - 나머지는 Integration Test로 커버
 * - E2E는 Smoke Test 역할 (빠른 피드백)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/shared/database/prisma.service';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { createUserDto } from '@/test/helpers/fixtures.helper';

/**
 * User Registration E2E 테스트 스위트
 *
 * @setup
 * 1. 전체 NestJS 앱 초기화
 * 2. 모든 전역 설정 적용 (Pipe, Filter, Interceptor)
 * 3. 실제 DB 연결
 * 4. HTTP 서버 시작
 */
describe('User Registration (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  /**
   * 모든 테스트 전 실행
   *
   * @why-beforeAll
   * - 앱 초기화 (시간 소요)
   * - 전역 설정 적용
   * - DB 연결
   *
   * @important
   * 프로덕션(main.ts)과 동일한 설정 적용:
   * - ValidationPipe
   * - HttpExceptionFilter
   * - TransformInterceptor
   * - 등등
   */
  beforeAll(async () => {
    // NestJS Testing 모듈 생성
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // 전체 앱 모듈 import
    }).compile();

    // 앱 인스턴스 생성
    app = moduleFixture.createNestApplication();

    // ========================================================================
    // 전역 설정 적용 (main.ts와 동일하게!)
    // ========================================================================

    /**
     * Global Validation Pipe
     *
     * @why-apply
     * - DTO Validation 자동 실행
     * - 잘못된 입력 자동 거부
     * - main.ts와 동일한 동작 보장
     */
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: false,
      }),
    );

    /**
     * Global Exception Filter
     *
     * @why-apply
     * - 에러 응답 형식 통일
     * - Prisma 에러 자동 변환 (P2002 → DUPLICATE_EMAIL)
     * - API 에러 응답 검증
     */
    app.useGlobalFilters(new HttpExceptionFilter());

    /**
     * Global Transform Interceptor
     *
     * @why-apply
     * - 응답 형식 통일 (ApiSuccessResponse)
     * - timestamp, requestId 자동 추가
     * - 일관된 API 응답 구조 검증
     */
    app.useGlobalInterceptors(new TransformInterceptor());

    // API Prefix 설정 (main.ts와 동일)
    app.setGlobalPrefix('api');

    // 앱 초기화 완료
    await app.init();

    // Prisma Service 가져오기 (DB 클린업용)
    prisma = app.get<PrismaService>(PrismaService);
  });

  /**
   * 각 테스트 후 실행
   *
   * @why-cleanup
   * - 테스트 간 독립성 보장
   * - DB 데이터 정리
   * - 다음 테스트에 영향 없도록
   */
  afterEach(async () => {
    // DB 클린업 (외래 키 순서 고려)
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
   * - 앱 종료
   * - DB 연결 해제
   * - 리소스 정리
   */
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  // ==========================================================================
  // 성공 케이스 (Happy Path)
  // ==========================================================================

  describe('POST /api/v1/users/register - 성공', () => {
    /**
     * 정상적인 회원가입
     *
     * @flow
     * 1. HTTP POST 요청
     * 2. ValidationPipe → DTO 검증
     * 3. Controller → Service
     * 4. Service → bcrypt 해싱
     * 5. Repository → DB 저장
     * 6. TransformInterceptor → 응답 변환
     * 7. HTTP 응답
     */
    it('유효한 데이터로 회원가입 성공', async () => {
      // Arrange: 회원가입 데이터
      const dto = createUserDto({
        email: 'newuser@example.com',
        password: 'Test@1234',
        passwordConfirm: 'Test@1234',
        name: '홍길동',
        phoneNumber: '010-1234-5678',
      });

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(201); // Created

      // Assert: 응답 구조 검증
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');

      // Assert: 응답 데이터 검증
      const { data } = response.body;
      expect(data).toHaveProperty('id');
      expect(data.email).toBe('newuser@example.com');
      expect(data.name).toBe('홍길동');
      expect(data.phoneNumber).toBe('01012345678'); // 하이픈 제거됨
      expect(data).not.toHaveProperty('password'); // 비밀번호는 응답에 없음

      // Assert: 메타 데이터 검증
      const { meta } = response.body;
      expect(meta).toHaveProperty('timestamp');
      expect(meta).toHaveProperty('requestId');

      // Assert: DB에 실제로 저장되었는지 확인
      const savedUser = await prisma.user.findUnique({
        where: { email: 'newuser@example.com' },
      });

      expect(savedUser).not.toBeNull();
      expect(savedUser?.name).toBe('홍길동');
      expect(savedUser?.password).not.toBe('Test@1234'); // 해싱되어 저장됨
    });

    it('선택 필드 없이 회원가입 성공', async () => {
      // Arrange: 필수 필드만 있는 데이터
      const dto = createUserDto({
        email: 'minimal@example.com',
        password: 'Test@1234',
        passwordConfirm: 'Test@1234',
        name: '김철수',
        phoneNumber: undefined, // 선택 필드
        marketingConsent: undefined, // 선택 필드
      });

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(201);

      // Assert: 성공
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('minimal@example.com');
    });

    it('이메일은 자동으로 소문자 변환', async () => {
      // Arrange: 대문자 이메일
      const dto = createUserDto({
        email: 'UPPERCASE@EXAMPLE.COM',
        password: 'Test@1234',
        passwordConfirm: 'Test@1234',
        name: 'User',
      });

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(201);

      // Assert: 소문자로 저장됨
      expect(response.body.data.email).toBe('uppercase@example.com');
    });
  });

  // ==========================================================================
  // Validation 에러 케이스
  // ==========================================================================

  describe('POST /api/v1/users/register - Validation 에러', () => {
    /**
     * ValidationPipe가 잡는 에러들
     *
     * @flow
     * 1. HTTP POST 요청
     * 2. ValidationPipe → DTO 검증 실패
     * 3. HttpExceptionFilter → 에러 응답 변환
     * 4. HTTP 400 Bad Request
     */

    it('이메일 형식이 잘못되면 400 에러', async () => {
      // Arrange: 잘못된 이메일
      const dto = createUserDto({ email: 'invalid-email' });

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(400); // Bad Request

      // Assert: 에러 응답 구조
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');

      // Assert: 에러 메시지
      const { error } = response.body;
      expect(error.code).toBe('COMMON_VALIDATION_ERROR');
      expect(error.message).toContain('이메일');
    });

    it('비밀번호가 약하면 400 에러', async () => {
      // Arrange: 약한 비밀번호 (소문자만)
      const dto = createUserDto({
        password: 'weakpassword',
        passwordConfirm: 'weakpassword',
      });

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(400);

      // Assert: 에러 메시지
      const { error } = response.body;
      expect(error.code).toBe('COMMON_VALIDATION_ERROR');
      expect(error.message).toContain('비밀번호');
    });

    it('비밀번호가 일치하지 않으면 400 에러', async () => {
      // Arrange: 불일치하는 비밀번호
      const dto = createUserDto({
        password: 'Test@1234',
        passwordConfirm: 'Different@123',
      });

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(400);

      // Assert: 에러 메시지
      const { error } = response.body;
      expect(error.code).toBe('COMMON_VALIDATION_ERROR');
      expect(error.message).toContain('일치');
    });

    it('이름이 너무 짧으면 400 에러', async () => {
      // Arrange: 1자 이름
      const dto = createUserDto({ name: 'A' });

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(400);

      // Assert: 에러 메시지
      const { error } = response.body;
      expect(error.code).toBe('COMMON_VALIDATION_ERROR');
      expect(error.message).toContain('최소 2자');
    });

    it('휴대폰 번호 형식이 잘못되면 400 에러', async () => {
      // Arrange: 잘못된 형식
      const dto = createUserDto({ phoneNumber: '123-456-7890' });

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(400);

      // Assert: 에러 메시지
      const { error } = response.body;
      expect(error.code).toBe('COMMON_VALIDATION_ERROR');
      expect(error.message).toContain('휴대폰');
    });

    it('필수 필드가 누락되면 400 에러', async () => {
      // Arrange: 이메일 누락
      const dto = {
        password: 'Test@1234',
        passwordConfirm: 'Test@1234',
        name: '홍길동',
      };

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(400);

      // Assert: 에러 메시지
      const { error } = response.body;
      expect(error.code).toBe('COMMON_VALIDATION_ERROR');
      expect(error.message).toContain('이메일');
    });

    it('정의되지 않은 필드가 있으면 400 에러', async () => {
      // Arrange: 정의되지 않은 필드 추가
      const dto = {
        ...createUserDto(),
        unknownField: 'some value', // DTO에 없는 필드
      };

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(400);

      // Assert: 에러 메시지
      const { error } = response.body;
      expect(error.code).toBe('COMMON_VALIDATION_ERROR');
    });

    it('여러 필드가 잘못되면 모든 에러 반환', async () => {
      // Arrange: 여러 필드가 잘못된 데이터
      const dto = {
        email: 'invalid-email', // 잘못된 형식
        password: '123', // 너무 짧음
        passwordConfirm: '456', // 불일치
        name: 'A', // 너무 짧음
        phoneNumber: '123', // 잘못된 형식
      };

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(400);

      // Assert: 여러 에러 메시지
      const { error } = response.body;
      expect(error.code).toBe('COMMON_VALIDATION_ERROR');

      // 메시지가 배열인 경우
      if (Array.isArray(error.message)) {
        expect(error.message.length).toBeGreaterThan(1);
      }
    });
  });

  // ==========================================================================
  // 비즈니스 로직 에러 케이스
  // ==========================================================================

  describe('POST /api/v1/users/register - 비즈니스 에러', () => {
    /**
     * Service 레이어에서 발생하는 비즈니스 에러
     *
     * @flow
     * 1. HTTP POST 요청
     * 2. ValidationPipe → 통과
     * 3. Service → 비즈니스 규칙 검증 실패
     * 4. Custom Exception throw
     * 5. HttpExceptionFilter → 에러 응답
     * 6. HTTP 4xx
     */

    it('중복 이메일로 가입 시도하면 409 에러', async () => {
      // Arrange: 첫 번째 사용자 생성
      const dto = createUserDto({ email: 'duplicate@example.com' });

      await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(201);

      // Act: 같은 이메일로 두 번째 가입 시도
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(409); // Conflict

      // Assert: 에러 응답
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DB_UNIQUE_CONSTRAINT');
      expect(response.body.error.message).toContain('중복');
    });
  });

  // ==========================================================================
  // 응답 형식 검증
  // ==========================================================================

  describe('POST /api/v1/users/register - 응답 형식', () => {
    /**
     * TransformInterceptor가 적용한 응답 형식 검증
     *
     * @why
     * - API 계약 검증
     * - 클라이언트 호환성 보장
     * - Swagger 문서와 일치 확인
     */

    it('성공 응답은 ApiSuccessResponse 형식', async () => {
      // Arrange: 회원가입 데이터
      const dto = createUserDto();

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(201);

      // Assert: 응답 형식 (커스텀 matcher 사용)
      expect(response.body).toHaveApiSuccessFormat();

      // Assert: 필드 존재 여부
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');

      expect(response.body.meta).toHaveProperty('timestamp');
      expect(response.body.meta).toHaveProperty('requestId');
    });

    it('에러 응답은 ApiErrorResponse 형식', async () => {
      // Arrange: 잘못된 데이터
      const dto = { email: 'invalid' };

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(400);

      // Assert: 응답 형식 (커스텀 matcher 사용)
      expect(response.body).toHaveApiErrorFormat();

      // Assert: 필드 존재 여부
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('meta');

      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.meta).toHaveProperty('timestamp');
    });

    it('비밀번호는 응답에 포함되지 않음', async () => {
      // Arrange: 회원가입 데이터
      const dto = createUserDto();

      // Act: HTTP POST 요청
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(201);

      // Assert: password 필드 없음
      expect(response.body.data).not.toHaveProperty('password');
    });
  });

  // ==========================================================================
  // HTTP 헤더 검증
  // ==========================================================================

  describe('POST /api/v1/users/register - HTTP 헤더', () => {
    it('Request ID 헤더가 응답에 포함됨', async () => {
      // Arrange: 회원가입 데이터
      const dto = createUserDto();

      // Act: HTTP POST 요청 (Request ID 전송)
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .set('X-Request-ID', 'test-request-123')
        .send(dto)
        .expect(201);

      // Assert: 응답 헤더에 Request ID 포함
      expect(response.headers['x-request-id']).toBe('test-request-123');

      // Assert: 응답 본문의 meta에도 포함
      expect(response.body.meta.requestId).toBe('test-request-123');
    });

    it('Request ID가 없으면 자동 생성', async () => {
      // Arrange: 회원가입 데이터
      const dto = createUserDto();

      // Act: HTTP POST 요청 (Request ID 없음)
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(201);

      // Assert: 응답 헤더에 Request ID 자동 생성됨
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/); // UUID 형식
    });
  });

  // ==========================================================================
  // 보안 검증
  // ==========================================================================

  describe('POST /api/v1/users/register - 보안', () => {
    it('비밀번호는 bcrypt로 해싱되어 저장됨', async () => {
      // Arrange: 회원가입 데이터
      const dto = createUserDto({
        email: 'security@example.com',
        password: 'PlainPassword@123',
        passwordConfirm: 'PlainPassword@123',
        name: 'User',
      });

      // Act: HTTP POST 요청
      await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(dto)
        .expect(201);

      // Assert: DB에 저장된 비밀번호 확인
      const savedUser = await prisma.user.findUnique({
        where: { email: 'security@example.com' },
      });

      // 평문 비밀번호와 다름
      expect(savedUser?.password).not.toBe('PlainPassword@123');

      // bcrypt 해시 형식 ($2b$...)
      expect(savedUser?.password).toMatch(/^\$2b\$/);
    });
  });
});

/**
 * Work/ERP 확장 대비
 *
 * @scalability
 * 더 많은 E2E 테스트 추가:
 * 1. 로그인 플로우
 *    - POST /api/v1/auth/login
 *    - JWT 토큰 발급 검증
 *
 * 2. 워크스페이스 생성
 *    - POST /api/v1/workspaces
 *    - 인증 필요 (JWT)
 *
 * 3. 프로젝트 생성/조회/수정/삭제
 *    - CRUD 전체 플로우
 *    - 권한 검증
 *
 * 4. 태스크 워크플로우
 *    - 생성 → 할당 → 진행 → 완료
 *    - 상태 전이 검증
 *
 * @ci-optimization
 * CI에서 E2E 테스트 최적화:
 * 1. 병렬 실행 주의
 *    - 포트 충돌 방지 (동적 포트 할당)
 *    - DB 격리 (각 테스트별 독립 DB)
 *
 * 2. 테스트 우선순위
 *    - 핵심 플로우만 E2E (빠른 피드백)
 *    - 나머지는 Integration Test
 *
 * 3. Smoke Test
 *    - 배포 전 주요 기능 빠르게 검증
 *    - E2E의 일부만 선별 실행
 */
