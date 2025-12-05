/**
 * JWT Auth Guard
 *
 * @description
 * JWT 토큰 검증 가드
 * - @Public() 데코레이터가 있으면 인증 우회
 * - Authorization Bearer 토큰 검증
 * - 유효한 토큰이면 request.user에 페이로드 저장
 *
 * @usage
 * ```typescript
 * // 전역 적용 (main.ts)
 * app.useGlobalGuards(new JwtAuthGuard(reflector));
 *
 * // @Public() 데코레이터로 우회
 * @Public()
 * @Get('health')
 * healthCheck() {}
 * ```
 *
 * @security
 * - ✅ JWT 서명 검증
 * - ✅ 만료 시간 검증
 * - ✅ 토큰 형식 검증
 *
 * @performance <5ms
 */

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ErrorCode, ErrorMessage } from '../constants/error-codes';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * 가드 실행 전 체크
   *
   * @description
   * @Public() 데코레이터가 있으면 인증 우회
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @Public() 데코레이터 확인
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // JWT 검증
    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (error) {
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_INVALID_TOKEN,
        message: ErrorMessage[ErrorCode.AUTH_INVALID_TOKEN],
      });
    }
  }

  /**
   * 요청 핸들러
   *
   * @description
   * 인증 실패 시 에러 메시지 커스터마이징
   */
  handleRequest(err: any, user: any, info: any) {
    // 에러 발생 또는 사용자 없음
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          code: ErrorCode.AUTH_TOKEN_EXPIRED,
          message: ErrorMessage[ErrorCode.AUTH_TOKEN_EXPIRED],
        });
      }

      throw new UnauthorizedException({
        code: ErrorCode.AUTH_UNAUTHORIZED,
        message: ErrorMessage[ErrorCode.AUTH_UNAUTHORIZED],
      });
    }

    return user;
  }
}
