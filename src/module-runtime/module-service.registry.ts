import { Injectable } from '@nestjs/common';

export interface ModuleServiceRegistration<TService = unknown> {
  /** Module that owns and implements the public contract. */
  providerModuleId: string;
  /** Stable, provider-namespaced identifier, e.g. customer.branch-directory. */
  contractId: string;
  /** Semver version of the public contract, not the provider package version. */
  version: string;
  /** Explicit consumer allow-list. Empty means no other module may resolve it. */
  consumers: readonly string[];
  /** Public facade only; never register repositories or ORM entities. */
  service: TService;
}

function parseVersion(value: string): [number, number, number] {
  const normalized = value.startsWith('^') ? value.slice(1) : value;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(normalized);
  if (!match) throw new TypeError(`Invalid module service contract version: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersion(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

/**
 * Runtime registry for explicitly published cross-module service contracts.
 *
 * Consumers resolve a provider's public facade by stable contract id and
 * compatible contract version. Provider internals remain private to its module.
 */
@Injectable()
export class ModuleServiceRegistry {
  private readonly registrations = new Map<string, ModuleServiceRegistration>();

  register<TService>(registration: ModuleServiceRegistration<TService>): () => void {
    const providerModuleId = registration.providerModuleId.trim();
    const contractId = registration.contractId.trim();
    if (!providerModuleId || !contractId) {
      throw new TypeError('Module service provider and contract id are required');
    }
    if (!contractId.startsWith(`${providerModuleId}.`)) {
      throw new TypeError(
        `Module service contract "${contractId}" must be namespaced by provider "${providerModuleId}"`,
      );
    }
    parseVersion(registration.version);
    if (!registration.service || typeof registration.service !== 'object') {
      throw new TypeError('Module service implementation must be an object facade');
    }
    const consumers = [...new Set(registration.consumers.map((item) => item.trim()))];
    if (consumers.some((item) => !item)) {
      throw new TypeError('Module service consumer ids must be non-empty');
    }
    const existing = this.registrations.get(contractId);
    if (existing) {
      const sameConsumers =
        existing.consumers.length === consumers.length &&
        existing.consumers.every((consumer) => consumers.includes(consumer));
      if (
        existing.providerModuleId === providerModuleId &&
        existing.version === registration.version &&
        existing.service === registration.service &&
        sameConsumers
      ) {
        // The original registration owns disposal; a duplicate caller must
        // not be able to unregister another module lifecycle's service.
        return () => undefined;
      }
      throw new Error(`Module service contract already registered: ${contractId}`);
    }

    const stored: ModuleServiceRegistration = {
      ...registration,
      providerModuleId,
      contractId,
      consumers,
    };
    this.registrations.set(contractId, stored);

    return () => {
      if (this.registrations.get(contractId) === stored) {
        this.registrations.delete(contractId);
      }
    };
  }

  resolve<TService>(
    consumerModuleId: string,
    contractId: string,
    requiredVersion: string,
  ): TService {
    const registration = this.registrations.get(contractId);
    if (!registration) {
      throw new Error(`Module service contract is not available: ${contractId}`);
    }
    if (!registration.consumers.includes(consumerModuleId)) {
      throw new Error(
        `Module "${consumerModuleId}" is not an authorized consumer of "${contractId}"`,
      );
    }

    const provided = parseVersion(registration.version);
    const required = parseVersion(requiredVersion);
    if (provided[0] !== required[0] || compareVersion(provided, required) < 0) {
      throw new Error(
        `Incompatible module service contract "${contractId}": required ${requiredVersion}, provided ${registration.version}`,
      );
    }
    return registration.service as TService;
  }

  unregisterModule(providerModuleId: string): number {
    let removed = 0;
    for (const [contractId, registration] of this.registrations) {
      if (registration.providerModuleId === providerModuleId) {
        this.registrations.delete(contractId);
        removed += 1;
      }
    }
    return removed;
  }

  listContracts(): Array<{
    providerModuleId: string;
    contractId: string;
    version: string;
    consumers: readonly string[];
  }> {
    return [...this.registrations.values()]
      .map(({ providerModuleId, contractId, version, consumers }) => ({
        providerModuleId,
        contractId,
        version,
        consumers: [...consumers],
      }))
      .sort((left, right) => left.contractId.localeCompare(right.contractId));
  }
}
