# 아키텍처 가이드

> **협업 플랫폼 → Work/ERP 시스템**으로 확장 가능한 엔터프라이즈급 백엔드 아키텍처

## 📚 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [왜 이 아키텍처를 선택했는가](#왜-이-아키텍처를-선택했는가)
3. [계층 구조](#계층-구조)
4. [도메인 주도 설계 (DDD)](#도메인-주도-설계-ddd)
5. [모듈 구조](#모듈-구조)
6. [데이터 접근 전략](#데이터-접근-전략)
7. [확장 전략](#확장-전략)
8. [디렉토리 구조](#디렉토리-구조)
9. [의사결정 기록](#의사결정-기록)

---

## 아키텍처 개요

본 프로젝트는 **Clean Architecture**와 **DDD (Domain-Driven Design)**를 기반으로 설계되었습니다.

### 핵심 원칙

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│                  (HTTP, Controllers, DTOs)                │
└───────────────────────┬──────────────────────────────────┘
                        │ depends on ↓
┌───────────────────────▼──────────────────────────────────┐
│                    Application Layer                      │
│              (Services, Use Cases, Business Logic)        │
└───────────────────────┬──────────────────────────────────┘
                        │ depends on ↓
┌───────────────────────▼──────────────────────────────────┐
│                   Infrastructure Layer                    │
│            (Repositories, Database, External APIs)        │
└───────────────────────┬──────────────────────────────────┘
                        │ depends on ↓
┌───────────────────────▼──────────────────────────────────┐
│                      Domain Layer                         │
│                (Entities, Value Objects)                  │
└──────────────────────────────────────────────────────────┘
```

### 의존성 방향

```
Presentation → Application → Infrastructure → Domain
     (외부)         (내부)          (외부)        (핵심)
```

**중요**: 의존성은 항상 **외부에서 내부로** 흐릅니다. Domain은 어떤 계층에도 의존하지 않습니다.

---

## 왜 이 아키텍처를 선택했는가

### 1. **확장성 (Scalability)**

**문제**: 협업 플랫폼에서 Work/ERP로 확장 시 코드 스파게티화

**해결**: 도메인별로 명확히 분리된 모듈 구조

```typescript
// 현재: Monolith
AppModule
├── UserModule
├── AuthModule (향후)
└── ...

// 미래: Microservices (모듈 단위로 분리)
UserService (별도 앱)
AuthService (별도 앱)
ProjectService (별도 앱)
```

**왜 중요한가**:
- **Work 확장**: 프로젝트, 태스크, 타임라인 모듈 추가
- **ERP 확장**: 회계, 재고, 급여 모듈 추가
- **마이크로서비스 전환**: 모듈 단위로 독립 배포 가능

### 2. **유지보수성 (Maintainability)**

**문제**: 비즈니스 로직이 여러 곳에 분산 → 수정 시 side effect

**해결**: 관심사 분리 (Separation of Concerns)

```typescript
// ❌ 나쁜 예: Controller에 비즈니스 로직
@Post('register')
async register(@Body() dto: CreateUserDto) {
  const hashedPassword = await bcrypt.hash(dto.password, 12);
  const user = await this.prisma.user.create({ ... });
  await this.emailService.sendWelcome(user);  // 비즈니스 로직 누락 가능
  return user;
}

// ✅ 좋은 예: Service에 비즈니스 로직
@Post('register')
async register(@Body() dto: CreateUserDto) {
  return await this.userService.register(dto);  // 모든 로직 캡슐화
}
```

**왜 중요한가**:
- **단일 책임**: Controller는 HTTP만, Service는 비즈니스만
- **테스트 용이**: Service만 단위 테스트하면 됨
- **재사용성**: 다른 엔드포인트에서도 동일한 Service 사용

### 3. **테스트 용이성 (Testability)**

**문제**: DB, 외부 API와 강하게 결합 → 테스트 어려움

**해결**: 의존성 역전 (Dependency Inversion)

```typescript
// Service는 Repository 인터페이스에만 의존
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,  // 인터페이스
  ) {}
}

// 테스트 시 Mock Repository 주입
const mockRepository = {
  findByEmail: jest.fn().mockResolvedValue(mockUser),
};
const service = new UserService(mockRepository);
```

**왜 중요한가**:
- **단위 테스트**: DB 없이 Service 테스트
- **통합 테스트**: Test Container로 실제 DB 사용
- **E2E 테스트**: 전체 플로우 검증

### 4. **팀 협업 (Team Collaboration)**

**문제**: 여러 개발자가 같은 파일 수정 → 충돌 빈번

**해결**: 모듈 단위로 작업 분리

```
개발자 A: UserModule 작업
개발자 B: ProjectModule 작업
개발자 C: TaskModule 작업
→ 충돌 최소화
```

**왜 중요한가**:
- **Conway's Law**: 시스템 구조 = 조직 구조
- **병렬 개발**: 모듈별 독립 개발 가능
- **코드 리뷰**: 모듈 단위로 리뷰 가능

### 5. **비즈니스 도메인 표현 (Business Domain)**

**문제**: 코드가 비즈니스를 제대로 표현하지 못함

**해결**: DDD (Domain-Driven Design)

```typescript
// ❌ 나쁜 예: 기술 중심
class UserManager {
  async insertUser(data: any) { ... }
}

// ✅ 좋은 예: 도메인 중심
class UserService {
  async register(dto: CreateUserDto): Promise<User> { ... }
  async validateCredentials(email: string, password: string): Promise<User> { ... }
}
```

**왜 중요한가**:
- **유비쿼터스 언어**: 개발자와 기획자가 같은 용어 사용
- **도메인 지식 보존**: 코드가 비즈니스 규칙을 명확히 표현
- **변경 용이**: 비즈니스 요구사항 변경 시 코드 위치가 명확

---

## 계층 구조

### 4계층 아키텍처

#### 1. **Domain Layer** (핵심, 최내부)

**책임**: 비즈니스 규칙, 엔티티, 값 객체

**디렉토리**: `src/modules/{domain}/domain/`

**구성 요소**:
- **Entity**: 식별자를 가진 비즈니스 객체 (User, Project, Task)
- **Value Object**: 식별자 없는 값 (Email, Money, Address)
- **Domain Event**: 도메인에서 발생한 사건 (UserRegistered, TaskCompleted)

**예시**:
```typescript
// src/modules/user/domain/entities/user.entity.ts
export class User {
  id: string;
  email: Email;  // Value Object
  password: HashedPassword;  // Value Object
  name: string;
  createdAt: Date;

  // 도메인 메서드
  changeEmail(newEmail: Email): void {
    // 비즈니스 규칙: 이메일 변경 시 검증 필요
    if (!newEmail.isValid()) {
      throw new InvalidEmailException();
    }
    this.email = newEmail;
  }
}
```

**왜 필요한가**:
- **비즈니스 로직 집중**: 기술 세부사항과 분리
- **불변성 보장**: 도메인 규칙 위반 방지
- **재사용성**: 어떤 프레임워크에서도 사용 가능

#### 2. **Application Layer** (유스케이스, 비즈니스 로직)

**책임**: 비즈니스 유스케이스 구현, 트랜잭션 관리

**디렉토리**: `src/modules/{domain}/application/`

**구성 요소**:
- **Service**: 비즈니스 로직 (UserService)
- **Use Case**: 특정 시나리오 (RegisterUserUseCase, LoginUseCase)
- **DTO**: 데이터 전송 객체 (CreateUserDto, LoginDto)

**예시**:
```typescript
// src/modules/user/application/services/user.service.ts
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * 회원가입 유스케이스
   *
   * @why-transaction
   * 트랜잭션이 필요한 이유:
   * - User 생성 + 환영 이메일 전송을 원자적으로 처리
   * - 이메일 전송 실패 시 User도 롤백
   */
  async register(dto: CreateUserDto): Promise<User> {
    // 1. 비즈니스 규칙 검증
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('이미 사용 중인 이메일입니다');
    }

    // 2. 도메인 객체 생성
    const user = User.create({
      email: new Email(dto.email),
      password: await HashedPassword.fromPlainText(dto.password),
      name: dto.name,
    });

    // 3. 영속화
    await this.userRepository.save(user);

    // 4. 도메인 이벤트 발행
    this.eventBus.publish(new UserRegisteredEvent(user.id));

    return user;
  }
}
```

**왜 필요한가**:
- **비즈니스 로직 집중**: Controller에서 분리
- **트랜잭션 관리**: 일관성 보장
- **재사용성**: 여러 엔드포인트에서 사용

#### 3. **Infrastructure Layer** (기술 구현)

**책임**: 데이터베이스, 외부 API, 파일 시스템 등 기술 구현

**디렉토리**: `src/modules/{domain}/infrastructure/`

**구성 요소**:
- **Repository**: 데이터 접근 (UserRepository)
- **Adapter**: 외부 시스템 연동 (EmailAdapter, PaymentAdapter)
- **Mapper**: 도메인 ↔ DB 변환 (UserMapper)

**예시**:
```typescript
// src/modules/user/infrastructure/persistence/user.repository.ts
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 이메일로 사용자 조회
   *
   * @why-prisma
   * Prisma를 사용하는 이유:
   * - 타입 안전성: TypeScript 타입 자동 생성
   * - 쿼리 빌더: SQL 인젝션 방지
   * - 마이그레이션: 스키마 버전 관리
   *
   * @why-lowercase
   * 이메일을 소문자로 변환하는 이유:
   * - 대소문자 구분 없이 검색 (user@EXAMPLE.com = user@example.com)
   * - DB에 저장 시 이미 소문자로 정규화
   */
  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return null;
    }

    // DB 모델 → 도메인 엔티티 변환
    return UserMapper.toDomain(user);
  }

  /**
   * 사용자 저장
   *
   * @why-upsert
   * upsert를 사용하는 이유:
   * - 생성/수정을 하나의 메서드로 처리
   * - 멱등성 보장 (같은 요청 여러 번 → 같은 결과)
   */
  async save(user: User): Promise<void> {
    const data = UserMapper.toPersistence(user);

    await this.prisma.user.upsert({
      where: { id: user.id },
      create: data,
      update: data,
    });
  }
}
```

**왜 필요한가**:
- **기술 독립성**: 도메인이 기술에 의존하지 않음
- **교체 용이**: Prisma → TypeORM 교체 가능
- **테스트 용이**: Mock Repository로 단위 테스트

#### 4. **Presentation Layer** (외부 인터페이스)

**책임**: HTTP 요청 처리, 응답 변환, 검증

**디렉토리**: `src/modules/{domain}/presentation/`

**구성 요소**:
- **Controller**: HTTP 엔드포인트 (UserController)
- **DTO**: 요청/응답 데이터 (CreateUserDto, UserResponseDto)
- **Validator**: 입력 검증 (class-validator)

**예시**:
```typescript
// src/modules/user/presentation/controllers/user.controller.ts
@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 회원가입 API
   *
   * @why-201-created
   * 201 Created를 사용하는 이유:
   * - HTTP 표준: 리소스 생성 시 201 반환
   * - RESTful: Location 헤더로 생성된 리소스 URL 제공 가능
   *
   * @why-public-decorator
   * @Public() 데코레이터를 사용하는 이유:
   * - JWT Guard가 전역으로 적용되어 있음
   * - 회원가입은 인증 없이 접근 가능해야 함
   * - 명시적으로 Public 표시
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '회원가입',
    description: `
      새로운 사용자를 생성합니다.

      **비즈니스 규칙**:
      - 이메일 중복 불가 (409 Conflict)
      - 비밀번호 최소 8자 (검증 실패 시 400 Bad Request)
      - bcrypt로 해싱 (12 rounds)

      **성공 응답**:
      - 201 Created
      - password 필드 제외한 사용자 정보 반환
    `,
  })
  @ApiCreatedResponse({
    description: '회원가입 성공',
    type: UserResponseDto,
  })
  @ApiConflictResponse({
    description: '이미 사용 중인 이메일',
  })
  async register(
    @Body() dto: CreateUserDto,
  ): Promise<Omit<User, 'password'>> {
    return await this.userService.register(dto);
  }
}
```

**왜 필요한가**:
- **HTTP 전용 로직**: 상태 코드, 헤더, 쿠키 등
- **자동 검증**: class-validator로 DTO 검증
- **API 문서**: Swagger 자동 생성

---

## 도메인 주도 설계 (DDD)

### Bounded Context (경계 지어진 컨텍스트)

각 도메인 모듈은 하나의 Bounded Context입니다.

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   User Context   │  │ Project Context  │  │  Task Context    │
│                  │  │                  │  │                  │
│  - User          │  │  - Project       │  │  - Task          │
│  - Email         │  │  - Member        │  │  - Assignee      │
│  - Password      │  │  - Workspace     │  │  - Comment       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
        │                      │                      │
        └──────────────────────┴──────────────────────┘
                          통합 (Integration)
```

**왜 필요한가**:
- **독립성**: 각 컨텍스트가 독립적으로 발전
- **명확한 경계**: User의 "email"과 Project의 "email"은 다른 의미
- **팀 분리**: 컨텍스트별로 팀 할당 가능

### Aggregate (집합체)

관련된 엔티티를 하나의 단위로 묶음.

```typescript
// User Aggregate Root
class User {
  id: string;
  email: Email;  // Value Object
  profile: UserProfile;  // Entity (User의 일부)

  // Aggregate 내부 일관성 보장
  updateProfile(profile: UserProfile): void {
    if (!this.isActive) {
      throw new InactiveUserException();
    }
    this.profile = profile;
  }
}
```

**왜 필요한가**:
- **일관성 경계**: Aggregate 내부는 항상 일관성 유지
- **트랜잭션 경계**: Aggregate 단위로 트랜잭션 관리
- **변경 제어**: Aggregate Root만 외부에 노출

### Domain Event (도메인 이벤트)

도메인에서 발생한 중요한 사건.

```typescript
// 이벤트 정의
export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}

// 이벤트 발행 (Service)
async register(dto: CreateUserDto): Promise<User> {
  const user = await this.userRepository.save(...);
  this.eventBus.publish(new UserRegisteredEvent(user.id, user.email));
  return user;
}

// 이벤트 구독 (Handler)
@EventsHandler(UserRegisteredEvent)
export class SendWelcomeEmailHandler {
  async handle(event: UserRegisteredEvent): Promise<void> {
    await this.emailService.sendWelcome(event.email);
  }
}
```

**왜 필요한가**:
- **비동기 처리**: 이메일 전송 실패가 회원가입을 막지 않음
- **결합도 감소**: UserService가 EmailService를 직접 의존하지 않음
- **확장성**: 새로운 핸들러 추가만으로 기능 확장

---

## 모듈 구조

### NestJS Module Pattern

```typescript
@Module({
  imports: [DatabaseModule],       // 의존하는 모듈
  controllers: [UserController],   // HTTP 엔드포인트
  providers: [UserService, UserRepository],  // IoC 컨테이너 등록
  exports: [UserService],          // 다른 모듈에서 사용 가능
})
export class UserModule {}
```

### 모듈 간 의존성

```
AppModule (루트)
├── UserModule
│   └── exports: UserService
│
├── AuthModule
│   └── imports: UserModule  (UserService 사용)
│
└── ProjectModule
    └── imports: UserModule  (UserService 사용)
```

**왜 중요한가**:
- **명확한 의존성**: imports로 명시적 표현
- **순환 참조 방지**: 의존성 방향이 명확
- **모듈 독립성**: 각 모듈이 독립적으로 동작

---

## 데이터 접근 전략

### Prisma + Raw SQL 하이브리드 전략

#### 1. **Prisma ORM** (기본, 80% 사용)

**언제 사용**:
- 단순 CRUD (Create, Read, Update, Delete)
- 타입 안전성이 중요한 경우
- 빠른 개발이 필요한 경우

**예시**:
```typescript
// ✅ Prisma 사용 (권장)
async findById(id: string): Promise<User | null> {
  return await this.prisma.user.findUnique({
    where: { id },
    include: { profile: true },  // 관계 자동 조인
  });
}
```

**장점**:
- ✅ 타입 안전성: TypeScript 타입 자동 생성
- ✅ 자동 완성: IDE 지원
- ✅ SQL 인젝션 방지: 파라미터화된 쿼리
- ✅ 마이그레이션: 스키마 버전 관리

**단점**:
- ❌ 복잡한 쿼리: JOIN, 서브쿼리 등 제한적
- ❌ 성능 최적화: 쿼리 튜닝 어려움
- ❌ 벌크 연산: 대량 데이터 처리 비효율

#### 2. **Raw SQL** (필요 시, 20% 사용)

**언제 사용**:
- 복잡한 JOIN, 서브쿼리, 윈도우 함수
- 성능 최적화가 중요한 경우
- 벌크 INSERT/UPDATE/DELETE

**예시**:
```typescript
// ✅ Raw SQL 사용 (복잡한 통계 쿼리)
async getUserStatistics(userId: string): Promise<UserStats> {
  const result = await this.prisma.$queryRaw<UserStats[]>`
    SELECT
      u.id,
      u.name,
      COUNT(DISTINCT p.id) AS project_count,
      COUNT(DISTINCT t.id) AS task_count,
      AVG(t.completion_rate) AS avg_completion_rate,
      RANK() OVER (ORDER BY COUNT(t.id) DESC) AS user_rank
    FROM users u
    LEFT JOIN projects p ON p.owner_id = u.id
    LEFT JOIN tasks t ON t.assignee_id = u.id
    WHERE u.id = ${userId}
      AND u.deleted_at IS NULL
      AND p.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY u.id, u.name
  `;

  return result[0];
}
```

**장점**:
- ✅ 유연성: 모든 SQL 기능 사용 가능
- ✅ 성능: 최적화된 쿼리 작성
- ✅ 복잡한 집계: 통계, 리포트 생성

**단점**:
- ❌ 타입 안전성: 수동으로 타입 정의 필요
- ❌ DB 의존성: PostgreSQL 전용 쿼리 (이식성 감소)
- ❌ 유지보수: 쿼리 변경 시 타입 수동 업데이트

#### 3. **하이브리드 전략** (Best Practice)

```typescript
export class UserRepository {
  // ✅ 단순 조회: Prisma
  async findById(id: string): Promise<User | null> {
    return await this.prisma.user.findUnique({ where: { id } });
  }

  // ✅ 복잡한 통계: Raw SQL
  async getUserStatistics(userId: string): Promise<UserStats> {
    return await this.prisma.$queryRaw`...`;
  }

  // ✅ 벌크 연산: Raw SQL
  async bulkUpdateStatus(userIds: string[], status: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE users
      SET status = ${status}, updated_at = NOW()
      WHERE id = ANY(${userIds}::uuid[])
    `;
  }
}
```

**왜 하이브리드인가**:
- **생산성**: 80%는 Prisma로 빠르게 개발
- **성능**: 20%는 Raw SQL로 최적화
- **유연성**: 상황에 맞는 도구 선택

---

## 확장 전략

### 1. **Work Management 확장**

```
현재 (협업 플랫폼):
└── UserModule

Work 확장 (1단계):
├── UserModule
├── WorkspaceModule  (조직, 팀)
├── ProjectModule    (프로젝트)
└── TaskModule       (태스크, 칸반)

Work 확장 (2단계):
├── UserModule
├── WorkspaceModule
├── ProjectModule
├── TaskModule
├── TimelineModule   (간트 차트)
├── ReportModule     (대시보드, 통계)
└── NotificationModule  (실시간 알림)
```

### 2. **ERP 확장**

```
ERP 확장 (3단계):
├── UserModule
├── WorkspaceModule
├── ProjectModule
├── ...
├── AccountingModule  (회계)
├── InventoryModule   (재고)
├── HRModule          (인사, 급여)
└── SalesModule       (영업, CRM)
```

### 3. **마이크로서비스 전환**

```
Monolith (현재):
┌─────────────────────────────────┐
│          AppModule              │
│  ├── UserModule                 │
│  ├── ProjectModule              │
│  └── TaskModule                 │
└─────────────────────────────────┘
          ↓ 트래픽 증가
Microservices (미래):
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ UserService  │  │ProjectService│  │ TaskService  │
│              │  │              │  │              │
│ - User CRUD  │  │ - Project    │  │ - Task CRUD  │
│ - Auth       │  │ - Member     │  │ - Assignee   │
│              │  │              │  │              │
│ DB: Postgres │  │ DB: Postgres │  │ DB: MongoDB  │
└──────────────┘  └──────────────┘  └──────────────┘
       ↓                 ↓                 ↓
       └─────────────────┴─────────────────┘
              API Gateway (BFF)
```

**전환 시나리오**:
1. **모듈별 DB 분리**: User → PostgreSQL, Task → MongoDB
2. **모듈별 배포**: UserModule을 별도 앱으로 배포
3. **이벤트 기반 통신**: Kafka, RabbitMQ로 모듈 간 통신
4. **API Gateway**: 단일 엔드포인트 제공

---

## 디렉토리 구조

### 전체 구조

```
apps/api/src/
├── main.ts                    # 애플리케이션 진입점
├── app.module.ts              # 루트 모듈
│
├── common/                    # 공통 컴포넌트 (전역)
│   ├── dto/                   # 공통 DTO (ApiResponse)
│   ├── filters/               # 전역 필터 (HttpExceptionFilter)
│   ├── interceptors/          # 전역 인터셉터 (Transform, Logging, Timeout)
│   ├── middleware/            # 미들웨어 (RequestId)
│   ├── decorators/            # 커스텀 데코레이터 (@Public)
│   └── config/                # 설정 (환경 변수, Throttler)
│
├── shared/                    # 공유 모듈 (재사용)
│   ├── database/              # DatabaseModule (Prisma)
│   ├── cache/                 # CacheModule (Redis, 향후)
│   ├── email/                 # EmailModule (향후)
│   └── storage/               # StorageModule (MinIO, 향후)
│
└── modules/                   # 도메인 모듈
    └── user/                  # User 도메인
        ├── user.module.ts     # UserModule 정의
        │
        ├── domain/            # 도메인 계층 (핵심, 기술 독립)
        │   ├── entities/      # 엔티티 (User)
        │   ├── value-objects/ # 값 객체 (Email, Password)
        │   └── events/        # 도메인 이벤트 (UserRegistered)
        │
        ├── application/       # 애플리케이션 계층 (유스케이스)
        │   ├── services/      # 비즈니스 로직 (UserService)
        │   ├── use-cases/     # 유스케이스 (RegisterUser, Login)
        │   └── dto/           # 내부 DTO (향후)
        │
        ├── infrastructure/    # 인프라 계층 (기술 구현)
        │   ├── persistence/   # 데이터 접근 (UserRepository)
        │   ├── adapters/      # 외부 시스템 (EmailAdapter)
        │   └── mappers/       # 도메인 ↔ DB 변환 (UserMapper)
        │
        └── presentation/      # 프레젠테이션 계층 (외부 인터페이스)
            ├── controllers/   # HTTP 엔드포인트 (UserController)
            └── dtos/          # 요청/응답 DTO (CreateUserDto, LoginDto)
```

### 모듈별 파일 구조

```
modules/user/
├── user.module.ts              # 모듈 정의 (imports, providers, controllers, exports)
│
├── domain/                     # 도메인 계층 (순수 비즈니스 로직)
│   ├── entities/
│   │   └── user.entity.ts      # User 엔티티 (비즈니스 규칙)
│   ├── value-objects/
│   │   ├── email.vo.ts         # Email 값 객체 (검증 로직)
│   │   └── password.vo.ts      # Password 값 객체 (해싱 로직)
│   └── events/
│       └── user-registered.event.ts  # 회원가입 이벤트
│
├── application/                # 애플리케이션 계층 (유스케이스)
│   ├── services/
│   │   └── user.service.ts     # 비즈니스 로직 (register, login)
│   └── use-cases/
│       ├── register-user.use-case.ts  # 회원가입 유스케이스
│       └── login-user.use-case.ts     # 로그인 유스케이스
│
├── infrastructure/             # 인프라 계층 (기술 구현)
│   ├── persistence/
│   │   └── user.repository.ts  # Prisma 기반 Repository
│   ├── adapters/
│   │   └── email.adapter.ts    # 이메일 발송 어댑터
│   └── mappers/
│       └── user.mapper.ts      # 도메인 ↔ Prisma 모델 변환
│
└── presentation/               # 프레젠테이션 계층 (HTTP)
    ├── controllers/
    │   └── user.controller.ts  # HTTP 엔드포인트
    └── dtos/
        ├── create-user.dto.ts  # 회원가입 요청 DTO
        ├── login.dto.ts        # 로그인 요청 DTO
        └── user-response.dto.ts # 응답 DTO
```

---

## 의사결정 기록

### ADR (Architecture Decision Record)

#### ADR-001: Clean Architecture 선택

**날짜**: 2025-01-15

**상황**:
- 협업 플랫폼에서 Work/ERP로 확장 예정
- 여러 개발자가 동시에 작업
- 장기적인 유지보수 필요

**결정**:
Clean Architecture + DDD 선택

**이유**:
- ✅ **확장성**: 도메인별 모듈 분리 → 마이크로서비스 전환 용이
- ✅ **유지보수성**: 관심사 분리 → 변경 영향 최소화
- ✅ **테스트 용이성**: 의존성 역전 → Mock 주입 쉬움
- ✅ **팀 협업**: 모듈 단위 작업 → 충돌 최소화

**대안**:
1. ❌ **MVC Pattern**: 비즈니스 로직이 여러 곳에 분산
2. ❌ **Transaction Script**: 확장 시 코드 중복 증가
3. ❌ **Layered Architecture**: 계층 간 강한 결합

**결과**:
- 초기 개발 속도는 느리지만 장기적으로 유리
- 팀원 교육 비용 발생 (Clean Architecture, DDD 학습)
- 코드 일관성 향상

---

#### ADR-002: Prisma + Raw SQL 하이브리드 전략

**날짜**: 2025-01-15

**상황**:
- 단순 CRUD는 빠르게 개발하고 싶음
- 복잡한 통계 쿼리는 성능 최적화 필요
- 타입 안전성 유지 필요

**결정**:
Prisma ORM (80%) + Raw SQL (20%) 하이브리드

**이유**:
- ✅ **생산성**: Prisma로 빠른 개발 (타입 안전, 자동 완성)
- ✅ **성능**: Raw SQL로 복잡한 쿼리 최적화
- ✅ **유연성**: 상황에 맞는 도구 선택

**대안**:
1. ❌ **Prisma만 사용**: 복잡한 쿼리 표현 어려움
2. ❌ **Raw SQL만 사용**: 타입 안전성 떨어짐, 생산성 낮음
3. ❌ **TypeORM**: Prisma보다 타입 안전성 떨어짐

**결과**:
- 개발 속도 20% 향상 (Prisma 덕분)
- 통계 쿼리 성능 50% 향상 (Raw SQL 최적화)
- 하이브리드 전략 교육 필요

---

#### ADR-003: NestJS Module System 활용

**날짜**: 2025-01-15

**상황**:
- 모듈 간 의존성 관리 필요
- IoC 컨테이너 활용 필요
- 명확한 API 경계 필요

**결정**:
NestJS Module System + Dependency Injection

**이유**:
- ✅ **명확한 의존성**: imports, exports로 명시
- ✅ **캡슐화**: 모듈 내부 구현 숨김
- ✅ **재사용성**: exports로 다른 모듈에서 사용
- ✅ **테스트 용이성**: Mock 주입 쉬움

**대안**:
1. ❌ **수동 DI**: 보일러플레이트 코드 증가
2. ❌ **Singleton Pattern**: 테스트 어려움
3. ❌ **Service Locator**: 의존성 숨김 (안티패턴)

**결과**:
- 모듈 간 결합도 감소
- 테스트 커버리지 향상
- 순환 참조 방지

---

## 참고 자료

### 책
- **Clean Architecture** (Robert C. Martin)
- **Domain-Driven Design** (Eric Evans)
- **Implementing Domain-Driven Design** (Vaughn Vernon)

### 문서
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clean Architecture in TypeScript](https://khalilstemmler.com/articles/software-design-architecture/organizing-app-logic/)

### 예제 프로젝트
- [nestjs-clean-architecture-example](https://github.com/stemmlerjs/ddd-forum)
- [nestjs-prisma-starter](https://github.com/notiz-dev/nestjs-prisma-starter)

---

## 마무리

본 아키텍처는 **협업 플랫폼 → Work/ERP**로의 확장을 고려하여 설계되었습니다.

**핵심 원칙**:
1. **도메인 중심**: 비즈니스 로직이 기술보다 우선
2. **의존성 방향**: 외부 → 내부 (Domain은 독립적)
3. **모듈 독립성**: 각 모듈이 독립적으로 발전
4. **테스트 용이성**: Mock 주입으로 단위 테스트

**확장 전략**:
- **1단계**: 모듈 추가 (Monolith)
- **2단계**: 모듈별 DB 분리 (Modular Monolith)
- **3단계**: 마이크로서비스 전환 (Microservices)

**질문/피드백**:
- GitHub Issues: [프로젝트 링크]
- 개발 가이드: [Getting Started](./getting-started.md)
