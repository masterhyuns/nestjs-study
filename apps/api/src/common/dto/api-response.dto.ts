/**
 * 공통 API 응답 DTO
 *
 * @description
 * 모든 API 엔드포인트의 일관된 응답 형식
 *
 * @pattern Response Wrapper
 * - 성공/실패 여부 명확
 * - 에러 정보 구조화
 * - 메타 정보 포함
 *
 * @example
 * ```json
 * {
 *   "success": true,
 *   "data": { "id": "123", "name": "홍길동" },
 *   "meta": {
 *     "timestamp": "2025-12-05T00:00:00.000Z",
 *     "requestId": "abc-123"
 *   }
 * }
 * ```
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * 성공 응답
 */
export class ApiSuccessResponse<T = any> {
  @ApiProperty({ example: true, description: '성공 여부' })
  success: boolean;

  @ApiProperty({ description: '응답 데이터' })
  data: T;

  @ApiProperty({
    description: '메타 정보',
    required: false,
    example: {
      timestamp: '2025-12-05T00:00:00.000Z',
      requestId: 'abc-123',
    },
  })
  meta?: {
    timestamp: string;
    requestId?: string;
    [key: string]: any;
  };

  constructor(data: T, meta?: any) {
    this.success = true;
    this.data = data;
    this.meta = {
      timestamp: new Date().toISOString(),
      ...meta,
    };
  }
}

/**
 * 에러 응답
 */
export class ApiErrorResponse {
  @ApiProperty({ example: false, description: '성공 여부' })
  success: boolean;

  @ApiProperty({
    description: '에러 정보',
    example: {
      code: 'USER_NOT_FOUND',
      message: '사용자를 찾을 수 없습니다',
      details: null,
    },
  })
  error: {
    /** 에러 코드 (상수) */
    code: string;

    /** 사용자 친화적 메시지 */
    message: string;

    /** 상세 에러 정보 (개발 환경만) */
    details?: any;
  };

  @ApiProperty({
    description: '메타 정보',
    example: {
      timestamp: '2025-12-05T00:00:00.000Z',
      requestId: 'abc-123',
      path: '/api/v1/users/123',
    },
  })
  meta: {
    timestamp: string;
    requestId?: string;
    path?: string;
    [key: string]: any;
  };

  constructor(code: string, message: string, details?: any, meta?: any) {
    this.success = false;
    this.error = {
      code,
      message,
      details,
    };
    this.meta = {
      timestamp: new Date().toISOString(),
      ...meta,
    };
  }
}

/**
 * 페이지네이션 응답
 */
export class ApiPaginatedResponse<T = any> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ description: '데이터 배열', isArray: true })
  data: T[];

  @ApiProperty({
    description: '페이지네이션 메타',
    example: {
      page: 1,
      limit: 20,
      total: 100,
      totalPages: 5,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  @ApiProperty({
    description: '메타 정보',
    required: false,
  })
  meta?: {
    timestamp: string;
    requestId?: string;
    [key: string]: any;
  };

  constructor(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    meta?: any,
  ) {
    this.success = true;
    this.data = data;
    this.pagination = pagination;
    this.meta = {
      timestamp: new Date().toISOString(),
      ...meta,
    };
  }
}
