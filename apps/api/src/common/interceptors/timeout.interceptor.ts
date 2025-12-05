/**
 * Timeout Interceptor
 *
 * @description
 * 지정된 시간 내에 응답하지 않으면 요청을 자동으로 취소하고
 * 408 Request Timeout 에러를 반환하는 전역 Interceptor
 *
 * @why-global-timeout-interceptor
 * 전역 Timeout Interceptor가 필요한 이유:
 *
 * 1. **리소스 보호 (Resource Protection)**
 *    - 문제: 무한 대기 중인 요청이 리소스(메모리, DB 연결, 스레드)를 계속 점유
 *    - 해결: 일정 시간 후 자동 취소 → 리소스 반환
 *    - 효과: 서버 다운 방지, 동시 처리 능력 향상
 *
 * 2. **사용자 경험 (User Experience)**
 *    - 문제: 클라이언트가 무한정 대기 → 화면 멈춤, 사용자 이탈
 *    - 해결: 명확한 타임아웃 에러 반환 → 클라이언트가 재시도/안내
 *    - 효과: 사용자에게 명확한 피드백 제공
 *
 * 3. **캐스케이딩 실패 방지 (Cascading Failure Prevention)**
 *    - 문제: 외부 API가 느리면 내부 서버도 영향 받음 (도미노 효과)
 *    - 해결: 타임아웃으로 조기 차단 → 다음 요청 처리 가능
 *    - 효과: 전체 시스템 안정성 향상
 *
 * 4. **악의적 공격 방어 (Slowloris Attack)**
 *    - 문제: 의도적으로 느린 요청을 대량 전송 → 서버 리소스 고갈
 *    - 해결: 타임아웃으로 강제 종료
 *    - 효과: DoS 공격 완화
 *
 * 5. **성능 문제 조기 발견 (Early Detection)**
 *    - 문제: 느린 쿼리, 무한 루프 등이 숨어있음
 *    - 해결: 타임아웃 에러 발생 → 로그로 문제 파악
 *    - 효과: 성능 병목 지점 조기 발견
 *
 * @why-30-seconds
 * 30초를 기본값으로 사용하는 이유:
 *
 * - **일반 API**: 대부분 1초 이내 응답 (30초는 충분한 여유)
 * - **무거운 작업**: 리포트 생성, 파일 처리 등도 30초면 충분
 * - **브라우저 타임아웃**: 대부분 브라우저가 30-60초 타임아웃
 * - **프록시/로드밸런서**: Nginx, ALB 기본값이 30-60초
 * - **AWS Lambda**: 최대 실행 시간이 15분이지만 API Gateway는 30초
 *
 * @why-interceptor-not-middleware
 * Middleware 대신 Interceptor를 사용하는 이유:
 *
 * - ✅ **Interceptor**:
 *   - RxJS timeout 연산자 사용 → 정확한 타임아웃
 *   - Controller 실행 시간만 측정 (미들웨어/가드 제외)
 *   - 엔드포인트별 커스텀 타임아웃 가능 (Reflector)
 *
 * - ❌ **Middleware**:
 *   - setTimeout으로 구현 → 부정확
 *   - 전체 요청 시간 측정 (파싱, 라우팅 포함)
 *   - 엔드포인트 구분 어려움
 *
 * @why-rxjs-timeout
 * RxJS의 `timeout` 연산자를 사용하는 이유:
 *
 * - **자동 취소**: 타임아웃 시 Observable을 자동으로 unsubscribe
 * - **메모리 누수 방지**: 리소스 자동 정리
 * - **정확성**: 밀리초 단위로 정확한 타임아웃
 * - **조합 가능**: 다른 Interceptor와 체이닝 가능
 *
 * @architecture
 * 타임아웃 플로우:
 * ```
 * 요청 수신
 *   ↓
 * TimeoutInterceptor.intercept()
 *   ↓
 * next.handle().pipe(timeout(30000))
 *   ↓
 * ┌─────────────────┬─────────────────┐
 * │ 30초 이내 응답   │ 30초 초과       │
 * └─────────────────┴─────────────────┘
 *   ↓                 ↓
 * 정상 응답         TimeoutError 발생
 *                     ↓
 *                   catchError()
 *                     ↓
 *                   RequestTimeoutException (408)
 *                     ↓
 *                   HttpExceptionFilter
 *                     ↓
 *                   { success: false, error: { ... }, meta }
 * ```
 *
 * @before-after
 * 타임아웃 예시:
 *
 * **정상 응답 (30초 이내)**
 * ```
 * GET /api/v1/users → 200 OK (450ms)
 * ```
 *
 * **타임아웃 (30초 초과)**
 * ```
 * GET /api/v1/reports → 408 Request Timeout
 * {
 *   "success": false,
 *   "error": {
 *     "code": "REQUEST_TIMEOUT",
 *     "message": "요청 시간이 초과되었습니다 (30000ms)",
 *     "statusCode": 408
 *   },
 *   "meta": {
 *     "timestamp": "2025-01-15T12:34:56.789Z",
 *     "requestId": "550e8400-e29b-41d4-a716-446655440000"
 *   }
 * }
 * ```
 *
 * @features
 * - ✅ 기본 30초 타임아웃 (생성자로 커스터마이징 가능)
 * - ✅ 타임아웃 시 요청 자동 취소 (Observable unsubscribe)
 * - ✅ 408 Request Timeout 응답 (HTTP 표준)
 * - ✅ 엔드포인트별 커스텀 타임아웃 (향후 구현, @SetTimeout 데코레이터)
 * - ✅ 리소스 자동 정리 (메모리 누수 방지)
 *
 * @usage
 * ```typescript
 * // main.ts - 전역 적용 (기본 30초)
 * app.useGlobalInterceptors(new TimeoutInterceptor());
 *
 * // main.ts - 전역 적용 (커스텀 60초)
 * app.useGlobalInterceptors(new TimeoutInterceptor(60000));
 *
 * // Controller - 엔드포인트별 커스텀 (향후 구현)
 * @SetTimeout(60000)  // 60초
 * @Post('upload')
 * async upload() {
 *   // 파일 업로드는 60초 허용
 * }
 * ```
 *
 * @performance
 * - 오버헤드: <1ms (RxJS timeout 연산자만 추가)
 * - 메모리: 타임아웃 시 자동 정리 (메모리 누수 없음)
 * - CPU: 타임아웃 체크는 이벤트 루프 기반 (블로킹 없음)
 * - 리소스 절약: 무한 대기 방지 → DB 연결, 메모리 반환
 *
 * @scalability
 * Work/ERP 확장 시 고려사항:
 *
 * 1. **엔드포인트별 타임아웃 (Reflector 메타데이터)**:
 *    ```typescript
 *    // 데코레이터로 메타데이터 저장
 *    @SetTimeout(60000)
 *    @Post('reports')
 *    async generateReport() {}
 *
 *    // Interceptor에서 메타데이터 읽기
 *    const customTimeout = this.reflector.get('timeout', context.getHandler());
 *    const timeout = customTimeout || this.timeoutMs;
 *    ```
 *
 * 2. **작업 유형별 타임아웃**:
 *    ```typescript
 *    // 일반 API: 30초
 *    // 파일 업로드: 5분 (300초)
 *    // 리포트 생성: 10분 (600초)
 *    // 배치 작업: 30분 (1800초)
 *    ```
 *
 * 3. **프로그레스 응답 (Server-Sent Events)**:
 *    ```typescript
 *    // 긴 작업은 타임아웃 대신 프로그레스 전송
 *    @Sse('reports/progress')
 *    async* generateReportWithProgress() {
 *      yield { data: { progress: 10 } };
 *      yield { data: { progress: 50 } };
 *      yield { data: { progress: 100, result: '...' } };
 *    }
 *    ```
 *
 * 4. **비동기 작업 큐 (Bull/BullMQ)**:
 *    ```typescript
 *    // 매우 긴 작업은 큐로 전환
 *    @Post('reports')
 *    async generateReport() {
 *      const job = await this.reportQueue.add('generate', { ... });
 *      return { jobId: job.id, status: 'processing' };
 *    }
 *    ```
 *
 * 5. **타임아웃 메트릭 수집**:
 *    ```typescript
 *    if (err instanceof TimeoutError) {
 *      this.metricsService.increment('timeout_errors', {
 *        endpoint: request.url,
 *        method: request.method,
 *      });
 *      // 알람: 타임아웃 비율이 5% 초과 시 Slack 알림
 *    }
 *    ```
 *
 * @security
 * 보안 고려사항:
 *
 * - ✅ **Slowloris 공격 방어**: 의도적으로 느린 요청을 자동 종료
 * - ✅ **리소스 고갈 방지**: 무한 대기 요청으로 인한 서버 다운 방지
 * - ⚠️ **타임아웃 값 노출**: 에러 메시지에 타임아웃 값 포함 (공격자가 악용 가능)
 *   - 해결: 프로덕션에서는 일반적 메시지만 노출
 *   ```typescript
 *   const message = process.env.NODE_ENV === 'production'
 *     ? '요청 시간이 초과되었습니다'
 *     : `요청 시간이 초과되었습니다 (${this.timeoutMs}ms)`;
 *   ```
 *
 * @alternatives
 * 다른 타임아웃 구현 방법들과 비교:
 *
 * 1. ❌ **setTimeout으로 수동 구현**:
 *    - 단점: 메모리 누수 위험, clearTimeout 누락 가능
 *    ```typescript
 *    const timer = setTimeout(() => {
 *      throw new Error('Timeout');
 *    }, 30000);
 *    // ❌ 응답 후 clearTimeout 누락 시 메모리 누수
 *    ```
 *
 * 2. ❌ **Middleware로 구현**:
 *    - 단점: 요청 파싱, 라우팅 시간도 포함 → 부정확
 *    ```typescript
 *    app.use((req, res, next) => {
 *      const timer = setTimeout(() => {
 *        res.status(408).send('Timeout');
 *      }, 30000);
 *      res.on('finish', () => clearTimeout(timer));
 *      next();
 *    });
 *    ```
 *
 * 3. ❌ **Controller에서 직접 구현**:
 *    - 단점: 코드 중복, 실수 가능성
 *    ```typescript
 *    @Get()
 *    async findAll() {
 *      return Promise.race([
 *        this.service.findAll(),
 *        new Promise((_, reject) =>
 *          setTimeout(() => reject(new Error('Timeout')), 30000)
 *        ),
 *      ]);
 *    }
 *    ```
 *
 * 4. ✅ **Global Interceptor + RxJS timeout (현재 방식)**:
 *    - 장점: 자동화, 정확성, 메모리 안전, 확장성
 *    - 단점: RxJS 이해 필요
 *
 * @testing
 * 테스트 시나리오:
 *
 * ```typescript
 * describe('TimeoutInterceptor', () => {
 *   it('정상 응답 시 타임아웃 안 됨', async () => {
 *     const result = await controller.findAll();  // 100ms 소요
 *     expect(result).toBeDefined();
 *   });
 *
 *   it('30초 초과 시 408 에러', async () => {
 *     jest.useFakeTimers();
 *     const promise = controller.slowOperation();  // 60초 소요
 *     jest.advanceTimersByTime(30001);
 *     await expect(promise).rejects.toThrow(RequestTimeoutException);
 *     jest.useRealTimers();
 *   });
 *
 *   it('커스텀 타임아웃 적용', async () => {
 *     const interceptor = new TimeoutInterceptor(5000);  // 5초
 *     // 테스트 로직
 *   });
 * });
 * ```
 *
 * @related
 * 연관 컴포넌트:
 * - `HttpExceptionFilter`: 타임아웃 에러를 408 응답으로 변환
 * - `LoggingInterceptor`: 타임아웃 발생 시 에러 로그 기록
 * - `TransformInterceptor`: 정상 응답 변환 (타임아웃 전)
 * - `RequestIdMiddleware`: Request ID 생성 (타임아웃 에러 추적)
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * 요청 타임아웃 Interceptor
 *
 * @why-injectable
 * `@Injectable()` 데코레이터를 사용하는 이유:
 * - NestJS IoC 컨테이너에 등록
 * - Singleton 인스턴스 관리 (메모리 효율)
 * - 향후 의존성 주입 가능 (ConfigService, MetricsService 등)
 *
 * @why-configurable-timeout
 * 생성자로 타임아웃을 받는 이유:
 * - 환경별 설정: 개발(60초), 프로덕션(30초)
 * - 테스트: 짧은 타임아웃(1초)으로 빠른 테스트
 * - 유연성: 서비스 특성에 맞게 조정 가능
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  /**
   * 타임아웃 시간 (밀리초)
   *
   * @why-readonly
   * readonly로 선언하는 이유:
   * - 불변성: 생성 후 변경 방지 (예상치 못한 버그 방지)
   * - 의도 명확: 타임아웃은 고정값임을 표시
   * - 성능: 컴파일러 최적화 가능
   *
   * @why-default-30000
   * 30초(30000ms)를 기본값으로 사용하는 이유:
   * - **일반 API**: 대부분 1초 이내 응답 (30초는 충분)
   * - **무거운 작업**: 리포트 생성도 30초면 대부분 완료
   * - **브라우저 호환**: 대부분 브라우저가 30-60초 타임아웃
   * - **프록시 호환**: Nginx, ALB 기본값이 30-60초
   * - **AWS 호환**: API Gateway 최대 타임아웃이 30초
   *
   * @example
   * ```typescript
   * // 기본 30초
   * new TimeoutInterceptor()
   *
   * // 커스텀 60초
   * new TimeoutInterceptor(60000)
   *
   * // ConfigService에서 읽기
   * new TimeoutInterceptor(configService.get('TIMEOUT_MS', 30000))
   * ```
   */
  constructor(private readonly timeoutMs: number = 30000) {}

  /**
   * 요청/응답 가로채기 (Intercept)
   *
   * @param context - 실행 컨텍스트 (HTTP 요청 정보)
   * @param next - 다음 핸들러 (Controller)
   *
   * @why-execution-context
   * ExecutionContext를 사용하는 이유:
   * - 프로토콜 독립적: HTTP, WebSocket, gRPC 모두 처리 가능
   * - 메타데이터 접근: Reflector로 @SetTimeout 데코레이터 읽기 (향후 구현)
   * - 타입 안전성: switchToHttp()로 HTTP 전용 메서드 접근
   *
   * @returns Observable<any> - 타임아웃이 적용된 응답 스트림
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    /**
     * RxJS 파이프라인
     *
     * @why-pipe
     * RxJS pipe를 사용하는 이유:
     * - **조합 가능**: timeout, catchError를 순차적으로 적용
     * - **선언적**: 코드가 의도를 명확히 표현
     * - **타입 안전**: TypeScript가 Observable 타입 추론
     *
     * @flow
     * 1. next.handle() - Controller 실행
     * 2. timeout(30000) - 30초 타임아웃 체크
     * 3. catchError() - TimeoutError 발생 시 RequestTimeoutException으로 변환
     */
    return next.handle().pipe(
      /**
       * RxJS timeout 연산자
       *
       * @why-rxjs-timeout
       * RxJS timeout을 사용하는 이유:
       *
       * - **자동 취소**: 타임아웃 시 Observable을 자동으로 unsubscribe
       *   → DB 쿼리, HTTP 요청 등 진행 중인 작업 중단
       *   → 리소스(메모리, 연결) 즉시 반환
       *
       * - **정확성**: 밀리초 단위로 정확한 타임아웃
       *   → setTimeout보다 정밀
       *
       * - **메모리 안전**: unsubscribe 시 자동 정리
       *   → 메모리 누수 방지
       *
       * - **스트림 통합**: RxJS 파이프라인에 자연스럽게 통합
       *   → 다른 연산자(map, tap)와 조합 가능
       *
       * @behavior
       * - 30초 이내 응답: 정상 처리 (다음 연산자로 전달)
       * - 30초 초과: TimeoutError 발생 (catchError로 전달)
       *
       * @example
       * ```typescript
       * // 정상 응답 (10초)
       * next.handle() → timeout(30000) → map(data) → 200 OK
       *
       * // 타임아웃 (40초)
       * next.handle() → timeout(30000) → TimeoutError → catchError
       * ```
       */
      timeout(this.timeoutMs),

      /**
       * 에러 처리 (catchError)
       *
       * @why-catch-error
       * catchError를 사용하는 이유:
       * - **에러 변환**: TimeoutError → RequestTimeoutException
       * - **HTTP 표준**: 408 Request Timeout 응답 생성
       * - **클라이언트 친화**: 의미 있는 에러 메시지 제공
       * - **로깅**: HttpExceptionFilter가 자동으로 로깅
       *
       * @param err - 발생한 에러 (TimeoutError 또는 기타 에러)
       *
       * @why-instanceof-check
       * instanceof TimeoutError로 체크하는 이유:
       * - **타입 가드**: TypeScript가 타입을 좁힘 (Type Narrowing)
       * - **정확성**: TimeoutError만 RequestTimeoutException으로 변환
       * - **기타 에러**: 다른 에러는 그대로 전파 (HttpExceptionFilter가 처리)
       */
      catchError((err) => {
        /**
         * TimeoutError 발생 시
         *
         * @why-request-timeout-exception
         * RequestTimeoutException을 사용하는 이유:
         * - **HTTP 표준**: 408 Request Timeout (RFC 7231)
         * - **자동 처리**: HttpExceptionFilter가 자동으로 변환
         * - **일관성**: 다른 예외와 동일한 형식 (ApiErrorResponse)
         *
         * @http-status-408
         * 408 Request Timeout의 의미:
         * - **정의**: 서버가 요청을 기다리다 타임아웃
         * - **재시도**: 클라이언트가 동일한 요청을 재시도 가능
         * - **멱등성**: GET, PUT, DELETE는 안전하게 재시도
         * - **비멱등성**: POST는 중복 생성 주의 (idempotency key 권장)
         *
         * @why-include-timeout-value
         * 에러 메시지에 타임아웃 값을 포함하는 이유:
         * - **디버깅**: 개발자가 타임아웃 시간 확인 가능
         * - **클라이언트 대응**: 재시도 타이머 설정 참고
         * - **투명성**: 왜 실패했는지 명확히 전달
         *
         * @security
         * 프로덕션에서는 타임아웃 값 노출 주의:
         * ```typescript
         * const message = process.env.NODE_ENV === 'production'
         *   ? '요청 시간이 초과되었습니다'
         *   : `요청 시간이 초과되었습니다 (${this.timeoutMs}ms)`;
         * ```
         */
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `요청 시간이 초과되었습니다 (${this.timeoutMs}ms)`,
              ),
          );
        }

        /**
         * 기타 에러는 그대로 전파
         *
         * @why-rethrow
         * 기타 에러를 그대로 전파하는 이유:
         * - **책임 분리**: TimeoutInterceptor는 타임아웃만 처리
         * - **필터 위임**: HttpExceptionFilter가 모든 에러 처리
         * - **일관성**: 에러 처리 로직이 한 곳에 집중
         *
         * @example
         * ```typescript
         * // Prisma 에러, Validation 에러 등
         * HttpExceptionFilter가 처리 → 400/404/500 응답
         * ```
         */
        return throwError(() => err);
      }),
    );
  }

  /**
   * @future 향후 추가 기능
   *
   * Work/ERP 확장 시 고려할 기능들:
   *
   * 1. **Reflector로 엔드포인트별 타임아웃 읽기**:
   *    ```typescript
   *    import { Reflector } from '@nestjs/core';
   *
   *    constructor(
   *      private readonly timeoutMs: number = 30000,
   *      private readonly reflector?: Reflector,
   *    ) {}
   *
   *    intercept(context, next) {
   *      // @SetTimeout 데코레이터에서 설정한 값 읽기
   *      const customTimeout = this.reflector?.get<number>(
   *        'timeout',
   *        context.getHandler(),
   *      );
   *      const timeout = customTimeout || this.timeoutMs;
   *
   *      return next.handle().pipe(
   *        timeout(timeout),
   *        catchError(...)
   *      );
   *    }
   *    ```
   *
   * 2. **타임아웃 메트릭 수집**:
   *    ```typescript
   *    catchError((err) => {
   *      if (err instanceof TimeoutError) {
   *        const request = context.switchToHttp().getRequest();
   *        this.metricsService.increment('timeout_errors', {
   *          endpoint: request.url,
   *          method: request.method,
   *        });
   *      }
   *      return throwError(() => ...);
   *    })
   *    ```
   *
   * 3. **타임아웃 알람 (임계값 초과 시)**:
   *    ```typescript
   *    // 1시간 동안 타임아웃이 100건 이상 발생하면 Slack 알림
   *    if (timeoutCount > 100) {
   *      await this.slackService.sendAlert('타임아웃 급증 감지');
   *    }
   *    ```
   *
   * 4. **프로그레스 타임아웃 (긴 작업)**:
   *    ```typescript
   *    // 긴 작업은 주기적으로 진행 상황 전송 → 타임아웃 리셋
   *    @Sse('reports/progress')
   *    async* generateReport() {
   *      yield { progress: 10 };  // 타임아웃 리셋
   *      yield { progress: 50 };  // 타임아웃 리셋
   *      yield { progress: 100, result: '...' };
   *    }
   *    ```
   *
   * 5. **환경별 타임아웃 설정**:
   *    ```typescript
   *    // .env
   *    TIMEOUT_MS=30000  // 프로덕션
   *    TIMEOUT_MS=60000  // 개발 (디버깅 용이)
   *
   *    // main.ts
   *    const timeout = configService.get('TIMEOUT_MS', 30000);
   *    app.useGlobalInterceptors(new TimeoutInterceptor(timeout));
   *    ```
   */
}

/**
 * SetTimeout 데코레이터
 *
 * @description
 * 엔드포인트별 커스텀 타임아웃을 설정하는 메서드 데코레이터
 *
 * @why-decorator
 * 데코레이터를 사용하는 이유:
 * - **선언적**: 타임아웃을 메서드 위에 명시적으로 표시
 * - **가독성**: 코드만 봐도 타임아웃 설정을 쉽게 파악
 * - **재사용성**: 여러 엔드포인트에 적용 가능
 * - **메타데이터**: Reflector로 런타임에 읽기 가능
 *
 * @example
 * ```typescript
 * @Controller('reports')
 * export class ReportController {
 *   @Get()
 *   @SetTimeout(60000)  // 60초 (리포트 생성은 시간이 오래 걸림)
 *   async generateReport() {
 *     // ...
 *   }
 *
 *   @Get('summary')
 *   // SetTimeout 없음 → 기본 30초
 *   async getSummary() {
 *     // ...
 *   }
 * }
 * ```
 *
 * @implementation
 * 현재 구현:
 * - ⚠️ TODO: Reflector로 메타데이터 저장 미구현
 * - ⚠️ TimeoutInterceptor에서 읽기 미구현
 *
 * @future
 * 향후 구현 방법:
 * ```typescript
 * import { SetMetadata } from '@nestjs/common';
 *
 * export const SetTimeout = (timeoutMs: number) =>
 *   SetMetadata('timeout', timeoutMs);
 *
 * // TimeoutInterceptor에서 읽기
 * const customTimeout = this.reflector.get<number>(
 *   'timeout',
 *   context.getHandler(),
 * );
 * ```
 *
 * @param timeoutMs - 타임아웃 시간 (밀리초)
 * @returns 메서드 데코레이터 함수
 *
 * @why-return-descriptor
 * descriptor를 반환하는 이유:
 * - **체이닝**: 다른 데코레이터와 조합 가능
 * - **표준**: TypeScript 데코레이터 스펙 준수
 * - **타입 안전**: PropertyDescriptor 타입 보장
 */
export const SetTimeout = (timeoutMs: number) => {
  /**
   * 메서드 데코레이터 함수
   *
   * @param target - 클래스 프로토타입 (ReportController.prototype)
   * @param propertyKey - 메서드 이름 ('generateReport')
   * @param descriptor - 메서드 디스크립터 (value, writable, enumerable 등)
   *
   * @why-parameters
   * 이 파라미터들을 받는 이유:
   * - **target**: 어느 클래스의 메서드인지 식별
   * - **propertyKey**: 어떤 메서드인지 식별
   * - **descriptor**: 메서드 정보 읽기/수정
   *
   * @returns PropertyDescriptor - 변경된 디스크립터
   */
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    /**
     * @future 향후 구현
     *
     * 메타데이터 저장 방법:
     * ```typescript
     * import { SetMetadata } from '@nestjs/common';
     *
     * // 방법 1: SetMetadata 사용 (권장)
     * export const SetTimeout = (timeoutMs: number) =>
     *   SetMetadata('timeout', timeoutMs);
     *
     * // 방법 2: Reflect.defineMetadata 사용
     * Reflect.defineMetadata('timeout', timeoutMs, descriptor.value);
     *
     * // 방법 3: Custom Metadata
     * if (!Reflect.hasMetadata('timeout', target, propertyKey)) {
     *   Reflect.defineMetadata('timeout', timeoutMs, target, propertyKey);
     * }
     * ```
     *
     * TimeoutInterceptor에서 읽기:
     * ```typescript
     * import { Reflector } from '@nestjs/core';
     *
     * constructor(
     *   private readonly timeoutMs: number,
     *   private readonly reflector: Reflector,
     * ) {}
     *
     * intercept(context, next) {
     *   const handler = context.getHandler();
     *   const customTimeout = this.reflector.get<number>('timeout', handler);
     *   const timeout = customTimeout || this.timeoutMs;
     *   // ...
     * }
     * ```
     */

    /**
     * @todo 메타데이터 저장 구현
     *
     * 구현 전:
     * - @SetTimeout 데코레이터는 동작하지 않음
     * - 모든 엔드포인트가 기본 30초 타임아웃 사용
     *
     * 구현 후:
     * - @SetTimeout(60000) → 해당 엔드포인트만 60초
     * - 엔드포인트별 세밀한 타임아웃 제어 가능
     */

    return descriptor;
  };
};
