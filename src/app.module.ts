import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { FilesModule } from './files/files.module';
import { StatsModule } from './stats/stats.module';
import { ModulesModule } from './modules/modules.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { AuthModule } from './auth/auth.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { SettingsModule } from './settings/settings.module';
import { BACKEND_MODULE_DEFINITIONS } from './module-runtime/module-manifest.registry';
import { ModuleRuntimeModule } from './module-runtime/module-runtime.module';
import { ModuleAuthorizationService } from './module-runtime/module-authorization.service';
import databaseConfig from './database/config/database.config';
import authConfig from './auth/config/auth.config';
import appConfig from './config/app.config';
import mailConfig from './mail/config/mail.config';
import fileConfig from './files/config/file.config';
import facebookConfig from './auth-facebook/config/facebook.config';
import googleConfig from './auth-google/config/google.config';
import appleConfig from './auth-apple/config/apple.config';
import path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthAppleModule } from './auth-apple/auth-apple.module';
import { AuthFacebookModule } from './auth-facebook/auth-facebook.module';
import { AuthGoogleModule } from './auth-google/auth-google.module';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { MailModule } from './mail/mail.module';
import { HomeModule } from './home/home.module';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AllConfigType } from './config/config.type';
import { SessionModule } from './session/session.module';
import { UsersService } from './users/users.service';
import { SessionService } from './session/session.service';
import { AuthService } from './auth/auth.service';
import { StatusEnum } from './statuses/statuses.enum';
import { MailerModule } from './mailer/mailer.module';

const infrastructureDatabaseModule = TypeOrmModule.forRootAsync({
  useClass: TypeOrmConfigService,
  dataSourceFactory: async (options: DataSourceOptions) =>
    new DataSource(options).initialize(),
});

const backendModuleImports = BACKEND_MODULE_DEFINITIONS.map((definition) =>
  definition.registerAsync({
    imports: [ModuleRuntimeModule, UsersModule, SessionModule, AuthModule],
    inject: [
      ModuleAuthorizationService,
      UsersService,
      SessionService,
      AuthService,
    ],
    useFactory: (
      authorization: ModuleAuthorizationService,
      users: UsersService,
      sessions: SessionService,
      auth: AuthService,
    ) => {
      if (definition.manifest.id !== 'impersonate') {
        return {
          authorize: (roleId: number | string, permission: string) =>
            authorization.hasPermission(roleId, permission),
          authorizeScoped: async (
            userId: number | string,
            permission: string,
            target: {
              scopes: readonly { type: string; id: string }[];
            },
          ) => {
            // Reload current role membership for every scoped request so a
            // revoked role cannot remain effective until the JWT expires.
            const user = await users.findById(userId);
            if (!user) return false;
            const assignedRoles = user.roles?.length
              ? user.roles
              : user.role
                ? [user.role]
                : [];
            return authorization.hasScopedModulePermission(
              userId,
              assignedRoles.map((role) => role.id),
              definition.manifest.id,
              permission,
              target.scopes,
            );
          },
          resolveScopes: async (
            userId: number | string,
            permission: string,
          ) => {
            // Resolve scopes from fresh role membership; do not trust browser
            // state or role claims that may outlive an assignment revocation.
            const user = await users.findById(userId);
            if (!user) return { global: false, scopes: [] };
            const assignedRoles = user.roles?.length
              ? user.roles
              : user.role
                ? [user.role]
                : [];
            return authorization.resolveModuleScopes(
              userId,
              assignedRoles.map((role) => role.id),
              definition.manifest.id,
              permission,
            );
          },
        };
      }

      const getRoles = (user: Awaited<ReturnType<UsersService['findById']>>) =>
        user?.roles?.length ? user.roles : user?.role ? [user.role] : [];
      const isActive = (user: Awaited<ReturnType<UsersService['findById']>>) =>
        Boolean(user && String(user.status?.id) === String(StatusEnum.active));
      const toImpersonationUser = (
        user: NonNullable<Awaited<ReturnType<UsersService['findById']>>>,
      ) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: getRoles(user).map((role) => ({ id: role.id })),
        active: isActive(user),
      });

      return {
        authorize: async (userId: number | string, permission: string) => {
          const user = await users.findById(userId);
          if (!isActive(user)) return false;
          for (const role of getRoles(user)) {
            if (await authorization.hasPermission(role.id, permission)) {
              return true;
            }
          }
          return false;
        },
        findUserById: async (userId: number | string) => {
          const user = await users.findById(userId);
          return user ? toImpersonationUser(user) : null;
        },
        searchUsers: async (input: {
          query: string;
          page: number;
          limit: number;
          excludeUserId: number | string;
        }) => {
          const result = await users.searchForImpersonation(input);
          return {
            data: result.data.map(toImpersonationUser),
            total: result.total,
          };
        },
        validateActorSession: async (
          actorId: number | string,
          sessionId: number | string,
        ) => {
          const session = await sessions.findById(sessionId);
          return Boolean(
            session &&
            Number(session.user?.id) === Number(actorId) &&
            session.hash &&
            !session.deletedAt,
          );
        },
        resolveActorSession: async (
          sessionId: number | string,
          hash: string,
        ) => {
          const session = await sessions.findById(sessionId);
          if (
            !session ||
            session.hash !== hash ||
            !session.user?.id ||
            session.deletedAt
          ) {
            return null;
          }
          return { actorId: session.user.id };
        },
        issueAccessToken: (input: {
          subjectUserId: number | string;
          subjectRoleIds: readonly (number | string)[];
          actorUserId: number | string;
          actorSessionId: number | string;
          impersonationId: string;
          expiresInSeconds: number;
        }) => auth.issueImpersonationAccessToken(input),
        tokenLifetimeSeconds: 1800,
      };
    },
  }),
);

@Module({
  imports: [
    // HYGEN_MODULE_IMPORTS
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        appConfig,
        mailConfig,
        fileConfig,
        facebookConfig,
        googleConfig,
        appleConfig,
      ],
      envFilePath: ['.env'],
    }),
    infrastructureDatabaseModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: path.join(__dirname, '/i18n/'), watch: true },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => [
            configService.get('app.headerLanguage', { infer: true }),
          ],
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    UsersModule,
    FilesModule,
    StatsModule,
    ModulesModule,
    BroadcastModule,
    AuthModule,
    PermissionsModule,
    RolesModule,
    SettingsModule,
    ...backendModuleImports,
    AuthFacebookModule,
    AuthGoogleModule,
    AuthAppleModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
  ],
})
export class AppModule {}
