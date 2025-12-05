/**
 * Pagination 유틸리티
 *
 * @description
 * 페이지네이션 공통 로직
 *
 * @features
 * - Offset 기반 페이징
 * - Cursor 기반 페이징 (향후)
 * - 메타 정보 자동 생성
 *
 * @usage
 * ```typescript
 * const paginated = createPaginatedResponse(users, { page: 1, limit: 20 }, total);
 * ```
 */

import { ApiPaginatedResponse } from '../dto/api-response.dto';

/**
 * 페이지네이션 옵션
 */
export interface PaginationOptions {
  /** 페이지 번호 (1부터 시작) */
  page: number;

  /** 페이지당 항목 수 (기본: 20, 최대: 100) */
  limit: number;

  /** 정렬 필드 */
  sortBy?: string;

  /** 정렬 방향 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 페이지네이션 메타 정보
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * 페이지네이션 응답 생성
 *
 * @param data - 데이터 배열
 * @param options - 페이지네이션 옵션
 * @param total - 전체 항목 수
 * @returns ApiPaginatedResponse
 */
export const createPaginatedResponse = <T>(
  data: T[],
  options: PaginationOptions,
  total: number,
): ApiPaginatedResponse<T> => {
  const { page, limit } = options;
  const totalPages = Math.ceil(total / limit);

  return new ApiPaginatedResponse(
    data,
    {
      page,
      limit,
      total,
      totalPages,
    },
  );
};

/**
 * Offset 계산
 *
 * @param page - 페이지 번호 (1부터 시작)
 * @param limit - 페이지당 항목 수
 * @returns Offset 값 (Prisma skip)
 */
export const calculateOffset = (page: number, limit: number): number => {
  return (page - 1) * limit;
};

/**
 * 페이지네이션 옵션 검증 및 기본값 설정
 *
 * @param options - 원본 옵션
 * @returns 검증된 옵션
 */
export const validatePaginationOptions = (
  options: Partial<PaginationOptions>,
): PaginationOptions => {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));

  return {
    page,
    limit,
    sortBy: options.sortBy || 'createdAt',
    sortOrder: options.sortOrder || 'desc',
  };
};

/**
 * Cursor 기반 페이지네이션 (향후 구현)
 *
 * @description
 * 대용량 데이터에 적합
 * Offset 방식의 성능 문제 해결
 *
 * @example
 * ```typescript
 * const result = await findWithCursor({
 *   cursor: 'last-item-id',
 *   limit: 20,
 * });
 * ```
 */
export interface CursorPaginationOptions {
  /** 마지막 항목 ID */
  cursor?: string;

  /** 가져올 항목 수 */
  limit: number;

  /** 정렬 방향 */
  direction?: 'forward' | 'backward';
}

/**
 * Cursor 페이지네이션 응답
 */
export interface CursorPaginatedResponse<T> {
  data: T[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}
