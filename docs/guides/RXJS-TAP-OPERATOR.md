# RxJS와 tap 연산자 가이드

## 개요

본 문서는 **NestJS Interceptor에서 사용되는 RxJS와 tap 연산자**에 대한 상세 설명을 제공합니다.

**학습 목표:**
- RxJS가 무엇이고 왜 사용하는지 이해
- Observable의 개념과 동작 원리 파악
- tap 연산자의 역할과 사용 사례 숙지
- 프로젝트에서 RxJS를 효과적으로 활용

---

## 1. RxJS란?

### 정의

**RxJS (Reactive Extensions for JavaScript)**는 **비동기 이벤트 기반 프로그램을 작성하기 위한 라이브러리**입니다.

```typescript
import { Observable } from 'rxjs';
import { map, filter, tap } from 'rxjs/operators';
```

**핵심 개념:**
- **Observable**: 시간에 걸쳐 여러 값을 방출하는 데이터 스트림
- **Operator**: Observable을 변환/조작하는 함수 (map, filter, tap 등)
- **Subscription**: Observable을 구독하여 값을 받음
- **Pipeline**: 여러 Operator를 체이닝하여 데이터 변환

---

## 2. 왜 RxJS를 사용하는가?

### 문제 상황: 복잡한 비동기 처리

```typescript
// ❌ RxJS 없이 (콜백 지옥, Callback Hell)

function processRequest(req, callback) {
  validateUser(req, (err, user) => {
    if (err) return callback(err);

    fetchData(user.id, (err, data) => {
      if (err) return callback(err);

      transformData(data, (err, transformed) => {
        if (err) return callback(err);

        saveToDatabase(transformed, (err, result) => {
          if (err) return callback(err);

          callback(null, result);
        });
      });
    });
  });
}

// 😰 문제점:
// 1. 가독성 최악 (중첩 5단계)
// 2. 에러 처리 중복 (if (err) 반복)
// 3. 유지보수 어려움
// 4. 테스트 어려움
```

### 해결책: RxJS로 선언적 파이프라인

```typescript
// ✅ RxJS 사용 (선언적, Declarative)

import { of, throwError } from 'rxjs';
import { switchMap, map, tap, catchError } from 'rxjs/operators';

const processRequest$ = (req) =>
  of(req).pipe(
    // 1. 사용자 검증
    switchMap((req) => validateUser(req)),

    // 2. 데이터 조회
    switchMap((user) => fetchData(user.id)),

    // 3. 데이터 변환
    map((data) => transformData(data)),

    // 4. 데이터베이스 저장
    switchMap((transformed) => saveToDatabase(transformed)),

    // 5. 에러 처리 (한 곳에서 통합)
    catchError((error) => {
      console.error('에러 발생:', error);
      return throwError(() => new Error('처리 실패'));
    }),
  );

// ✅ 장점:
// 1. 가독성 좋음 (단계별 명확)
// 2. 에러 처리 중앙화 (catchError 한 번)
// 3. 유지보수 쉬움 (파이프 추가/제거 용이)
// 4. 테스트 쉬움 (각 단계 독립적 테스트 가능)
```

---

## 3. NestJS에서 RxJS를 사용하는 이유

### NestJS Interceptor의 반환 타입

```typescript
import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  /**
   * @why-observable-return
   * Interceptor가 Observable을 반환하는 이유:
   *
   * 1. **비동기 파이프라인**: 요청 → Controller → 응답 전체 플로우 제어
   * 2. **시간 측정**: 요청 시작 ~ 응답 완료까지 정확한 시간 측정
   * 3. **에러 처리**: try-catch 없이도 에러 스트림 처리 가능
   * 4. **Non-Blocking**: 응답을 변경하거나 지연시키지 않음
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    //                                                      ^^^^^^^^^^^^^^^^
    //                                                      Observable 반환 필수

    return next.handle();  // Controller 실행 결과가 Observable
  }
}
```

### NestJS의 Observable 흐름

```
클라이언트 요청
  ↓
Middleware
  ↓
Guard
  ↓
Interceptor.intercept() ──────┐
  ↓                            │
next.handle() ─────────────────┤ Observable 시작
  ↓                            │
Controller 실행 ───────────────┤ 비동기 작업
  ↓                            │
Service 호출                   │
  ↓                            │
Database 쿼리                  │
  ↓                            │
Service 응답 ──────────────────┤
  ↓                            │
Controller 반환 ───────────────┤
  ↓                            │
Interceptor (tap, map) ────────┘ Observable 연산자
  ↓
응답 변환 (TransformInterceptor)
  ↓
클라이언트 응답
```

---

## 4. Observable이란?

### 정의

**Observable**은 **시간에 걸쳐 여러 값을 방출하는 데이터 스트림**입니다.

```typescript
import { Observable } from 'rxjs';

// Observable 생성 예시
const myObservable$ = new Observable((subscriber) => {
  subscriber.next(1);      // 첫 번째 값 방출
  subscriber.next(2);      // 두 번째 값 방출
  subscriber.next(3);      // 세 번째 값 방출
  subscriber.complete();   // 완료
});

// 구독 (Subscribe)
myObservable$.subscribe({
  next: (value) => console.log('받은 값:', value),
  error: (err) => console.error('에러:', err),
  complete: () => console.log('완료'),
});

// 출력:
// 받은 값: 1
// 받은 값: 2
// 받은 값: 3
// 완료
```

### Observable vs Promise

| 비교 | Promise | Observable |
|-----|---------|------------|
| **값 개수** | 1개 (단일 값) | 0개 이상 (스트림) |
| **즉시 실행** | ✅ 생성 즉시 실행 | ❌ 구독 시 실행 |
| **취소 가능** | ❌ 취소 불가 | ✅ unsubscribe() 가능 |
| **재사용** | ❌ 한 번만 사용 | ✅ 여러 번 구독 가능 |
| **연산자** | then, catch | map, filter, tap, 100+ |
| **에러 처리** | catch | catchError |

**예시 비교:**

```typescript
// ❌ Promise (단일 값, 즉시 실행)
const promise = fetch('https://api.example.com/users')
  .then((res) => res.json())
  .then((users) => console.log(users))
  .catch((err) => console.error(err));

// Promise는 생성 즉시 HTTP 요청 시작 (취소 불가)

// ✅ Observable (다중 값, 지연 실행)
import { ajax } from 'rxjs/ajax';
import { map, catchError } from 'rxjs/operators';

const users$ = ajax.getJSON('https://api.example.com/users').pipe(
  map((users) => users.filter((u) => u.isActive)),
  catchError((err) => {
    console.error(err);
    return of([]);
  }),
);

// Observable은 subscribe()를 호출하기 전까지 실행되지 않음
users$.subscribe((users) => console.log(users));
```

---

## 5. tap 연산자란?

### 정의

**`tap` 연산자**는 **데이터 스트림을 변경하지 않고 부수 효과(Side Effect)를 수행**하는 연산자입니다.

```typescript
import { tap } from 'rxjs/operators';

// 예시 1: 로깅
of(1, 2, 3).pipe(
  tap((value) => console.log('값:', value)),  // 부수 효과: 로깅
  map((value) => value * 2),                   // 데이터 변환
).subscribe();

// 출력:
// 값: 1
// 값: 2
// 값: 3
// (최종 값: 2, 4, 6)
```

### tap의 역할

```typescript
/**
 * tap 연산자의 특징
 *
 * @features
 * 1. **데이터 불변성**: 스트림을 변경하지 않음
 * 2. **사이드 이펙트**: 로깅, 디버깅, 통계 수집 등
 * 3. **Non-Blocking**: 다음 연산자에 영향 없음
 * 4. **에러 처리**: next, error, complete 콜백 제공
 */

import { of, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';

of(10).pipe(
  tap((value) => console.log('1. tap: 원본 값:', value)),  // 10
  map((value) => value * 2),
  tap((value) => console.log('2. tap: 변환 후:', value)),  // 20
  map((value) => value + 5),
  tap((value) => console.log('3. tap: 최종 값:', value)),  // 25
).subscribe((result) => console.log('결과:', result));     // 25

// 출력:
// 1. tap: 원본 값: 10
// 2. tap: 변환 후: 20
// 3. tap: 최종 값: 25
// 결과: 25
```

### tap vs map 비교

```typescript
import { of } from 'rxjs';
import { tap, map } from 'rxjs/operators';

// ❌ tap은 데이터를 변경하지 않음
of(10).pipe(
  tap((value) => value * 2),  // ❌ 무시됨! (반환값 사용 안 함)
  tap((value) => console.log('tap:', value)),  // 출력: tap: 10 (원본 그대로)
).subscribe();

// ✅ map은 데이터를 변환함
of(10).pipe(
  map((value) => value * 2),  // ✅ 데이터 변환 (10 → 20)
  tap((value) => console.log('map 후:', value)),  // 출력: map 후: 20
).subscribe();

// 요약:
// - tap: 로깅, 디버깅, 통계 수집 (데이터 변경 ❌)
// - map: 데이터 변환 (데이터 변경 ✅)
```

---

## 6. tap의 next, error, complete 콜백

### tap 시그니처

```typescript
import { tap } from 'rxjs/operators';

observable$.pipe(
  tap({
    /**
     * next: 값이 방출될 때마다 호출
     */
    next: (value) => console.log('✅ 성공:', value),

    /**
     * error: 에러가 발생했을 때 호출
     */
    error: (err) => console.error('❌ 에러:', err),

    /**
     * complete: 스트림이 완료되었을 때 호출
     */
    complete: () => console.log('🎉 완료'),
  }),
);
```

### 실제 예시: HTTP 요청 로깅

```typescript
import { of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

// ✅ 성공 시나리오
of({ userId: 123, name: '홍길동' }).pipe(
  tap({
    next: (user) => console.log('✅ 사용자 조회 성공:', user.name),
    error: (err) => console.error('❌ 에러:', err.message),
    complete: () => console.log('🎉 완료'),
  }),
).subscribe();

// 출력:
// ✅ 사용자 조회 성공: 홍길동
// 🎉 완료

// ❌ 에러 시나리오
throwError(() => new Error('DB 연결 실패')).pipe(
  tap({
    next: (value) => console.log('✅ 성공:', value),  // 호출 안 됨
    error: (err) => console.error('❌ 에러:', err.message),  // 호출됨
    complete: () => console.log('🎉 완료'),  // 호출 안 됨
  }),
  catchError((err) => of(null)),  // 에러 처리
).subscribe();

// 출력:
// ❌ 에러: DB 연결 실패
```

---

## 7. 프로젝트 실제 예시: LoggingInterceptor

### 코드 분석

```typescript
// apps/api/src/common/interceptors/logging.interceptor.ts

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();  // ⏰ 요청 시작 시간 기록

    // 요청 로그 출력
    this.logger.logRequest(requestLogData);

    /**
     * @why-return-observable
     * next.handle()이 Observable을 반환하는 이유:
     * - Controller 실행이 비동기적으로 완료됨
     * - pipe()로 응답 완료 시점을 추적 가능
     * - tap으로 응답 시간을 정확히 측정
     */
    return next.handle().pipe(
      //   ^^^^^^^^^^^
      //   Controller 실행 (Observable)

      tap({
        /**
         * next: Controller가 성공적으로 응답을 반환했을 때
         */
        next: () => {
          const duration = Date.now() - startTime;  // ⏱️ 응답 시간 계산

          // ✅ 응답 로그 출력
          this.logger.logResponse({
            requestId: requestLogData.requestId,
            method: requestLogData.method,
            url: requestLogData.url,
            statusCode: response.statusCode,  // 200, 201, 204 등
            duration,  // 45ms, 1234ms 등
          });
        },

        /**
         * error: Controller 실행 중 에러가 발생했을 때
         */
        error: (error) => {
          const duration = Date.now() - startTime;

          // ❌ 에러 로그 출력
          this.logger.logWarning(`✖ ${method} ${url} ${duration}ms`, {
            requestId: requestLogData.requestId,
            error: error.message,
          });
        },
      }),
    );
  }
}
```

### tap이 없다면?

```typescript
// ❌ tap 없이 시도 (불가능!)

intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const startTime = Date.now();
  this.logger.logRequest(requestLogData);

  const result = next.handle();  // Observable
  //    ^^^^^^
  //    아직 실행되지 않음! (subscribe 전까지 지연 실행)

  const duration = Date.now() - startTime;
  //    ^^^^^^^^
  //    ❌ 문제: duration이 항상 0~1ms (Controller 실행 전)

  this.logger.logResponse({ duration });  // ❌ 잘못된 시간

  return result;
}

// 😰 문제:
// - Observable은 구독(subscribe) 전까지 실행되지 않음
// - Controller 완료 시점을 알 수 없음
// - 응답 시간을 정확히 측정할 수 없음
```

### tap을 사용한 해결

```typescript
// ✅ tap으로 해결 (정확한 시간 측정)

intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const startTime = Date.now();
  this.logger.logRequest(requestLogData);

  return next.handle().pipe(
    /**
     * @why-tap
     * tap을 사용하는 이유:
     *
     * 1. **정확한 시간 측정**:
     *    - tap의 next 콜백은 Controller 완료 후 호출됨
     *    - duration = Date.now() - startTime이 정확함
     *
     * 2. **에러 처리**:
     *    - tap의 error 콜백으로 에러 시점 측정
     *    - HttpExceptionFilter와 별도로 로깅 가능
     *
     * 3. **Non-Blocking**:
     *    - 로깅이 응답을 지연시키지 않음
     *    - 응답 데이터를 변경하지 않음 (tap은 데이터 불변)
     */
    tap({
      next: () => {
        const duration = Date.now() - startTime;  // ✅ 정확한 시간
        this.logger.logResponse({ duration });
      },
      error: (err) => {
        const duration = Date.now() - startTime;  // ✅ 에러 시점도 측정
        this.logger.logWarning(`에러: ${err.message}`, { duration });
      },
    }),
  );
}
```

---

## 8. 다른 RxJS 연산자들

### 8.1. map (데이터 변환)

```typescript
import { map } from 'rxjs/operators';

// 예시: 응답 데이터 변환
return next.handle().pipe(
  map((data) => ({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  })),
);

// Before: { id: 1, name: '홍길동' }
// After:  { success: true, data: { id: 1, name: '홍길동' }, timestamp: '2025-12-05T...' }
```

**프로젝트 예시: TransformInterceptor**

```typescript
// apps/api/src/common/interceptors/transform.interceptor.ts

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      /**
       * @why-map
       * map을 사용하는 이유:
       * - 모든 API 응답을 일관된 형식으로 변환
       * - ApiSuccessResponse 타입으로 래핑
       * - 클라이언트가 항상 동일한 구조 기대 가능
       */
      map((data) => new ApiSuccessResponse(data)),
    );
  }
}

// Before: { id: 1, email: 'user@example.com' }
// After:  { success: true, data: { id: 1, email: 'user@example.com' }, ... }
```

### 8.2. catchError (에러 처리)

```typescript
import { catchError } from 'rxjs/operators';
import { throwError, of } from 'rxjs';

return next.handle().pipe(
  /**
   * @why-catchError
   * catchError를 사용하는 이유:
   * - Observable 스트림에서 발생한 에러를 처리
   * - 에러를 다른 값으로 대체하거나 재발생
   * - Filter에서 처리하기 전에 Interceptor에서 먼저 처리
   */
  catchError((error) => {
    // 에러 로깅
    this.logger.error('Interceptor에서 에러 감지:', error);

    // 에러를 다시 발생시켜 Filter로 전달
    return throwError(() => error);

    // 또는 기본값으로 대체
    // return of({ success: false, error: error.message });
  }),
);
```

### 8.3. timeout (타임아웃 설정)

```typescript
import { timeout, catchError } from 'rxjs/operators';
import { TimeoutError, throwError } from 'rxjs';

// 프로젝트 예시: TimeoutInterceptor
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeoutValue: number = 30000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      /**
       * @why-timeout
       * timeout 연산자를 사용하는 이유:
       * - 무한 대기 방지 (DB 연결 끊김, 외부 API 응답 없음)
       * - 30초 이내 응답 없으면 TimeoutError 발생
       * - 클라이언트가 무한 대기하지 않음
       */
      timeout(this.timeoutValue),

      catchError((error) => {
        if (error instanceof TimeoutError) {
          this.logger.error(`⏰ 타임아웃: ${this.timeoutValue}ms 초과`);
          return throwError(() => new RequestTimeoutException('요청 시간 초과'));
        }
        return throwError(() => error);
      }),
    );
  }
}
```

### 8.4. switchMap (Observable 전환)

```typescript
import { switchMap } from 'rxjs/operators';

// 예시: 사용자 인증 후 데이터 조회
of({ userId: 123 }).pipe(
  switchMap((user) => this.userService.findById(user.userId)),  // Observable 반환
  tap((userData) => console.log('사용자 데이터:', userData)),
).subscribe();

/**
 * @why-switchMap
 * switchMap을 사용하는 이유:
 * - 내부 Observable을 평탄화 (flatten)
 * - Observable<Observable<T>> → Observable<T>
 * - 이전 요청 취소 (새 요청 시작 시)
 */
```

### 8.5. filter (조건부 필터링)

```typescript
import { filter } from 'rxjs/operators';

of(1, 2, 3, 4, 5).pipe(
  filter((value) => value % 2 === 0),  // 짝수만
  tap((value) => console.log('짝수:', value)),
).subscribe();

// 출력:
// 짝수: 2
// 짝수: 4
```

---

## 9. RxJS 파이프라인 실전 예시

### 예시 1: HTTP 요청 처리

```typescript
import { ajax } from 'rxjs/ajax';
import { map, tap, catchError, retry, timeout } from 'rxjs/operators';
import { of } from 'rxjs';

const fetchUsers$ = ajax.getJSON<User[]>('https://api.example.com/users').pipe(
  // 1. 타임아웃 설정 (5초)
  timeout(5000),

  // 2. 에러 시 재시도 (3회)
  retry(3),

  // 3. 요청 로깅
  tap(() => console.log('📡 사용자 목록 요청 중...')),

  // 4. 활성 사용자만 필터링
  map((users) => users.filter((u) => u.isActive)),

  // 5. 응답 로깅
  tap((users) => console.log(`✅ ${users.length}명의 사용자 조회 완료`)),

  // 6. 에러 처리
  catchError((error) => {
    console.error('❌ 사용자 조회 실패:', error.message);
    return of([]);  // 빈 배열 반환
  }),
);

// 구독 (실행)
fetchUsers$.subscribe((users) => {
  console.log('최종 데이터:', users);
});
```

### 예시 2: 검색어 자동완성 (Debounce)

```typescript
import { fromEvent } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';

const searchInput = document.getElementById('search');

fromEvent(searchInput, 'input').pipe(
  // 1. 입력값 추출
  map((event: any) => event.target.value),

  // 2. 300ms 대기 (사용자가 타이핑 멈출 때까지)
  debounceTime(300),

  // 3. 이전 검색어와 동일하면 무시
  distinctUntilChanged(),

  // 4. 검색 로깅
  tap((query) => console.log('🔍 검색어:', query)),

  // 5. API 호출 (이전 요청 취소)
  switchMap((query) =>
    ajax.getJSON(`https://api.example.com/search?q=${query}`).pipe(
      catchError(() => of([])),
    ),
  ),

  // 6. 결과 로깅
  tap((results) => console.log(`✅ ${results.length}개 결과`)),
).subscribe((results) => {
  // 검색 결과 표시
  renderSearchResults(results);
});
```

---

## 10. tap 사용 모범 사례

### ✅ 좋은 사용 사례

```typescript
// 1. 로깅
.pipe(
  tap((value) => console.log('처리 중:', value)),
)

// 2. 디버깅
.pipe(
  tap((value) => console.log('[DEBUG] 현재 값:', value)),
)

// 3. 통계 수집
.pipe(
  tap((value) => this.metrics.increment('api.calls')),
)

// 4. 캐시 업데이트
.pipe(
  tap((user) => this.cacheService.set(`user:${user.id}`, user)),
)

// 5. 사이드 이펙트 (알림 발송)
.pipe(
  tap((order) => this.emailService.sendOrderConfirmation(order)),
)
```

### ❌ 잘못된 사용 사례

```typescript
// ❌ 데이터 변환 시도 (map 사용해야 함)
.pipe(
  tap((value) => value * 2),  // ❌ 무시됨! (반환값 사용 안 함)
)

// ✅ 올바른 방법
.pipe(
  map((value) => value * 2),  // ✅ 데이터 변환
)

// ❌ 비동기 작업 (switchMap 사용해야 함)
.pipe(
  tap((userId) => this.userService.findById(userId)),  // ❌ Promise 무시됨
)

// ✅ 올바른 방법
.pipe(
  switchMap((userId) => this.userService.findById(userId)),  // ✅ Observable 평탄화
)

// ❌ 에러 처리 시도 (catchError 사용해야 함)
.pipe(
  tap((value) => {
    if (!value) throw new Error('값 없음');  // ❌ 에러 발생 시 스트림 중단
  }),
)

// ✅ 올바른 방법
.pipe(
  map((value) => {
    if (!value) throw new Error('값 없음');
    return value;
  }),
  catchError((error) => {
    console.error(error);
    return of(null);
  }),
)
```

---

## 11. NestJS Interceptor에서 RxJS 연산자 조합

### 실전 예시: 로깅 + 변환 + 타임아웃

```typescript
@Injectable()
export class CombinedInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    this.logger.logRequest(request);

    return next.handle().pipe(
      /**
       * @why-operator-order
       * 연산자 순서가 중요한 이유:
       * 1. timeout → 먼저 타임아웃 체크
       * 2. tap → 응답 시간 로깅
       * 3. map → 응답 데이터 변환
       * 4. catchError → 최종 에러 처리
       */

      // 1. 타임아웃 (30초)
      timeout(30000),

      // 2. 응답 시간 로깅
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.logResponse({ duration });
      }),

      // 3. 응답 데이터 변환
      map((data) => new ApiSuccessResponse(data)),

      // 4. 에러 처리
      catchError((error) => {
        const duration = Date.now() - startTime;

        if (error instanceof TimeoutError) {
          this.logger.logError({ message: '타임아웃', duration });
          throw new RequestTimeoutException();
        }

        this.logger.logError({ message: error.message, duration });
        throw error;
      }),
    );
  }
}
```

---

## 12. RxJS 학습 로드맵

### 초급 (본 프로젝트 수준)

1. **Observable 생성**: `of`, `from`, `fromEvent`
2. **기본 연산자**: `map`, `filter`, `tap`
3. **에러 처리**: `catchError`, `throwError`
4. **시간 관련**: `timeout`, `delay`

### 중급 (Work/ERP 확장 시)

1. **고급 변환**: `switchMap`, `mergeMap`, `concatMap`
2. **조합**: `combineLatest`, `forkJoin`, `zip`
3. **필터링**: `debounceTime`, `distinctUntilChanged`, `take`
4. **재시도**: `retry`, `retryWhen`

### 고급 (대규모 시스템)

1. **Subject**: `BehaviorSubject`, `ReplaySubject`
2. **Multicasting**: `share`, `shareReplay`
3. **Scheduler**: 비동기 실행 제어
4. **Custom Operator**: 재사용 가능한 연산자 생성

---

## 13. 디버깅 팁

### tap으로 디버깅

```typescript
import { tap } from 'rxjs/operators';

return next.handle().pipe(
  // 1. 값 확인
  tap((value) => console.log('1️⃣ Controller 응답:', value)),

  // 2. 타입 확인
  tap((value) => console.log('2️⃣ 타입:', typeof value, value instanceof Array)),

  // 3. 조건부 로깅
  tap((value) => {
    if (value === null) {
      console.warn('⚠️ null 값 감지!');
    }
  }),

  map((value) => transform(value)),

  // 4. 변환 후 확인
  tap((value) => console.log('3️⃣ 변환 후:', value)),

  // 5. 에러 추적
  tap({
    next: (value) => console.log('✅ 성공:', value),
    error: (err) => console.error('❌ 에러:', err),
    complete: () => console.log('🎉 완료'),
  }),
);
```

---

## 14. 요약

| 항목 | 설명 | 예시 |
|------|------|------|
| **RxJS** | 비동기 이벤트 기반 프로그래밍 라이브러리 | `import { Observable } from 'rxjs'` |
| **Observable** | 시간에 걸쳐 여러 값을 방출하는 스트림 | `of(1, 2, 3)` |
| **tap** | 데이터를 변경하지 않고 부수 효과 수행 | 로깅, 디버깅, 통계 |
| **map** | 데이터를 변환 | `map(x => x * 2)` |
| **catchError** | 에러 처리 | `catchError(err => of(null))` |
| **timeout** | 타임아웃 설정 | `timeout(30000)` |
| **switchMap** | Observable 전환 | `switchMap(id => findById(id))` |

---

## 15. 체크리스트

### Interceptor 작성 시

- [ ] `Observable<any>` 반환 타입 명시
- [ ] `next.handle().pipe()` 사용
- [ ] `tap`으로 로깅 (데이터 불변)
- [ ] `map`으로 데이터 변환 (필요 시)
- [ ] `catchError`로 에러 처리 (필요 시)
- [ ] `timeout`으로 타임아웃 설정 (필요 시)

### 디버깅 시

- [ ] `tap`으로 중간 값 확인
- [ ] `tap({ next, error, complete })` 사용
- [ ] `console.log`로 스트림 흐름 추적
- [ ] Marble Diagram 그려보기 (복잡한 경우)

### 성능 최적화 시

- [ ] 불필요한 `tap` 제거 (프로덕션)
- [ ] `shareReplay`로 중복 요청 방지
- [ ] `debounceTime`로 과도한 요청 방지
- [ ] `take(1)`로 즉시 완료 (단일 값)

---

## 16. 참고 자료

- [RxJS 공식 문서](https://rxjs.dev/)
- [RxJS Operators 목록](https://rxjs.dev/api/operators)
- [Learn RxJS (예시)](https://www.learnrxjs.io/)
- [NestJS Interceptors](https://docs.nestjs.com/interceptors)
- [Marble Diagrams](https://rxmarbles.com/) (시각화)

---

## 17. 프로젝트에서 RxJS가 사용되는 곳

| 파일 | 연산자 | 용도 |
|------|--------|------|
| `logging.interceptor.ts` | `tap` | HTTP 요청/응답 로깅 |
| `transform.interceptor.ts` | `map` | 응답 데이터 변환 (ApiSuccessResponse) |
| `timeout.interceptor.ts` | `timeout`, `catchError` | 30초 타임아웃 설정 |
| `http-exception.filter.ts` | - | (Observable 아님, 직접 처리) |

---

**마지막 업데이트**: 2025-12-05
**작성자**: Backend Team
**관련 파일**:
- `apps/api/src/common/interceptors/logging.interceptor.ts`
- `apps/api/src/common/interceptors/transform.interceptor.ts`
- `apps/api/src/common/interceptors/timeout.interceptor.ts`
