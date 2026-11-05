import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import type { RequestWithUser } from '../utils/types/request-with-user.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      (number | string)[] | undefined
    >('roles', [context.getClass(), context.getHandler()]);
    if (!requiredRoles?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestWithUser<JwtPayloadType | undefined>>();
    const assignedRoleIds = [
      ...(request.user?.roles ?? []).map((role) => String(role.id)),
      ...(request.user?.role?.id !== undefined
        ? [String(request.user.role.id)]
        : []),
    ];

    return requiredRoles.some((roleId) =>
      assignedRoleIds.includes(String(roleId)),
    );
  }
}