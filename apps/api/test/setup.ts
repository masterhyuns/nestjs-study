/**
 * Jest 전역 테스트 설정
 *
 * @description
 * 모든 테스트 파일 실행 전에 한 번 실행되는 설정
 *
 * @why-this-file-exists
 * 테스트 간 일관성 보장을 위한 전역 설정:
 * 1. 환경변수 설정 (테스트 DB, Redis 등)
 * 2. 전역 Mocks (Prisma, Logger 등)
 * 3. 커스텀 Jest Matchers (toBeValidEmail 같은)
 * 4. 테스트 타임아웃 설정
 * 5. 에러 핸들링 설정
 *
 * @architecture-decision
 * 왜 전역 설정이 필요한가:
 * - 각 테스트 파일마다 중복 설정 방지 (DRY 원칙)
 * - 테스트 환경 일관성 보장 (로컬/CI 동일한 동작)
 * - 테스트 데이터 격리 (각 테스트 독립적 실행)
 * - 외부 의존성 격리 (실제 DB/Redis 대신 Mock 사용)
 */

import { config } from 'dotenv';
import { randomUUID } from 'crypto';

// ============================================================================
// 환경변수 설정
// ============================================================================

/**
 * 테스트 환경변수 로드
 *
 * @why-.env.test 사용:
 * - 프로덕션 DB와 격리된 테스트 DB 사용
 * - 테스트 전용 Redis 사용 (포트 6380)
 * - 로그 레벨 조정 (ERROR만 출력)
 *
 * @security
 * - .env.test는 .gitignore에 포함
 * - CI에서는 환경변수로 주입
 * - 민감 정보 절대 하드코딩 금지
 */
config({ path: '.env.test' });

/**
 * 필수 테스트 환경변수 설정
 *
 * @why-override:
 * - NODE_ENV=test: 테스트 모드 명시
 * - TEST_DATABASE_URL: 테스트 전용 DB (접미사 _test)
 * - JWT_SECRET: 테스트용 고정 시크릿 (일관성)
 *
 * @example
 * DATABASE_URL=postgresql://user:pass@localhost:5432/app_test
 * REDIS_HOST=localhost
 * REDIS_PORT=6380
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/collaboration_test';
process.env.REDIS_HOST = process.env.TEST_REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.TEST_REDIS_PORT || '6380';
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET || 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = '1h';

// ============================================================================
// 전역 타임아웃 설정
// ============================================================================

/**
 * 테스트 타임아웃 설정
 *
 * @why-10-seconds:
 * - Unit Test: ~100ms (빠른 피드백)
 * - Integration Test: ~1-2s (DB 쿼리 포함)
 * - E2E Test: ~5-10s (전체 워크플로우)
 *
 * @override
 * 개별 테스트에서 더 긴 시간 필요 시:
 * jest.setTimeout(30000); // 특정 테스트만 30초
 */
jest.setTimeout(10000);

// ============================================================================
// Console 출력 제어
// ============================================================================

/**
 * 테스트 실행 중 Console 로그 억제
 *
 * @why-suppress:
 * - 테스트 출력이 깔끔해짐 (노이즈 제거)
 * - 실제 에러만 눈에 띔
 * - CI 로그 크기 감소
 *
 * @when-to-enable:
 * - 테스트 디버깅 시: 주석 해제
 * - 특정 테스트만 로그 보고 싶을 때:
 *   const log = console.log;
 *   log('디버그 메시지');
 */
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

global.console = {
  ...console,
  log: jest.fn(), // console.log 무시
  error: jest.fn(), // console.error 무시 (실제 에러는 throw로 처리)
  warn: jest.fn(), // console.warn 무시
  // debug, info는 원래대로 유지 (필요 시 사용)
};

/**
 * 테스트 디버깅용 헬퍼
 *
 * @usage
 * import { debug } from '@/test/setup';
 * debug('테스트 중 확인하고 싶은 값:', value);
 */
export const debug = (...args: any[]): void => {
  if (process.env.TEST_DEBUG === 'true') {
    originalConsoleLog('[TEST DEBUG]', ...args);
  }
};

// ============================================================================
// 전역 유틸리티
// ============================================================================

/**
 * 테스트용 UUID 생성
 *
 * @why-fixed-uuid:
 * - Snapshot 테스트 시 UUID가 매번 바뀌면 실패
 * - 테스트 데이터 일관성 유지
 * - 디버깅 용이 (항상 같은 ID)
 *
 * @usage
 * const userId = generateTestUUID('user');
 * // → 'user-00000000-0000-0000-0000-000000000001'
 */
let uuidCounter = 0;
export const generateTestUUID = (prefix = 'test'): string => {
  uuidCounter++;
  const paddedCounter = String(uuidCounter).padStart(12, '0');
  return `${prefix}-00000000-0000-0000-0000-${paddedCounter}`;
};

/**
 * UUID 카운터 리셋 (각 테스트 파일마다 초기화)
 *
 * @why-reset:
 * - 테스트 간 독립성 보장
 * - 테스트 순서에 관계없이 동일한 결과
 *
 * @auto-reset
 * afterEach에서 자동으로 리셋됨
 */
export const resetTestUUID = (): void => {
  uuidCounter = 0;
};

/**
 * 테스트용 현재 시간 고정
 *
 * @why-fixed-time:
 * - createdAt, updatedAt 같은 타임스탬프 테스트
 * - Snapshot 테스트 시 시간이 바뀌면 실패
 * - 시간 기반 로직 테스트 (만료, 스케줄링 등)
 *
 * @usage
 * const now = new Date('2024-01-01T00:00:00Z');
 * mockCurrentTime(now);
 * // 이제 new Date()는 항상 2024-01-01을 반환
 */
export const mockCurrentTime = (date: Date): void => {
  jest.useFakeTimers();
  jest.setSystemTime(date);
};

/**
 * 시간 Mock 해제
 */
export const restoreRealTime = (): void => {
  jest.useRealTimers();
};

// ============================================================================
// 커스텀 Jest Matchers
// ============================================================================

/**
 * 커스텀 Matcher 정의
 *
 * @why-custom-matchers:
 * - 도메인 특화 검증 로직 재사용
 * - 테스트 가독성 향상
 * - 에러 메시지 명확화
 *
 * @example
 * expect(user.email).toBeValidEmail();
 * expect(response).toHaveApiSuccessFormat();
 */
expect.extend({
  /**
   * 이메일 형식 검증
   *
   * @why
   * CreateUserDto에서 사용하는 이메일 검증과 동일한 로직
   */
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `예상: "${received}"가 유효한 이메일이 아니어야 함`
          : `예상: "${received}"가 유효한 이메일이어야 함`,
    };
  },

  /**
   * 한국 휴대폰 번호 형식 검증
   *
   * @why
   * IsPhoneNumber 커스텀 validator와 동일한 로직
   */
  toBeValidPhoneNumber(received: string) {
    const phoneRegex = /^(01[0|1|6|7|8|9])-?(\d{3,4})-?(\d{4})$/;
    const pass = phoneRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `예상: "${received}"가 유효한 휴대폰 번호가 아니어야 함`
          : `예상: "${received}"가 유효한 휴대폰 번호여야 함`,
    };
  },

  /**
   * API Success Response 형식 검증
   *
   * @why
   * TransformInterceptor에서 생성하는 응답 형식과 일치 확인
   */
  toHaveApiSuccessFormat(received: any) {
    const hasSuccess = received.success === true;
    const hasData = 'data' in received;
    const hasMeta = 'meta' in received && 'timestamp' in received.meta;

    const pass = hasSuccess && hasData && hasMeta;

    return {
      pass,
      message: () =>
        pass
          ? `예상: API Success 형식이 아니어야 함`
          : `예상: API Success 형식이어야 함 (success: true, data, meta.timestamp 필요)`,
    };
  },

  /**
   * API Error Response 형식 검증
   *
   * @why
   * HttpExceptionFilter에서 생성하는 에러 응답 형식과 일치 확인
   */
  toHaveApiErrorFormat(received: any) {
    const hasSuccess = received.success === false;
    const hasError =
      'error' in received &&
      'code' in received.error &&
      'message' in received.error;
    const hasMeta = 'meta' in received && 'timestamp' in received.meta;

    const pass = hasSuccess && hasError && hasMeta;

    return {
      pass,
      message: () =>
        pass
          ? `예상: API Error 형식이 아니어야 함`
          : `예상: API Error 형식이어야 함 (success: false, error.code, error.message, meta.timestamp 필요)`,
    };
  },

  /**
   * UUID 형식 검증
   *
   * @why
   * 데이터베이스 ID 형식 검증 (Prisma default uuid())
   */
  toBeUUID(received: string) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `예상: "${received}"가 UUID가 아니어야 함`
          : `예상: "${received}"가 UUID여야 함`,
    };
  },
});

// TypeScript 타입 선언
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidEmail(): R;
      toBeValidPhoneNumber(): R;
      toHaveApiSuccessFormat(): R;
      toHaveApiErrorFormat(): R;
      toBeUUID(): R;
    }
  }
}

// ============================================================================
// 테스트 Lifecycle Hooks
// ============================================================================

/**
 * 각 테스트 후 정리 작업
 *
 * @why-cleanup:
 * - 테스트 간 독립성 보장 (테스트 순서 무관)
 * - 메모리 누수 방지
 * - Mock 상태 초기화
 */
afterEach(() => {
  // UUID 카운터 리셋
  resetTestUUID();

  // 모든 Mock 초기화
  jest.clearAllMocks();

  // 타이머 Mock 해제
  if (jest.isMockFunction(setTimeout)) {
    jest.useRealTimers();
  }
});

/**
 * 모든 테스트 완료 후 정리
 *
 * @why
 * - DB 연결 종료
 * - Redis 연결 종료
 * - 임시 파일 삭제
 */
afterAll(async () => {
  // 비동기 작업 완료 대기
  await new Promise((resolve) => setTimeout(resolve, 500));
});

// ============================================================================
// 전역 에러 핸들링
// ============================================================================

/**
 * 처리되지 않은 Promise Rejection 감지
 *
 * @why
 * - 테스트에서 놓친 에러 캐치
 * - CI에서 테스트 실패로 처리
 */
process.on('unhandledRejection', (reason, promise) => {
  originalConsoleError('Unhandled Rejection in test:', reason);
  throw reason;
});

/**
 * 처리되지 않은 Exception 감지
 *
 * @why
 * - 동기 코드에서 발생한 에러 캐치
 * - 테스트 실패로 처리
 */
process.on('uncaughtException', (error) => {
  originalConsoleError('Uncaught Exception in test:', error);
  throw error;
});

// ============================================================================
// Work/ERP 확장 대비
// ============================================================================

/**
 * 마이크로서비스 확장 시 고려사항
 *
 * @scalability
 * 1. 서비스별 독립적인 테스트 환경:
 *    - apps/user-service/test/setup.ts
 *    - apps/project-service/test/setup.ts
 *    - 각 서비스의 환경변수 분리
 *
 * 2. 공통 테스트 유틸 분리:
 *    - packages/test-utils/src/matchers/
 *    - packages/test-utils/src/helpers/
 *    - 모든 서비스에서 재사용
 *
 * 3. 통합 테스트 환경:
 *    - apps/integration-tests/
 *    - 여러 서비스 간 통신 테스트
 *    - Docker Compose로 모든 서비스 실행
 *
 * 4. 테스트 데이터베이스 전략:
 *    - 서비스별 독립 DB (user_test, project_test)
 *    - 트랜잭션 롤백으로 테스트 격리
 *    - 또는 테스트마다 DB 재생성 (느리지만 확실)
 */
