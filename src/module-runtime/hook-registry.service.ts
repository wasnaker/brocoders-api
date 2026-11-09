import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export interface HookContext {
  /** Module that registered the currently executing handler. */
  ownerModuleId: string;
  /** Module or subsystem that dispatched the hook, when known. */
  sourceModuleId?: string;
  correlationId: string;
  signal?: AbortSignal;
}

export interface HookOptions {
  /** Lower numbers run first. Defaults to 10. */
  priority?: number;
  /** Stable key for idempotent registration across repeated bootstrap. */
  registrationKey?: string;
}

export type UnregisterHook = () => void;
export type ActionHandler<T = unknown> = (
  payload: T,
  context: HookContext,
) => void | Promise<void>;
export type FilterHandler<T = unknown> = (
  value: T,
  context: HookContext,
) => T | Promise<T>;

interface Registration {
  moduleId: string;
  hookName: string;
  kind: 'action' | 'filter';
  key: string;
  priority: number;
  sequence: number;
  handler: ActionHandler<any> | FilterHandler<any>;
}

export interface ModuleHooks {
  addAction<T>(
    name: string,
    handler: ActionHandler<T>,
    options?: HookOptions,
  ): UnregisterHook;
  addFilter<T>(
    name: string,
    handler: FilterHandler<T>,
    options?: HookOptions,
  ): UnregisterHook;
}

/**
 * In-process, module-owned action/filter registry.
 *
 * Register through forModule() so every contribution has an owner and can be
 * removed as part of module deactivation. Durable integration events belong
 * to the transactional outbox, not this in-process hook bus.
 */
@Injectable()
export class HookRegistryService {
  private readonly registrations: Registration[] = [];
  private nextSequence = 0;

  forModule(moduleId: string): ModuleHooks {
    this.assertModuleId(moduleId);
    return {
      addAction: <T>(
        name: string,
        handler: ActionHandler<T>,
        options?: HookOptions,
      ) => this.register(moduleId, name, 'action', handler, options),
      addFilter: <T>(
        name: string,
        handler: FilterHandler<T>,
        options?: HookOptions,
      ) => this.register(moduleId, name, 'filter', handler, options),
    };
  }

  async doAction<T>(
    name: string,
    payload: T,
    sourceModuleId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    this.assertHookName(name);
    const handlers = this.getHandlers(name, 'action');
    const errors: Error[] = [];

    for (const registration of handlers) {
      if (signal?.aborted) {
        errors.push(new Error(`Action "${name}" was aborted`));
        break;
      }
      try {
        await (registration.handler as ActionHandler<T>)(payload, {
          ownerModuleId: registration.moduleId,
          sourceModuleId,
          correlationId: randomUUID(),
          signal,
        });
      } catch (error) {
        errors.push(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `One or more handlers failed for action "${name}"`,
      );
    }
  }

  async applyFilters<T>(
    name: string,
    value: T,
    sourceModuleId?: string,
    signal?: AbortSignal,
  ): Promise<T> {
    this.assertHookName(name);
    let filteredValue = value;

    for (const registration of this.getHandlers(name, 'filter')) {
      if (signal?.aborted) {
        throw new Error(`Filter "${name}" was aborted`);
      }
      const nextValue = await (registration.handler as FilterHandler<T>)(
        filteredValue,
        {
          ownerModuleId: registration.moduleId,
          sourceModuleId,
          correlationId: randomUUID(),
          signal,
        },
      );
      if (nextValue === undefined) {
        throw new Error(
          `Filter "${name}" registered by "${registration.moduleId}" returned undefined`,
        );
      }
      filteredValue = nextValue;
    }

    return filteredValue;
  }

  unregisterModule(moduleId: string): number {
    this.assertModuleId(moduleId);
    const before = this.registrations.length;
    for (let index = this.registrations.length - 1; index >= 0; index -= 1) {
      if (this.registrations[index].moduleId === moduleId) {
        this.registrations.splice(index, 1);
      }
    }
    return before - this.registrations.length;
  }

  getRegistrationCount(moduleId?: string): number {
    return moduleId
      ? this.registrations.filter((item) => item.moduleId === moduleId).length
      : this.registrations.length;
  }

  private register(
    moduleId: string,
    name: string,
    kind: Registration['kind'],
    handler: ActionHandler<any> | FilterHandler<any>,
    options: HookOptions = {},
  ): UnregisterHook {
    this.assertModuleId(moduleId);
    this.assertHookName(name);
    if (typeof handler !== 'function') {
      throw new TypeError('Hook handler must be a function');
    }
    const priority = options.priority ?? 10;
    if (!Number.isFinite(priority)) {
      throw new TypeError('Hook priority must be a finite number');
    }

    const key = options.registrationKey ?? handler;
    const existing = this.registrations.find(
      (item) =>
        item.moduleId === moduleId &&
        item.hookName === name &&
        item.kind === kind &&
        item.key === key,
    );
    if (existing) {
      return () => this.removeRegistration(existing);
    }

    const registration: Registration = {
      moduleId,
      hookName: name,
      kind,
      key,
      priority,
      sequence: this.nextSequence++,
      handler,
    };
    this.registrations.push(registration);
    return () => this.removeRegistration(registration);
  }

  private getHandlers(
    name: string,
    kind: Registration['kind'],
  ): Registration[] {
    return this.registrations
      .filter((item) => item.hookName === name && item.kind === kind)
      .sort(
        (left, right) =>
          left.priority - right.priority || left.sequence - right.sequence,
      );
  }

  private removeRegistration(registration: Registration): void {
    const index = this.registrations.indexOf(registration);
    if (index >= 0) this.registrations.splice(index, 1);
  }

  private assertModuleId(moduleId: string): void {
    if (!/^[a-z][a-z0-9-]*$/.test(moduleId)) {
      throw new TypeError(`Invalid module id "${moduleId}"`);
    }
  }

  private assertHookName(name: string): void {
    if (!/^[a-z][a-z0-9-]*(\.[a-z][a-zA-Z0-9-]*)+$/.test(name)) {
      throw new TypeError(
        `Invalid hook name "${name}". Use a namespaced name such as "customer.created"`,
      );
    }
  }
}
