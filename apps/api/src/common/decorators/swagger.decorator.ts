/**
 * Swagger 헬퍼 데코레이터
 *
 * @description
 * Swagger API 문서 자동화를 위한 단축 데코레이터
 *
 * @usage
 * ```typescript
 * @ApiStandardResponse(UserEntity)
 * @Get(':id')
 * async findOne() {}
 *
 * @ApiPaginatedResponse(UserEntity)
 * @Get()
 * async findAll() {}
 * ```
 */

import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { ApiSuccessResponse, ApiPaginatedResponse } from '../dto/api-response.dto';

/**
 * 표준 성공 응답 Swagger 문서
 *
 * @param dataType - 응답 데이터 타입
 * @param description - 응답 설명
 */
export const ApiStandardResponse = <T>(
  dataType: Type<T>,
  description: string = '성공',
) => {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description,
      type: dataType,
    }),
  );
};

/**
 * 페이지네이션 응답 Swagger 문서
 *
 * @param dataType - 배열 아이템 타입
 * @param description - 응답 설명
 */
export const ApiPaginatedResponseDecorator = <T>(
  dataType: Type<T>,
  description: string = '페이지네이션 성공',
) => {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description,
      // type: ApiPaginatedResponse<T>,  // 실제 타입 적용은 복잡함
    }),
  );
};

/**
 * 인증 필요 엔드포인트
 *
 * @param description - 엔드포인트 설명
 */
export const ApiAuth = (description: string) => {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: description }),
    ApiResponse({
      status: 401,
      description: '인증 실패',
    }),
  );
};

/**
 * CRUD 생성 엔드포인트
 *
 * @param entity - 엔티티 이름
 * @param responseType - 응답 타입
 */
export const ApiCreate = <T>(entity: string, responseType: Type<T>) => {
  return applyDecorators(
    ApiOperation({ summary: `${entity} 생성` }),
    ApiResponse({
      status: 201,
      description: '생성 성공',
      type: responseType,
    }),
    ApiResponse({
      status: 400,
      description: '잘못된 요청',
    }),
    ApiResponse({
      status: 409,
      description: '중복된 데이터',
    }),
  );
};

/**
 * CRUD 조회 엔드포인트
 *
 * @param entity - 엔티티 이름
 * @param responseType - 응답 타입
 */
export const ApiFindOne = <T>(entity: string, responseType: Type<T>) => {
  return applyDecorators(
    ApiOperation({ summary: `${entity} 조회` }),
    ApiResponse({
      status: 200,
      description: '조회 성공',
      type: responseType,
    }),
    ApiResponse({
      status: 404,
      description: '찾을 수 없음',
    }),
  );
};

/**
 * CRUD 목록 조회 엔드포인트
 *
 * @param entity - 엔티티 이름
 * @param responseType - 응답 타입
 */
export const ApiFindAll = <T>(entity: string, responseType: Type<T>) => {
  return applyDecorators(
    ApiOperation({ summary: `${entity} 목록 조회` }),
    ApiResponse({
      status: 200,
      description: '조회 성공 (페이지네이션)',
    }),
  );
};

/**
 * CRUD 수정 엔드포인트
 *
 * @param entity - 엔티티 이름
 * @param responseType - 응답 타입
 */
export const ApiUpdate = <T>(entity: string, responseType: Type<T>) => {
  return applyDecorators(
    ApiOperation({ summary: `${entity} 수정` }),
    ApiResponse({
      status: 200,
      description: '수정 성공',
      type: responseType,
    }),
    ApiResponse({
      status: 404,
      description: '찾을 수 없음',
    }),
  );
};

/**
 * CRUD 삭제 엔드포인트
 *
 * @param entity - 엔티티 이름
 */
export const ApiDelete = (entity: string) => {
  return applyDecorators(
    ApiOperation({ summary: `${entity} 삭제` }),
    ApiResponse({
      status: 200,
      description: '삭제 성공',
    }),
    ApiResponse({
      status: 404,
      description: '찾을 수 없음',
    }),
  );
};
