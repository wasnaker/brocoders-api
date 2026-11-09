export interface BackendModulePermissionDefinition {
  name: string;
  description: string;
}

export type BackendModuleRoleScope = string;

export interface BackendModuleRoleDefinition {
  /** Stable key owned by the module, not a core role id or display name. */
  key: string;
  name: string;
  description: string;
  /** Module-defined scope identifier, e.g. global, customer, branch, group. */
  scope: BackendModuleRoleScope;
  permissions: readonly string[];
}

export interface BackendModuleServiceProvision {
  contractId: string;
  version: string;
  /** Explicit module ids allowed to consume this public contract. */
  consumers: readonly string[];
}

export interface BackendModuleServiceRequirement {
  providerModuleId: string;
  contractId: string;
  /** Minimum compatible contract version, e.g. ^1.0.0. */
  version: string;
}

export interface BackendModuleManifest {
  id: string;
  version: string;
  capabilities: readonly ('api' | 'web')[];
  permissions: readonly BackendModulePermissionDefinition[];
  /** Scope identifiers the module can resolve for resources and custom core roles. */
  scopeTypes?: readonly string[];
  /** Optional module-owned roles; the host owns assignment and enforcement. */
  roles?: readonly BackendModuleRoleDefinition[];
  /** Package ids this module depends on. Hard deps must be installed first. */
  requires?: readonly string[];
  /** Public service contracts exposed by this module. */
  providesServices?: readonly BackendModuleServiceProvision[];
  /** Versioned public service contracts this module consumes. */
  requiresServices?: readonly BackendModuleServiceRequirement[];
}
