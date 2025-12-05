/**
 * Custom Business Exceptions
 *
 * @description
 * 비즈니스 로직 에러를 구조화
 *
 * @usage
 * ```typescript
 * throw new UserNotFoundException(userId);
 * throw new DuplicateEmailException(email);
 * ```
 *
 * @benefits
 * - 타입 안전성
 * - 일관된 에러 처리
 * - 에러 코드 자동 매핑
 */

import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorMessage } from '../constants/error-codes';

/**
 * 기본 비즈니스 예외
 */
export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: any,
  ) {
    super(
      {
        code: errorCode,
        message,
        details,
      },
      status,
    );
  }
}

// =============================================================================
// User Exceptions
// =============================================================================

/**
 * 사용자를 찾을 수 없음
 */
export class UserNotFoundException extends BusinessException {
  constructor(userId: string) {
    super(
      ErrorCode.USER_NOT_FOUND,
      ErrorMessage[ErrorCode.USER_NOT_FOUND],
      HttpStatus.NOT_FOUND,
      { userId },
    );
  }
}

/**
 * 이메일 중복
 */
export class DuplicateEmailException extends BusinessException {
  constructor(email: string) {
    super(
      ErrorCode.USER_EMAIL_ALREADY_EXISTS,
      ErrorMessage[ErrorCode.USER_EMAIL_ALREADY_EXISTS],
      HttpStatus.CONFLICT,
      { email },
    );
  }
}

/**
 * 사용자 비활성화
 */
export class UserInactiveException extends BusinessException {
  constructor(userId: string) {
    super(
      ErrorCode.USER_INACTIVE,
      ErrorMessage[ErrorCode.USER_INACTIVE],
      HttpStatus.FORBIDDEN,
      { userId },
    );
  }
}

// =============================================================================
// Auth Exceptions
// =============================================================================

/**
 * 잘못된 인증 정보
 */
export class InvalidCredentialsException extends BusinessException {
  constructor() {
    super(
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      ErrorMessage[ErrorCode.AUTH_INVALID_CREDENTIALS],
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * 토큰 만료
 */
export class TokenExpiredException extends BusinessException {
  constructor() {
    super(
      ErrorCode.AUTH_TOKEN_EXPIRED,
      ErrorMessage[ErrorCode.AUTH_TOKEN_EXPIRED],
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * 권한 없음
 */
export class ForbiddenException extends BusinessException {
  constructor(resource?: string) {
    super(
      ErrorCode.AUTH_FORBIDDEN,
      ErrorMessage[ErrorCode.AUTH_FORBIDDEN],
      HttpStatus.FORBIDDEN,
      { resource },
    );
  }
}

// =============================================================================
// Workspace Exceptions
// =============================================================================

/**
 * 워크스페이스를 찾을 수 없음
 */
export class WorkspaceNotFoundException extends BusinessException {
  constructor(workspaceId: string) {
    super(
      ErrorCode.WORKSPACE_NOT_FOUND,
      ErrorMessage[ErrorCode.WORKSPACE_NOT_FOUND],
      HttpStatus.NOT_FOUND,
      { workspaceId },
    );
  }
}

/**
 * 워크스페이스 접근 거부
 */
export class WorkspaceAccessDeniedException extends BusinessException {
  constructor(workspaceId: string, userId: string) {
    super(
      ErrorCode.WORKSPACE_ACCESS_DENIED,
      ErrorMessage[ErrorCode.WORKSPACE_ACCESS_DENIED],
      HttpStatus.FORBIDDEN,
      { workspaceId, userId },
    );
  }
}

// =============================================================================
// Project Exceptions
// =============================================================================

/**
 * 프로젝트를 찾을 수 없음
 */
export class ProjectNotFoundException extends BusinessException {
  constructor(projectId: string) {
    super(
      ErrorCode.PROJECT_NOT_FOUND,
      ErrorMessage[ErrorCode.PROJECT_NOT_FOUND],
      HttpStatus.NOT_FOUND,
      { projectId },
    );
  }
}

// =============================================================================
// Task Exceptions
// =============================================================================

/**
 * 태스크를 찾을 수 없음
 */
export class TaskNotFoundException extends BusinessException {
  constructor(taskId: string) {
    super(
      ErrorCode.TASK_NOT_FOUND,
      ErrorMessage[ErrorCode.TASK_NOT_FOUND],
      HttpStatus.NOT_FOUND,
      { taskId },
    );
  }
}
