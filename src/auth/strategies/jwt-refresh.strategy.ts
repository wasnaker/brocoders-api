import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { BACKEND_MODULE_MANIFESTS } from '../../module-runtime/module-manifest.registry';
import { JwtRefreshPayloadType } from './types/jwt-refresh-payload.type';
import { OrNeverType } from '../../utils/types/or-never.type';
import { AllConfigType } from '../../config/config.type';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService<AllConfigType>,
    private readonly moduleRef: ModuleRef,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow('auth.refreshSecret', {
        infer: true,
      }),
      algorithms: ['HS256'],
    });
  }

  public async validate(
    payload: JwtRefreshPayloadType,
  ): Promise<OrNeverType<JwtRefreshPayloadType>> {
    if (!payload.sessionId) {
      throw new UnauthorizedException();
    }

    if (BACKEND_MODULE_MANIFESTS.some((manifest) => manifest.id === 'impersonate')) {
      const validator = this.moduleRef.get<{
        assertActorSessionCanRefresh(actorSessionId: number): Promise<void>;
      }>(Symbol.for('@wasnaker/module-impersonate/service'), { strict: false });
      await validator.assertActorSessionCanRefresh(Number(payload.sessionId));
    }

    return payload;
  }
}
