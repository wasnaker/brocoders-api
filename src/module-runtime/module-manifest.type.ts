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

export interface BackendModuleManifest {
  id: string;
  version: string;
  capabilities: readonly ('api' | 'web')[];
  permissions: readonly BackendModulePermissionDefinition[];
  /** Optional module-owned roles; the host owns assignment and enforcement. */
  roles?: readonly BackendModuleRoleDefinition[];
  /** Package ids this module depends on. Hard deps must be installed first. */
  requires?: readonly string[];
}
