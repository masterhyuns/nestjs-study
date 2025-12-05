/**
 * 루트 애플리케이션 모듈
 *
 * @description
 * NestJS 애플리케이션의 루트 모듈
 * 모든 기능 모듈과 공통 모듈을 통합
 *
 * @architecture
 * - 공통 모듈: Config, Database, Cache, Logger, Throttler
 * - 도메인 모듈: Auth, User, Workspace, Project, Task
 * - 헬스 체크: Terminus
 *
 * @scalability
 * - 각 도메인 모듈은 독립적으로 마이크로서비스로 전환 가능
 */

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { throttlerConfig } from './common/config/throttler.config';
import { validate } from './common/config/env.validation';
import { DatabaseModule } from './shared/database/database.module';
import { LoggerModule } from './common/logger/logger.module';
import { UserModule } from './modules/user/user.module';

/**
 * 루트 모듈
 */
@Module({
  imports: [
    // ==========================================================================
    // 환경 변수 설정 (전역, 검증)
    // ==========================================================================
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      validate, // ⭐ 환경 변수 검증
    }),

    // ==========================================================================
    // Rate Limiting (전역)
    // ==========================================================================
    ThrottlerModule.forRoot(throttlerConfig),

    // ==========================================================================
    // 데이터베이스 (전역)
    // ==========================================================================
    DatabaseModule,

    // ==========================================================================
    // 로깅 (전역)
    // ==========================================================================

    /**
     * LoggerModule - 구조화된 로깅
     *
     * @provides
     * - StructuredLoggerService: 일관된 로그 포맷
     * - HTTP 요청/응답/에러 로깅
     * - 타입 안전 로깅 인터페이스
     *
     * @why-global
     * Global 모듈로 선언한 이유:
     * - Interceptor, Filter, Service 모든 곳에서 사용
     * - import 없이 의존성 주입 가능
     * - 로깅 방식 변경 시 한 곳만 수정
     *
     * @usage
     * ```typescript
     * constructor(private readonly logger: StructuredLoggerService) {}
     * this.logger.logInfo('작업 시작', { userId: '123' });
     * ```
     */
    LoggerModule,

    // ==========================================================================
    // 도메인 모듈
    // ==========================================================================

    /**
     * UserModule - 사용자 관리
     *
     * @provides
     * - 회원가입: POST /api/v1/users/register
     * - 로그인: POST /api/v1/users/login
     * - 프로필 조회: GET /api/v1/users/me
     *
     * @why-first
     * UserModule을 가장 먼저 구현하는 이유:
     * - 인증의 기초: 다른 모든 기능이 사용자를 필요로 함
     * - 독립성: 다른 모듈에 의존하지 않음
     * - 테스트 기준: 가장 단순하여 아키텍처 검증에 적합
     *
     * @dependencies
     * - DatabaseModule: Prisma를 통한 DB 접근
     * - ConfigModule: 환경 변수 (bcrypt rounds 등)
     *
     * @exports
     * - UserService: AuthModule, ProjectModule 등에서 사용
     */
    UserModule,

    // ==========================================================================
    // 향후 추가될 도메인 모듈
    // ==========================================================================

    /**
     * @future AuthModule - 인증/권한 관리
     *
     * @provides
     * - JWT 토큰 발급/검증
     * - SSO 연동 (Google, Microsoft, GitHub)
     * - 권한 관리 (RBAC, ABAC)
     *
     * @why-separate
     * UserModule과 분리하는 이유:
     * - 관심사 분리: 사용자 관리 vs 인증
     * - 확장성: 다양한 인증 방식 추가
     * - 재사용성: 다른 도메인에서도 사용
     */
    // AuthModule,

    /**
     * @future WorkspaceModule - 워크스페이스 관리
     *
     * @provides
     * - 워크스페이스 생성/조회/수정/삭제
     * - 멤버 초대/제거
     * - 역할 관리 (Owner, Admin, Member)
     */
    // WorkspaceModule,

    /**
     * @future ProjectModule - 프로젝트 관리
     *
     * @provides
     * - 프로젝트 CRUD
     * - 프로젝트 멤버 관리
     * - 프로젝트 통계
     */
    // ProjectModule,

    /**
     * @future TaskModule - 태스크 관리
     *
     * @provides
     * - 태스크 CRUD
     * - 태스크 할당/상태 변경
     * - 댓글, 첨부파일
     */
    // TaskModule,

    /**
     * @future NotificationModule - 알림
     *
     * @provides
     * - 실시간 알림 (WebSocket)
     * - 이메일 알림
     * - 푸시 알림 (모바일)
     */
    // NotificationModule,

    // ==========================================================================
    // 공통 인프라 모듈 (향후 추가)
    // ==========================================================================

    /**
     * @future CacheModule - Redis 캐싱
     *
     * @provides
     * - 사용자 세션 관리
     * - API 응답 캐싱
     * - Rate Limiting 저장소
     */
    // CacheModule,

    /**
     * @future StorageModule - 파일 스토리지
     *
     * @provides
     * - 파일 업로드/다운로드
     * - 이미지 리사이징
     * - S3/MinIO 연동
     */
    // StorageModule,
  ],
  controllers: [HealthController],
  providers: [
    /**
     * @why-app-providers
     * APP_FILTER, APP_INTERCEPTOR를 providers에 등록하는 이유:
     * - 의존성 주입 가능: StructuredLoggerService 주입
     * - 모듈 컨텍스트: NestJS IoC 컨테이너에서 관리
     * - 테스트 용이: Mock 주입 가능
     *
     * @alternative
     * main.ts에서 new로 생성 (의존성 주입 불가):
     * ```typescript
     * app.useGlobalFilters(new HttpExceptionFilter());  // ❌ DI 불가
     * ```
     */

    /**
     * HttpExceptionFilter - 전역 예외 처리
     *
     * @why-app-filter
     * APP_FILTER를 사용하는 이유:
     * - StructuredLoggerService 의존성 주입
     * - 모듈 레벨 등록 (main.ts 간소화)
     */
    // NOTE: APP_FILTER는 main.ts에서 직접 등록합니다.
    // 이유: StructuredLoggerService 주입 시 순환 의존성 이슈 가능
    // 해결: main.ts에서 app.get(StructuredLoggerService)로 주입

    /**
     * LoggingInterceptor - HTTP 요청/응답 로깅
     *
     * @why-app-interceptor
     * APP_INTERCEPTOR를 사용하는 이유:
     * - StructuredLoggerService 의존성 주입
     * - 모듈 레벨 등록
     */
    // NOTE: APP_INTERCEPTOR도 main.ts에서 직접 등록합니다.
  ],
})
export class AppModule implements NestModule {
  /**
   * 미들웨어 설정
   *
   * @description
   * Request ID 미들웨어를 모든 라우트에 적용
   *
   * @why-not-wildcard
   * `.forRoutes('*')` 대신 `'/'`를 사용하는 이유:
   * - NestJS v9+ 부터 와일드카드 패턴 `'*'`이 deprecated
   * - 경고: "WARN [LegacyRouteResolver] Unsupported route path: '/api/*'"
   * - 해결: `'/'`를 사용하면 모든 하위 경로에 자동 적용
   * - 효과: 경고 메시지 제거, 동일한 기능 유지
   *
   * @alternative
   * 다른 방법들:
   * 1. `.forRoutes({ path: '/', method: RequestMethod.ALL })` (명시적)
   * 2. `.forRoutes('*')` (경고 무시)
   * 3. `.exclude()` 사용 (특정 경로 제외)
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('/');
  }
}
