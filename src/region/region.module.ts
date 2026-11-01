import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvinceEntity } from './infrastructure/persistence/relational/entities/province.entity';
import { RegencyEntity } from './infrastructure/persistence/relational/entities/regency.entity';
import { RegionService } from './services/region.service';
import { RegionController } from './controllers/region.controller';
import { RegionSeedService } from './database/region-seed.service';
import { ProvinceRepository } from './infrastructure/persistence/province.repository';
import { RegencyRepository } from './infrastructure/persistence/regency.repository';
import { ProvincesRelationalRepository } from './infrastructure/persistence/relational/repositories/province.repository';
import { RegenciesRelationalRepository } from './infrastructure/persistence/relational/repositories/regency.repository';

// NOTE: This module is relational-only (TypeORM/MySQL). The host brocoders-api
// uses a database-config block to switch between relational (TypeORM) and
// document (Mongoose) databases. To extend for document DB support, add a
// similar infrastructure block following the pattern in permissions.module.ts:
//   if (isDocumentDatabase) { MongooseModule.forFeature([...]) }
//   else { TypeOrmModule.forFeature([entities]) }
// with a conditional repositoryProvider array.

@Module({
  imports: [TypeOrmModule.forFeature([ProvinceEntity, RegencyEntity])],
  providers: [
    RegionService,
    RegionSeedService,
    { provide: ProvinceRepository, useClass: ProvincesRelationalRepository },
    { provide: RegencyRepository, useClass: RegenciesRelationalRepository },
  ],
  controllers: [RegionController],
  exports: [RegionService, RegionSeedService],
})
export class RegionModule {}
