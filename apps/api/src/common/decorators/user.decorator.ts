/**
 * CurrentUser Decorator
 *
 * @description
 * 현재 로그인한 사용자 정보 추출
 *
 * @usage
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: JwtPayload) {
 *   return user;
 * }
 * ```
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 현재 사용자 정보 추출 데코레이터
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // 특정 필드만 반환
    return data ? user?.[data] : user;
  },
);
