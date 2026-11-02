import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { ProvinceEntity } from './infrastructure/persistence/relational/entities/province.entity';
import { RegencyEntity } from './infrastructure/persistence/relational/entities/regency.entity';
import { RegionService } from './services/region.service';
import { RegionController } from './controllers/region.controller';
import { RegionSeedService } from './database/region-seed.service';
import { RegionPermissionSeedService } from './database/region-permission-seed.service';
import { ProvinceRepository } from './infrastructure/persistence/province.repository';
import { RegencyRepository } from './infrastructure/persistence/regency.repository';
import { ProvincesRelationalRepository } from './infrastructure/persistence/relational/repositories/province.repository';
import { RegenciesRelationalRepository } from './infrastructure/persistence/relational/repositories/regency.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProvinceEntity, RegencyEntity, PermissionEntity]),
  ],
  providers: [
    RegionService,
    RegionSeedService,
    RegionPermissionSeedService,
    { provide: ProvinceRepository, useClass: ProvincesRelationalRepository },
    { provide: RegencyRepository, useClass: RegenciesRelationalRepository },
  ],
  controllers: [RegionController],
  exports: [RegionService, RegionSeedService, RegionPermissionSeedService],
})
export class RegionModule {}
