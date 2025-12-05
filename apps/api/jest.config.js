/**
 * Jest 테스트 설정
 *
 * @description
 * NestJS 애플리케이션을 위한 Jest 테스트 프레임워크 설정
 *
 * @architecture-decision
 * Jest를 선택한 이유:
 * 1. NestJS 공식 지원: @nestjs/testing과 완벽한 통합
 * 2. 빠른 실행 속도: 병렬 테스트 실행으로 대규모 테스트 스위트도 빠르게 처리
 * 3. 풍부한 Mocking: Prisma, Redis 등 외부 의존성 쉽게 Mock 가능
 * 4. Snapshot Testing: API 응답 형식 회귀 테스트
 * 5. Coverage Report: Istanbul 통합으로 코드 커버리지 자동 측정
 *
 * @testing-strategy
 * 테스트 피라미드 전략 적용:
 * - Unit Tests (70%): 빠르고 독립적인 비즈니스 로직 검증
 * - Integration Tests (20%): DB, Redis 등 실제 의존성과의 통합 검증
 * - E2E Tests (10%): 전체 워크플로우 검증
 *
 * @performance
 * - 병렬 실행: maxWorkers를 CPU 코어 수의 50%로 제한 (메모리 절약)
 * - 테스트 격리: 각 테스트 파일마다 독립적인 환경 (testEnvironment: 'node')
 * - 빠른 피드백: watch 모드에서 변경된 파일만 재실행
 *
 * @scalability
 * - Work/ERP 확장 시 고려사항:
 *   - 마이크로서비스로 분리 시 각 서비스별 Jest 설정 복제
 *   - 공통 테스트 유틸은 packages/test-utils로 분리
 *   - E2E 테스트는 별도 CI 파이프라인으로 분리 (실행 시간 고려)
 */

module.exports = {
  // ============================================================================
  // 기본 설정
  // ============================================================================

  /**
   * TypeScript 파일을 Jest가 이해할 수 있도록 변환
   *
   * @why ts-jest 사용:
   * - babel보다 타입 체크 기능 포함
   * - tsconfig.json 설정을 그대로 사용 (일관성)
   * - NestJS 데코레이터 완벽 지원
   */
  preset: 'ts-jest',

  /**
   * Node.js 환경에서 테스트 실행
   *
   * @why 'node' 환경:
   * - 백엔드 API는 브라우저 환경 불필요
   * - jsdom보다 빠른 실행 속도 (DOM 파싱 없음)
   * - 메모리 사용량 낮음
   */
  testEnvironment: 'node',

  /**
   * 테스트 파일을 찾을 루트 디렉토리
   *
   * @why src/ 포함:
   * - Unit 테스트는 소스 코드 옆에 위치 (*.spec.ts)
   * - 관련 코드와 테스트가 가까워 유지보수 용이
   * - 파일 삭제 시 테스트도 함께 삭제 (일관성)
   */
  roots: ['<rootDir>/src/', '<rootDir>/test/'],

  // ============================================================================
  // 파일 패턴 설정
  // ============================================================================

  /**
   * 테스트 파일 패턴
   *
   * @convention
   * - *.spec.ts: Unit/Integration 테스트 (src/ 디렉토리 내)
   * - *.e2e-spec.ts: E2E 테스트 (test/ 디렉토리 내)
   *
   * @why 이런 네이밍:
   * - .spec.ts: 명확한 테스트 파일 구분
   * - .e2e-spec.ts: E2E는 실행 시간이 길어 별도 실행 가능
   */
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],

  /**
   * 테스트에서 제외할 디렉토리
   *
   * @why 이것들을 제외:
   * - node_modules: 외부 라이브러리는 이미 테스트됨
   * - dist: 컴파일된 파일은 테스트 불필요
   * - coverage: 커버리지 리포트 파일
   * - prisma/migrations: DB 마이그레이션 파일
   */
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/'],

  // ============================================================================
  // 모듈 해석 설정
  // ============================================================================

  /**
   * TypeScript 경로 별칭 설정
   *
   * @why 경로 별칭 필요:
   * - import { UserService } from '@/modules/user/...'; 간결한 import
   * - 상대 경로 지옥 방지: ../../../common/utils 대신 @/common/utils
   * - 리팩토링 시 import 경로 자동 수정 가능
   *
   * @sync
   * tsconfig.json의 paths와 동일하게 유지 (일관성)
   */
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@config/(.*)$': '<rootDir>/src/common/config/$1',
  },

  /**
   * 모듈 파일 확장자 우선순위
   *
   * @why 이 순서:
   * - .ts 우선: 대부분의 코드가 TypeScript
   * - .js 포함: 일부 설정 파일이나 외부 모듈
   * - .json 포함: 설정 파일이나 테스트 픽스처
   */
  moduleFileExtensions: ['js', 'json', 'ts'],

  // ============================================================================
  // 테스트 실행 설정
  // ============================================================================

  /**
   * 각 테스트 파일 실행 전 실행할 설정 파일
   *
   * @why setupFilesAfterEnv 사용:
   * - 모든 테스트에서 공통으로 사용할 설정
   * - Jest matchers 확장 (toBeValidEmail 같은 커스텀 matcher)
   * - 전역 Mock 설정 (console.log 억제 등)
   * - 테스트 타임아웃 설정
   *
   * @example
   * - 환경변수 설정
   * - 전역 에러 핸들러
   * - 데이터베이스 연결 풀 설정
   */
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  /**
   * 테스트 타임아웃 (밀리초)
   *
   * @why 10초:
   * - Unit Test: 보통 100ms 이내
   * - Integration Test: DB 쿼리 포함해도 1-2초
   * - E2E Test: 전체 워크플로우 포함 5-10초
   * - 10초면 대부분의 테스트 커버 가능
   *
   * @troubleshooting
   * E2E 테스트가 10초를 초과한다면:
   * - 테스트 데이터 최소화
   * - DB 연결 재사용
   * - 불필요한 대기 시간 제거
   * - 또는 개별 테스트에서 jest.setTimeout(30000) 사용
   */
  testTimeout: 10000,

  /**
   * 병렬 실행 워커 수
   *
   * @why CPU 코어의 50%:
   * - 100% 사용 시 시스템이 느려짐
   * - 50%면 테스트 + 다른 작업 병행 가능
   * - CI 환경에서는 환경변수로 오버라이드 (CI=true일 때 100%)
   *
   * @performance
   * - 로컬: 4코어 → 2개 워커 (편안한 개발)
   * - CI: 8코어 → 8개 워커 (빠른 피드백)
   */
  maxWorkers: '50%',

  // ============================================================================
  // 커버리지 설정
  // ============================================================================

  /**
   * 코드 커버리지 수집 대상
   *
   * @why src/**만 포함:
   * - 프로덕션 코드만 커버리지 측정
   * - 테스트 코드 자체는 커버리지에서 제외
   * - 설정 파일, 마이그레이션 파일 제외
   *
   * @why 특정 파일 제외:
   * - main.ts: 부트스트랩 로직, E2E에서 검증
   * - *.module.ts: DI 설정, 통합 테스트에서 검증
   * - *.interface.ts, *.types.ts: 타입 정의는 런타임에 존재하지 않음
   * - *.dto.ts: 데코레이터는 런타임에 실행되지만, 로직이 없음
   */
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.types.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/**/index.ts',
  ],

  /**
   * 커버리지 리포트 형식
   *
   * @why 이 형식들:
   * - text: 터미널에 바로 출력 (빠른 피드백)
   * - text-summary: 간단한 요약 (CI 로그)
   * - lcov: SonarQube, Codecov 같은 외부 도구 연동
   * - html: 브라우저에서 상세 커버리지 확인 (로컬 개발)
   */
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  /**
   * 커버리지 임계값
   *
   * @why 80%:
   * - 100% 목표는 비현실적 (테스트 작성에 너무 많은 시간)
   * - 80%면 핵심 비즈니스 로직 대부분 커버
   * - 나머지 20%는 엣지 케이스, 에러 처리 등
   *
   * @progressive-improvement
   * - 초기: 60% 목표로 시작
   * - 중기: 70% 달성 후 80%로 상향
   * - 장기: 크리티컬 모듈은 90% 이상 유지
   *
   * @ci-enforcement
   * CI에서 이 임계값 미달 시 빌드 실패
   * → 코드 품질 자동 보장
   */
  coverageThreshold: {
    global: {
      branches: 80,   // 분기문 (if, switch) 커버리지
      functions: 80,  // 함수 실행 커버리지
      lines: 80,      // 라인 커버리지
      statements: 80, // 구문 커버리지
    },
  },

  // ============================================================================
  // 성능 최적화
  // ============================================================================

  /**
   * 변환 캐시 사용
   *
   * @why true:
   * - TypeScript → JavaScript 변환 결과 캐싱
   * - 두 번째 테스트 실행부터 10배 빠름
   * - CI에서는 캐시 디렉토리를 저장하면 더 빠름
   */
  cache: true,

  /**
   * 캐시 디렉토리
   *
   * @why node_modules/.cache/jest:
   * - node_modules와 함께 .gitignore 처리
   * - pnpm clean 시 자동 삭제
   * - 팀원 간 충돌 없음
   */
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',

  // ============================================================================
  // 디버깅 설정
  // ============================================================================

  /**
   * 테스트 실행 시 상세 로그 출력
   *
   * @why true (개발 환경):
   * - 어떤 테스트가 실행되는지 명확히 확인
   * - 느린 테스트 식별 가능
   * - CI에서는 false로 설정 (로그 양 감소)
   */
  verbose: true,

  /**
   * 테스트 실패 시 즉시 중단하지 않음
   *
   * @why false:
   * - 모든 테스트 실행해서 전체 실패 목록 확인
   * - CI에서 한 번에 모든 문제 파악
   * - 로컬에서는 --bail 옵션으로 즉시 중단 가능
   */
  bail: false,

  // ============================================================================
  // Work/ERP 확장 대비 설정
  // ============================================================================

  /**
   * 글로벌 설정
   *
   * @future-scalability
   * 마이크로서비스 확장 시:
   * 1. 각 서비스별 jest.config.js 분리
   *    - apps/user-service/jest.config.js
   *    - apps/project-service/jest.config.js
   *    - apps/erp-service/jest.config.js
   *
   * 2. 공통 설정은 jest.config.base.js로 추출
   *    - packages/jest-config/jest.config.base.js
   *    - 각 서비스에서 extends로 상속
   *
   * 3. 통합 테스트는 별도 프로젝트
   *    - apps/integration-tests/
   *    - 여러 서비스 간 통신 테스트
   *
   * 4. 성능 테스트 분리
   *    - apps/performance-tests/
   *    - K6 또는 Artillery 사용
   */
  globals: {
    'ts-jest': {
      /**
       * TypeScript 컴파일러 옵션
       *
       * @why isolatedModules: true:
       * - 각 파일을 독립적으로 컴파일 (빠름)
       * - Babel과 동일한 동작 (일관성)
       */
      isolatedModules: true,
    },
  },
};
