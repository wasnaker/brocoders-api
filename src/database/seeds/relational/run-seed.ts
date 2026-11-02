import { NestFactory } from '@nestjs/core';
import { PermissionSeedService } from './permission/permission-seed.service';
import { RolePermissionSeedService } from './role/role-permission-seed.service';
import { RoleSeedService } from './role/role-seed.service';
import { SeedModule } from './seed.module';
import { StatusSeedService } from './status/status-seed.service';
import { UserSeedService } from './user/user-seed.service';
import { ModulePermissionSeedService } from '../../../module-runtime/module-permission-seed.service';
import { BACKEND_MODULE_SEED_SERVICES } from '../../../module-runtime/module-manifest.registry';

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

  // Module seed providers are discovered from each installed API package.
  for (const SeedService of BACKEND_MODULE_SEED_SERVICES) {
    const seedService = app.get(SeedService) as { run: () => Promise<void> };
    await seedService.run();
  }

  await app.close();
};

void runSeed();
