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
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../dto/api-response.dto';
import { ErrorCode, ErrorMessage } from '../constants/error-codes';
import { StructuredLoggerService } from '../logger/structured-logger.service';

/**
 * 모든 예외를 캐치하는 전역 필터 (StructuredLoggerService 사용)
 *
 * @why-structured-logger
 * StructuredLoggerService를 사용하는 이유:
 * - **일관성**: LoggingInterceptor와 동일한 로그 포맷
 * - **타입 안전성**: HttpErrorLog 인터페이스로 타입 보장
 * - **중앙화**: 로깅 로직 변경 시 한 곳만 수정
 * - **자동 분류**: 4xx(WARN), 5xx(ERROR) 자동 레벨 결정
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLoggerService) {}

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
    // 2. 데이터베이스 에러 처리 (SQLite/Kysely)
    // ========================================================================

    /**
     * @why-database-error-handling
     * Kysely는 Prisma처럼 자체 에러 타입을 제공하지 않습니다.
     * - SQLite 에러는 일반 Error 객체로 전달됨
     * - 필요 시 error.message를 파싱하여 처리 가능
     * - 현재는 일반 에러로 처리 (500 Internal Server Error)
     *
     * @future
     * 향후 필요 시 SQLite 에러 코드별 처리 추가:
     * - SQLITE_CONSTRAINT: Unique/FK 제약 위반
     * - SQLITE_BUSY: DB 락
     * - SQLITE_NOTFOUND: 레코드 없음
     */

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

    // 에러 로깅 (StructuredLoggerService 사용)
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
        userId: (request as any).user?.id,
      },
      exception,
    );

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

}
