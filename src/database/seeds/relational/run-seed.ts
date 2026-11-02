import { NestFactory } from '@nestjs/core';
import { PermissionSeedService } from './permission/permission-seed.service';
import { RolePermissionSeedService } from './role/role-permission-seed.service';
import { RoleSeedService } from './role/role-seed.service';
import { SeedModule } from './seed.module';
import { StatusSeedService } from './status/status-seed.service';
import { UserSeedService } from './user/user-seed.service';

import { RegionSeedService } from '@wasnaker/module-region/api';
import { ModulePermissionSeedService } from '../../../module-runtime/module-permission-seed.service';

const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  // Core permissions first, then permissions owned by installed modules.
  await app.get(RoleSeedService).run();
  await app.get(PermissionSeedService).run();
  await app.get(ModulePermissionSeedService).run();

  // Append newly registered permissions to the admin role without replacing
  // any permissions that were already assigned.
  await app.get(RolePermissionSeedService).run();

  await app.get(StatusSeedService).run();
  await app.get(UserSeedService).run();
  await app.get(RegionSeedService).run();

  await app.close();
};

void runSeed();
