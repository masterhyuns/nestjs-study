/**
 * Public Decorator
 *
 * @description
 * 인증 없이 접근 가능한 엔드포인트 표시
 *
 * @usage
 * ```typescript
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 인증 우회 데코레이터
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
