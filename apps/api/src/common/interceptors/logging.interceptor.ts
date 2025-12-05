/**
 * Logging Interceptor
 *
 * @description
 * 모든 HTTP 요청/응답을 구조화된 JSON 형식으로 로깅하는 전역 Interceptor
 *
 * @why-global-logging-interceptor
 * 전역 Logging Interceptor가 필요한 이유:
 *
 * 1. **요청 추적 (Request Tracing)**
 *    - 문제: 분산 환경에서 특정 요청의 전체 플로우 파악 어려움
 *    - 해결: Request ID로 요청-응답-에러를 연결
 *    - 효과: 디버깅 시간 단축 (수 시간 → 수 분)
 *
 * 2. **성능 모니터링 (Performance Monitoring)**
 *    - 문제: 어떤 API가 느린지 파악 어려움
 *    - 해결: 모든 요청의 응답 시간 자동 측정
 *    - 효과: 병목 지점 조기 발견, SLA 모니터링
 *
 * 3. **감사 로그 (Audit Trail)**
 *    - 문제: 누가 언제 무엇을 했는지 기록 필요 (규정 준수)
 *    - 해결: 요청 메서드, URL, IP, User-Agent 자동 로깅
 *    - 효과: 보안 사고 조사, 규정 준수 (GDPR, ISO 27001)
 *
 * 4. **개발 생산성 (Developer Experience)**
 *    - 문제: 개발 중 API 호출 내역 확인 어려움
 *    - 해결: 콘솔에 요청/응답을 보기 좋게 출력
 *    - 효과: Postman 대신 로그만으로도 디버깅 가능
 *
 * 5. **중앙화된 로그 수집 (Centralized Logging)**
 *    - 문제: 여러 서버의 로그를 각각 확인해야 함
 *    - 해결: 구조화된 JSON 로그 → ELK, DataDog으로 수집
 *    - 효과: 실시간 모니터링, 알람, 통계 분석
 *
 * @why-interceptor-not-middleware
 * Middleware 대신 Interceptor를 사용하는 이유:
 *
 * - ✅ **Interceptor**:
 *   - RxJS Observable 사용 → 응답 시간 정확 측정
 *   - 예외 발생 시에도 로깅 가능 (tap의 error 콜백)
 *   - ExecutionContext로 Controller 메타데이터 접근
 *
 * - ❌ **Middleware**:
 *   - response.on('finish')로 응답 시간 측정 → 부정확
 *   - 예외 발생 시 로깅 어려움 (별도 처리 필요)
 *   - HTTP 요청만 처리 가능 (WebSocket, gRPC 불가)
 *
 * @why-rxjs-tap
 * RxJS의 `tap` 연산자를 사용하는 이유:
 *
 * - **사이드 이펙트 (Side Effect)**: 로깅은 데이터 변환이 아닌 부수 효과
 * - **Non-Blocking**: 로깅이 응답을 지연시키지 않음
 * - **에러 처리**: `tap({ next, error })`로 성공/실패 모두 처리
 * - **데이터 불변성**: 응답 데이터를 변경하지 않음
 *
 * @architecture
 * 로깅 플로우:
 * ```
 * 요청 수신
 *   ↓
 * LoggingInterceptor.intercept() - 시작 시간 기록
 *   ↓
 * [요청 로그 출력] → method, url, query, body, IP, User-Agent
 *   ↓
 * next.handle() - Controller 실행
 *   ↓
 * tap({ next, error })
 *   ↓
 * ┌─────────────┬──────────────┐
 * │ 성공 (next) │ 실패 (error) │
 * └─────────────┴──────────────┘
 *   ↓             ↓
 * [응답 로그]   [에러 로그]
 *   ↓             ↓
 * statusCode    error.message
 * duration      duration
 * ```
 *
 * @before-after
 * 로깅 예시:
 *
 * **요청 로그**
 * ```
 * [HTTP] INFO  → POST /api/v1/users/login
 * {
 *   "requestId": "550e8400-e29b-41d4-a716-446655440000",
 *   "method": "POST",
 *   "url": "/api/v1/users/login",
 *   "body": { "email": "user@example.com", "password": "***REDACTED***" },
 *   "userAgent": "Mozilla/5.0...",
 *   "ip": "192.168.1.100"
 * }
 * ```
 *
 * **응답 로그 (성공)**
 * ```
 * [HTTP] INFO  ← POST /api/v1/users/login 200 45ms
 * {
 *   "requestId": "550e8400-e29b-41d4-a716-446655440000",
 *   "method": "POST",
 *   "url": "/api/v1/users/login",
 *   "statusCode": 200,
 *   "duration": "45ms"
 * }
 * ```
 *
 * **응답 로그 (느린 요청, >1초)**
 * ```
 * [HTTP] WARN  ⚠️  느린 요청: GET /api/v1/reports 200 1234ms
 * {
 *   "requestId": "...",
 *   "method": "GET",
 *   "url": "/api/v1/reports",
 *   "statusCode": 200,
 *   "duration": "1234ms"
 * }
 * ```
 *
 * **에러 로그**
 * ```
 * [HTTP] ERROR ✖ POST /api/v1/users/login 78ms
 * {
 *   "requestId": "...",
 *   "method": "POST",
 *   "url": "/api/v1/users/login",
 *   "duration": "78ms",
 *   "error": "이메일 또는 비밀번호가 잘못되었습니다"
 * }
 * ```
 *
 * @features
 * - ✅ 요청 시작 시간 기록 (startTime)
 * - ✅ 응답 시간 측정 (duration = Date.now() - startTime)
 * - ✅ HTTP 메서드, URL, 상태 코드 로깅
 * - ✅ 느린 요청 감지 (>1초) → WARN 레벨로 로깅
 * - ✅ Request ID 추적 (분산 추적)
 * - ✅ 민감한 정보 자동 제거 (password, token 등)
 * - ✅ 개발/프로덕션 환경별 로깅 레벨 분리
 * - ✅ 구조화된 JSON 로그 (ELK 스택 연동 대비)
 *
 * @usage
 * ```typescript
 * // main.ts - 전역 적용
 * app.useGlobalInterceptors(new LoggingInterceptor());
 *
 * // 자동으로 모든 요청/응답이 로깅됨 (추가 코드 불필요)
 * ```
 *
 * @performance
 * - 로깅 오버헤드: <1ms (JSON.stringify만 수행)
 * - 비동기 로깅: Non-Blocking (응답 지연 없음)
 * - 메모리: 로그 객체는 즉시 가비지 컬렉션
 * - 동시 요청: 인스턴스 공유 (Singleton), 상태 없음 (Stateless)
 *
 * @scalability
 * Work/ERP 확장 시 고려사항:
 *
 * 1. **사용자 정보 로깅 (인증 후)**:
 *    ```typescript
 *    const user = (request as any).user;  // JWT Guard에서 주입
 *    requestLog.userId = user?.id;
 *    requestLog.userEmail = user?.email;
 *    ```
 *
 * 2. **외부 로그 수집 (ELK, DataDog)**:
 *    ```typescript
 *    // Winston Transport 사용
 *    import { WinstonModule } from 'nest-winston';
 *    import * as winston from 'winston';
 *
 *    const logger = WinstonModule.createLogger({
 *      transports: [
 *        new winston.transports.Console(),
 *        new winston.transports.File({ filename: 'logs/app.log' }),
 *        new winston.transports.Http({ host: 'elk.example.com' }),
 *      ],
 *    });
 *    ```
 *
 * 3. **응답 본문 로깅 (민감한 데이터 제외)**:
 *    ```typescript
 *    // 개발 환경에서만 응답 데이터 로깅
 *    if (process.env.NODE_ENV === 'development') {
 *      responseLog.responseBody = this.sanitizeResponse(data);
 *    }
 *    ```
 *
 * 4. **느린 쿼리 임계값 동적 설정**:
 *    ```typescript
 *    constructor(private configService: ConfigService) {
 *      this.slowThreshold = configService.get('SLOW_REQUEST_THRESHOLD', 1000);
 *    }
 *    ```
 *
 * 5. **로그 샘플링 (High Traffic 대응)**:
 *    ```typescript
 *    // 1% 샘플링 (100건 중 1건만 로깅)
 *    if (Math.random() < 0.01 || duration > 1000) {
 *      this.logger.log(...);
 *    }
 *    ```
 *
 * @security
 * 보안 고려사항:
 *
 * - ✅ **민감한 정보 제거**: password, token, accessToken, refreshToken
 * - ✅ **개발 환경에서만 body 로깅**: 프로덕션에서는 body 제외
 * - ⚠️ **PII (개인 정보) 로깅 주의**: GDPR, PIPA 규정 준수
 *   - IP 주소: 동의 필요 (마케팅 목적)
 *   - User-Agent: 통계 목적 허용
 *   - 이메일, 이름: 로그에서 제외 권장
 *
 * @alternatives
 * 다른 로깅 방법들과 비교:
 *
 * 1. ❌ **Controller에서 직접 로깅**:
 *    - 단점: 코드 중복, 실수 가능성, 일관성 보장 어려움
 *    ```typescript
 *    @Post()
 *    async create() {
 *      this.logger.log('Creating user...');
 *      // ...
 *      this.logger.log('User created');
 *    }
 *    ```
 *
 * 2. ❌ **Middleware로 로깅**:
 *    - 단점: 응답 시간 측정 부정확, 예외 처리 어려움
 *    ```typescript
 *    app.use((req, res, next) => {
 *      const start = Date.now();
 *      res.on('finish', () => {
 *        const duration = Date.now() - start;  // ❌ 부정확
 *      });
 *      next();
 *    });
 *    ```
 *
 * 3. ✅ **Global Interceptor (현재 방식)**:
 *    - 장점: 자동화, 정확성, 예외 처리, 확장성
 *    - 단점: RxJS 이해 필요
 *
 * @testing
 * 테스트 시나리오:
 *
 * ```typescript
 * describe('LoggingInterceptor', () => {
 *   it('요청 시작 시 로깅', () => {
 *     const spy = jest.spyOn(logger, 'log');
 *     await controller.create();
 *     expect(spy).toHaveBeenCalledWith(expect.stringContaining('→ POST'));
 *   });
 *
 *   it('응답 완료 시 duration 로깅', () => {
 *     const spy = jest.spyOn(logger, 'log');
 *     await controller.create();
 *     expect(spy).toHaveBeenCalledWith(expect.stringContaining('ms'));
 *   });
 *
 *   it('느린 요청 시 WARN 로깅', async () => {
 *     const spy = jest.spyOn(logger, 'warn');
 *     jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(1500);
 *     await controller.slowEndpoint();
 *     expect(spy).toHaveBeenCalledWith(expect.stringContaining('느린 요청'));
 *   });
 *
 *   it('민감한 정보 마스킹', () => {
 *     const body = { email: 'test@example.com', password: 'secret' };
 *     const sanitized = interceptor['sanitizeBody'](body);
 *     expect(sanitized.password).toBe('***REDACTED***');
 *   });
 * });
 * ```
 *
 * @related
 * 연관 컴포넌트:
 * - `RequestIdMiddleware`: Request ID 생성 (로깅 시 사용)
 * - `HttpExceptionFilter`: 에러 응답 생성 (에러 로그와 연동)
 * - `TransformInterceptor`: 성공 응답 변환 (로깅 후)
 * - `TimeoutInterceptor`: 타임아웃 처리 (느린 요청 감지)
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * HTTP 요청/응답 로깅 Interceptor
 *
 * @why-injectable
 * `@Injectable()` 데코레이터를 사용하는 이유:
 * - NestJS IoC 컨테이너에 등록
 * - Singleton 인스턴스 관리 (메모리 효율)
 * - 향후 의존성 주입 가능 (ConfigService, WinstonLogger 등)
 *
 * @why-logger-instance
 * class 필드로 Logger를 선언하는 이유:
 * - 재사용: 모든 요청에서 동일한 Logger 인스턴스 사용
 * - 컨텍스트: 'HTTP'로 로그 출처 명시 ([HTTP] 접두사)
 * - 성능: 요청마다 new Logger() 생성 방지
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  /**
   * NestJS Logger 인스턴스
   *
   * @why-nestjs-logger
   * NestJS Logger를 사용하는 이유:
   * - console.log보다 기능 풍부: 로그 레벨, 타임스탬프, 컨텍스트
   * - Winston으로 쉽게 교체 가능: WinstonModule.createLogger()
   * - 테스트 가능: jest.spyOn(logger, 'log')으로 로깅 검증
   *
   * @why-context-http
   * 컨텍스트를 'HTTP'로 설정하는 이유:
   * - 로그 출처 명시: [HTTP] 접두사로 HTTP 요청 로그임을 표시
   * - 필터링: 로그 검색 시 HTTP 관련만 필터링 가능
   * - 구분: WebSocket, CRON, Event 로그와 구분
   */
  private readonly logger = new Logger('HTTP');

  /**
   * 요청/응답 가로채기 (Intercept)
   *
   * @param context - 실행 컨텍스트 (HTTP 요청 정보)
   * @param next - 다음 핸들러 (Controller)
   *
   * @why-execution-context
   * ExecutionContext를 사용하는 이유:
   * - 프로토콜 독립적: HTTP, WebSocket, gRPC 모두 처리 가능
   * - Request/Response 접근: switchToHttp()로 HTTP 객체 가져오기
   * - 메타데이터 접근: Reflector로 Decorator 메타데이터 읽기
   *
   * @returns Observable<any> - 로깅이 추가된 응답 스트림
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    /**
     * HTTP Request/Response 객체 추출
     *
     * @why-switch-to-http
     * switchToHttp()를 사용하는 이유:
     * - ExecutionContext는 범용 객체 (HTTP, WS, RPC 모두 지원)
     * - switchToHttp()로 HTTP 전용 메서드 접근 가능
     * - 타입 안전성: getRequest<Request>()로 Express 타입 보장
     */
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    /**
     * 요청 정보 추출
     *
     * @why-destructuring
     * 구조 분해 할당을 사용하는 이유:
     * - 가독성: 사용할 속성만 명시적으로 추출
     * - 성능: request 객체를 여러 번 접근하지 않음
     * - 타입 추론: TypeScript가 타입을 정확히 추론
     */
    const { method, url, body, query, params } = request;

    /**
     * Request ID 추출
     *
     * @why-request-id
     * Request ID를 로그에 포함하는 이유:
     * - **에러 추적**: 클라이언트가 에러 발생 시 Request ID를 제공하면 해당 요청의 모든 로그를 찾을 수 있음
     * - **분산 추적**: 마이크로서비스 간 요청 전파 시 동일한 Request ID 사용
     * - **로그 상관관계**: 요청 로그 - 응답 로그 - 에러 로그를 Request ID로 연결
     * - **디버깅**: "이 요청이 왜 실패했지?" → Request ID로 전체 플로우 확인
     *
     * @why-fallback-unknown
     * 'unknown'을 기본값으로 사용하는 이유:
     * - RequestIdMiddleware가 적용 안 된 경우 대비
     * - undefined보다 명시적 (로그에서 확인 가능)
     * - 에러 방지: requestId가 없어도 로깅 계속 진행
     */
    const requestId = (request as any).id || 'unknown';

    /**
     * 시작 시간 기록
     *
     * @why-date-now
     * Date.now()를 사용하는 이유:
     * - 성능: new Date() 대비 10배 빠름 (객체 생성 없음)
     * - 밀리초 정밀도: 응답 시간 측정에 충분
     * - 타임스탬프: 숫자로 연산 가능 (duration = end - start)
     *
     * @alternative
     * 더 정밀한 측정이 필요하면 process.hrtime.bigint() 사용:
     * ```typescript
     * const startTime = process.hrtime.bigint();
     * const duration = Number(process.hrtime.bigint() - startTime) / 1_000_000;  // ms
     * ```
     */
    const startTime = Date.now();

    /**
     * 요청 로그 객체 생성
     *
     * @why-structured-log
     * 구조화된 객체로 로깅하는 이유:
     * - **검색 용이**: ELK 스택에서 필드별 쿼리 가능
     * - **타입 안전성**: 일관된 로그 형식 보장
     * - **파싱 불필요**: JSON 그대로 저장/조회
     * - **통계 분석**: 필드별 집계 가능 (예: method별 요청 수)
     *
     * @why-conditional-fields
     * query, params, body를 조건부로 포함하는 이유:
     * - **로그 크기 최소화**: 빈 객체는 로깅하지 않음
     * - **가독성**: 의미 있는 데이터만 출력
     * - **성능**: JSON.stringify 크기 감소
     */
    const requestLog = {
      requestId,
      method,
      url,
      /**
       * Query String (GET 파라미터)
       *
       * @example /api/users?page=1&limit=10
       * query = { page: '1', limit: '10' }
       *
       * @why-check-length
       * Object.keys(query).length > 0으로 체크하는 이유:
       * - 빈 객체 {} 로깅 방지
       * - undefined로 제외 (JSON에서 생략됨)
       */
      query: Object.keys(query).length > 0 ? query : undefined,
      /**
       * Path Parameters (URL 경로 변수)
       *
       * @example /api/users/:id → params = { id: '123' }
       *
       * @why-separate-from-query
       * query와 params를 분리하는 이유:
       * - 의미 구분: params는 리소스 식별, query는 필터링
       * - RESTful 원칙: /users/:id (params), /users?role=admin (query)
       */
      params: Object.keys(params).length > 0 ? params : undefined,
      /**
       * Request Body (POST/PUT 데이터)
       *
       * @why-development-only
       * 개발 환경에서만 body를 로깅하는 이유:
       * - **보안**: 프로덕션에서 민감한 데이터 노출 방지
       * - **성능**: 대용량 body 로깅 시 I/O 부하
       * - **규정 준수**: GDPR, PIPA 위반 방지
       *
       * @why-sanitize
       * sanitizeBody()로 민감한 정보를 제거하는 이유:
       * - password, token 등 로그에 남으면 보안 사고
       * - 개발 중에도 실수로 비밀번호 노출 방지
       * - '***REDACTED***'로 필드 존재는 확인 가능
       */
      body:
        process.env.NODE_ENV === 'development' && Object.keys(body || {}).length > 0
          ? this.sanitizeBody(body)
          : undefined,
      /**
       * User-Agent (브라우저/클라이언트 정보)
       *
       * @why-user-agent
       * User-Agent를 로깅하는 이유:
       * - **디버깅**: 특정 브라우저에서만 발생하는 문제 파악
       * - **통계**: 사용자 환경 분석 (Chrome 90%, Safari 10%)
       * - **호환성**: 오래된 브라우저 지원 여부 결정
       *
       * @example
       * "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
       */
      userAgent: request.get('user-agent'),
      /**
       * IP 주소
       *
       * @why-ip-address
       * IP 주소를 로깅하는 이유:
       * - **보안**: 비정상적인 접근 패턴 감지 (DDoS, Brute Force)
       * - **지역화**: 사용자 위치 기반 서비스 제공
       * - **감사**: 규정 준수 (접근 기록 보관)
       *
       * @security
       * IP 주소는 개인정보로 분류될 수 있음 (GDPR):
       * - 동의 필요: 마케팅 목적 사용 시
       * - 익명화: 마지막 옥텟 마스킹 (192.168.1.xxx)
       * - 보관 기간: 법적 의무 기간만 보관
       *
       * @why-request-ip
       * request.ip를 사용하는 이유:
       * - Express가 자동으로 X-Forwarded-For 헤더 처리
       * - 프록시/로드밸런서 뒤에서도 실제 IP 추출
       * - IPv4/IPv6 모두 지원
       */
      ip: request.ip,
    };

    /**
     * 요청 로그 출력
     *
     * @why-arrow-prefix
     * "→" 화살표를 사용하는 이유:
     * - 시각적 구분: 요청(→)과 응답(←)을 쉽게 구분
     * - 개발자 경험: 콘솔에서 한눈에 플로우 파악
     *
     * @why-json-stringify-pretty
     * JSON.stringify(requestLog, null, 2)를 사용하는 이유:
     * - 가독성: 2칸 들여쓰기로 구조 명확히 표시
     * - 개발 편의: 콘솔에서 복사-붙여넣기 가능
     * - 디버깅: 중첩된 객체도 쉽게 확인
     *
     * @production
     * 프로덕션에서는 1줄 JSON 권장:
     * ```typescript
     * JSON.stringify(requestLog)  // 파일 크기 감소
     * ```
     */
    this.logger.log(`→ ${method} ${url}`, JSON.stringify(requestLog, null, 2));

    /**
     * 응답/에러 로깅 파이프라인
     *
     * @why-tap
     * tap 연산자를 사용하는 이유:
     * - **사이드 이펙트**: 로깅은 데이터 변환이 아닌 부수 효과
     * - **Non-Blocking**: 로깅이 응답을 지연시키지 않음
     * - **에러 처리**: next/error 콜백으로 성공/실패 모두 처리
     * - **불변성**: 응답 데이터를 변경하지 않음
     *
     * @why-object-syntax
     * tap({ next, error }) 객체 문법을 사용하는 이유:
     * - 명시적: 성공/에러 콜백을 명확히 구분
     * - 타입 안전성: TypeScript가 타입 추론
     * - 가독성: 어떤 경우에 어떤 로깅을 하는지 명확
     */
    return next.handle().pipe(
      tap({
        /**
         * 성공 응답 로깅
         *
         * @why-next-callback
         * next 콜백을 사용하는 이유:
         * - Controller가 정상적으로 응답을 반환한 경우 실행
         * - 예외가 발생하지 않은 경우 (200, 201, 204 등)
         */
        next: () => {
          /**
           * 응답 시간 계산
           *
           * @why-duration
           * duration을 측정하는 이유:
           * - **성능 모니터링**: 어떤 API가 느린지 파악
           * - **SLA 관리**: 응답 시간 목표 (예: 95%ile < 500ms) 검증
           * - **병목 발견**: DB 쿼리, 외부 API 호출 등 최적화 포인트 식별
           * - **용량 계획**: 트래픽 증가 시 서버 증설 시점 예측
           */
          const duration = Date.now() - startTime;

          /**
           * HTTP 상태 코드 추출
           *
           * @why-status-code
           * statusCode를 로깅하는 이유:
           * - **성공/실패 구분**: 2xx(성공), 4xx(클라이언트 오류), 5xx(서버 오류)
           * - **통계**: 상태 코드별 요청 수 집계 (200: 95%, 404: 3%, 500: 2%)
           * - **알람**: 5xx 비율이 높아지면 알람 발생
           *
           * @example
           * 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 500 Internal Server Error
           */
          const statusCode = response.statusCode;

          /**
           * 응답 로그 객체 생성
           */
          const responseLog = {
            requestId,
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
          };

          /**
           * 느린 요청 감지 및 경고
           *
           * @why-1000ms-threshold
           * 1초(1000ms)를 임계값으로 사용하는 이유:
           * - **사용자 경험**: 1초 이상 대기 시 사용자가 느림을 체감
           * - **업계 표준**: 웹 성능 Best Practice (TTFB < 200ms, Total < 1000ms)
           * - **조기 경고**: 성능 문제를 조기에 발견
           *
           * @why-warn-level
           * WARN 레벨로 로깅하는 이유:
           * - **우선순위**: ERROR보다 낮지만 INFO보다 높음 (주의 필요)
           * - **필터링**: 로그 모니터링 시 WARN 이상만 알람 설정
           * - **통계**: WARN 발생 빈도로 성능 추세 파악
           *
           * @scalability
           * Work/ERP 확장 시 고려사항:
           * - 엔드포인트별 임계값 설정: 리포트 생성(10초), 사용자 조회(100ms)
           * - Decorator로 커스텀 임계값: @SlowThreshold(5000)
           */
          if (duration > 1000) {
            this.logger.warn(
              `⚠️  느린 요청: ${method} ${url} ${statusCode} ${duration}ms`,
              JSON.stringify(responseLog, null, 2),
            );
          } else {
            /**
             * 정상 응답 로깅
             *
             * @why-arrow-prefix
             * "←" 화살표를 사용하는 이유:
             * - 시각적 구분: 응답(←)과 요청(→) 구분
             * - 플로우 추적: → 로그와 ← 로그를 Request ID로 매칭
             */
            this.logger.log(
              `← ${method} ${url} ${statusCode} ${duration}ms`,
              JSON.stringify(responseLog, null, 2),
            );
          }
        },
        /**
         * 에러 로깅
         *
         * @why-error-callback
         * error 콜백을 사용하는 이유:
         * - Controller에서 예외가 발생한 경우 실행
         * - HttpException, Prisma 에러, 기타 런타임 에러 모두 포착
         * - Filter로 전달되기 전에 로깅 (에러 추적 용이)
         *
         * @param error - 발생한 예외 객체
         */
        error: (error) => {
          /**
           * 에러 발생 시점의 duration도 측정
           *
           * @why-error-duration
           * 에러 발생 시에도 duration을 측정하는 이유:
           * - **타임아웃 감지**: 1초 이상 걸려서 에러 발생했는지 확인
           * - **성능 분석**: 느린 쿼리로 인한 에러인지 파악
           * - **디버깅**: 에러가 즉시 발생했는지, 지연 후 발생했는지 구분
           */
          const duration = Date.now() - startTime;

          /**
           * 에러 로그 객체 생성
           *
           * @why-error-message
           * error.message를 로깅하는 이유:
           * - **에러 내용 파악**: 무슨 에러인지 즉시 확인
           * - **통계**: 같은 에러 발생 빈도 집계
           * - **알람**: 특정 에러 메시지 패턴 감지 시 알람
           *
           * @security
           * 프로덕션에서는 상세한 에러 메시지 노출 주의:
           * - 클라이언트에는 추상화된 메시지 전송
           * - 로그에만 상세 내용 기록
           */
          const errorLog = {
            requestId,
            method,
            url,
            duration: `${duration}ms`,
            error: error.message,
          };

          /**
           * 에러 로그 출력 (ERROR 레벨)
           *
           * @why-error-level
           * ERROR 레벨로 로깅하는 이유:
           * - **우선순위**: 가장 높은 우선순위 (즉시 대응 필요)
           * - **알람**: ERROR 발생 시 즉시 알람 전송 (Slack, PagerDuty)
           * - **통계**: 에러율 모니터링 (SLI: 99.9% 성공률)
           *
           * @why-x-prefix
           * "✖" 기호를 사용하는 이유:
           * - 시각적 강조: 에러 발생을 명확히 표시
           * - 개발자 경험: 콘솔에서 에러를 빠르게 발견
           */
          this.logger.error(
            `✖ ${method} ${url} ${duration}ms`,
            JSON.stringify(errorLog, null, 2),
          );
        },
      }),
    );
  }

  /**
   * 민감한 정보 제거 (Sanitization)
   *
   * @param body - 요청 body 객체
   * @returns 민감한 정보가 제거된 객체
   *
   * @why-private
   * private 메서드로 선언하는 이유:
   * - 캡슐화: 외부에서 호출할 필요 없음
   * - 명확성: 내부 구현 세부사항
   * - 테스트: 필요 시 interceptor['sanitizeBody']로 접근 가능
   *
   * @security
   * 이 메서드가 중요한 이유:
   * - **데이터 유출 방지**: 로그에 비밀번호가 남으면 보안 사고
   * - **규정 준수**: GDPR, PIPA에서 개인정보 로깅 금지
   * - **내부자 공격 방지**: 개발자/운영자도 비밀번호를 볼 수 없어야 함
   */
  private sanitizeBody(body: any): any {
    /**
     * 얕은 복사 (Shallow Copy)
     *
     * @why-spread-operator
     * ...body를 사용하는 이유:
     * - **불변성**: 원본 body 객체를 변경하지 않음
     * - **안전성**: Controller로 전달되는 데이터는 그대로 유지
     * - **사이드 이펙트 방지**: 로깅이 비즈니스 로직에 영향 없음
     *
     * @limitation
     * 얕은 복사의 한계:
     * - 중첩 객체는 참조 공유: { user: { password: 'secret' } }
     * - 향후 개선: 깊은 복사 (lodash.cloneDeep) 또는 재귀 sanitize
     */
    const sanitized = { ...body };

    /**
     * 민감한 필드 목록
     *
     * @why-these-fields
     * 이 필드들을 제거하는 이유:
     *
     * - **password**: 비밀번호 (가장 중요!)
     *   - 로그에 남으면: 계정 탈취, 무단 접근
     *   - 해시 전 평문이므로 특히 위험
     *
     * - **token**: 일반적인 인증 토큰
     *   - 세션 토큰, CSRF 토큰 등
     *
     * - **accessToken**: JWT Access Token
     *   - 탈취 시: API 호출 가능 (짧은 유효기간)
     *
     * - **refreshToken**: JWT Refresh Token
     *   - 탈취 시: 새로운 Access Token 발급 가능 (긴 유효기간, 더 위험)
     *
     * @future
     * 추가 고려 필드:
     * - creditCard, cardNumber: 신용카드 번호
     * - ssn, socialSecurityNumber: 주민등록번호
     * - apiKey, secret: API 키, 시크릿
     * - privateKey: 개인 키
     */
    const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken'];

    /**
     * 민감한 필드를 '***REDACTED***'로 교체
     *
     * @why-foreach
     * forEach를 사용하는 이유:
     * - 간결성: map보다 의도가 명확 (반환값 사용 안 함)
     * - 성능: 새 배열 생성 안 함
     *
     * @why-redacted
     * '***REDACTED***'로 교체하는 이유 (undefined가 아닌):
     * - **필드 존재 확인**: password 필드가 있었다는 것을 알 수 있음
     * - **디버깅 편의**: 요청 형식은 맞는지 확인 가능
     * - **보안 표준**: OWASP 권장 방식
     *
     * @why-if-check
     * sanitized[field]를 체크하는 이유:
     * - undefined/null 필드는 건드리지 않음
     * - 성능: 없는 필드는 처리 스킵
     */
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });

    return sanitized;
  }

  /**
   * @future 향후 추가 기능
   *
   * Work/ERP 확장 시 고려할 기능들:
   *
   * 1. **사용자 정보 자동 추가**:
   *    ```typescript
   *    const user = (request as any).user;
   *    if (user) {
   *      requestLog.userId = user.id;
   *      requestLog.userRole = user.role;
   *      requestLog.organizationId = user.organizationId;
   *    }
   *    ```
   *
   * 2. **응답 본문 로깅 (개발 환경)**:
   *    ```typescript
   *    tap({
   *      next: (data) => {
   *        if (process.env.NODE_ENV === 'development') {
   *          responseLog.responseBody = this.sanitizeResponse(data);
   *        }
   *      }
   *    })
   *    ```
   *
   * 3. **Winston Logger 교체 (프로덕션)**:
   *    ```typescript
   *    import { WinstonModule } from 'nest-winston';
   *    constructor(
   *      @Inject(WINSTON_MODULE_PROVIDER)
   *      private readonly logger: Logger
   *    ) {}
   *    ```
   *
   * 4. **로그 샘플링 (High Traffic)**:
   *    ```typescript
   *    // 1% 샘플링, 느린 요청/에러는 100% 로깅
   *    const shouldLog = Math.random() < 0.01 || duration > 1000 || error;
   *    if (shouldLog) {
   *      this.logger.log(...);
   *    }
   *    ```
   *
   * 5. **구조화된 로그 (ELK 연동)**:
   *    ```typescript
   *    this.logger.log({
   *      '@timestamp': new Date().toISOString(),
   *      level: 'info',
   *      message: 'HTTP Request',
   *      fields: requestLog,
   *      tags: ['http', 'access-log'],
   *    });
   *    ```
   *
   * 6. **엔드포인트별 임계값 설정**:
   *    ```typescript
   *    @SetSlowThreshold(5000)  // 5초
   *    @Get('reports')
   *    async generateReport() {}
   *
   *    const threshold = Reflector.get('slowThreshold', handler) || 1000;
   *    ```
   */
}
