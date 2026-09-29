import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { PermissionEntity } from './infrastructure/persistence/relational/entities/permission.entity';
import { PermissionSchema } from './infrastructure/persistence/document/entities/permission.schema';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { DatabaseConfig } from '../database/config/database-config.type';
import databaseConfig from '../database/config/database.config';
import { PermissionsRelationalRepository } from './infrastructure/persistence/relational/repositories/permission.repository';
import { PermissionRepository } from './infrastructure/persistence/permission.repository';

// <database-block>
const infrastructurePersistenceModule = (databaseConfig() as DatabaseConfig)
  .isDocumentDatabase
  ? MongooseModule.forFeature([
      { name: PermissionSchema.name, schema: PermissionSchema },
    ])
  : TypeOrmModule.forFeature([PermissionEntity]);
// </database-block>

const repositoryProvider = (databaseConfig() as DatabaseConfig).isDocumentDatabase
  ? []
  : [{ provide: PermissionRepository, useClass: PermissionsRelationalRepository }];

@Module({
  imports: [infrastructurePersistenceModule],
  providers: [PermissionsService, ...repositoryProvider],
  controllers: [PermissionsController],
  exports: [PermissionsService, infrastructurePersistenceModule],
})
export class PermissionsModule {}
