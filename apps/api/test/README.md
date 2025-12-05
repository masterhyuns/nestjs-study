# 테스트 가이드

## 목차
- [개요](#개요)
- [테스트 전략](#테스트-전략)
- [환경 설정](#환경-설정)
- [테스트 실행](#테스트-실행)
- [테스트 작성 가이드](#테스트-작성-가이드)
- [디렉토리 구조](#디렉토리-구조)

---

## 개요

이 프로젝트는 **테스트 피라미드** 전략을 따릅니다:
```
       /\
      /  \     E2E Tests (10%)
     /____\    - 전체 워크플로우 검증
    /      \
   /        \  Integration Tests (20%)
  /__________\ - DB, 외부 서비스 통합
 /            \
/______________\ Unit Tests (70%)
                - 비즈니스 로직 검증
```

### 왜 이런 비율인가?

1. **Unit Tests (70%)**
   - **빠름**: 밀리초 단위 (Mock 사용)
   - **격리**: 각 컴포넌트 독립 테스트
   - **디버깅 용이**: 실패 시 정확한 위치 파악
   - **예시**: DTO 검증, Repository 로직, Service 비즈니스 로직

2. **Integration Tests (20%)**
   - **실제 환경**: 실제 DB, Redis 등 사용
   - **통합 검증**: 여러 컴포넌트 함께 동작
   - **제약조건**: DB UNIQUE, FK 등 검증
   - **예시**: 복잡한 쿼리, 트랜잭션, DB 제약조건

3. **E2E Tests (10%)**
   - **사용자 관점**: HTTP → DB 전체 플로우
   - **회귀 방지**: 주요 기능 동작 보장
   - **API 계약**: Swagger 문서와 일치 확인
   - **예시**: 회원가입, 로그인, 프로젝트 생성

---

## 테스트 전략

### 1. Unit Test 작성 기준

**언제 작성하나?**
- DTO Validation 로직
- Service 비즈니스 로직
- 간단한 Repository CRUD
- Utility 함수

**어떻게 작성하나?**
```typescript
import { prismaMock } from '@/test/helpers/mock-prisma.helper';
import { createUser } from '@/test/helpers/fixtures.helper';

describe('UserService', () => {
  it('should create user', async () => {
    // Arrange: Mock 설정
    const mockUser = createUser();
    prismaMock.user.create.mockResolvedValue(mockUser);

    // Act: 서비스 실행
    const result = await userService.create(dto);

    // Assert: 결과 검증
    expect(result).toEqual(mockUser);
  });
});
```

### 2. Integration Test 작성 기준

**언제 작성하나?**
- 복잡한 쿼리 (JOIN, aggregation)
- Raw SQL 쿼리
- 트랜잭션 동작
- DB 제약조건 검증

**어떻게 작성하나?**
```typescript
describe('UserRepository Integration', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    // 실제 DB 연결
    prisma = new PrismaService();
  });

  afterEach(async () => {
    // DB 클린업
    await prisma.user.deleteMany();
  });

  it('should enforce unique email constraint', async () => {
    await repository.create({ email: 'test@example.com' });

    // 중복 이메일 시도
    await expect(
      repository.create({ email: 'test@example.com' })
    ).rejects.toThrow();
  });
});
```

### 3. E2E Test 작성 기준

**언제 작성하나?**
- 핵심 사용자 워크플로우
- 회원가입, 로그인 같은 주요 기능
- API 계약 검증

**어떻게 작성하나?**
```typescript
describe('POST /api/v1/users/register (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // 전체 앱 초기화
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    // 전역 설정 적용
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  it('should register new user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users/register')
      .send(dto)
      .expect(201);

    expect(response.body).toHaveApiSuccessFormat();
  });
});
```

---

## 환경 설정

### 1. 의존성 설치

```bash
# 프로젝트 루트에서
pnpm install
```

### 2. 테스트 DB 설정

#### Docker Compose 사용 (권장)

```bash
# PostgreSQL 테스트 DB 실행
docker-compose up -d postgres

# Redis 테스트 서버 실행 (선택)
docker-compose up -d redis
```

#### 수동 설정

```bash
# PostgreSQL 설치 및 테스트 DB 생성
createdb collaboration_test
```

### 3. 환경 변수 설정

```bash
# .env.test 파일 생성
cp .env.test.example .env.test

# 내용 편집 (필요 시)
vi .env.test
```

### 4. DB Migration 실행

```bash
# Prisma 마이그레이션 실행
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/collaboration_test \
pnpm prisma migrate deploy

# Prisma Client 생성
pnpm prisma generate
```

---

## 테스트 실행

### 전체 테스트 실행

```bash
# 모든 테스트 (Unit + Integration + E2E)
pnpm test

# Watch 모드 (파일 변경 시 자동 재실행)
pnpm test:watch

# Coverage 포함
pnpm test:cov
```

### 테스트 타입별 실행

```bash
# Unit Tests만 (빠름, ~1-2초)
pnpm test src/

# Integration Tests만 (보통, ~5-10초)
pnpm test test/integration

# E2E Tests만 (느림, ~10-30초)
pnpm test:e2e
```

### 특정 파일/패턴 실행

```bash
# 특정 파일
pnpm test src/modules/user/presentation/dtos/__tests__/create-user.dto.spec.ts

# 패턴 매칭
pnpm test --testPathPattern=user

# 특정 describe/it 블록
pnpm test --testNamePattern="should create user"
```

### 디버깅

```bash
# 디버그 모드로 실행
pnpm test:debug

# VS Code에서 F5로 디버깅 가능
# .vscode/launch.json 설정 필요
```

### CI/CD에서 실행

```bash
# Coverage 포함, 병렬 실행
CI=true pnpm test:cov --maxWorkers=4

# E2E만 (Smoke Test)
CI=true pnpm test:e2e
```

---

## 테스트 작성 가이드

### 파일 위치

#### Unit Tests
```
src/
  modules/
    user/
      presentation/
        dtos/
          __tests__/
            create-user.dto.spec.ts  ← DTO 테스트
      infrastructure/
        persistence/
          __tests__/
            user.repository.spec.ts  ← Repository 테스트
      application/
        services/
          __tests__/
            user.service.spec.ts     ← Service 테스트
```

#### Integration Tests
```
test/
  integration/
    user.repository.integration.spec.ts
    user.service.integration.spec.ts
```

#### E2E Tests
```
test/
  e2e/
    user-registration.e2e-spec.ts
    user-login.e2e-spec.ts
```

### 네이밍 컨벤션

- **Unit Test**: `*.spec.ts`
- **Integration Test**: `*.integration.spec.ts`
- **E2E Test**: `*.e2e-spec.ts`

### 테스트 구조 (AAA 패턴)

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with hashed password', async () => {
      // Arrange (준비)
      const dto = createUserDto();
      const mockUser = createUser();
      prismaMock.user.create.mockResolvedValue(mockUser);

      // Act (실행)
      const result = await userService.createUser(dto);

      // Assert (검증)
      expect(result).toEqual(mockUser);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: dto.email,
          password: expect.not.stringContaining(dto.password), // 해싱됨
        }),
      });
    });
  });
});
```

### 커스텀 Matchers 사용

```typescript
// API 응답 형식 검증
expect(response.body).toHaveApiSuccessFormat();
expect(response.body).toHaveApiErrorFormat();

// 이메일 검증
expect(user.email).toBeValidEmail();

// UUID 검증
expect(user.id).toBeUUID();

// 휴대폰 번호 검증
expect(user.phoneNumber).toBeValidPhoneNumber();
```

---

## 디렉토리 구조

```
apps/api/
├── src/
│   ├── modules/
│   │   └── user/
│   │       ├── presentation/
│   │       │   └── dtos/
│   │       │       ├── __tests__/
│   │       │       │   └── create-user.dto.spec.ts       ← Unit Test
│   │       │       └── create-user.dto.ts
│   │       ├── infrastructure/
│   │       │   └── persistence/
│   │       │       ├── __tests__/
│   │       │       │   └── user.repository.spec.ts       ← Unit Test
│   │       │       └── user.repository.ts
│   │       └── application/
│   │           └── services/
│   │               ├── __tests__/
│   │               │   └── user.service.spec.ts          ← Unit Test
│   │               └── user.service.ts
│   └── common/
│       └── validators/
│           ├── password.validator.ts                     ← 커스텀 Validator
│           ├── match.validator.ts
│           └── phone.validator.ts
│
├── test/
│   ├── setup.ts                                          ← 전역 설정
│   ├── jest-e2e.json                                     ← E2E Jest 설정
│   ├── helpers/
│   │   ├── mock-prisma.helper.ts                        ← Prisma Mock
│   │   └── fixtures.helper.ts                           ← 테스트 데이터
│   ├── integration/
│   │   └── user.repository.integration.spec.ts          ← Integration Test
│   └── e2e/
│       └── user-registration.e2e-spec.ts                ← E2E Test
│
├── jest.config.js                                        ← Jest 설정
├── .env.test.example                                     ← 환경 변수 예시
└── .env.test                                             ← 실제 환경 변수 (git ignore)
```

---

## 주요 파일 설명

### 1. `jest.config.js`
- Jest 전역 설정
- Coverage 임계값 (80%)
- 모듈 경로 별칭 (@/)
- 병렬 실행 설정

### 2. `test/setup.ts`
- 전역 환경 변수 설정
- 커스텀 Matchers 정의
- Console 출력 제어
- 테스트 간 클린업

### 3. `test/helpers/mock-prisma.helper.ts`
- Prisma Mock 객체
- 에러 시뮬레이션 (P2002, P2025 등)
- 트랜잭션 Mock
- 검증 헬퍼 함수

### 4. `test/helpers/fixtures.helper.ts`
- 테스트 데이터 Factory
- User, Workspace, Project, Task 생성
- DTO Fixture
- 복잡한 시나리오 생성

---

## 모범 사례

### DO ✅

1. **각 테스트는 독립적으로**
   ```typescript
   afterEach(() => {
     jest.clearAllMocks();
   });
   ```

2. **의미 있는 테스트 이름**
   ```typescript
   it('should create user with hashed password', async () => {
     // 명확한 테스트 의도
   });
   ```

3. **AAA 패턴 사용**
   ```typescript
   // Arrange
   const dto = createUserDto();

   // Act
   const result = await service.create(dto);

   // Assert
   expect(result).toBeDefined();
   ```

4. **Fixture 활용**
   ```typescript
   const user = createUser({ email: 'custom@example.com' });
   ```

5. **에러 케이스도 테스트**
   ```typescript
   await expect(service.create(invalidDto)).rejects.toThrow();
   ```

### DON'T ❌

1. **테스트 간 의존성 만들지 말기**
   ```typescript
   // ❌ Bad
   let userId;
   it('should create user', async () => {
     userId = await service.create(dto);
   });
   it('should find user', async () => {
     await service.findById(userId); // 이전 테스트에 의존!
   });
   ```

2. **실제 외부 서비스 호출하지 말기**
   ```typescript
   // ❌ Bad
   await sendEmail('test@example.com'); // 실제 이메일 발송!

   // ✅ Good
   emailService.send = jest.fn();
   ```

3. **너무 많은 것을 한 번에 테스트하지 말기**
   ```typescript
   // ❌ Bad
   it('should create user, workspace, project, task', async () => {
     // 너무 많은 동작!
   });

   // ✅ Good
   it('should create user', async () => { ... });
   it('should create workspace', async () => { ... });
   ```

4. **Magic Number/String 사용하지 말기**
   ```typescript
   // ❌ Bad
   expect(result).toBe('test@example.com');

   // ✅ Good
   const expectedEmail = 'test@example.com';
   expect(result).toBe(expectedEmail);
   ```

---

## 트러블슈팅

### 문제: 테스트가 느려요

**원인**: Integration/E2E 테스트가 너무 많음

**해결**:
```bash
# Unit Test만 실행
pnpm test src/

# 병렬 실행 증가
pnpm test --maxWorkers=8
```

### 문제: DB 연결 에러

**원인**: 테스트 DB가 실행되지 않음

**해결**:
```bash
# Docker로 DB 실행
docker-compose up -d postgres

# 환경 변수 확인
cat .env.test
```

### 문제: Prisma Mock이 작동하지 않음

**원인**: jest-mock-extended 미설치

**해결**:
```bash
pnpm add -D jest-mock-extended
```

### 문제: Coverage가 낮아요

**원인**: 테스트되지 않은 파일 존재

**해결**:
```bash
# Coverage 리포트 확인
pnpm test:cov
open coverage/lcov-report/index.html
```

---

## 추가 리소스

- [Jest 공식 문서](https://jestjs.io/)
- [NestJS Testing 가이드](https://docs.nestjs.com/fundamentals/testing)
- [Prisma Testing 가이드](https://www.prisma.io/docs/guides/testing)
- [테스트 피라미드](https://martinfowler.com/articles/practical-test-pyramid.html)

---

**작성 원칙**: 왜 이렇게 구현했는지에 대한 주석 포함
