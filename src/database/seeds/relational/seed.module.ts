import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TypeOrmConfigService } from '../../typeorm-config.service';
import { PermissionSeedModule } from './permission/permission-seed.module';
import { RolePermissionSeedModule } from './role/role-permission-seed.module';
import { RoleSeedModule } from './role/role-seed.module';
import { StatusSeedModule } from './status/status-seed.module';
import { UserSeedModule } from './user/user-seed.module';
import { BACKEND_MODULE_DEFINITIONS } from '../../../module-runtime/module-manifest.registry';
import { ModuleRuntimeModule } from '../../../module-runtime/module-runtime.module';
import { ModuleAuthorizationService } from '../../../module-runtime/module-authorization.service';
import databaseConfig from '../../config/database.config';
import appConfig from '../../../config/app.config';

const backendModuleImports = BACKEND_MODULE_DEFINITIONS.map((definition) =>
  definition.registerAsync({
    imports: [ModuleRuntimeModule],
    inject: [ModuleAuthorizationService],
    useFactory: (authorization: ModuleAuthorizationService) => ({
      authorize: (roleId: number | string, permission: string) =>
        authorization.hasPermission(roleId, permission),
    }),
  }),
);

@Module({
  imports: [
    PermissionSeedModule,
    RolePermissionSeedModule,
    RoleSeedModule,
    StatusSeedModule,
    UserSeedModule,
    ...backendModuleImports,
    ModuleRuntimeModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options: DataSourceOptions) =>
        new DataSource(options).initialize(),
    }),
  ],
})
export class SeedModule {}
