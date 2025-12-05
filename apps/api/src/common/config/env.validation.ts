/**
 * Environment Variables 검증
 *
 * @description
 * 환경 변수 타입 체크 및 기본값 설정
 * 애플리케이션 시작 시 검증 실패 시 종료
 *
 * @usage
 * ConfigModule.forRoot({ validate })
 *
 * @benefits
 * - 타입 안전성
 * - 필수 변수 누락 방지
 * - 기본값 설정
 */

import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  Min,
  Max,
  validateSync,
  IsOptional,
} from 'class-validator';

/**
 * 환경 변수 Enum
 */
enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Staging = 'staging',
}

/**
 * 환경 변수 스키마
 */
class EnvironmentVariables {
  // ==========================================================================
  // 애플리케이션
  // ==========================================================================
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  API_PREFIX: string = 'api';

  // ==========================================================================
  // 데이터베이스
  // ==========================================================================
  @IsString()
  DATABASE_URL: string;

  // ==========================================================================
  // Redis
  // ==========================================================================
  @IsString()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @Min(0)
  @Max(15)
  REDIS_DB: number = 0;

  // ==========================================================================
  // JWT
  // ==========================================================================
  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_TOKEN_EXPIRATION?: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_TOKEN_EXPIRATION?: string = '7d';

  // ==========================================================================
  // 파일 스토리지
  // ==========================================================================
  @IsString()
  STORAGE_ENDPOINT: string;

  @IsString()
  STORAGE_ACCESS_KEY: string;

  @IsString()
  STORAGE_SECRET_KEY: string;

  @IsString()
  STORAGE_BUCKET: string;

  @IsString()
  STORAGE_REGION: string = 'us-east-1';

  // ==========================================================================
  // CORS
  // ==========================================================================
  @IsString()
  CORS_ORIGIN: string = 'http://localhost:3001';

  // ==========================================================================
  // Rate Limiting
  // ==========================================================================
  @IsNumber()
  @IsOptional()
  RATE_LIMIT_TTL?: number = 60;

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_MAX?: number = 100;

  // ==========================================================================
  // 로깅
  // ==========================================================================
  @IsString()
  @IsOptional()
  LOG_LEVEL?: string = 'debug';
}

/**
 * 환경 변수 검증 함수
 *
 * @param config - process.env 객체
 * @returns 검증된 환경 변수
 * @throws 검증 실패 시 에러
 */
export const validate = (config: Record<string, unknown>) => {
  // 타입 변환
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  // 검증 실행
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `❌ 환경 변수 검증 실패:\n${errors.map((error) => Object.values(error.constraints || {}).join(', ')).join('\n')}`,
    );
  }

  return validatedConfig;
};
