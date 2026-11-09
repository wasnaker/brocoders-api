import { Injectable } from '@nestjs/common';
import { ModuleAuthorizationReconciliationService } from './module-authorization-reconciliation.service';

/**
 * Backward-compatible seed entry point. All authorization persistence is
 * delegated to the Core reconciliation engine; module packages never write
 * Core Role/Permission tables or the legacy many-to-many relation.
 */
@Injectable()
export class ModulePermissionSeedService {
  constructor(
    private readonly reconciliation: ModuleAuthorizationReconciliationService,
  ) {}

  async run(): Promise<void> {
    const results = await this.reconciliation.syncAll();
    const failures = results.filter((result) => result.status !== 'success');
    if (failures.length) {
      throw new Error(
        `Module authorization seed failed: ${failures
          .map((failure) => `${failure.moduleId}: ${failure.error ?? 'unknown error'}`)
          .join('; ')}`,
      );
    }
  }
}
