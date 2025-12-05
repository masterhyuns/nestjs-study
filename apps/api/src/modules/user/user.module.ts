/**
 * 사용자 모듈
 *
 * @description
 * 사용자 도메인의 모든 컴포넌트를 통합하는 NestJS 모듈
 *
 * @why-module-system
 * NestJS 모듈 시스템을 사용하는 이유:
 * 1. **의존성 주입**: Provider들을 자동으로 연결
 * 2. **캡슐화**: 모듈 내부 구현을 외부에 숨김
 * 3. **재사용성**: 다른 모듈에서 UserModule import 가능
 * 4. **테스트 용이성**: 모듈 단위로 독립적 테스트
 *
 * @architecture
 * Clean Architecture 계층 구조:
 * ```
 * UserModule
 * ├── Presentation (Controller)
 * │   └── UserController - HTTP 엔드포인트
 * ├── Application (Service)
 * │   └── UserService - 비즈니스 로직
 * └── Infrastructure (Repository)
 *     └── UserRepository - 데이터 접근
 * ```
 *
 * @dependency-flow
 * 의존성 방향 (단방향):
 * Controller → Service → Repository → Database
 *
 * @why-this-structure
 * 왜 이런 구조를 선택했는가:
 * - ✅ DDD (Domain-Driven Design): 도메인별로 모듈 분리
 * - ✅ SOLID 원칙: 단일 책임, 의존성 역전
 * - ✅ 확장성: Work/ERP 확장 시 모듈 추가만 하면 됨
 * - ✅ 팀 협업: 모듈별로 개발자 할당 가능
 *
 * @scalability
 * Work/ERP 확장 시:
 * - OrganizationModule: 조직 관리
 * - ProjectModule: 프로젝트 관리
 * - TaskModule: 태스크 관리
 * - AuthModule: 인증/권한 (JWT, SSO)
 * - NotificationModule: 알림
 */

import { Module } from '@nestjs/common';
import { UserController } from './presentation/controllers/user.controller';
import { UserService } from './application/services/user.service';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { DatabaseModule } from '@/shared/database/database.module';

/**
 * 사용자 모듈
 *
 * @providers
 * NestJS IoC 컨테이너에 등록할 Provider:
 * - UserService: 비즈니스 로직
 * - UserRepository: 데이터 접근
 *
 * @controllers
 * HTTP 요청을 처리할 Controller:
 * - UserController: /api/v1/users
 *
 * @imports
 * 다른 모듈로부터 가져올 것:
 * - DatabaseModule: PrismaService 제공
 *
 * @exports
 * 다른 모듈에서 사용 가능하도록 export:
 * - UserService: AuthModule, ProjectModule 등에서 사용
 * - UserRepository: 직접 데이터 접근이 필요한 경우 (드물음)
 */
@Module({
  /**
   * imports - 의존하는 다른 모듈
   *
   * @why-DatabaseModule
   * DatabaseModule을 import하는 이유:
   * - PrismaService 제공: UserRepository에서 Prisma 사용
   * - 공유 리소스: 모든 Repository가 동일한 Prisma 인스턴스 사용
   * - 연결 풀 관리: 데이터베이스 연결을 효율적으로 관리
   *
   * @scalability
   * 향후 추가될 import:
   * - AuthModule: JWT 토큰 발급/검증
   * - EmailModule: 이메일 발송 (회원가입, 비밀번호 재설정)
   * - StorageModule: 프로필 이미지 업로드
   */
  imports: [DatabaseModule],

  /**
   * controllers - HTTP 요청 처리
   *
   * @why-array
   * 여러 Controller를 등록할 수 있도록 배열 사용
   * 향후 추가 가능성:
   * - UserAdminController: 관리자 전용 사용자 관리
   * - UserProfileController: 공개 프로필 조회 (인증 불필요)
   *
   * @routing
   * UserController의 모든 엔드포인트:
   * - POST /api/v1/users/register
   * - POST /api/v1/users/login
   * - GET /api/v1/users/me
   * - GET /api/v1/users/:id
   */
  controllers: [UserController],

  /**
   * providers - 의존성 주입 컨테이너에 등록
   *
   * @why-order-matters
   * Provider 등록 순서:
   * 1. UserRepository - 데이터 접근 (가장 하위)
   * 2. UserService - 비즈니스 로직 (Repository 의존)
   *
   * @dependency-injection
   * NestJS가 자동으로 의존성 해결:
   * ```typescript
   * UserService
   *   └── constructor(private userRepository: UserRepository)
   *       └── NestJS가 UserRepository 인스턴스 자동 주입
   * ```
   *
   * @lifecycle
   * Provider 생명주기:
   * - Singleton (기본): 애플리케이션 시작 시 1번 생성
   * - Request-scoped: 요청마다 생성 (필요 시 @Injectable({ scope: Scope.REQUEST }))
   * - Transient: 주입될 때마다 생성 (거의 사용 안 함)
   *
   * @why-singleton
   * Singleton을 사용하는 이유:
   * - 메모리 효율: 인스턴스 재사용
   * - 성능: 매 요청마다 생성 오버헤드 없음
   * - 상태 공유: 불필요 (Stateless Service)
   */
  providers: [
    UserService,
    UserRepository,

    /**
     * @future 추가 Provider
     *
     * Work/ERP 확장 시 추가될 Provider:
     *
     * 1. 사용자 이벤트 핸들러:
     * ```typescript
     * UserCreatedEventHandler, // 회원가입 후 환영 이메일
     * UserDeletedEventHandler, // 탈퇴 후 데이터 정리
     * ```
     *
     * 2. 사용자 정책:
     * ```typescript
     * UserPasswordPolicy, // 비밀번호 복잡도 규칙
     * UserAccountLockPolicy, // 계정 잠금 규칙
     * ```
     *
     * 3. 사용자 도메인 서비스:
     * ```typescript
     * UserDomainService, // 복잡한 도메인 로직
     * UserStatisticsService, // 사용자 통계
     * ```
     */
  ],

  /**
   * exports - 다른 모듈에서 사용 가능하도록 공개
   *
   * @why-export-service
   * UserService를 export하는 이유:
   * - AuthModule: 로그인 시 사용자 검증
   * - ProjectModule: 프로젝트 소유자 확인
   * - TaskModule: 태스크 담당자 할당
   * - OrganizationModule: 조직 멤버 관리
   *
   * @why-export-repository
   * UserRepository를 export하는 이유 (선택적):
   * - 특별한 경우: Service를 거치지 않고 직접 DB 접근
   * - 예시: 배치 작업, 통계 집계
   * - 일반적으로는 Service만 export 권장
   *
   * @encapsulation
   * 캡슐화 원칙:
   * - ✅ Service export: 비즈니스 로직을 통한 접근
   * - ⚠️ Repository export: 직접 DB 접근 (주의 필요)
   * - ❌ Controller export: 절대 안 함 (HTTP 계층)
   */
  exports: [
    UserService,
    // UserRepository, // 필요 시 주석 해제
  ],
})
export class UserModule {
  /**
   * 모듈 생명주기 훅
   *
   * @future
   * 필요 시 onModuleInit, onModuleDestroy 구현:
   *
   * ```typescript
   * import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
   *
   * export class UserModule implements OnModuleInit, OnModuleDestroy {
   *   async onModuleInit() {
   *     // 모듈 초기화 시 실행
   *     // 예: 관리자 계정 자동 생성, 캐시 워밍업
   *   }
   *
   *   async onModuleDestroy() {
   *     // 모듈 종료 시 실행
   *     // 예: 리소스 정리, 연결 해제
   *   }
   * }
   * ```
   */

  /**
   * @architecture-notes
   *
   * 왜 이런 모듈 구조를 선택했는가?
   *
   * 1. **도메인 주도 설계 (DDD)**
   *    - User는 하나의 Bounded Context
   *    - 모든 User 관련 로직을 한 모듈에 응집
   *    - 다른 도메인과 명확한 경계
   *
   * 2. **확장성 (Scalability)**
   *    - Work/ERP 확장 시 모듈 추가만 하면 됨
   *    - 마이크로서비스 전환 시 모듈 단위로 분리
   *    - 팀별로 모듈 할당 가능 (Conway's Law)
   *
   * 3. **테스트 용이성**
   *    - 모듈 단위로 독립적 테스트
   *    - Mock 주입 쉬움 (Testing Module)
   *    - Integration Test 범위 명확
   *
   * 4. **유지보수성**
   *    - 관련 코드가 한 곳에 모임 (응집도 ↑)
   *    - 다른 모듈과 결합도 낮음 (결합도 ↓)
   *    - 변경 영향 범위 최소화
   *
   * @alternatives
   *
   * 다른 모듈 구조 방식들:
   *
   * 1. ❌ Feature Module (기능별):
   *    - AuthModule, ProfileModule, SettingsModule
   *    - 단점: User 로직이 여러 모듈에 분산
   *
   * 2. ❌ Layer Module (계층별):
   *    - ControllerModule, ServiceModule, RepositoryModule
   *    - 단점: 도메인 경계가 불명확
   *
   * 3. ✅ Domain Module (도메인별):
   *    - UserModule, ProjectModule, TaskModule
   *    - 장점: DDD 원칙 준수, 확장성 우수
   *
   * @migration-strategy
   *
   * 마이크로서비스 전환 시나리오:
   *
   * 1. Monolith (현재):
   *    ```
   *    AppModule
   *    ├── UserModule
   *    ├── ProjectModule
   *    └── TaskModule
   *    ```
   *
   * 2. Modular Monolith (중간 단계):
   *    ```
   *    AppModule
   *    ├── UserModule (독립적 DB)
   *    ├── ProjectModule (독립적 DB)
   *    └── TaskModule (독립적 DB)
   *    ```
   *
   * 3. Microservices (최종):
   *    ```
   *    UserService (별도 앱)
   *    ProjectService (별도 앱)
   *    TaskService (별도 앱)
   *    ```
   *
   * 모듈 단위로 설계했기 때문에 전환이 용이!
   */
}
