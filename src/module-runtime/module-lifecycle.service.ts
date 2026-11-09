import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HookRegistryService } from './hook-registry.service';
import { ModuleLifecycleEntity } from './module-lifecycle.entity';
import { ModuleServiceRegistry } from './module-service.registry';
import { BACKEND_MODULE_MANIFESTS } from './module-manifest.registry';

export interface ModuleRuntimeAdapter {
  /** Register menus/routes/hooks/services and return an idempotent disposer. */
  activate():
    | void
    | (() => void | Promise<void>)
    | Promise<void | (() => void | Promise<void>)>;
}

@Injectable()
export class ModuleLifecycleService {
  private readonly adapters = new Map<string, ModuleRuntimeAdapter>();
  private readonly disposers = new Map<string, () => void | Promise<void>>();

  constructor(
    @InjectRepository(ModuleLifecycleEntity)
    private readonly modules: Repository<ModuleLifecycleEntity>,
    private readonly hooks: HookRegistryService,
    private readonly services: ModuleServiceRegistry,
  ) {}

  registerRuntimeAdapter(
    moduleId: string,
    adapter: ModuleRuntimeAdapter,
  ): () => void {
    this.assertModuleId(moduleId);
    if (this.adapters.has(moduleId)) {
      throw new Error(
        `Runtime adapter already registered for module "${moduleId}"`,
      );
    }
    this.adapters.set(moduleId, adapter);
    return () => {
      if (this.adapters.get(moduleId) === adapter) {
        this.adapters.delete(moduleId);
      }
    };
  }

  async install(
    moduleId: string,
    packageName: string,
    version: string,
    metadata: Record<string, unknown> = {},
  ): Promise<ModuleLifecycleEntity> {
    this.assertModuleId(moduleId);
    if (!packageName.trim() || !version.trim()) {
      throw new TypeError('Module package name and version are required');
    }
    const manifest = BACKEND_MODULE_MANIFESTS.find(
      (item) => item.id === moduleId,
    );
    if (!manifest) throw new Error(`Unknown backend module "${moduleId}"`);

    const existing = await this.modules.findOne({ where: { moduleId } });
    if (existing && existing.status !== 'uninstalled') {
      if (
        existing.packageName !== packageName ||
        existing.version !== version
      ) {
        throw new Error(
          `Module "${moduleId}" is already installed with another package version`,
        );
      }
      return existing;
    }

    const dependencies = manifest.requires ?? [];
    if (dependencies.length > 0) {
      const installed = await this.modules.find({
        where: {
          moduleId: In(dependencies),
          status: In(['installed', 'inactive', 'active']),
        },
      });
      const installedIds = new Set(installed.map((item) => item.moduleId));
      const missing = dependencies.filter((id) => !installedIds.has(id));
      if (missing.length > 0) {
        throw new Error(
          `Install dependencies before "${moduleId}": ${missing.join(', ')}`,
        );
      }
    }

    const now = new Date();
    const record = this.modules.create({
      moduleId,
      packageName,
      version,
      status: 'installed',
      metadata,
      dataRetention: 'retained',
      lastError: null,
      installedAt: now,
      activatedAt: null,
      deactivatedAt: null,
      uninstalledAt: null,
    });
    await this.modules.save(record);
    return record;
  }

  async activate(moduleId: string): Promise<ModuleLifecycleEntity> {
    this.assertModuleId(moduleId);
    const record = await this.requireRecord(moduleId);
    if (record.status === 'active') {
      // Rebuild in-memory contributions after a process restart without
      // creating a second registration in the same process.
      if (!this.disposers.has(moduleId)) {
        const disposer = await this.adapters.get(moduleId)?.activate();
        if (typeof disposer === 'function') this.disposers.set(moduleId, disposer);
      }
      return record;
    }
    if (!['installed', 'inactive', 'failed'].includes(record.status)) {
      throw new Error(
        `Cannot activate module "${moduleId}" from state "${record.status}"`,
      );
    }

    const manifest = BACKEND_MODULE_MANIFESTS.find(
      (item) => item.id === moduleId,
    );
    const dependencies = manifest?.requires ?? [];
    if (dependencies.length > 0) {
      const active = await this.modules.find({
        where: { moduleId: In(dependencies), status: 'active' },
      });
      const activeIds = new Set(active.map((item) => item.moduleId));
      const unavailable = dependencies.filter((id) => !activeIds.has(id));
      if (unavailable.length > 0) {
        throw new Error(
          `Activate dependencies before "${moduleId}": ${unavailable.join(', ')}`,
        );
      }
    }

    const claim = await this.modules.update(
      { moduleId, status: In(['installed', 'inactive', 'failed']) },
      { status: 'activating', lastError: null },
    );
    if (!claim.affected) {
      const latest = await this.requireRecord(moduleId);
      if (latest.status === 'active') return latest;
      throw new Error(
        `Module "${moduleId}" lifecycle transition is already in progress`,
      );
    }

    try {
      const adapter = this.adapters.get(moduleId);
      const disposer = await adapter?.activate();
      if (typeof disposer === 'function')
        this.disposers.set(moduleId, disposer);
      return await this.modules.save({
        ...(await this.requireRecord(moduleId)),
        status: 'active',
        activatedAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      this.hooks.unregisterModule(moduleId);
      this.services.unregisterModule(moduleId);
      const message = error instanceof Error ? error.message : String(error);
      await this.modules.update(
        { moduleId, status: 'activating' },
        { status: 'failed', lastError: message.slice(0, 8000) },
      );
      throw error;
    }
  }

  async deactivate(moduleId: string): Promise<ModuleLifecycleEntity> {
    this.assertModuleId(moduleId);
    const record = await this.requireRecord(moduleId);
    if (record.status === 'inactive' || record.status === 'installed')
      return record;
    if (record.status !== 'active') {
      throw new Error(
        `Cannot deactivate module "${moduleId}" from state "${record.status}"`,
      );
    }
    const claim = await this.modules.update(
      { moduleId, status: 'active' },
      { status: 'deactivating' },
    );
    if (!claim.affected) {
      throw new Error(
        `Module "${moduleId}" lifecycle transition is already in progress`,
      );
    }

    try {
      const disposer = this.disposers.get(moduleId);
      await disposer?.();
      this.disposers.delete(moduleId);
      this.hooks.unregisterModule(moduleId);
      this.services.unregisterModule(moduleId);
      return await this.modules.save({
        ...(await this.requireRecord(moduleId)),
        status: 'inactive',
        deactivatedAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.modules.update(
        { moduleId, status: 'deactivating' },
        { status: 'failed', lastError: message.slice(0, 8000) },
      );
      throw error;
    }
  }

  async uninstall(moduleId: string): Promise<ModuleLifecycleEntity> {
    this.assertModuleId(moduleId);
    let record = await this.requireRecord(moduleId);
    if (record.status === 'active') record = await this.deactivate(moduleId);
    if (record.status === 'uninstalled') return record;
    if (!['installed', 'inactive', 'failed'].includes(record.status)) {
      throw new Error(
        `Cannot uninstall module "${moduleId}" from state "${record.status}"`,
      );
    }

    const dependents = await this.modules.find({
      where: { status: In(['installed', 'inactive', 'active']) },
    });
    const blocking = dependents.filter((item) => {
      const manifest = BACKEND_MODULE_MANIFESTS.find(
        (candidate) => candidate.id === item.moduleId,
      );
      return (
        item.moduleId !== moduleId &&
        (manifest?.requires ?? []).includes(moduleId)
      );
    });
    if (blocking.length > 0) {
      throw new Error(
        `Uninstall dependent modules first: ${blocking.map((item) => item.moduleId).join(', ')}`,
      );
    }

    const claim = await this.modules.update(
      { moduleId, status: In(['installed', 'inactive', 'failed']) },
      { status: 'uninstalling' },
    );
    if (!claim.affected) {
      throw new Error(
        `Module "${moduleId}" lifecycle transition is already in progress`,
      );
    }
    this.hooks.unregisterModule(moduleId);
    this.services.unregisterModule(moduleId);
    this.disposers.delete(moduleId);
    return this.modules.save({
      ...(await this.requireRecord(moduleId)),
      status: 'uninstalled',
      uninstalledAt: new Date(),
      dataRetention: 'retained',
      lastError: null,
    });
  }

  async getState(moduleId: string): Promise<ModuleLifecycleEntity> {
    return this.requireRecord(moduleId);
  }

  async listStates(): Promise<ModuleLifecycleEntity[]> {
    return this.modules.find({ order: { moduleId: 'ASC' } });
  }

  private async requireRecord(
    moduleId: string,
  ): Promise<ModuleLifecycleEntity> {
    const record = await this.modules.findOne({ where: { moduleId } });
    if (!record) throw new Error(`Module "${moduleId}" is not installed`);
    return record;
  }

  private assertModuleId(moduleId: string): void {
    if (!/^[a-z][a-z0-9-]*$/.test(moduleId)) {
      throw new TypeError(`Invalid module id "${moduleId}"`);
    }
  }
}
