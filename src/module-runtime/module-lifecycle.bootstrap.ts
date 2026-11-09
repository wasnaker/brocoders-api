import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { BACKEND_MODULE_MANIFESTS } from './module-manifest.registry';
import type { BackendModuleManifest } from './module-manifest.type';
import { ModuleLifecycleService } from './module-lifecycle.service';

/**
 * Reconciles persisted module states with runtime contributions.
 * Dependencies activate in topological order and deactivate in reverse order.
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

    const states = new Map<
      string,
      Awaited<ReturnType<ModuleLifecycleService['getState']>>
    >();
    for (const manifest of ordered) {
      try {
        states.set(manifest.id, await this.lifecycle.getState(manifest.id));
      } catch {
        states.set(
          manifest.id,
          await this.lifecycle.install(
            manifest.id,
            `@wasnaker/module-${manifest.id}`,
            manifest.version,
          ),
        );
      }
    }

    // Compute the desired state using persisted intent and dependency state.
    const desiredActive = new Map<string, boolean>();
    for (const manifest of ordered) {
      const state = states.get(manifest.id);
      const dependenciesReady = (manifest.requires ?? []).every(
        (dependency) =>
          !knownIds.has(dependency) || desiredActive.get(dependency) === true,
      );
      desiredActive.set(
        manifest.id,
        dependenciesReady &&
          ['installed', 'active', 'failed'].includes(state?.status ?? ''),
      );
    }

    // Stop dependents before providers so no active child outlives its contract.
    for (const manifest of [...ordered].reverse()) {
      const state = states.get(manifest.id);
      if (state?.status === 'active' && !desiredActive.get(manifest.id)) {
        await this.lifecycle.deactivate(manifest.id);
      } else if (
        state &&
        ['inactive', 'uninstalled', 'failed'].includes(state.status)
      ) {
        await this.lifecycle.clearRuntimeContributions(manifest.id);
      }
    }

    // Restore eligible contributions only after all required providers are active.
    const active = new Set<string>();
    for (const manifest of ordered) {
      if (!desiredActive.get(manifest.id)) continue;
      const dependenciesReady = (manifest.requires ?? []).every(
        (dependency) => !knownIds.has(dependency) || active.has(dependency),
      );
      if (!dependenciesReady) {
        await this.lifecycle.clearRuntimeContributions(manifest.id);
        continue;
      }

      try {
        await this.lifecycle.activate(manifest.id);
        active.add(manifest.id);
      } catch {
        // Failed modules remain visible in lifecycle state; dependents stay inactive.
        await this.lifecycle.clearRuntimeContributions(manifest.id);
      }
    }
  }
}
