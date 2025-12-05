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
     * @future LoggerModule - Winston 로깅
     *
     * @provides
     * - 구조화된 로깅 (JSON)
     * - 로그 레벨별 파일 분리
     * - 외부 로그 수집 (ELK, DataDog)
     */
    // LoggerModule,

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
  providers: [],
})
export class AppModule implements NestModule {
  /**
   * 미들웨어 설정
   *
   * @description
   * Request ID 미들웨어를 모든 라우트에 적용
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
