# 의존성 주입 가이드 (Dependency Injection Guide)

## 개요

본 프로젝트는 **NestJS의 의존성 주입(DI, Dependency Injection) 시스템**을 활용하여 느슨하게 결합된(loosely coupled) 코드를 작성합니다.

## @Injectable() 데코레이터란?

### 정의

`@Injectable()`은 **클래스를 NestJS IoC(Inversion of Control) 컨테이너에 등록**하는 데코레이터입니다.

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findById(id: string) {
    return await this.userRepository.findById(id);
  }
}
```

**역할:**
- 이 클래스를 **Provider**로 등록
- NestJS가 인스턴스 생성 및 생명주기 관리
- 다른 클래스에서 의존성으로 주입 가능

## 왜 @Injectable()이 필요한가?

### 문제 상황: 수동 의존성 관리

```typescript
// ❌ @Injectable() 없이 (전통적인 방식)

class PrismaService {
  constructor() {
    // DB 연결
  }
}

class UserRepository {
  private prisma: PrismaService;

  constructor() {
    // 😰 문제 1: 직접 인스턴스 생성
    this.prisma = new PrismaService();
  }
}

class UserService {
  private userRepository: UserRepository;

  constructor() {
    // 😰 문제 2: 의존성 체인 수동 관리
    this.userRepository = new UserRepository();
  }
}

class UserController {
  private userService: UserService;

  constructor() {
    // 😰 문제 3: 최상위에서 모든 의존성 생성
    this.userService = new UserService();
  }
}
```

**문제점:**
1. **강한 결합 (Tight Coupling)**: 클래스가 구체적인 구현에 의존
2. **테스트 어려움**: Mock 객체 주입 불가능
3. **코드 중복**: 인스턴스 생성 로직 반복
4. **싱글톤 관리 불가**: 매번 새 인스턴스 생성 (메모리 낭비)
5. **유지보수 어려움**: 의존성 변경 시 모든 곳 수정

### 해결책: @Injectable() 사용

```typescript
// ✅ @Injectable() 사용 (NestJS DI)

@Injectable()
export class PrismaService {
  constructor() {
    // DB 연결
  }
}

@Injectable()
export class UserRepository {
  // ✅ 자동 주입 (NestJS가 인스턴스 생성 및 주입)
  constructor(private readonly prisma: PrismaService) {}
}

@Injectable()
export class UserService {
  // ✅ 자동 주입
  constructor(private readonly userRepository: UserRepository) {}
}

@Controller('users')
export class UserController {
  // ✅ 자동 주입
  constructor(private readonly userService: UserService) {}
}
```

**장점:**
1. **느슨한 결합 (Loose Coupling)**: 인터페이스/추상화에 의존
2. **테스트 용이**: Mock 객체 쉽게 주입 가능
3. **코드 간결**: `new` 키워드 불필요
4. **싱글톤 자동 관리**: 메모리 효율적
5. **유지보수 쉬움**: constructor만 수정

## NestJS DI 동작 원리

### 1. 모듈에 Provider 등록

```typescript
// apps/api/src/modules/user/user.module.ts

@Module({
  imports: [DatabaseModule],  // 다른 모듈에서 export한 provider 가져오기
  providers: [
    UserService,        // ← @Injectable()이 있어야 등록 가능
    UserRepository,     // ← @Injectable()이 있어야 등록 가능
  ],
  controllers: [UserController],
  exports: [UserService],  // 다른 모듈에서 사용할 수 있도록 export
})
export class UserModule {}
```

### 2. 의존성 그래프 자동 해결

```
애플리케이션 시작 시 NestJS가 하는 일:

1. 모듈 스캔
   └─ UserModule
      ├─ providers: [UserService, UserRepository]
      ├─ controllers: [UserController]
      └─ imports: [DatabaseModule]

2. 의존성 그래프 생성
   UserController
     └─ UserService
          └─ UserRepository
               └─ PrismaService (DatabaseModule에서 제공)

3. 올바른 순서로 인스턴스 생성
   ① PrismaService 생성
   ② UserRepository 생성 (PrismaService 주입)
   ③ UserService 생성 (UserRepository 주입)
   ④ UserController 생성 (UserService 주입)

4. 싱글톤으로 관리
   - 각 provider는 애플리케이션 전체에서 단 하나의 인스턴스만 존재
   - 메모리 효율적
```

### 3. Constructor Injection (생성자 주입)

```typescript
@Injectable()
export class UserService {
  /**
   * Constructor Injection
   *
   * @why-constructor-injection
   * 생성자 주입을 사용하는 이유:
   * - **불변성**: 의존성이 생성 후 변경되지 않음
   * - **필수 의존성 명시**: 생성자 파라미터로 필수 의존성 표현
   * - **테스트 용이**: Mock 주입이 명확
   * - **순환 참조 감지**: 컴파일 타임에 순환 참조 발견
   */
  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: StructuredLoggerService,
  ) {}

  async register(dto: CreateUserDto) {
    this.logger.logInfo('사용자 등록 시작', { email: dto.email });
    return await this.userRepository.create(dto);
  }
}
```

**TypeScript `private readonly` 단축 구문:**
```typescript
// 아래 두 코드는 동일

// 전통적인 방식
export class UserService {
  private readonly userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }
}

// TypeScript 단축 구문 (권장)
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}
  // ← 자동으로 필드 선언 + 할당
}
```

## 프로젝트 실제 예시

### 1. Service에서 DI 사용

```typescript
// apps/api/src/modules/user/application/services/user.service.ts

@Injectable()
export class UserService {
  /**
   * @why-inject-dependencies
   * UserRepository를 주입받는 이유:
   * - DB 접근 로직 분리 (Single Responsibility)
   * - 테스트 시 Mock Repository 주입 가능
   * - Repository 구현 변경 시 Service 코드 수정 불필요
   */
  constructor(private readonly userRepository: UserRepository) {}

  async register(dto: CreateUserDto): Promise<Omit<User, 'password'>> {
    // 1. 이메일 중복 체크
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('이미 사용 중인 이메일입니다');
    }

    // 2. 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // 3. 사용자 생성
    const user = await this.userRepository.create({
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      name: dto.name.trim(),
    });

    // 4. 비밀번호 제거 후 반환
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
```

### 2. Repository에서 DI 사용

```typescript
// apps/api/src/modules/user/infrastructure/persistence/user.repository.ts

@Injectable()
export class UserRepository {
  /**
   * @why-inject-prisma
   * PrismaService를 주입받는 이유:
   * - DB 연결 재사용 (싱글톤)
   * - 트랜잭션 관리 용이
   * - 테스트 시 Mock PrismaService 주입 가능
   */
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return await this.prisma.user.create({ data });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id },
    });
  }
}
```

### 3. Interceptor에서 DI 사용

```typescript
// apps/api/src/common/interceptors/logging.interceptor.ts

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  /**
   * @why-inject-logger
   * StructuredLoggerService를 주입받는 이유:
   * - 일관된 로그 포맷 (HttpExceptionFilter와 동일)
   * - 중앙화된 로깅 로직
   * - 테스트 시 Mock Logger 주입 가능
   */
  constructor(private readonly logger: StructuredLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestLogData = StructuredLoggerService.extractRequestLogData(request);

    // StructuredLoggerService의 메서드 사용
    this.logger.logRequest(requestLogData);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.logResponse({
            ...requestLogData,
            statusCode: response.statusCode,
            duration: Date.now() - startTime,
          });
        },
      }),
    );
  }
}
```

### 4. Filter에서 DI 사용

```typescript
// apps/api/src/common/filters/http-exception.filter.ts

@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * @why-inject-logger
   * StructuredLoggerService를 주입받는 이유:
   * - LoggingInterceptor와 동일한 로그 포맷
   * - 4xx/5xx 자동 레벨 결정 (WARN/ERROR)
   * - Stack Trace 자동 처리
   */
  constructor(private readonly logger: StructuredLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // ... 에러 처리 ...

    // StructuredLoggerService의 메서드 사용
    this.logger.logError(
      {
        requestId,
        method: request.method,
        url: request.url,
        status,
        errorCode,
        message,
        stack: exception instanceof Error ? exception.stack : undefined,
      },
      exception,
    );

    // 에러 응답 반환
    response.status(status).json(errorResponse);
  }
}
```

### 5. main.ts에서 DI 사용

```typescript
// apps/api/src/main.ts

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule);

  /**
   * @why-app-get
   * app.get()으로 provider를 가져오는 이유:
   * - LoggerModule이 Global 모듈이므로 어디서든 가져올 수 있음
   * - Filter, Interceptor에 의존성 주입하기 위함
   * - new로 생성하면 DI 혜택 못 받음 (싱글톤 관리 안 됨)
   */
  const logger = app.get(StructuredLoggerService);

  // Filter, Interceptor에 logger 주입
  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  await app.listen(3000);
};
```

## @Injectable() 없으면 어떻게 되나?

### 시나리오: @Injectable() 빠뜨린 경우

```typescript
// ❌ @Injectable() 빠뜨림
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}
}

// Module에 등록
@Module({
  providers: [UserService, UserRepository],
})
export class UserModule {}

// Controller에서 사용 시도
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}
  //           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //           💥 런타임 에러 발생!
}
```

### 에러 메시지

```
Error: Nest can't resolve dependencies of the UserController (?).
Please make sure that the argument UserService at index [0] is available
in the UserModule context.

Potential solutions:
- Is UserModule a valid NestJS module?
- If UserService is a provider, is it part of the current UserModule?
- If UserService is exported from a separate @Module, is that module imported within UserModule?
  @Module({
    imports: [ /* the Module containing UserService */ ]
  })
```

### 원인

- `@Injectable()`이 없으면 NestJS가 해당 클래스를 **Provider로 인식하지 못함**
- 의존성 그래프에서 제외됨
- 주입 시도 시 "이 클래스를 찾을 수 없다"는 에러 발생

### 해결

```typescript
// ✅ @Injectable() 추가
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}
}
```

## 어떤 클래스에 @Injectable()을 사용하는가?

### 1. Services (가장 흔함)

```typescript
@Injectable()
export class UserService { }

@Injectable()
export class EmailService { }

@Injectable()
export class AuthService { }

@Injectable()
export class NotificationService { }
```

**특징:**
- 비즈니스 로직 처리
- 다른 Services, Repositories를 주입받음
- Controller, 다른 Services에서 사용

### 2. Repositories

```typescript
@Injectable()
export class UserRepository { }

@Injectable()
export class ProjectRepository { }

@Injectable()
export class TaskRepository { }
```

**특징:**
- 데이터 접근 계층
- PrismaService를 주입받음
- Services에서 사용

### 3. Guards (인증/인가)

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // 인증 로직
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // 권한 체크
  }
}
```

### 4. Interceptors (요청/응답 변환)

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor { }

@Injectable()
export class TransformInterceptor implements NestInterceptor { }

@Injectable()
export class TimeoutInterceptor implements NestInterceptor { }
```

### 5. Filters (예외 처리)

```typescript
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter { }

@Injectable()
export class ValidationExceptionFilter implements ExceptionFilter { }
```

### 6. Pipes (데이터 변환/검증)

```typescript
@Injectable()
export class ValidationPipe implements PipeTransform { }

@Injectable()
export class ParseIntPipe implements PipeTransform { }
```

### 7. Custom Providers (유틸리티)

```typescript
@Injectable()
export class StructuredLoggerService { }

@Injectable()
export class EncryptionService { }

@Injectable()
export class CacheService { }
```

## Provider Scope (생명주기)

`@Injectable()`은 선택적으로 **scope**를 지정할 수 있습니다.

### 1. DEFAULT (기본 - Singleton)

```typescript
@Injectable()  // ← scope 생략 시 DEFAULT
export class UserService {
  // 애플리케이션 전체에서 단 하나의 인스턴스만 생성
  // 가장 일반적이고 권장되는 방식
  // 메모리 효율적
}
```

**특징:**
- **애플리케이션 시작 시 한 번만 생성**
- 모든 요청에서 동일한 인스턴스 공유
- 상태를 공유하므로 주의 필요

**사용 사례:**
- 대부분의 Services, Repositories
- 상태가 없는(stateless) 클래스

### 2. REQUEST (요청별 인스턴스)

```typescript
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {
  // HTTP 요청마다 새 인스턴스 생성
  // 요청 컨텍스트 저장 가능
}
```

**특징:**
- **각 HTTP 요청마다 새 인스턴스 생성**
- 요청 종료 시 가비지 컬렉션
- 요청별로 다른 데이터를 저장 가능

**사용 사례:**
- 요청별 사용자 정보 저장
- 요청별 로깅 컨텍스트
- 멀티테넌트 애플리케이션

**주의:**
- 성능 오버헤드 (인스턴스 매번 생성)
- REQUEST scope provider를 주입받는 모든 provider도 REQUEST scope가 됨

### 3. TRANSIENT (일시적 - 매번 새 인스턴스)

```typescript
@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {
  // 주입될 때마다 새 인스턴스 생성
  // 상태를 절대 공유하지 않음
}
```

**특징:**
- **주입될 때마다 새 인스턴스 생성**
- 각 consumer가 독립적인 인스턴스 소유
- 상태를 공유하지 않음

**사용 사례:**
- 상태를 가진 유틸리티 클래스
- 독립적인 설정이 필요한 경우

**주의:**
- 메모리 사용량 증가
- 성능 오버헤드

### Scope 비교

| Scope | 인스턴스 생성 시점 | 인스턴스 개수 | 메모리 | 성능 | 사용 사례 |
|-------|----------------|-------------|--------|------|----------|
| **DEFAULT** | 앱 시작 시 1회 | 1개 (전체) | ✅ 효율 | ✅ 빠름 | 대부분의 Services |
| **REQUEST** | 요청마다 | N개 (요청 수) | ⚠️ 보통 | ⚠️ 보통 | 요청별 컨텍스트 |
| **TRANSIENT** | 주입마다 | N개 (주입 수) | ❌ 비효율 | ❌ 느림 | 독립 상태 필요 |

## 테스트에서 DI 활용

### @Injectable() 덕분에 테스트가 쉬움

```typescript
// apps/api/src/modules/user/application/services/__tests__/user.service.spec.ts

describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    /**
     * @why-mock-injection
     * Mock 주입을 사용하는 이유:
     * - 실제 DB 접근 없이 테스트 (빠름)
     * - 테스트 격리 (다른 테스트에 영향 없음)
     * - 에러 상황 시뮬레이션 쉬움
     */
    mockRepository = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: mockRepository,  // ← Mock 주입
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('register', () => {
    it('should create user successfully', async () => {
      // Given (준비)
      const dto: CreateUserDto = {
        email: 'test@example.com',
        password: 'Password123!',
        name: '홍길동',
      };

      mockRepository.findByEmail.mockResolvedValue(null);  // 중복 없음
      mockRepository.create.mockResolvedValue({
        id: 'uuid-123',
        email: dto.email,
        name: dto.name,
        password: 'hashed-password',
        role: UserRole.MEMBER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User);

      // When (실행)
      const result = await service.register(dto);

      // Then (검증)
      expect(result.id).toBe('uuid-123');
      expect(result.email).toBe(dto.email);
      expect(result).not.toHaveProperty('password');  // 비밀번호 제거 확인
      expect(mockRepository.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when email already exists', async () => {
      // Given
      const dto: CreateUserDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        name: '홍길동',
      };

      mockRepository.findByEmail.mockResolvedValue({
        id: 'existing-id',
        email: dto.email,
      } as User);

      // When & Then
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });
});
```

### @Injectable() 없으면 테스트가 어려움

```typescript
// ❌ @Injectable() 없이 테스트

describe('UserService (without DI)', () => {
  it('should create user', async () => {
    // 😰 문제: Mock 주입 불가능
    // 실제 PrismaService, UserRepository 인스턴스 필요
    const prisma = new PrismaService();  // ← 실제 DB 연결
    const repository = new UserRepository(prisma);  // ← 실제 Repository
    const service = new UserService(repository);  // ← 실제 Service

    // 😰 문제: 테스트마다 DB 초기화 필요
    // 😰 문제: 테스트 속도 느림 (실제 DB I/O)
    // 😰 문제: 테스트 격리 어려움
  });
});
```

## Custom Provider 패턴

### 1. useClass (다른 클래스 사용)

```typescript
@Module({
  providers: [
    {
      provide: UserRepository,
      useClass: MockUserRepository,  // ← 테스트/개발 환경에서 Mock 사용
    },
  ],
})
export class UserModule {}
```

### 2. useValue (직접 값 제공)

```typescript
@Module({
  providers: [
    {
      provide: 'CONFIG',
      useValue: {
        apiKey: 'secret-key',
        timeout: 5000,
      },
    },
  ],
})
export class AppModule {}

// Service에서 사용
@Injectable()
export class ApiService {
  constructor(@Inject('CONFIG') private config: any) {
    console.log(this.config.apiKey);
  }
}
```

### 3. useFactory (동적 생성)

```typescript
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async (configService: ConfigService) => {
        const config = {
          host: configService.get('DB_HOST'),
          port: configService.get('DB_PORT'),
        };
        return await createConnection(config);
      },
      inject: [ConfigService],  // ← 팩토리 함수에 주입
    },
  ],
})
export class DatabaseModule {}
```

### 4. useExisting (별칭)

```typescript
@Module({
  providers: [
    UserService,
    {
      provide: 'USER_SERVICE_ALIAS',
      useExisting: UserService,  // ← 동일한 인스턴스 참조
    },
  ],
})
export class UserModule {}
```

## 모범 사례 (Best Practices)

### 1. ✅ Constructor Injection 사용

```typescript
// ✅ 권장: Constructor Injection
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: StructuredLoggerService,
  ) {}
}

// ❌ 비권장: Property Injection
@Injectable()
export class UserService {
  @Inject(UserRepository)
  private userRepository: UserRepository;
}
```

**이유:**
- 필수 의존성 명확히 표현
- 테스트 시 Mock 주입 쉬움
- 순환 참조 조기 발견

### 2. ✅ readonly 사용

```typescript
// ✅ 권장
constructor(private readonly userRepository: UserRepository) {}

// ❌ 비권장
constructor(private userRepository: UserRepository) {}
```

**이유:**
- 의존성이 변경되지 않음을 보장
- 의도하지 않은 재할당 방지

### 3. ✅ 인터페이스에 의존 (향후)

```typescript
// ✅ 권장 (향후 리팩토링)
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  create(data: any): Promise<User>;
}

@Injectable()
export class UserService {
  constructor(private readonly userRepository: IUserRepository) {}
  //                                         ^^^^^^^^^^^^^^^^
  //                                         인터페이스에 의존
}

// ❌ 현재 (구체 클래스에 의존)
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}
  //                                         ^^^^^^^^^^^^^^
  //                                         구체 클래스에 의존
}
```

**이유:**
- 구현체 교체 가능 (느슨한 결합)
- 테스트 시 Mock 생성 쉬움
- SOLID 원칙 (Dependency Inversion Principle)

### 4. ✅ 순환 참조 피하기

```typescript
// ❌ 순환 참조 (피해야 함)
@Injectable()
export class UserService {
  constructor(private readonly authService: AuthService) {}
}

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}
  //                        ^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                        순환 참조 발생!
}
```

**해결책:**
```typescript
// ✅ 순환 참조 해결

// 1. 공통 로직을 별도 Service로 분리
@Injectable()
export class UserHelperService {
  // 공통 로직
}

@Injectable()
export class UserService {
  constructor(private readonly userHelper: UserHelperService) {}
}

@Injectable()
export class AuthService {
  constructor(private readonly userHelper: UserHelperService) {}
}

// 2. @Inject(forwardRef(() => ...)) 사용 (최후의 수단)
@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}
}
```

### 5. ✅ Global Module 신중히 사용

```typescript
// ✅ 권장: 정말 전역적으로 필요한 것만
@Global()  // ← 모든 모듈에서 import 없이 사용 가능
@Module({
  providers: [StructuredLoggerService],
  exports: [StructuredLoggerService],
})
export class LoggerModule {}

// ❌ 비권장: 모든 모듈을 Global로
@Global()  // ← 남용하지 말 것
@Module({
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

**Global Module로 만들어야 하는 것:**
- Logger
- Config
- Database Connection

**일반 Module로 유지해야 하는 것:**
- 도메인 Services (UserService, ProjectService 등)
- Repositories

## 요약

| 항목 | @Injectable() 있음 | @Injectable() 없음 |
|------|-------------------|-------------------|
| **인스턴스 생성** | ✅ NestJS가 자동 생성 | ❌ 수동 `new` 키워드 |
| **의존성 주입** | ✅ 자동 주입 (constructor) | ❌ 수동으로 전달 |
| **싱글톤 관리** | ✅ 자동 (메모리 효율) | ❌ 매번 새 인스턴스 |
| **테스트** | ✅ Mock 주입 쉬움 | ❌ Mock 주입 어려움 |
| **유지보수** | ✅ 의존성 변경 쉬움 | ❌ 모든 곳 수정 필요 |
| **순환 참조 감지** | ✅ 컴파일 타임 감지 | ❌ 런타임에야 발견 |
| **코드 간결성** | ✅ 간결 (new 불필요) | ❌ 장황 (new 반복) |

## 체크리스트

### 새로운 Service 작성 시

- [ ] `@Injectable()` 데코레이터 추가
- [ ] 의존성을 constructor에서 `private readonly`로 주입
- [ ] Module의 `providers` 배열에 등록
- [ ] 다른 모듈에서 사용해야 하면 `exports` 배열에 추가

### 테스트 작성 시

- [ ] `Test.createTestingModule()` 사용
- [ ] Mock 객체를 `useValue`로 주입
- [ ] `module.get<T>()` 으로 인스턴스 가져오기
- [ ] 실제 DB 접근 피하기

### 문제 발생 시

- [ ] `@Injectable()` 빠뜨리지 않았는지 확인
- [ ] Module의 `providers`에 등록했는지 확인
- [ ] 순환 참조가 없는지 확인
- [ ] Import 순서 확인 (필요한 Module을 `imports`에 추가)

## 참고 자료

- [NestJS Dependency Injection](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS Provider Scopes](https://docs.nestjs.com/fundamentals/injection-scopes)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)

---

**마지막 업데이트**: 2025-12-05
**작성자**: Backend Team
**관련 파일**:
- `apps/api/src/modules/user/user.module.ts`
- `apps/api/src/common/logger/logger.module.ts`
- `apps/api/src/modules/user/application/services/user.service.ts`
- `apps/api/src/modules/user/infrastructure/persistence/user.repository.ts`
