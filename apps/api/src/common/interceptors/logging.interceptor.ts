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
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';

/**
 * HTTP 요청/응답 로깅 Interceptor (StructuredLoggerService 사용)
 *
 * @why-structured-logger
 * StructuredLoggerService를 사용하는 이유:
 * - **일관성**: HttpExceptionFilter, UserService 등 모든 곳에서 동일한 로그 포맷
 * - **타입 안전성**: HttpRequestLog, HttpResponseLog 인터페이스로 타입 보장
 * - **중앙화**: 로깅 로직 변경 시 StructuredLoggerService만 수정
 * - **확장성**: Sentry, DataDog 연동 시 한 곳만 수정
 *
 * @why-dependency-injection
 * 의존성 주입으로 logger를 받는 이유:
 * - 테스트 용이: Mock logger 주입 가능
 * - 설정 공유: 동일한 logger 인스턴스 사용
 * - NestJS 패턴: 권장 사항
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLoggerService) {}

  /**
   * 요청/응답 가로채기 (Intercept)
   *
   * @why-simplified
   * StructuredLoggerService로 단순화된 이유:
   * - 복잡한 로그 객체 생성 로직 제거 → logger.logRequest()로 대체
   * - 민감 정보 제거 로직 제거 → StructuredLoggerService에서 처리
   * - 환경별 분기 로직 제거 → StructuredLoggerService에서 처리
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    /**
     * Request 객체에서 로그 데이터 추출
     *
     * @why-helper-method
     * StructuredLoggerService.extractRequestLogData()를 사용하는 이유:
     * - 코드 중복 제거: HttpExceptionFilter에서도 동일한 로직 사용
     * - 일관성: 모든 곳에서 동일한 필드 추출
     * - 타입 안전성: HttpRequestLog 타입 보장
     */
    const requestLogData = StructuredLoggerService.extractRequestLogData(request);

    /**
     * 요청 로그 출력
     *
     * @why-one-line
     * 한 줄로 로깅하는 이유:
     * - 가독성: 복잡한 로직 숨김
     * - 재사용성: 동일한 로그 포맷
     * - 유지보수: 로그 형식 변경 시 StructuredLoggerService만 수정
     */
    this.logger.logRequest(requestLogData);

    /**
     * 응답/에러 로깅 파이프라인
     *
     * @why-simplified
     * StructuredLoggerService로 단순화:
     * - logger.logResponse() 한 줄로 응답 로깅
     * - 느린 요청 감지 로직 StructuredLoggerService에서 처리
     * - 일관된 로그 포맷 자동 적용
     */
    return next.handle().pipe(
      tap({
        /**
         * 성공 응답 로깅
         */
        next: () => {
          const duration = Date.now() - startTime;

          this.logger.logResponse({
            requestId: requestLogData.requestId,
            method: requestLogData.method,
            url: requestLogData.url,
            statusCode: response.statusCode,
            duration,
            userId: requestLogData.userId,
          });
        },

        /**
         * 에러 로깅
         *
         * @note
         * Interceptor에서는 간단한 에러 로그만 출력
         * 상세한 에러 로깅은 HttpExceptionFilter에서 처리
         */
        error: (error) => {
          const duration = Date.now() - startTime;

          /**
           * @why-simple-error-log
           * Interceptor에서는 간단한 에러만 로깅하는 이유:
           * - HttpExceptionFilter에서 더 상세한 로그 출력
           * - 중복 로깅 방지 (에러 발생 사실만 기록)
           * - Filter에서 4xx/5xx 구분, Stack Trace 등 처리
           */
          this.logger.logWarning(`✖ ${requestLogData.method} ${requestLogData.url} ${duration}ms`, {
            requestId: requestLogData.requestId,
            error: error.message,
          });
        },
      }),
    );
  }

  /**
   * @migration-note
   * 기존의 sanitizeBody() 메서드는 StructuredLoggerService로 이동했습니다.
   * - 위치: apps/api/src/common/logger/structured-logger.service.ts
   * - 이유: 코드 중복 제거, 일관된 로깅 로직
   * - 영향: LoggingInterceptor, HttpExceptionFilter 모두 동일한 sanitize 로직 사용
   */

  /**
   * @future 향후 추가 기능
   *
   * Work/ERP 확장 시 고려할 기능들:
   *
   * 1. **Winston Logger 교체 (프로덕션)**:
   *    StructuredLoggerService에서 Winston으로 전환
   *
   * 2. **로그 샘플링 (High Traffic)**:
   *    StructuredLoggerService에 샘플링 로직 추가
   *
   * 3. **엔드포인트별 임계값 설정**:
   *    ```typescript
   *    @SetSlowThreshold(5000)  // 5초
   *    @Get('reports')
   *    async generateReport() {}
   *    ```
   *
   * 4. **외부 모니터링 연동**:
   *    StructuredLoggerService에서 Sentry, DataDog 연동
   */
}
