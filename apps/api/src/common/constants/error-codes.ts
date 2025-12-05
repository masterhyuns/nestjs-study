/**
 * 에러 코드 상수
 *
 * @description
 * 애플리케이션 전역 에러 코드 정의
 * - 일관된 에러 처리
 * - 다국어 대응 가능
 * - 프론트엔드와 에러 코드 공유
 *
 * @pattern
 * - 도메인_에러종류 형식
 * - 예: USER_NOT_FOUND, AUTH_INVALID_TOKEN
 */

export const ErrorCode = {
  // 공통 에러 (COMMON_*)
  COMMON_INTERNAL_SERVER_ERROR: 'COMMON_INTERNAL_SERVER_ERROR',
  COMMON_BAD_REQUEST: 'COMMON_BAD_REQUEST',
  COMMON_VALIDATION_ERROR: 'COMMON_VALIDATION_ERROR',
  COMMON_NOT_FOUND: 'COMMON_NOT_FOUND',

  // 인증 에러 (AUTH_*)
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',

  // 사용자 에러 (USER_*)
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_EMAIL_ALREADY_EXISTS: 'USER_EMAIL_ALREADY_EXISTS',
  USER_INACTIVE: 'USER_INACTIVE',
  USER_SUSPENDED: 'USER_SUSPENDED',

  // 워크스페이스 에러 (WORKSPACE_*)
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  WORKSPACE_ALREADY_EXISTS: 'WORKSPACE_ALREADY_EXISTS',
  WORKSPACE_ACCESS_DENIED: 'WORKSPACE_ACCESS_DENIED',
  WORKSPACE_MEMBER_NOT_FOUND: 'WORKSPACE_MEMBER_NOT_FOUND',

  // 프로젝트 에러 (PROJECT_*)
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_ACCESS_DENIED: 'PROJECT_ACCESS_DENIED',

  // 태스크 에러 (TASK_*)
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_ACCESS_DENIED: 'TASK_ACCESS_DENIED',

  // 데이터베이스 에러 (DB_*)
  DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
  DB_TRANSACTION_ERROR: 'DB_TRANSACTION_ERROR',
  DB_UNIQUE_CONSTRAINT: 'DB_UNIQUE_CONSTRAINT',

  // 외부 서비스 에러 (EXTERNAL_*)
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  EXTERNAL_S3_ERROR: 'EXTERNAL_S3_ERROR',
  EXTERNAL_EMAIL_ERROR: 'EXTERNAL_EMAIL_ERROR',
} as const;

/**
 * 에러 메시지 맵
 *
 * @description
 * 에러 코드별 기본 메시지
 * 향후 다국어 지원 대비
 */
export const ErrorMessage: Record<string, string> = {
  // 공통
  [ErrorCode.COMMON_INTERNAL_SERVER_ERROR]: '서버 오류가 발생했습니다',
  [ErrorCode.COMMON_BAD_REQUEST]: '잘못된 요청입니다',
  [ErrorCode.COMMON_VALIDATION_ERROR]: '입력 값이 유효하지 않습니다',
  [ErrorCode.COMMON_NOT_FOUND]: '리소스를 찾을 수 없습니다',

  // 인증
  [ErrorCode.AUTH_UNAUTHORIZED]: '인증이 필요합니다',
  [ErrorCode.AUTH_INVALID_TOKEN]: '유효하지 않은 토큰입니다',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: '토큰이 만료되었습니다',
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: '이메일 또는 비밀번호가 올바르지 않습니다',
  [ErrorCode.AUTH_FORBIDDEN]: '접근 권한이 없습니다',

  // 사용자
  [ErrorCode.USER_NOT_FOUND]: '사용자를 찾을 수 없습니다',
  [ErrorCode.USER_ALREADY_EXISTS]: '이미 존재하는 사용자입니다',
  [ErrorCode.USER_EMAIL_ALREADY_EXISTS]: '이미 사용 중인 이메일입니다',
  [ErrorCode.USER_INACTIVE]: '비활성화된 사용자입니다',
  [ErrorCode.USER_SUSPENDED]: '정지된 사용자입니다',

  // 워크스페이스
  [ErrorCode.WORKSPACE_NOT_FOUND]: '워크스페이스를 찾을 수 없습니다',
  [ErrorCode.WORKSPACE_ALREADY_EXISTS]: '이미 존재하는 워크스페이스입니다',
  [ErrorCode.WORKSPACE_ACCESS_DENIED]: '워크스페이스 접근 권한이 없습니다',
  [ErrorCode.WORKSPACE_MEMBER_NOT_FOUND]: '워크스페이스 멤버를 찾을 수 없습니다',

  // 프로젝트
  [ErrorCode.PROJECT_NOT_FOUND]: '프로젝트를 찾을 수 없습니다',
  [ErrorCode.PROJECT_ACCESS_DENIED]: '프로젝트 접근 권한이 없습니다',

  // 태스크
  [ErrorCode.TASK_NOT_FOUND]: '태스크를 찾을 수 없습니다',
  [ErrorCode.TASK_ACCESS_DENIED]: '태스크 접근 권한이 없습니다',

  // 데이터베이스
  [ErrorCode.DB_CONNECTION_ERROR]: '데이터베이스 연결 오류',
  [ErrorCode.DB_TRANSACTION_ERROR]: '트랜잭션 오류',
  [ErrorCode.DB_UNIQUE_CONSTRAINT]: '중복된 데이터입니다',

  // 외부 서비스
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: '외부 서비스 오류',
  [ErrorCode.EXTERNAL_S3_ERROR]: '파일 스토리지 오류',
  [ErrorCode.EXTERNAL_EMAIL_ERROR]: '이메일 전송 오류',
};
