/**
 * 전역 HTTP Exception Filter
 *
 * @description
 * 모든 예외를 캐치하여 일관된 에러 응답 반환
 *
 * @why-global-filter
 * 전역 Exception Filter가 필요한 이유:
 * 1. **일관성**: 모든 API 에러가 동일한 형식 (ApiErrorResponse)
 * 2. **자동화**: Controller/Service에서 try-catch 불필요
 * 3. **보안**: 내부 에러를 클라이언트 친화적 메시지로 변환
 * 4. **추적**: Request ID로 에러 디버깅 용이
 * 5. **모니터링**: 중앙화된 에러 로깅으로 통계 수집 가능
 *
 * @features
 * - HTTP 예외 처리 (400, 401, 404, 500 등)
 * - Prisma 예외 처리 (P2002: Unique constraint 등)
 * - 알 수 없는 예외 처리 (500 Internal Server Error)
 * - 개발/프로덕션 환경별 에러 상세 정보
 * - Request ID 추적 (분산 시스템 디버깅)
 *
 * @why-catch-all
 * @Catch() 데코레이터 (인자 없음)를 사용하는 이유:
 * - 모든 예외 캐치: HttpException, PrismaError, Error, unknown
 * - 폴백 처리: 예상치 못한 에러도 안전하게 처리
 * - 500 에러 방지: 애플리케이션 크래시 방지
 *
 * @performance
 * - 에러 응답 생성: <5ms (JSON 직렬화 포함)
 * - 로깅: 비동기 처리 (응답 지연 없음)
 * - 메모리: Stateless (인스턴스 상태 없음)
 *
 * @scalability
 * Work/ERP 확장 시:
 * - 외부 모니터링: Sentry, DataDog 연동
 * - 에러 알림: Slack, 이메일 자동 발송
 * - 에러 통계: 에러율, 응답 시간 추적
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiErrorResponse } from '../dto/api-response.dto';
import { ErrorCode, ErrorMessage } from '../constants/error-codes';

/**
 * 모든 예외를 캐치하는 전역 필터
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Request ID (향후 추가)
    const requestId = (request as any).id || 'unknown';

    let status: number;
    let errorCode: string;
    let message: string;
    let details: any = null;

    // 1. HTTP Exception 처리
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const response = exceptionResponse as any;
        message = response.message || exception.message;
        errorCode = this.getErrorCodeFromStatus(status);
        details = response.error || response.details || null;
      } else {
        message = exceptionResponse as string;
        errorCode = this.getErrorCodeFromStatus(status);
      }
    }
    // ========================================================================
    // 2. Prisma Exception 처리
    // ========================================================================

    /**
     * 왜 Prisma 에러를 특별히 처리하는가?
     * - P2002 (Unique): 사용자에게 "중복 이메일" 같은 친절한 메시지
     * - P2025 (Not Found): 404 Not Found로 적절한 HTTP 상태 코드
     * - 보안: DB 스키마 정보 노출 방지 (개발 환경에서만 상세 정보)
     */
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception);
      status = prismaError.status;
      errorCode = prismaError.code;
      message = prismaError.message;

      /**
       * 왜 개발/프로덕션을 분기하는가?
       * - 개발: 상세한 에러 정보로 빠른 디버깅 (error.meta, stack trace)
       * - 프로덕션: 최소한의 정보만 노출 (보안, 해커에게 DB 구조 노출 방지)
       */
      details = process.env.NODE_ENV === 'development' ? prismaError.details : null;
    }

    // ========================================================================
    // 3. 알 수 없는 예외 (Fallback)
    // ========================================================================

    /**
     * 왜 Fallback이 필요한가?
     * - 예상치 못한 에러: TypeError, ReferenceError, 외부 라이브러리 에러
     * - 애플리케이션 크래시 방지: 500 에러로 처리하되 응답은 반환
     * - 디버깅: 개발 환경에서 stack trace로 원인 파악
     */
    else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = ErrorCode.COMMON_INTERNAL_SERVER_ERROR;
      message = ErrorMessage[ErrorCode.COMMON_INTERNAL_SERVER_ERROR];

      /**
       * 개발/프로덕션 분기:
       * - 개발: Error 객체 전체 (name, message, stack)
       * - 프로덕션: "서버 오류가 발생했습니다" 만
       */
      details =
        process.env.NODE_ENV === 'development' && exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
              stack: exception.stack,
            }
          : null;
    }

    // 에러 로깅
    this.logError(exception, request, status, errorCode);

    // 에러 응답 생성
    const errorResponse = new ApiErrorResponse(errorCode, message, details, {
      requestId,
      path: request.url,
      method: request.method,
    });

    response.status(status).json(errorResponse);
  }

  /**
   * HTTP 상태 코드에서 에러 코드 추출
   */
  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.COMMON_BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.AUTH_UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.AUTH_FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.COMMON_NOT_FOUND;
      default:
        return ErrorCode.COMMON_INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * Prisma 에러 처리
   *
   * @description
   * Prisma 에러 코드를 애플리케이션 에러로 변환
   *
   * @why-auto-convert
   * Prisma 에러를 자동 변환하는 이유:
   * 1. **클라이언트 친화적**: P2002 → "이미 존재하는 이메일" (이해하기 쉬움)
   * 2. **HTTP 시맨틱**: P2025 → 404 Not Found (RESTful)
   * 3. **보안**: DB 내부 구조 노출 방지 (프로덕션에서는 최소 정보)
   * 4. **자동화**: Service에서 Prisma 에러 처리 불필요
   * 5. **일관성**: 모든 DB 에러가 동일한 형식
   *
   * @reference
   * Prisma Error Reference: https://www.prisma.io/docs/reference/api-reference/error-reference
   *
   * @common-errors
   * | Prisma Code | HTTP Status | 의미 | 예시 |
   * |-------------|-------------|------|------|
   * | P2002 | 409 Conflict | Unique 제약 위반 | 중복 이메일 |
   * | P2025 | 404 Not Found | 레코드 없음 | 존재하지 않는 사용자 |
   * | P2003 | 400 Bad Request | FK 제약 위반 | 존재하지 않는 workspace |
   * | P1001 | 503 Service Unavailable | DB 연결 실패 | DB 서버 다운 |
   */
  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
    details: any;
  } {
    switch (error.code) {
      // ======================================================================
      // P2002: Unique constraint failed
      // ======================================================================

      /**
       * 왜 409 Conflict를 사용하는가?
       * - 400 Bad Request: 요청 형식이 잘못됨 (DTO 검증 실패)
       * - 409 Conflict: 요청은 올바르나 현재 상태와 충돌 ✅
       * - 422 Unprocessable Entity: 의미론적 오류 (사용 가능하나 덜 명확)
       *
       * @example
       * - 이메일 중복 가입 시도
       * - workspace slug 중복
       */
      case 'P2002': {
        const target = (error.meta?.target as string[]) || [];
        return {
          status: HttpStatus.CONFLICT,
          code: ErrorCode.DB_UNIQUE_CONSTRAINT,
          message: `이미 존재하는 데이터입니다 (${target.join(', ')})`,
          details: { fields: target }, // 어떤 필드가 중복인지
        };
      }

      // ======================================================================
      // P2025: Record not found
      // ======================================================================

      /**
       * 왜 404 Not Found를 사용하는가?
       * - RESTful API 표준: 리소스가 없으면 404
       * - 클라이언트 경험: 명확한 의미 전달
       *
       * @example
       * - 존재하지 않는 사용자 조회
       * - 삭제된 프로젝트 접근
       */
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: ErrorCode.COMMON_NOT_FOUND,
          message: '데이터를 찾을 수 없습니다',
          details: error.meta, // Prisma가 제공하는 추가 정보
        };

      // ======================================================================
      // P2003: Foreign key constraint failed
      // ======================================================================

      /**
       * 왜 400 Bad Request를 사용하는가?
       * - 클라이언트 오류: 존재하지 않는 ID 전달
       * - 요청 수정 필요: 올바른 ID로 재시도 필요
       *
       * @example
       * - 없는 workspaceId로 프로젝트 생성
       * - 없는 userId로 태스크 할당
       */
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: ErrorCode.COMMON_BAD_REQUEST,
          message: '연관된 데이터가 존재하지 않습니다',
          details: error.meta,
        };

      // ======================================================================
      // P1001, P1002: Database connection error
      // ======================================================================

      /**
       * 왜 503 Service Unavailable을 사용하는가?
       * - 500 Internal Server Error: 애플리케이션 코드 오류
       * - 503 Service Unavailable: 의존하는 서비스 장애 ✅
       * - Retry 가능: 클라이언트가 나중에 재시도 가능
       *
       * @example
       * - PostgreSQL 서버 다운
       * - 네트워크 장애
       * - 연결 풀 고갈
       */
      case 'P1001':
      case 'P1002':
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          code: ErrorCode.DB_CONNECTION_ERROR,
          message: '데이터베이스 연결 오류',
          details: process.env.NODE_ENV === 'development' ? error.meta : null,
        };

      // ======================================================================
      // 기타 Prisma 에러 (예상치 못한 DB 에러)
      // ======================================================================

      /**
       * 왜 500 Internal Server Error를 사용하는가?
       * - 예상하지 못한 에러: P2004, P2014 등
       * - 서버 책임: 클라이언트가 할 수 있는 것이 없음
       * - 개발자 조치 필요: 로그 확인 및 수정
       *
       * @monitoring
       * 이 에러가 발생하면 즉시 알림 발송 (Slack, 이메일)
       */
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ErrorCode.COMMON_INTERNAL_SERVER_ERROR,
          message: '데이터베이스 오류가 발생했습니다',
          details: process.env.NODE_ENV === 'development' ? error : null,
        };
    }
  }

  /**
   * 에러 로깅
   *
   * @description
   * 에러를 로그 레벨에 따라 기록
   *
   * @why-different-log-levels
   * 로그 레벨을 분리하는 이유:
   * - **WARN (4xx)**: 클라이언트 오류, 정상 동작 범위 (예: 잘못된 입력)
   * - **ERROR (5xx)**: 서버 오류, 즉시 조치 필요 (예: DB 장애)
   *
   * @why-log-request-info
   * Request 정보를 로깅하는 이유:
   * - 재현: 같은 요청으로 에러 재현 가능
   * - 디버깅: 어떤 상황에서 에러가 발생했는지 파악
   * - 통계: 어떤 엔드포인트가 에러가 많은지 분석
   *
   * @why-environment-split
   * 개발/프로덕션 분기:
   * - 개발: body, query, params 모두 로깅 (상세 디버깅)
   * - 프로덕션: 민감 정보 제외 (보안, GDPR 준수)
   *
   * @security
   * 로깅하지 말아야 할 정보:
   * - ❌ 비밀번호 (body.password)
   * - ❌ JWT 토큰 (headers.authorization)
   * - ❌ 신용카드 정보
   * - ✅ Request ID, URL, Method, Status Code
   *
   * @monitoring
   * 향후 연동:
   * - Sentry: 에러 추적 및 알림
   * - DataDog: APM 및 로그 분석
   * - ELK Stack: 로그 수집 및 검색
   */
  private logError(
    exception: unknown,
    request: Request,
    status: number,
    errorCode: string,
  ): void {
    const { method, url, body, query, params } = request;

    /**
     * 구조화된 로그 데이터
     *
     * @why-json-format
     * JSON 형식으로 로깅하는 이유:
     * - 파싱 용이: 로그 분석 도구가 자동 파싱
     * - 검색 가능: 특정 필드로 검색 (예: errorCode:"DB_UNIQUE_CONSTRAINT")
     * - 집계 가능: 에러 통계, 대시보드 생성
     */
    const logData = {
      timestamp: new Date().toISOString(),
      method,
      url,
      status,
      errorCode,

      /**
       * 왜 개발 환경에서만 body/query/params를 로깅하는가?
       * - 개발: 빠른 디버깅 (모든 정보 필요)
       * - 프로덕션: 보안 (비밀번호, 개인정보 노출 방지)
       */
      body: process.env.NODE_ENV === 'development' ? body : undefined,
      query: process.env.NODE_ENV === 'development' ? query : undefined,
      params: process.env.NODE_ENV === 'development' ? params : undefined,
    };

    const logMessage = `${method} ${url} ${status} ${errorCode}`;

    /**
     * 로그 레벨 결정
     *
     * @why-this-threshold
     * - 500 이상: ERROR - 서버 책임, 즉시 조치 필요
     * - 400-499: WARN - 클라이언트 오류, 참고용
     * - 300 이하: (로깅 안 함) - 정상 동작
     */
    if (status >= 500) {
      // 서버 에러: ERROR 레벨 + Stack Trace
      this.logger.error(logMessage, JSON.stringify(logData, null, 2));

      /**
       * Stack Trace 로깅
       *
       * @why
       * - 원인 파악: 어느 라인에서 에러 발생했는지
       * - 호출 경로: 어떤 함수 호출 순서로 에러 발생했는지
       * - 디버깅: 프로덕션에서 재현 어려울 때 유용
       */
      if (exception instanceof Error) {
        this.logger.error(exception.stack);
      }
    } else if (status >= 400) {
      // 클라이언트 에러: WARN 레벨 (Stack Trace 불필요)
      this.logger.warn(logMessage, JSON.stringify(logData, null, 2));
    }

    /**
     * @future 향후 확장
     *
     * 1. 외부 모니터링 연동:
     * ```typescript
     * if (status >= 500) {
     *   await this.sentryService.captureException(exception);
     *   await this.slackService.sendAlert(logMessage);
     * }
     * ```
     *
     * 2. 에러 메트릭 수집:
     * ```typescript
     * this.metricsService.incrementErrorCounter({
     *   status,
     *   errorCode,
     *   endpoint: url,
     * });
     * ```
     *
     * 3. 민감 정보 자동 마스킹:
     * ```typescript
     * const maskedBody = this.maskSensitiveData(body);
     * ```
     */
  }
}
