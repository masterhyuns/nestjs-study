/**
 * 공통 타입 정의
 *
 * @description
 * 애플리케이션 전반에서 사용하는 공통 타입
 */

/**
 * API 응답 래퍼
 */
export interface ApiResponse<T> {
  /** 성공 여부 */
  success: boolean;

  /** 응답 데이터 */
  data?: T;

  /** 에러 메시지 */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };

  /** 메타 정보 */
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * 페이지네이션 요청
 */
export interface PaginationRequest {
  /** 페이지 번호 (1부터 시작) */
  page: number;

  /** 페이지당 항목 수 */
  limit: number;

  /** 정렬 필드 */
  sortBy?: string;

  /** 정렬 방향 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 페이지네이션 응답
 */
export interface PaginationResponse<T> {
  /** 데이터 배열 */
  data: T[];

  /** 메타 정보 */
  meta: {
    /** 현재 페이지 */
    page: number;

    /** 페이지당 항목 수 */
    limit: number;

    /** 전체 항목 수 */
    total: number;

    /** 전체 페이지 수 */
    totalPages: number;
  };
}

/**
 * 정렬 옵션
 */
export type SortOrder = 'asc' | 'desc';

/**
 * 날짜 범위
 */
export interface DateRange {
  /** 시작일 */
  from: Date;

  /** 종료일 */
  to: Date;
}
