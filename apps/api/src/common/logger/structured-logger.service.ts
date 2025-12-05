/**
 * Structured Logger Service
 *
 * @description
 * 구조화된 로깅을 제공하는 공통 서비스
 *
 * @why-common-logger-service
 * 공통 Logger Service가 필요한 이유:
 *
 * 1. **일관성 (Consistency)**
 *    - 문제: LoggingInterceptor, HttpExceptionFilter 등에서 각자 다른 로깅 방식 사용
 *    - 해결: 모든 곳에서 동일한 로그 포맷 사용
 *    - 효과: 로그 파싱, 검색, 분석이 쉬워짐
 *
 * 2. **중앙화 (Centralization)**
 *    - 문제: 로깅 방식 변경 시 여러 파일 수정 필요
 *    - 해결: 한 곳에서 로깅 로직 관리
 *    - 효과: 유지보수성 향상
 *
 * 3. **확장성 (Extensibility)**
 *    - 문제: Sentry, DataDog 연동 시 모든 파일 수정
 *    - 해결: LoggerService만 수정하면 전체 적용
 *    - 효과: 외부 서비스 연동 용이
 *
 * 4. **타입 안전성 (Type Safety)**
 *    - 문제: JSON.stringify에 any 타입 전달
 *    - 해결: 타입 정의로 로그 구조 명확화
 *    - 효과: 컴파일 타임에 오류 발견
 *
 * @architecture
 * 로깅 플로우:
 * ```
 * LoggingInterceptor → StructuredLogger.logRequest()
 *                    → StructuredLogger.logResponse()
 *
 * HttpExceptionFilter → StructuredLogger.logError()
 *
 * UserService → StructuredLogger.logInfo()
 * ```
 *
 * @features
 * - ✅ 구조화된 JSON 로그
 * - ✅ 타임스탬프 자동 추가
 * - ✅ 환경별 민감정보 제거
 * - ✅ 로그 레벨 자동 결정
 * - ✅ Stack Trace 처리
 * - ✅ Request ID 추적
 *
 * @usage
 * ```typescript
 * // Interceptor, Filter, Service 모두에서 사용
 * constructor(private readonly logger: StructuredLoggerService) {}
 *
 * this.logger.logRequest({ method: 'GET', url: '/api/users' });
 * this.logger.logResponse({ method: 'GET', url: '/api/users', statusCode: 200, duration: 45 });
 * this.logger.logError({ method: 'POST', url: '/api/users', status: 400, errorCode: 'BAD_REQUEST' });
 * ```
 */

import { Injectable, Logger, LogLevel } from '@nestjs/common';
import { Request } from 'express';

/**
 * 로그 레벨 타입
 */
export type StructuredLogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

/**
 * HTTP 요청 로그 데이터
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
  userId?: string;
  userEmail?: string;
}

/**
 * HTTP 응답 로그 데이터
 */
export interface HttpResponseLog {
  requestId?: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  userId?: string;
}

/**
 * HTTP 에러 로그 데이터
 */
export interface HttpErrorLog {
  requestId?: string;
  method: string;
  url: string;
  status: number;
  errorCode: string;
  message: string;
  stack?: string;
  body?: any;
  query?: any;
  params?: any;
  userId?: string;
}

/**
 * 구조화된 로그 기본 인터페이스
 */
interface BaseStructuredLog {
  timestamp: string;
  level: StructuredLogLevel;
  context?: string;
  [key: string]: any;
}

/**
 * Structured Logger Service
 *
 * @why-no-constructor-params
 * Constructor에 파라미터가 없는 이유:
 * - NestJS는 constructor의 모든 파라미터를 의존성 주입 대상으로 인식
 * - Primitive type (string, number 등)은 자동 주입 불가
 * - context를 파라미터로 받으면 "UnknownDependenciesException" 발생
 * - 해결: context를 내부에서 기본값으로 설정
 */
@Injectable()
export class StructuredLoggerService {
  private readonly logger: Logger;

  /**
   * @why-hardcoded-context
   * context를 'App'으로 고정하는 이유:
   * - LoggingInterceptor, HttpExceptionFilter 등 여러 곳에서 사용
   * - 로그에 [App] 태그가 붙어서 어떤 서비스의 로그인지 구분 가능
   * - 필요 시 Logger 클래스를 직접 사용하여 다른 context 지정 가능
   *
   * @alternative
   * 만약 context를 동적으로 받고 싶다면:
   * ```typescript
   * import { Inject, Optional } from '@nestjs/common';
   *
   * constructor(@Optional() @Inject('LOGGER_CONTEXT') context?: string) {
   *   this.logger = new Logger(context || 'App');
   * }
   * ```
   */
  constructor() {
    this.logger = new Logger('App');
  }

  /**
   * HTTP 요청 로그
   *
   * @why
   * 모든 HTTP 요청을 일관된 형식으로 로깅
   */
  logRequest(data: HttpRequestLog): void {
    const structuredLog = this.createStructuredLog('log', {
      type: 'http_request',
      ...data,
      // 민감 정보 제거
      body:
        process.env.NODE_ENV === 'development' && data.body
          ? this.sanitizeBody(data.body)
          : undefined,
      query:
        process.env.NODE_ENV === 'development' && data.query && Object.keys(data.query).length > 0
          ? data.query
          : undefined,
      params:
        process.env.NODE_ENV === 'development' && data.params && Object.keys(data.params).length > 0
          ? data.params
          : undefined,
    });

    this.logger.log(
      `→ ${data.method} ${data.url}`,
      JSON.stringify(structuredLog, null, 2),
    );
  }

  /**
   * HTTP 응답 로그
   *
   * @why
   * 모든 HTTP 응답을 일관된 형식으로 로깅
   * 느린 요청(>1초)은 WARN 레벨로 자동 분류
   */
  logResponse(data: HttpResponseLog): void {
    const isSlowRequest = data.duration > 1000;
    const level: StructuredLogLevel = isSlowRequest ? 'warn' : 'log';

    const structuredLog = this.createStructuredLog(level, {
      type: 'http_response',
      ...data,
      duration: `${data.duration}ms`,
    });

    const message = isSlowRequest
      ? `⚠️  느린 요청: ${data.method} ${data.url} ${data.statusCode} ${data.duration}ms`
      : `← ${data.method} ${data.url} ${data.statusCode} ${data.duration}ms`;

    if (isSlowRequest) {
      this.logger.warn(message, JSON.stringify(structuredLog, null, 2));
    } else {
      this.logger.log(message, JSON.stringify(structuredLog, null, 2));
    }
  }

  /**
   * HTTP 에러 로그
   *
   * @why
   * 모든 HTTP 에러를 일관된 형식으로 로깅
   * 4xx: WARN, 5xx: ERROR로 자동 분류
   */
  logError(data: HttpErrorLog, exception?: unknown): void {
    const level: StructuredLogLevel = data.status >= 500 ? 'error' : 'warn';

    const structuredLog = this.createStructuredLog(level, {
      type: 'http_error',
      ...data,
      // 개발 환경에서만 body/query/params 포함
      body: process.env.NODE_ENV === 'development' ? data.body : undefined,
      query: process.env.NODE_ENV === 'development' ? data.query : undefined,
      params: process.env.NODE_ENV === 'development' ? data.params : undefined,
    });

    const message = `${data.method} ${data.url} ${data.status} ${data.errorCode}`;

    if (level === 'error') {
      this.logger.error(message, JSON.stringify(structuredLog, null, 2));

      // Stack Trace 출력 (5xx 에러만)
      if (exception instanceof Error && exception.stack) {
        this.logger.error(exception.stack);
      }
    } else {
      this.logger.warn(message, JSON.stringify(structuredLog, null, 2));
    }
  }

  /**
   * 일반 정보 로그
   *
   * @why
   * 비즈니스 로직에서 사용하는 일반 로그
   */
  logInfo(message: string, context?: Record<string, any>): void {
    const structuredLog = this.createStructuredLog('log', {
      type: 'info',
      message,
      ...context,
    });

    this.logger.log(message, JSON.stringify(structuredLog, null, 2));
  }

  /**
   * 경고 로그
   */
  logWarning(message: string, context?: Record<string, any>): void {
    const structuredLog = this.createStructuredLog('warn', {
      type: 'warning',
      message,
      ...context,
    });

    this.logger.warn(message, JSON.stringify(structuredLog, null, 2));
  }

  /**
   * 디버그 로그
   */
  logDebug(message: string, context?: Record<string, any>): void {
    const structuredLog = this.createStructuredLog('debug', {
      type: 'debug',
      message,
      ...context,
    });

    this.logger.debug(message, JSON.stringify(structuredLog, null, 2));
  }

  /**
   * 구조화된 로그 생성
   *
   * @why
   * 모든 로그에 공통 필드 자동 추가 (timestamp, level)
   */
  private createStructuredLog(
    level: StructuredLogLevel,
    data: Record<string, any>,
  ): BaseStructuredLog {
    return {
      timestamp: new Date().toISOString(),
      level,
      ...data,
    };
  }

  /**
   * 민감한 정보 제거
   *
   * @why
   * password, token 등이 로그에 남지 않도록 제거
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'apiKey',
      'privateKey',
      'creditCard',
      'cardNumber',
      'ssn',
    ];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });

    return sanitized;
  }

  /**
   * Request 객체에서 로그 데이터 추출
   *
   * @why
   * Interceptor, Filter에서 중복 코드 제거
   */
  static extractRequestLogData(request: Request): HttpRequestLog {
    return {
      requestId: (request as any).id || 'unknown',
      method: request.method,
      url: request.url,
      query: request.query,
      params: request.params,
      body: request.body,
      userAgent: request.get('user-agent'),
      ip: request.ip,
      userId: (request as any).user?.id,
      userEmail: (request as any).user?.email,
    };
  }
}
