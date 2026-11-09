import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { BACKEND_MODULE_MANIFESTS } from './module-manifest.registry';
import type { BackendModuleManifest } from './module-manifest.type';
import { ModuleLifecycleService } from './module-lifecycle.service';

/**
 * Reconciles persisted module states with in-process runtime contributions.
 * A first deployment installs and activates modules in dependency order; explicit
 * inactive or uninstalled states are respected on subsequent restarts.
 */
@Injectable()
export class ModuleLifecycleBootstrap implements OnApplicationBootstrap {
  constructor(private readonly lifecycle: ModuleLifecycleService) {}

  async onApplicationBootstrap(): Promise<void> {
    const pending = [...BACKEND_MODULE_MANIFESTS];
    const ordered: BackendModuleManifest[] = [];
    const knownIds = new Set(pending.map((item) => item.id));

    while (pending.length > 0) {
      const ready = pending.filter((manifest) =>
        (manifest.requires ?? []).every(
          (dependency) =>
            !knownIds.has(dependency) ||
            ordered.some((item) => item.id === dependency),
        ),
      );
      if (ready.length === 0) {
        throw new Error('Backend module lifecycle dependency cycle detected');
      }
      for (const manifest of ready) {
        ordered.push(manifest);
        pending.splice(pending.indexOf(manifest), 1);
      }
    }

    const active = new Set<string>();
    for (const manifest of ordered) {
      const dependencies = manifest.requires ?? [];
      if (dependencies.some((dependency) => !active.has(dependency))) {
        continue;
      }

      let state;
      try {
        state = await this.lifecycle.getState(manifest.id);
      } catch {
        state = await this.lifecycle.install(
          manifest.id,
          `@wasnaker/module-${manifest.id}`,
          manifest.version,
        );
      }

      if (state.status === 'inactive' || state.status === 'uninstalled') {
        continue;
      }

      try {
        await this.lifecycle.activate(manifest.id);
        active.add(manifest.id);
      } catch {
        // A failed module remains visible in lifecycle state for admin repair;
        // its dependents stay inactive rather than breaking application boot.
      }
    }
  }
}
