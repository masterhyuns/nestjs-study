/**
 * Rate Limiting (Throttler) 설정
 *
 * @description
 * API 요청 속도 제한 (DDoS 방지, 남용 차단)
 *
 * @features
 * - IP 기반 제한
 * - 엔드포인트별 제한 가능
 * - Redis 저장소 (분산 환경 대응)
 *
 * @usage
 * ```typescript
 * // 전역 설정: 60초에 100번
 *
 * // 커스텀 제한
 * @Throttle({ default: { limit: 10, ttl: 60000 } })
 * @Post('login')
 * login() {}
 *
 * // 제한 우회
 * @SkipThrottle()
 * @Get('health')
 * health() {}
 * ```
 */

import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      // 기본 설정: 60초에 100번 요청 허용
      ttl: 60000, // 60초 (ms)
      limit: 100, // 100번
    },
  ],
  // 향후 Redis 저장소 추가
  // storage: new ThrottlerStorageRedisService(redisClient),
};

/**
 * 엔드포인트별 커스텀 제한 예시
 *
 * @example
 * ```typescript
 * // 로그인: 5분에 5번만 허용
 * @Throttle({ default: { limit: 5, ttl: 300000 } })
 * @Post('login')
 * async login() {}
 *
 * // 회원가입: 1시간에 3번만 허용
 * @Throttle({ default: { limit: 3, ttl: 3600000 } })
 * @Post('register')
 * async register() {}
 *
 * // 파일 업로드: 1분에 10번
 * @Throttle({ default: { limit: 10, ttl: 60000 } })
 * @Post('upload')
 * async upload() {}
 * ```
 */
