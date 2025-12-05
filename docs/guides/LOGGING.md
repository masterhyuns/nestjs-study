# 로깅 가이드 (Logging Guide)

## 개요

본 프로젝트는 **일관되고 구조화된 로깅**을 위해 `StructuredLoggerService`를 도입했습니다.

### 왜 로깅 시스템을 리팩토링했는가?

**문제점:**
```typescript
// Before (문제 상황)

// LoggingInterceptor
{
  requestId, method, url, query, params, body  // ← timestamp 없음
}

// HttpExceptionFilter
{
  timestamp,  // ← 추가된 필드
  method, url, status, errorCode,  // ← errorCode 추가
  body, query, params  // ← 환경 분기 있음
}
```

**문제:**
1. **로그 포맷 불일치**: Interceptor와 Filter에서 다른 필드 사용
2. **코드 중복**: sanitize, 환경 분기 로직이 여러 곳에 산재
3. **타입 안전성 부족**: any 타입 사용으로 컴파일 타임 검증 불가
4. **유지보수 어려움**: 로깅 방식 변경 시 여러 파일 수정 필요

**해결책:**
```typescript
// After (해결)

// StructuredLoggerService - 모든 로그가 동일한 구조
{
  timestamp: "2025-12-05T10:30:00.000Z",  // ← 항상 포함
  level: "log" | "warn" | "error",         // ← 항상 포함
  type: "http_request" | "http_response" | "http_error",
  requestId,
  method,
  url,
  ...
}
```

## 아키텍처

### 로깅 플로우

```
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Request                              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  LoggingInterceptor                                          │
│  ├─ StructuredLoggerService.logRequest()                    │
│  │  ├─ timestamp 자동 추가                                   │
│  │  ├─ 민감 정보 제거 (password, token)                     │
│  │  └─ 환경별 분기 (development에서만 body 로깅)            │
│  └─ 요청 로그 출력: "→ POST /api/v1/users/login"           │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Controller → Service → Repository                          │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    ┌─────────────────┐      ┌─────────────────┐
    │  Success        │      │  Error          │
    └────────┬────────┘      └────────┬────────┘
             ▼                        ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ LoggingInterceptor      │  │ HttpExceptionFilter     │
│ ├─ logResponse()        │  │ ├─ logError()           │
│ │  ├─ duration 계산     │  │ │  ├─ 4xx: WARN         │
│ │  ├─ >1초면 WARN       │  │ │  ├─ 5xx: ERROR        │
│ │  └─ <1초면 LOG        │  │ │  └─ Stack Trace       │
│ └─ "← POST ... 200 45ms"│  │ └─ "POST ... 400 ..."   │
└─────────────────────────┘  └─────────────────────────┘
             │                        │
             └────────────┬───────────┘
                          ▼
         ┌─────────────────────────────────────┐
         │  StructuredLoggerService            │
         │  - 일관된 로그 포맷                  │
         │  - 타입 안전 인터페이스               │
         │  - 자동 레벨 결정                    │
         └─────────────────────────────────────┘
```

## StructuredLoggerService

### 위치
`apps/api/src/common/logger/structured-logger.service.ts`

### 핵심 인터페이스

```typescript
/**
 * HTTP 요청 로그
 */
export interface HttpRequestLog {
  requestId?: string;
  method: string;
  url: string;
  query?: Record<string, any>;
  params?: Record<string, any>;
  body?: any;
  userAgent?: string;
  ip?: string;
  userId?: string;        // JWT 구현 후 추가
  userEmail?: string;
}

/**
 * HTTP 응답 로그
 */
export interface HttpResponseLog {
  requestId?: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;       // 밀리초 단위
  userId?: string;
}

/**
 * HTTP 에러 로그
 */
export interface HttpErrorLog {
  requestId?: string;
  method: string;
  url: string;
  status: number;
  errorCode: string;
  message: string;
  stack?: string;          // 5xx 에러만
  body?: any;
  query?: any;
  params?: any;
  userId?: string;
}
```

### 주요 메서드

#### 1. logRequest()

**목적**: 모든 HTTP 요청을 일관된 형식으로 로깅

```typescript
this.logger.logRequest({
  requestId: 'uuid-123',
  method: 'POST',
  url: '/api/v1/users/login',
  body: { email: 'user@example.com', password: '***REDACTED***' },
  userAgent: 'Mozilla/5.0...',
  ip: '192.168.1.100',
});

// 출력:
// [HTTP] INFO → POST /api/v1/users/login
// {
//   "timestamp": "2025-12-05T10:30:00.123Z",
//   "level": "log",
//   "type": "http_request",
//   "requestId": "uuid-123",
//   "method": "POST",
//   "url": "/api/v1/users/login",
//   "body": { "email": "user@example.com", "password": "***REDACTED***" },
//   "userAgent": "Mozilla/5.0...",
//   "ip": "192.168.1.100"
// }
```

**자동 처리:**
- ✅ timestamp 추가
- ✅ level: "log" 설정
- ✅ password, token 등 민감 정보 제거
- ✅ development 환경에서만 body, query, params 로깅

#### 2. logResponse()

**목적**: 모든 HTTP 응답을 로깅, 느린 요청 자동 감지

```typescript
this.logger.logResponse({
  requestId: 'uuid-123',
  method: 'POST',
  url: '/api/v1/users/login',
  statusCode: 200,
  duration: 1234,  // 1.234초
});

// 출력 (느린 요청):
// [HTTP] WARN ⚠️  느린 요청: POST /api/v1/users/login 200 1234ms
// {
//   "timestamp": "2025-12-05T10:30:01.357Z",
//   "level": "warn",
//   "type": "http_response",
//   "requestId": "uuid-123",
//   "method": "POST",
//   "url": "/api/v1/users/login",
//   "statusCode": 200,
//   "duration": "1234ms"
// }
```

**자동 처리:**
- ✅ duration > 1000ms이면 자동 WARN 레벨
- ✅ duration ≤ 1000ms이면 LOG 레벨
- ✅ 일관된 포맷 (← 화살표 prefix)

#### 3. logError()

**목적**: 모든 HTTP 에러를 로깅, 4xx/5xx 자동 분류

```typescript
this.logger.logError(
  {
    requestId: 'uuid-123',
    method: 'POST',
    url: '/api/v1/users/login',
    status: 401,
    errorCode: 'AUTH_UNAUTHORIZED',
    message: '이메일 또는 비밀번호가 잘못되었습니다',
    body: { email: 'wrong@example.com', password: 'wrong' },
  },
  exception,  // Error 객체
);

// 출력 (4xx - WARN):
// [HTTP] WARN POST /api/v1/users/login 401 AUTH_UNAUTHORIZED
// {
//   "timestamp": "2025-12-05T10:30:00.456Z",
//   "level": "warn",
//   "type": "http_error",
//   "requestId": "uuid-123",
//   "method": "POST",
//   "url": "/api/v1/users/login",
//   "status": 401,
//   "errorCode": "AUTH_UNAUTHORIZED",
//   "message": "이메일 또는 비밀번호가 잘못되었습니다"
//   // body는 development 환경에서만 포함
// }
```

**자동 처리:**
- ✅ status >= 500 → ERROR 레벨 + Stack Trace
- ✅ status >= 400 → WARN 레벨
- ✅ development 환경에서만 body, query, params 로깅
- ✅ Stack Trace 자동 출력 (5xx만)

#### 4. 일반 로그 메서드

```typescript
// 정보 로그
this.logger.logInfo('사용자 생성 완료', { userId: '123' });

// 경고 로그
this.logger.logWarning('캐시 미스', { key: 'user:123' });

// 디버그 로그
this.logger.logDebug('DB 쿼리 실행', { sql: 'SELECT ...' });
```

### extractRequestLogData() - 헬퍼 메서드

**목적**: Request 객체에서 로그 데이터 자동 추출

```typescript
const requestLogData = StructuredLoggerService.extractRequestLogData(request);

// 추출되는 데이터:
// {
//   requestId: request.id || 'unknown',
//   method: request.method,
//   url: request.url,
//   query: request.query,
//   params: request.params,
//   body: request.body,
//   userAgent: request.get('user-agent'),
//   ip: request.ip,
//   userId: request.user?.id,      // JWT 구현 후
//   userEmail: request.user?.email,
// }
```

**왜 static 메서드인가?**
- 인스턴스 생성 없이 사용 가능
- Interceptor, Filter에서 공통 로직 재사용
- 코드 중복 제거

## 리팩토링 전후 비교

### Before: LoggingInterceptor (리팩토링 전)

```typescript
// 복잡한 로그 객체 생성 로직 (80줄)
const requestLog = {
  requestId,
  method,
  url,
  query: Object.keys(query).length > 0 ? query : undefined,
  params: Object.keys(params).length > 0 ? params : undefined,
  body: process.env.NODE_ENV === 'development' && Object.keys(body || {}).length > 0
    ? this.sanitizeBody(body)
    : undefined,
  userAgent: request.get('user-agent'),
  ip: request.ip,
};

this.logger.log(`→ ${method} ${url}`, JSON.stringify(requestLog, null, 2));

// 민감 정보 제거 로직 (30줄)
private sanitizeBody(body: any): any {
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken'];
  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });
  return sanitized;
}
```

### After: LoggingInterceptor (리팩토링 후)

```typescript
// 간결한 로그 호출 (3줄)
const requestLogData = StructuredLoggerService.extractRequestLogData(request);
this.logger.logRequest(requestLogData);
```

**개선 사항:**
- ✅ 80줄 → 3줄 (96% 감소)
- ✅ 민감 정보 제거 로직 중앙화
- ✅ 환경 분기 로직 숨김
- ✅ 타입 안전성 (HttpRequestLog 인터페이스)

### Before: HttpExceptionFilter (리팩토링 전)

```typescript
// 복잡한 로그 데이터 생성 (50줄)
const logData = {
  timestamp: new Date().toISOString(),
  method,
  url,
  status,
  errorCode,
  body: process.env.NODE_ENV === 'development' ? body : undefined,
  query: process.env.NODE_ENV === 'development' ? query : undefined,
  params: process.env.NODE_ENV === 'development' ? params : undefined,
};

const logMessage = `${method} ${url} ${status} ${errorCode}`;

if (status >= 500) {
  this.logger.error(logMessage, JSON.stringify(logData, null, 2));
  if (exception instanceof Error) {
    this.logger.error(exception.stack);
  }
} else if (status >= 400) {
  this.logger.warn(logMessage, JSON.stringify(logData, null, 2));
}
```

### After: HttpExceptionFilter (리팩토링 후)

```typescript
// 간결한 에러 로깅 (한 번의 호출)
this.logger.logError(
  {
    requestId,
    method: request.method,
    url: request.url,
    status,
    errorCode,
    message,
    stack: exception instanceof Error ? exception.stack : undefined,
    body: request.body,
    query: request.query,
    params: request.params,
  },
  exception,
);
```

**개선 사항:**
- ✅ 복잡한 레벨 결정 로직 제거 (4xx/5xx 자동 분류)
- ✅ Stack Trace 자동 처리
- ✅ timestamp 자동 추가
- ✅ 환경 분기 로직 제거

## 로그 포맷

### 요청 로그

```json
{
  "timestamp": "2025-12-05T10:30:00.123Z",
  "level": "log",
  "type": "http_request",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "url": "/api/v1/users/login",
  "body": {
    "email": "user@example.com",
    "password": "***REDACTED***"
  },
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "ip": "192.168.1.100"
}
```

### 응답 로그 (성공)

```json
{
  "timestamp": "2025-12-05T10:30:00.168Z",
  "level": "log",
  "type": "http_response",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "url": "/api/v1/users/login",
  "statusCode": 200,
  "duration": "45ms"
}
```

### 응답 로그 (느린 요청)

```json
{
  "timestamp": "2025-12-05T10:30:01.500Z",
  "level": "warn",
  "type": "http_response",
  "requestId": "550e8400-e29b-41d4-a716-446655440001",
  "method": "GET",
  "url": "/api/v1/reports",
  "statusCode": 200,
  "duration": "1234ms"
}
```

### 에러 로그 (4xx - 클라이언트 오류)

```json
{
  "timestamp": "2025-12-05T10:30:00.250Z",
  "level": "warn",
  "type": "http_error",
  "requestId": "550e8400-e29b-41d4-a716-446655440002",
  "method": "POST",
  "url": "/api/v1/users/login",
  "status": 401,
  "errorCode": "AUTH_UNAUTHORIZED",
  "message": "이메일 또는 비밀번호가 잘못되었습니다"
}
```

### 에러 로그 (5xx - 서버 오류)

```json
{
  "timestamp": "2025-12-05T10:30:00.789Z",
  "level": "error",
  "type": "http_error",
  "requestId": "550e8400-e29b-41d4-a716-446655440003",
  "method": "GET",
  "url": "/api/v1/users/123",
  "status": 500,
  "errorCode": "COMMON_INTERNAL_SERVER_ERROR",
  "message": "서버 오류가 발생했습니다",
  "stack": "Error: Database connection failed\n    at ..."
}
```

## 사용 방법

### 1. Interceptor, Filter에서 사용 (이미 적용됨)

```typescript
// apps/api/src/common/interceptors/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const requestLogData = StructuredLoggerService.extractRequestLogData(request);

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

### 2. Service에서 사용

```typescript
// apps/api/src/modules/user/application/services/user.service.ts
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: StructuredLoggerService,  // ← 주입
  ) {}

  async register(dto: CreateUserDto): Promise<User> {
    this.logger.logInfo('사용자 등록 시작', {
      email: dto.email,
      name: dto.name,
    });

    try {
      const user = await this.userRepository.create({ ... });

      this.logger.logInfo('사용자 등록 완료', { userId: user.id });

      return user;
    } catch (error) {
      this.logger.logWarning('사용자 등록 실패', {
        email: dto.email,
        error: error.message,
      });
      throw error;
    }
  }
}
```

### 3. Controller에서 사용

```typescript
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: StructuredLoggerService,  // ← 주입
  ) {}

  @Post('register')
  async register(@Body() dto: CreateUserDto) {
    this.logger.logDebug('회원가입 요청 수신', { email: dto.email });

    return await this.userService.register(dto);
  }
}
```

## 환경별 로깅 차이

### Development (개발 환경)

```json
{
  "timestamp": "2025-12-05T10:30:00.123Z",
  "level": "log",
  "type": "http_request",
  "method": "POST",
  "url": "/api/v1/users/login",
  "body": {                             // ← 포함
    "email": "user@example.com",
    "password": "***REDACTED***"
  },
  "query": { "redirect": "/dashboard" }, // ← 포함
  "params": { "id": "123" }               // ← 포함
}
```

### Production (프로덕션 환경)

```json
{
  "timestamp": "2025-12-05T10:30:00.123Z",
  "level": "log",
  "type": "http_request",
  "method": "POST",
  "url": "/api/v1/users/login"
  // body, query, params는 보안상 제외
}
```

**왜 프로덕션에서 제외하는가?**
- 🔒 **보안**: 비밀번호, 토큰 등 민감한 정보 노출 방지
- 📊 **규정 준수**: GDPR, PIPA 개인정보 보호 규정
- 💾 **로그 크기**: 불필요한 데이터로 로그 파일 비대화 방지

## 민감 정보 자동 제거

### 제거되는 필드

```typescript
const sensitiveFields = [
  'password',      // 비밀번호
  'token',         // 일반 토큰
  'accessToken',   // JWT Access Token
  'refreshToken',  // JWT Refresh Token
  'secret',        // API Secret
  'apiKey',        // API Key
  'privateKey',    // 개인 키
  'creditCard',    // 신용카드 번호
  'cardNumber',    // 카드 번호
  'ssn',           // 주민등록번호
];
```

### 예시

**요청 Body:**
```json
{
  "email": "user@example.com",
  "password": "MySecretPassword123!",
  "token": "abc123xyz"
}
```

**로그에 기록:**
```json
{
  "email": "user@example.com",
  "password": "***REDACTED***",
  "token": "***REDACTED***"
}
```

**왜 `***REDACTED***`를 사용하는가?**
- ✅ 필드 존재 확인: password 필드가 있었다는 것을 알 수 있음
- ✅ 디버깅 편의: 요청 형식은 맞는지 확인 가능
- ✅ 보안 표준: OWASP 권장 방식

## 로그 레벨 자동 결정

### HTTP 응답 (LoggingInterceptor)

| Duration | Level | 출력 |
|----------|-------|------|
| ≤ 1000ms | LOG   | `← POST /api/v1/users/login 200 45ms` |
| > 1000ms | WARN  | `⚠️  느린 요청: POST /api/v1/users/login 200 1234ms` |

### HTTP 에러 (HttpExceptionFilter)

| Status | Level | Stack Trace |
|--------|-------|-------------|
| 400-499 (클라이언트 오류) | WARN  | ❌ 없음 |
| 500-599 (서버 오류) | ERROR | ✅ 있음 |

**왜 이렇게 분류하는가?**

**4xx (WARN):**
- 클라이언트 오류 (잘못된 입력)
- 정상적인 동작 범위
- 즉시 조치 불필요
- Stack Trace 불필요 (코드 오류 아님)

**5xx (ERROR):**
- 서버 오류 (코드 버그, DB 장애)
- 비정상적인 상황
- **즉시 조치 필요** (알람 발생)
- Stack Trace 필요 (원인 파악)

## 통합 예시

### 정상 요청 플로우

```
1. LoggingInterceptor - 요청 로그
→ POST /api/v1/users/login
{
  "timestamp": "2025-12-05T10:30:00.123Z",
  "level": "log",
  "type": "http_request",
  "method": "POST",
  "url": "/api/v1/users/login",
  "body": { "email": "user@example.com", "password": "***REDACTED***" }
}

2. UserService - 비즈니스 로직 로그
사용자 등록 시작 { "email": "user@example.com", "name": "홍길동" }

3. LoggingInterceptor - 응답 로그
← POST /api/v1/users/login 200 45ms
{
  "timestamp": "2025-12-05T10:30:00.168Z",
  "level": "log",
  "type": "http_response",
  "method": "POST",
  "url": "/api/v1/users/login",
  "statusCode": 200,
  "duration": "45ms"
}
```

### 에러 요청 플로우

```
1. LoggingInterceptor - 요청 로그
→ POST /api/v1/users/login
{
  "timestamp": "2025-12-05T10:30:00.123Z",
  "level": "log",
  "type": "http_request",
  "method": "POST",
  "url": "/api/v1/users/login",
  "body": { "email": "wrong@example.com", "password": "***REDACTED***" }
}

2. UserService - 예외 발생
throw new UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다');

3. LoggingInterceptor - 에러 간단히 로그
✖ POST /api/v1/users/login 78ms
{
  "requestId": "uuid-123",
  "error": "이메일 또는 비밀번호가 잘못되었습니다"
}

4. HttpExceptionFilter - 상세 에러 로그
POST /api/v1/users/login 401 AUTH_UNAUTHORIZED
{
  "timestamp": "2025-12-05T10:30:00.201Z",
  "level": "warn",
  "type": "http_error",
  "method": "POST",
  "url": "/api/v1/users/login",
  "status": 401,
  "errorCode": "AUTH_UNAUTHORIZED",
  "message": "이메일 또는 비밀번호가 잘못되었습니다"
}
```

## 향후 확장

### 1. Winston Logger 교체 (프로덕션)

```typescript
// apps/api/src/common/logger/structured-logger.service.ts

import * as winston from 'winston';

@Injectable()
export class StructuredLoggerService {
  private readonly winstonLogger = winston.createLogger({
    format: winston.format.json(),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
  });

  logRequest(data: HttpRequestLog): void {
    this.winstonLogger.info('HTTP Request', this.createStructuredLog('log', {
      type: 'http_request',
      ...data,
    }));
  }
}
```

### 2. 외부 모니터링 연동 (Sentry, DataDog)

```typescript
logError(data: HttpErrorLog, exception?: unknown): void {
  // 기존 로깅
  this.logger.error(...);

  // Sentry 연동
  if (data.status >= 500 && this.sentryService) {
    this.sentryService.captureException(exception, {
      extra: data,
    });
  }

  // Slack 알림
  if (data.status >= 500 && this.slackService) {
    this.slackService.sendAlert(`🚨 서버 에러: ${data.method} ${data.url}`);
  }
}
```

### 3. 로그 샘플링 (High Traffic)

```typescript
logRequest(data: HttpRequestLog): void {
  // 1% 샘플링 (트래픽 많을 때)
  if (Math.random() > 0.01) {
    return;  // 99% 로그 skip
  }

  // 나머지 로깅
  this.logger.log(...);
}
```

### 4. 사용자 정보 자동 추가 (JWT 구현 후)

```typescript
static extractRequestLogData(request: Request): HttpRequestLog {
  return {
    requestId: (request as any).id || 'unknown',
    method: request.method,
    url: request.url,
    // ...
    userId: (request as any).user?.id,          // ← JWT에서 추출
    userEmail: (request as any).user?.email,    // ← JWT에서 추출
    organizationId: (request as any).user?.organizationId,  // ← Work/ERP 확장
  };
}
```

## 체크리스트

### 새로운 Service 작성 시

- [ ] StructuredLoggerService 의존성 주입
- [ ] 중요한 비즈니스 로직에 logInfo() 추가
- [ ] 에러 발생 시 logWarning() 또는 logError() 추가
- [ ] 민감 정보 (이메일, 이름 등)는 로그에서 제외 또는 마스킹

### 새로운 민감 필드 추가 시

- [ ] `StructuredLoggerService.sanitizeBody()`에 필드 추가
- [ ] 테스트 코드 작성 (민감 정보 제거 확인)

### 로그 모니터링 설정 시

- [ ] ERROR 레벨: 즉시 알람 (Slack, PagerDuty)
- [ ] WARN 레벨: 일일 리포트
- [ ] 느린 요청 (>1초): 성능 대시보드

## 참고 자료

- [NestJS Logging](https://docs.nestjs.com/techniques/logger)
- [Winston](https://github.com/winstonjs/winston)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

---

**마지막 업데이트**: 2025-12-05
**작성자**: Backend Team
**관련 파일**:
- `apps/api/src/common/logger/structured-logger.service.ts`
- `apps/api/src/common/logger/logger.module.ts`
- `apps/api/src/common/interceptors/logging.interceptor.ts`
- `apps/api/src/common/filters/http-exception.filter.ts`
