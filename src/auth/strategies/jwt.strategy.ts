import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { OrNeverType } from '../../utils/types/or-never.type';
import { JwtPayloadType } from './types/jwt-payload.type';
import { AllConfigType } from '../../config/config.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService<AllConfigType>,
    private readonly moduleRef: ModuleRef,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow('auth.secret', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  // Why we don't check if the user exists in the database:
  // https://github.com/brocoders/nestjs-boilerplate/blob/main/docs/auth.md#about-jwt-strategy
  public async validate(
    payload: JwtPayloadType,
  ): Promise<OrNeverType<JwtPayloadType>> {
    if (!payload.id) {
      throw new UnauthorizedException();
    }

    if (payload.impersonationId) {
      if (!payload.actorId || !payload.actorSessionId) {
        throw new UnauthorizedException('Incomplete impersonation context');
      }

      let validator: {
        assertActiveToken(input: {
          impersonationId: string;
          actorId: number;
          subjectId: number;
          actorSessionId: number;
        }): Promise<void>;
      };
      try {
        validator = this.moduleRef.get(
          Symbol.for('@wasnaker/module-impersonate/service'),
          { strict: false },
        );
      } catch {
        throw new UnauthorizedException('Impersonation validator is unavailable');
      }

      await validator.assertActiveToken({
        impersonationId: payload.impersonationId,
        actorId: Number(payload.actorId),
        subjectId: Number(payload.id),
        actorSessionId: Number(payload.actorSessionId),
      });
    }

    return payload;
  }
}
