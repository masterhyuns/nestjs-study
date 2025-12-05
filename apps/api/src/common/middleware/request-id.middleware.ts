/**
 * Request ID 미들웨어
 *
 * @description
 * 모든 HTTP 요청에 고유한 ID를 부여하여 분산 시스템 로그 추적 가능
 *
 * @why-request-id
 * Request ID가 필요한 이유:
 *
 * 1. **분산 추적 (Distributed Tracing)**:
 *    - 문제: 마이크로서비스에서 요청이 여러 서비스를 거침 (A → B → C)
 *    - 해결: 동일한 Request ID로 전체 플로우 추적
 *    - 효과: "이 요청이 어디서 실패했지?" → Request ID로 즉시 찾기
 *
 * 2. **로그 연결 (Log Correlation)**:
 *    - 문제: 하나의 요청이 수십 개의 로그 생성 (Interceptor, Service, Repository 등)
 *    - 해결: Request ID로 모든 로그 연결
 *    - 효과: ELK에서 "requestId: 550e8400" 검색 → 관련 로그 전부 조회
 *
 * 3. **중복 요청 감지 (Idempotency)**:
 *    - 문제: 네트워크 오류 시 클라이언트가 재시도 → 중복 결제/가입
 *    - 해결: 클라이언트가 동일한 Request ID로 재시도
 *    - 효과: 서버에서 "이미 처리한 Request ID" 감지 → 중복 방지
 *
 * 4. **디버깅 (Debugging)**:
 *    - 문제: 사용자가 "에러 났어요"라고만 말함
 *    - 해결: 응답 헤더의 Request ID를 알려달라고 요청
 *    - 효과: Request ID로 해당 요청의 모든 로그/DB 쿼리 추적
 *
 * @features
 * - ✅ UUID v4 생성 (충돌 가능성 거의 없음: 2^122)
 * - ✅ X-Request-ID 헤더로 클라이언트에 반환
 * - ✅ request.id로 접근 가능 (Controller, Service, Filter, Interceptor)
 * - ✅ 클라이언트가 보낸 ID 우선 사용 (재시도 지원)
 * - ✅ 분산 시스템 로그 추적 (ELK, DataDog 연동 대비)
 *
 * @architecture
 * Request ID 흐름:
 * ```
 * [클라이언트]
 *   요청: GET /api/v1/users
 *   헤더: X-Request-ID: 550e8400-... (있으면 사용, 없으면 생성)
 *     ↓
 * [RequestIdMiddleware] ← 여기서 생성!
 *   req.id = '550e8400-...'
 *   res.setHeader('X-Request-ID', '550e8400-...')
 *     ↓
 * [LoggingInterceptor]
 *   로그: { requestId: '550e8400-...', method: 'GET', url: '/api/v1/users' }
 *     ↓
 * [Controller]
 *   req.id로 접근 가능
 *     ↓
 * [Service]
 *   this.logger.log('작업 시작', { requestId: req.id })
 *     ↓
 * [HttpExceptionFilter]
 *   에러 로그: { requestId: '550e8400-...', error: '...' }
 *     ↓
 * [응답]
 *   헤더: X-Request-ID: 550e8400-...
 * ```
 *
 * @who-creates-request-id
 * Request ID 생성 주체 (3가지 방식):
 *
 * 1. **클라이언트가 생성** (본 프로젝트 우선 지원):
 *    ```typescript
 *    // 프론트엔드
 *    const requestId = uuidv4();
 *    fetch('/api/users', {
 *      headers: { 'X-Request-ID': requestId }
 *    });
 *    ```
 *    장점: 클라이언트 로그와 서버 로그 연결, 재시도 시 동일 ID 사용
 *    단점: 모든 클라이언트가 구현해야 함
 *
 * 2. **서버(Middleware)가 생성** (본 프로젝트 Fallback):
 *    ```typescript
 *    const requestId = randomUUID();  // 서버가 생성
 *    ```
 *    장점: 클라이언트 구현 불필요, 모든 요청에 ID 보장
 *    단점: 클라이언트에서 요청 전 로깅 불가
 *
 * 3. **API Gateway / Load Balancer가 생성**:
 *    ```
 *    Nginx: proxy_set_header X-Request-ID $request_id;
 *    AWS ALB: X-Amzn-Trace-Id
 *    ```
 *    장점: 여러 백엔드 서버에 동일한 ID 전달 (분산 추적)
 *    단점: Gateway 설정 필요
 *
 * @current-implementation
 * 본 프로젝트의 구현 전략:
 * - **하이브리드 방식**: 클라이언트 ID 우선, 없으면 서버가 생성
 * - **이유**: 유연성 (클라이언트가 구현하면 더 좋고, 안 해도 동작)
 *
 * @usage
 * ```typescript
 * // app.module.ts - 전역 적용
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer): void {
 *     consumer.apply(RequestIdMiddleware).forRoutes('*');
 *   }
 * }
 *
 * // Controller에서 사용
 * @Get()
 * async findAll(@Req() req: Request) {
 *   const requestId = req.id;  // ← Middleware에서 주입한 ID
 *   this.logger.log('조회 요청', { requestId });
 * }
 *
 * // Service에서 사용 (Request 주입)
 * async create(data: any, requestId: string) {
 *   this.logger.log('생성 시작', { requestId });
 *   // ...
 * }
 * ```
 *
 * @scalability
 * Work/ERP 확장 시 고려사항:
 *
 * 1. **마이크로서비스 간 전파**:
 *    ```typescript
 *    // Service A → Service B 호출 시
 *    const response = await this.httpService.get('http://service-b/api/data', {
 *      headers: {
 *        'X-Request-ID': req.id,  // ← Request ID 전달
 *      },
 *    }).toPromise();
 *    ```
 *
 * 2. **DB 쿼리 로깅**:
 *    ```typescript
 *    await this.prisma.$executeRaw`
 *      INSERT INTO audit_logs (request_id, action, user_id)
 *      VALUES (${req.id}, 'CREATE_USER', ${userId})
 *    `;
 *    ```
 *
 * 3. **외부 API 호출 추적**:
 *    ```typescript
 *    // 외부 API 호출 시에도 Request ID 전달
 *    await axios.post('https://payment-gateway.com/charge', data, {
 *      headers: { 'X-Request-ID': req.id },
 *    });
 *    ```
 *
 * 4. **중복 요청 방지 (Idempotency)**:
 *    ```typescript
 *    // Redis에 Request ID 저장
 *    const processed = await this.redis.get(`request:${req.id}`);
 *    if (processed) {
 *      return { message: '이미 처리된 요청입니다', data: processed };
 *    }
 *    ```
 *
 * @performance
 * - UUID 생성: <0.1ms (randomUUID는 매우 빠름)
 * - 헤더 설정: <0.01ms
 * - 총 오버헤드: <0.2ms (무시할 수 있는 수준)
 *
 * @security
 * - Request ID는 민감한 정보 아님 (UUID만 노출)
 * - 사용자 정보, 세션 정보 포함 안 함
 * - 로그에 안전하게 기록 가능
 *
 * @testing
 * ```typescript
 * describe('RequestIdMiddleware', () => {
 *   it('클라이언트가 보낸 Request ID 사용', () => {
 *     const req = { headers: { 'x-request-id': 'client-id-123' } };
 *     middleware.use(req, res, next);
 *     expect(req.id).toBe('client-id-123');
 *     expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'client-id-123');
 *   });
 *
 *   it('Request ID 없으면 서버가 생성', () => {
 *     const req = { headers: {} };
 *     middleware.use(req, res, next);
 *     expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 *   });
 * });
 * ```
 *
 * @alternatives
 * 다른 Request ID 생성 방법:
 *
 * 1. ❌ **Sequential ID (1, 2, 3, ...)**:
 *    - 단점: 보안 취약 (다음 요청 ID 예측 가능)
 *    - 단점: 분산 시스템에서 충돌 (여러 서버가 동시에 1, 2, 3 생성)
 *
 * 2. ❌ **Timestamp (1733400000000)**:
 *    - 단점: 동시 요청 시 충돌 가능
 *    - 단점: ID만으로 요청 시간 노출 (보안 이슈)
 *
 * 3. ✅ **UUID v4 (현재 방식)**:
 *    - 장점: 충돌 가능성 거의 없음 (2^122 = 5.3 × 10^36)
 *    - 장점: 분산 시스템에 최적 (서버마다 독립적으로 생성 가능)
 *    - 장점: 랜덤이라 보안 안전
 *
 * 4. ✅ **ULID (Universally Unique Lexicographically Sortable Identifier)**:
 *    - 장점: 시간 순 정렬 가능 (UUID v4보다 유리)
 *    - 장점: Base32 인코딩으로 짧음 (26자)
 *    - 단점: 추가 라이브러리 필요 (`ulid` 패키지)
 *    - 고려: 향후 DB 인덱싱 최적화 시 ULID 고려
 *
 * @related
 * - `LoggingInterceptor`: Request ID를 로그에 포함
 * - `HttpExceptionFilter`: 에러 로그에 Request ID 포함
 * - `StructuredLoggerService`: 모든 로그에 Request ID 자동 포함
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request 타입 확장
 *
 * @why-global-declaration
 * Express.Request 타입을 확장하는 이유:
 * - TypeScript 컴파일러가 req.id를 인식
 * - 타입 안전성: req.id 접근 시 자동 완성
 * - 런타임 에러 방지: req.id 오타 시 컴파일 에러
 */
declare global {
  namespace Express {
    interface Request {
      id: string;  // ← 모든 Request 객체에 id 필드 추가
    }
  }
}

/**
 * Request ID 미들웨어
 *
 * @implementation
 * 구현 전략:
 * 1. 클라이언트가 X-Request-ID 헤더를 보냈는지 확인
 * 2. 있으면 사용, 없으면 UUID v4 생성
 * 3. req.id에 저장 (Controller, Service에서 접근 가능)
 * 4. 응답 헤더에 X-Request-ID 추가 (클라이언트가 확인 가능)
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    /**
     * Request ID 생성 로직
     *
     * @strategy Hybrid (하이브리드)
     * - 클라이언트가 보낸 X-Request-ID 우선 사용 (있으면)
     * - 없으면 서버에서 UUID v4 생성 (randomUUID)
     *
     * @why-client-first
     * 클라이언트 ID를 우선 사용하는 이유:
     * 1. **재시도 지원**: 네트워크 오류 시 클라이언트가 동일한 ID로 재시도
     *    - 예: 결제 API 호출 실패 → 동일한 Request ID로 재시도
     *    - 효과: 서버에서 "이미 처리됨" 감지 → 중복 결제 방지
     *
     * 2. **클라이언트 로그 연결**: 프론트엔드 로그와 백엔드 로그 연결
     *    - 예: 프론트 "버튼 클릭 (ID: 550e8400)" → 백엔드 "요청 수신 (ID: 550e8400)"
     *    - 효과: 전체 플로우 추적 가능 (클릭 → API 호출 → 응답)
     *
     * 3. **A/B 테스트, 피처 플래그**: 클라이언트가 실험 ID 전달
     *    - 예: X-Request-ID: experiment-123-550e8400
     *    - 효과: 어떤 실험군에서 에러 발생했는지 추적
     *
     * @why-server-fallback
     * 서버에서 생성하는 이유 (Fallback):
     * 1. **모든 요청에 ID 보장**: 클라이언트가 구현 안 해도 동작
     * 2. **하위 호환성**: 기존 클라이언트도 그대로 동작
     * 3. **유연성**: 단계적 롤아웃 가능 (먼저 서버, 나중에 클라이언트)
     *
     * @security
     * 클라이언트가 보낸 ID를 신뢰해도 되는가?
     * - ✅ 안전: Request ID는 인증/권한과 무관 (단순 추적용)
     * - ✅ 검증 불필요: 악의적 ID를 보내도 시스템에 영향 없음
     * - ⚠️ 주의: Request ID로 중복 방지 구현 시 검증 필요 (UUID 형식, 길이 제한)
     *
     * @examples
     * 예시 1: 클라이언트가 ID 전송
     * ```
     * Request:  X-Request-ID: client-uuid-123
     * req.id:   'client-uuid-123'
     * Response: X-Request-ID: client-uuid-123
     * ```
     *
     * 예시 2: 클라이언트가 ID 미전송
     * ```
     * Request:  (X-Request-ID 헤더 없음)
     * req.id:   '550e8400-e29b-41d4-a716-446655440000' (서버 생성)
     * Response: X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
     * ```
     */
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    //                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //                클라이언트 ID 우선, 없으면 서버 생성

    /**
     * Request 객체에 ID 저장
     *
     * @why-attach-to-request
     * req.id에 저장하는 이유:
     * - Controller, Service, Repository 어디서든 접근 가능
     * - 함수 파라미터로 전달 불필요 (req만 있으면 됨)
     * - NestJS 생태계 표준 (Passport, Guards도 req에 user 저장)
     */
    req.id = requestId;

    /**
     * 응답 헤더에 Request ID 추가
     *
     * @why-response-header
     * 응답 헤더에 포함하는 이유:
     *
     * 1. **클라이언트 확인**: 프론트엔드가 응답 헤더에서 Request ID 확인 가능
     *    ```typescript
     *    const response = await fetch('/api/users');
     *    const requestId = response.headers.get('X-Request-ID');
     *    console.log('Request ID:', requestId);
     *    ```
     *
     * 2. **에러 리포팅**: 사용자가 에러 발생 시 Request ID 복사해서 전달
     *    ```
     *    "500 에러가 났어요. Request ID: 550e8400-..."
     *    → 개발자가 로그에서 즉시 검색
     *    ```
     *
     * 3. **디버깅**: 브라우저 개발자 도구에서 Request ID 확인
     *    - Network 탭 → Response Headers → X-Request-ID
     *
     * 4. **OpenTelemetry, Jaeger 연동**: 분산 추적 시스템에서 사용
     *    - 응답 헤더의 Request ID를 다음 요청에 전달
     *    - 전체 요청 체인 추적 (A → B → C → D)
     */
    res.setHeader('X-Request-ID', requestId);

    /**
     * 다음 미들웨어/핸들러로 전달
     *
     * @why-call-next
     * next()를 호출하는 이유:
     * - Express 미들웨어 체인 계속 진행
     * - next()를 호출하지 않으면 요청이 멈춤 (응답 안 됨)
     * - 다음 단계: Guards → Interceptors → Controller
     */
    next();
  }

  /**
   * @future 향후 확장 기능
   *
   * Work/ERP 확장 시 고려할 기능들:
   *
   * 1. **Request ID 검증** (중복 방지 구현 시):
   *    ```typescript
   *    private validateRequestId(id: string): boolean {
   *      // UUID v4 형식 검증
   *      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
   *      return uuidRegex.test(id);
   *    }
   *
   *    const clientId = req.headers['x-request-id'] as string;
   *    const requestId = (clientId && this.validateRequestId(clientId))
   *      ? clientId
   *      : randomUUID();
   *    ```
   *
   * 2. **ULID 사용** (시간 순 정렬 필요 시):
   *    ```typescript
   *    import { ulid } from 'ulid';
   *    const requestId = req.headers['x-request-id'] || ulid();
   *    // 예: 01ARZ3NDEKTSV4RRFFQ69G5FAV (26자, 시간 순 정렬 가능)
   *    ```
   *
   * 3. **Custom Prefix** (환경별 구분):
   *    ```typescript
   *    const env = process.env.NODE_ENV;
   *    const requestId = req.headers['x-request-id'] || `${env}-${randomUUID()}`;
   *    // 예: production-550e8400-..., development-660f9500-...
   *    ```
   *
   * 4. **중복 요청 감지** (Redis 연동):
   *    ```typescript
   *    const existingRequest = await this.redis.get(`request:${requestId}`);
   *    if (existingRequest && req.method === 'POST') {
   *      // 이미 처리된 요청
   *      return res.status(200).json({
   *        message: '이미 처리된 요청입니다',
   *        data: JSON.parse(existingRequest),
   *      });
   *    }
   *    ```
   */
}
