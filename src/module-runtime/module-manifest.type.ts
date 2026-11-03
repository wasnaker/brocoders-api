export interface BackendModulePermissionDefinition {
  name: string;
  description: string;
}

export interface BackendModuleManifest {
  id: string;
  version: string;
  capabilities: readonly ('api' | 'web')[];
  permissions: readonly BackendModulePermissionDefinition[];
  /** Package ids this module depends on. Hard deps must be installed first. */
  requires?: readonly string[];
}
