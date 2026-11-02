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
import { RegionModule } from '@wasnaker/module-region/api';
import { RoleEnum } from '../../../roles/roles.enum';
import { ModuleRuntimeModule } from '../../../module-runtime/module-runtime.module';
import databaseConfig from '../../config/database.config';
import appConfig from '../../../config/app.config';

@Module({
  imports: [
    PermissionSeedModule,
    RolePermissionSeedModule,
    RoleSeedModule,
    StatusSeedModule,
    UserSeedModule,
    RegionModule.register({ adminRoleIds: [RoleEnum.admin] }),
    ModuleRuntimeModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options: DataSourceOptions) => {
        return new DataSource(options).initialize();
      },
    }),
  ],
})
export class SeedModule {}
