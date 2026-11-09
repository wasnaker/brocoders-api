export interface BackendModulePermissionDefinition {
  /** Legacy display name; retained for compatibility with installed modules. */
  name: string;
  description: string;
  /** Stable, globally unique permission key. Omitted only by legacy manifests. */
  key?: string;
}

export type BackendModuleRoleScope = string;

export interface BackendModuleRoleDefinition {
  /** Stable key owned by the module, not a core role id or display name. */
  key: string;
  name: string;
  description: string;
  /** Module-defined scope identifier, e.g. global, customer, branch, group. */
  scope: BackendModuleRoleScope;
  /** Legacy same-module grants; new manifests should use manifest.roleGrants. */
  permissions?: readonly string[];
}

export interface BackendModuleRoleTarget {
  moduleId: string;
  key: string;
}

export interface BackendModuleRoleGrantDefinition {
  /** The Role receiving permissions; it may be owned by another module. */
  targetRole: BackendModuleRoleTarget;
  /** Stable permission keys owned by the module declaring this grant. */
  permissions: readonly string[];
}

export interface BackendModuleServiceProvision {
  contractId: string;
  version: string;
  consumers: readonly string[];
}

export interface BackendModuleServiceRequirement {
  providerModuleId: string;
  contractId: string;
  version: string;
}

export interface BackendModuleManifest {
  id: string;
  version: string;
  capabilities: readonly ('api' | 'web')[];
  permissions: readonly BackendModulePermissionDefinition[];
  scopeTypes?: readonly string[];
  roles?: readonly BackendModuleRoleDefinition[];
  /** Module-owned grants, including grants to Roles owned by other modules. */
  roleGrants?: readonly BackendModuleRoleGrantDefinition[];
  requires?: readonly string[];
  providesServices?: readonly BackendModuleServiceProvision[];
  requiresServices?: readonly BackendModuleServiceRequirement[];
}
