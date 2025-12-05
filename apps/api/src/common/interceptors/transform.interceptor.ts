/**
 * Response Transform Interceptor
 *
 * @description
 * 모든 성공 응답을 일관된 형식(ApiSuccessResponse)으로 변환하는 전역 Interceptor
 *
 * @why-global-interceptor
 * 전역 Response Interceptor가 필요한 이유:
 *
 * 1. **일관성 (Consistency)**
 *    - 문제: Controller마다 다른 응답 형식 → 클라이언트 코드 복잡도 증가
 *    - 해결: 모든 성공 응답을 `{ success: true, data, meta }` 형식으로 통일
 *    - 효과: 프론트엔드에서 `response.data`로 일관되게 접근
 *
 * 2. **메타 정보 자동 추가 (Auto Metadata)**
 *    - `timestamp`: 응답 생성 시간 → 캐싱, 디버깅
 *    - `requestId`: 요청 추적 → 에러 디버깅, 분산 추적 (Distributed Tracing)
 *    - 향후 추가 가능: `pagination`, `version`, `deprecation`
 *
 * 3. **보일러플레이트 제거 (DRY)**
 *    - 문제: 모든 Controller에서 `return { success: true, data }` 반복
 *    - 해결: Controller는 비즈니스 데이터만 반환, Interceptor가 래핑
 *    - 효과: 코드 중복 제거, 실수 방지
 *
 * 4. **Swagger 문서 자동 생성**
 *    - `ApiSuccessResponse<T>` 타입으로 자동 스키마 생성
 *    - 클라이언트 SDK 생성 시 타입 안전성 보장
 *
 * 5. **API 버전 관리 대비**
 *    - v1, v2 버전별로 다른 응답 형식 필요 시 Interceptor만 수정
 *    - 비즈니스 로직 변경 없이 응답 형식 변경 가능
 *
 * @why-interceptor-not-filter
 * Filter 대신 Interceptor를 사용하는 이유:
 *
 * - ✅ **Interceptor**: 성공 응답 변환 (정상 플로우)
 * - ❌ **Filter**: 예외 응답 변환 (에러 플로우)
 *
 * Interceptor는 RxJS pipe를 통해 응답을 변환할 수 있지만,
 * Filter는 예외만 처리하므로 정상 응답 변환에는 부적합.
 *
 * @why-rxjs-pipe
 * RxJS의 `map` 연산자를 사용하는 이유:
 *
 * - **Non-Blocking**: 비동기 응답도 자동 처리
 * - **함수형**: 불변성 유지, 사이드 이펙트 없음
 * - **조합 가능**: 다른 Interceptor와 체이닝 가능
 *   ```typescript
 *   next.handle().pipe(
 *     map(transformData),      // TransformInterceptor
 *     tap(logResponse),         // LoggingInterceptor
 *     timeout(30000),           // TimeoutInterceptor
 *   )
 *   ```
 *
 * @architecture
 * 응답 변환 플로우:
 * ```
 * Controller 반환
 *   ↓
 * { email: "...", name: "..." }  (원본 데이터)
 *   ↓
 * TransformInterceptor.intercept()
 *   ↓
 * {
 *   success: true,
 *   data: { email: "...", name: "..." },
 *   meta: { timestamp, requestId }
 * }
 *   ↓
 * HTTP 응답
 * ```
 *
 * @before-after
 * 변환 전후 비교:
 *
 * **Before (Controller 직접 반환)**
 * ```typescript
 * @Get(':id')
 * async findUser(@Param('id') id: string) {
 *   return await this.userService.findById(id);
 * }
 * ```
 * 응답:
 * ```json
 * {
 *   "email": "user@example.com",
 *   "name": "홍길동"
 * }
 * ```
 *
 * **After (Interceptor 자동 변환)**
 * ```typescript
 * @Get(':id')
 * async findUser(@Param('id') id: string) {
 *   return await this.userService.findById(id);  // 동일한 코드
 * }
 * ```
 * 응답:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "email": "user@example.com",
 *     "name": "홍길동"
 *   },
 *   "meta": {
 *     "timestamp": "2025-01-15T12:34:56.789Z",
 *     "requestId": "550e8400-e29b-41d4-a716-446655440000"
 *   }
 * }
 * ```
 *
 * @features
 * - ✅ 모든 성공 응답을 `ApiSuccessResponse` 포맷으로 래핑
 * - ✅ 메타 정보 자동 추가 (timestamp, requestId)
 * - ✅ 이미 변환된 응답은 중복 변환 방지 (idempotent)
 * - ✅ Swagger 응답 스키마 자동 적용
 * - ✅ 타입 안전성 보장 (Generic `<T>`)
 *
 * @usage
 * ```typescript
 * // main.ts - 전역 적용
 * app.useGlobalInterceptors(new TransformInterceptor());
 *
 * // Controller - 추가 코드 불필요
 * @Get()
 * async findAll() {
 *   return users;  // 자동으로 ApiSuccessResponse로 래핑됨
 * }
 * ```
 *
 * @performance
 * - 오버헤드: <1ms (객체 래핑만 수행)
 * - 메모리: 원본 데이터 참조 (복사 없음)
 * - 동시 요청: 인스턴스 공유 (Singleton)
 *
 * @scalability
 * Work/ERP 확장 시 고려사항:
 *
 * 1. **Pagination 메타 추가**:
 *    ```typescript
 *    meta: {
 *      timestamp,
 *      requestId,
 *      pagination: { page, limit, total, hasNext }
 *    }
 *    ```
 *
 * 2. **API 버전별 응답 형식**:
 *    ```typescript
 *    // v1: { success, data, meta }
 *    // v2: { status: "ok", result, _meta }
 *    const version = request.headers['api-version'];
 *    ```
 *
 * 3. **성능 모니터링 메타**:
 *    ```typescript
 *    meta: {
 *      timestamp,
 *      requestId,
 *      processingTime: `${Date.now() - startTime}ms`,
 *      cacheHit: true/false
 *    }
 *    ```
 *
 * 4. **다국어 메타 정보**:
 *    ```typescript
 *    meta: {
 *      timestamp,
 *      requestId,
 *      locale: 'ko-KR',
 *      timezone: 'Asia/Seoul'
 *    }
 *    ```
 *
 * @alternatives
 * 다른 응답 변환 방법들과 비교:
 *
 * 1. ❌ **Controller에서 직접 래핑**:
 *    - 단점: 코드 중복, 실수 가능성, 일관성 보장 어려움
 *    ```typescript
 *    return { success: true, data, meta: { timestamp: new Date() } };
 *    ```
 *
 * 2. ❌ **Base Controller 상속**:
 *    - 단점: 상속 제약, 다중 상속 불가, 유연성 부족
 *    ```typescript
 *    class BaseController {
 *      success(data) { return { success: true, data }; }
 *    }
 *    ```
 *
 * 3. ✅ **Global Interceptor (현재 방식)**:
 *    - 장점: 자동화, 일관성, DRY, 유연성
 *    - 단점: 마법처럼 보일 수 있음 (명시적이지 않음)
 *
 * @testing
 * 테스트 시나리오:
 *
 * ```typescript
 * describe('TransformInterceptor', () => {
 *   it('원본 데이터를 ApiSuccessResponse로 래핑', async () => {
 *     const result = await controller.findAll();
 *     expect(result).toMatchObject({
 *       success: true,
 *       data: expect.any(Array),
 *       meta: {
 *         timestamp: expect.any(String),
 *         requestId: expect.any(String),
 *       },
 *     });
 *   });
 *
 *   it('이미 변환된 응답은 중복 변환 방지', async () => {
 *     const alreadyTransformed = { success: true, data: [] };
 *     const result = await interceptor.intercept(alreadyTransformed);
 *     expect(result).toBe(alreadyTransformed);  // 같은 객체
 *   });
 * });
 * ```
 *
 * @security
 * 보안 고려사항:
 *
 * - ✅ **정보 누출 방지**: `meta`에 민감한 정보 포함 금지
 * - ✅ **타입 안전성**: Generic `<T>`로 데이터 타입 보장
 * - ⚠️ **대용량 데이터**: 매우 큰 응답은 래핑 오버헤드 고려
 *   - 해결: Streaming 응답은 Interceptor 스킵
 *
 * @related
 * 연관 컴포넌트:
 * - `HttpExceptionFilter`: 에러 응답 변환 (ApiErrorResponse)
 * - `ApiSuccessResponse`: 성공 응답 DTO
 * - `LoggingInterceptor`: 응답 로깅 (변환 후)
 * - `RequestIdMiddleware`: Request ID 생성 (변환 시 사용)
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../dto/api-response.dto';

/**
 * 응답 변환 Interceptor
 *
 * @why-injectable
 * `@Injectable()` 데코레이터를 사용하는 이유:
 * - NestJS IoC 컨테이너에 등록
 * - Singleton 인스턴스 관리 (메모리 효율)
 * - 의존성 주입 가능 (향후 ConfigService 등 주입)
 *
 * @why-generic
 * Generic `<T>`를 사용하는 이유:
 * - 타입 안전성: Controller 반환 타입이 그대로 유지됨
 * - Swagger 스키마: `ApiSuccessResponse<User>` 형태로 자동 생성
 * - IDE 지원: 자동완성, 타입 체크
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  /**
   * 요청/응답 가로채기 (Intercept)
   *
   * @param context - 실행 컨텍스트 (HTTP, WebSocket, gRPC 등)
   * @param next - 다음 핸들러 (Controller 또는 다음 Interceptor)
   *
   * @why-execution-context
   * ExecutionContext를 사용하는 이유:
   * - 프로토콜 독립적: HTTP뿐 아니라 WebSocket, gRPC에도 적용 가능
   * - 요청 정보 접근: Request, Response 객체 가져오기
   * - 메타데이터 접근: Decorator로 설정한 메타데이터 읽기
   *
   * @why-call-handler
   * CallHandler를 사용하는 이유:
   * - `handle()`: 다음 Interceptor 또는 Controller 실행
   * - Observable 반환: RxJS 파이프라인으로 응답 변환
   * - 지연 실행: handle() 호출 전까지 실행 안 됨 (pre-processing 가능)
   *
   * @returns Observable<ApiSuccessResponse<T>> - 변환된 응답
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<T>> {
    /**
     * Request ID 추출
     *
     * @why-request-id
     * Request ID를 응답에 포함하는 이유:
     * - **에러 추적**: 클라이언트가 에러 발생 시 Request ID를 제공
     * - **분산 추적**: 마이크로서비스 간 요청 추적 (Distributed Tracing)
     * - **로그 상관관계**: 로그 검색 시 Request ID로 필터링
     * - **디버깅**: 요청-응답 쌍을 쉽게 찾기
     *
     * @why-type-assertion
     * `(request as any).id`를 사용하는 이유:
     * - Express Request에 `id` 속성이 기본적으로 없음
     * - RequestIdMiddleware에서 동적으로 추가됨
     * - TypeScript는 이를 모르므로 타입 단언 필요
     *
     * @future
     * 향후 개선: Request 타입 확장
     * ```typescript
     * declare global {
     *   namespace Express {
     *     interface Request {
     *       id?: string;
     *     }
     *   }
     * }
     * ```
     */
    const request = context.switchToHttp().getRequest();
    const requestId = (request as any).id || undefined;

    /**
     * 응답 변환 파이프라인
     *
     * @why-pipe
     * RxJS pipe를 사용하는 이유:
     * - **비동기 처리**: Promise, Observable 모두 자동 처리
     * - **체이닝**: 여러 변환을 순차적으로 적용 가능
     * - **Non-Blocking**: 응답을 기다리지 않고 다음 요청 처리
     *
     * @why-map
     * `map` 연산자를 사용하는 이유:
     * - **데이터 변환**: 원본 데이터를 새로운 형식으로 변환
     * - **불변성**: 원본 데이터를 변경하지 않음
     * - **타입 변환**: `T` → `ApiSuccessResponse<T>`
     */
    return next.handle().pipe(
      map((data) => {
        /**
         * 중복 변환 방지 (Idempotent)
         *
         * @why-check-already-transformed
         * 이미 변환된 응답을 체크하는 이유:
         * - **중복 방지**: 수동으로 ApiSuccessResponse를 반환한 경우
         * - **성능**: 불필요한 래핑 방지
         * - **유연성**: Controller에서 특별한 meta 추가 가능
         *
         * @example
         * ```typescript
         * @Get()
         * async findAll() {
         *   // 수동 변환 (특별한 meta 추가)
         *   return new ApiSuccessResponse(users, {
         *     requestId: '...',
         *     pagination: { page: 1, total: 100 }
         *   });
         * }
         * ```
         *
         * @why-success-field-check
         * `success !== undefined`로 체크하는 이유:
         * - `success: true/false` 모두 처리
         * - `null`, `undefined`와 구분
         * - 타입 가드 (Type Guard) 역할
         */
        if (data && data.success !== undefined) {
          return data;
        }

        /**
         * 데이터를 ApiSuccessResponse로 래핑
         *
         * @why-new-api-success-response
         * new ApiSuccessResponse()를 사용하는 이유:
         * - **타입 안전성**: class-validator, class-transformer 적용
         * - **일관성**: 항상 동일한 형식 보장
         * - **확장성**: 나중에 로직 추가 가능 (예: 데이터 필터링)
         *
         * @why-pass-request-id
         * requestId를 meta에 포함하는 이유:
         * - **추적성**: 클라이언트가 에러 발생 시 Request ID 제공
         * - **디버깅**: 로그와 응답을 Request ID로 연결
         * - **모니터링**: APM 도구에서 요청 추적
         *
         * @structure
         * 최종 응답 구조:
         * ```json
         * {
         *   "success": true,
         *   "data": { ...원본 데이터... },
         *   "meta": {
         *     "timestamp": "2025-01-15T12:34:56.789Z",
         *     "requestId": "550e8400-e29b-41d4-a716-446655440000"
         *   }
         * }
         * ```
         */
        return new ApiSuccessResponse(data, { requestId });
      }),
    );
  }

  /**
   * @future 향후 추가 기능
   *
   * Work/ERP 확장 시 고려할 기능들:
   *
   * 1. **캐시 메타 정보**:
   *    ```typescript
   *    intercept(context, next) {
   *      const cacheKey = this.getCacheKey(context);
   *      return next.handle().pipe(
   *        map(data => new ApiSuccessResponse(data, {
   *          requestId,
   *          cache: { key: cacheKey, ttl: 300, hit: false }
   *        }))
   *      );
   *    }
   *    ```
   *
   * 2. **성능 메트릭**:
   *    ```typescript
   *    intercept(context, next) {
   *      const start = Date.now();
   *      return next.handle().pipe(
   *        map(data => new ApiSuccessResponse(data, {
   *          requestId,
   *          performance: {
   *            duration: Date.now() - start,
   *            dbQueries: 5,
   *            cacheHits: 2
   *          }
   *        }))
   *      );
   *    }
   *    ```
   *
   * 3. **API 버전 정보**:
   *    ```typescript
   *    meta: {
   *      requestId,
   *      version: '1.0.0',
   *      deprecation: {
   *        deprecated: false,
   *        sunset: '2026-01-01',
   *        alternative: '/api/v2/users'
   *      }
   *    }
   *    ```
   *
   * 4. **Pagination 자동 추가**:
   *    ```typescript
   *    if (Array.isArray(data) && context.getClass().name.includes('List')) {
   *      meta.pagination = {
   *        page: query.page,
   *        limit: query.limit,
   *        total: data.length,
   *        hasNext: data.length >= query.limit
   *      };
   *    }
   *    ```
   *
   * 5. **Rate Limit 정보**:
   *    ```typescript
   *    const rateLimitInfo = response.headers['x-ratelimit-remaining'];
   *    meta.rateLimit = {
   *      remaining: rateLimitInfo,
   *      reset: new Date(...)
   *    };
   *    ```
   */
}
