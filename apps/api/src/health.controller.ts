/**
 * 헬스 체크 컨트롤러
 *
 * @description
 * 애플리케이션 및 의존성 서비스 헬스 체크
 *
 * @endpoints
 * - GET /api/v1/health - 기본 헬스 체크
 *
 * @monitoring
 * - Kubernetes Liveness Probe
 * - Kubernetes Readiness Probe
 * - Load Balancer Health Check
 *
 * @security
 * - @Public() 데코레이터로 인증 우회 (공개 엔드포인트)
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

/**
 * 헬스 체크 응답 DTO
 */
interface HealthCheckResponse {
  /** 서비스 상태 */
  status: 'ok' | 'error';

  /** 타임스탬프 */
  timestamp: string;

  /** 서비스 정보 */
  service: {
    /** 서비스 이름 */
    name: string;

    /** 버전 */
    version: string;

    /** 환경 */
    environment: string;
  };
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * 기본 헬스 체크
   *
   * @returns 헬스 체크 결과
   *
   * @performance
   * - 응답 시간: <10ms
   * - 메모리 사용: <1KB
   *
   * @security
   * - 인증 불필요 (@Public)
   */
  @Public()
  @Get()
  @ApiOperation({ summary: '헬스 체크 (인증 불필요)' })
  @ApiResponse({
    status: 200,
    description: '서비스 정상',
  })
  check(): HealthCheckResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: {
        name: 'collaboration-platform-api',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
    };
  }
}
