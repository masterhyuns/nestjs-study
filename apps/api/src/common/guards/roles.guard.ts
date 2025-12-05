/**
 * Roles Guard
 *
 * @description
 * 역할 기반 접근 제어 (RBAC)
 *
 * @usage
 * ```typescript
 * @Roles(UserRole.ADMIN, UserRole.MANAGER)
 * @Delete(':id')
 * deleteUser() {}
 * ```
 *
 * @security
 * - JwtAuthGuard 이후 실행
 * - request.user.role 검증
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, ErrorMessage } from '../constants/error-codes';

export const ROLES_KEY = 'roles';

/**
 * Roles 데코레이터
 */
export const Roles = (...roles: string[]) =>
  (target: any, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(ROLES_KEY, roles, target);
    return target;
  };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // @Roles() 데코레이터가 없으면 통과
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 사용자 정보 없음 (JwtAuthGuard가 먼저 실행되어야 함)
    if (!user || !user.role) {
      throw new ForbiddenException({
        code: ErrorCode.AUTH_FORBIDDEN,
        message: ErrorMessage[ErrorCode.AUTH_FORBIDDEN],
      });
    }

    // 역할 확인
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException({
        code: ErrorCode.AUTH_FORBIDDEN,
        message: ErrorMessage[ErrorCode.AUTH_FORBIDDEN],
      });
    }

    return true;
  }
}
