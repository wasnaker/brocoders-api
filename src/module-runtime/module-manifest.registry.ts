import { regionModuleManifest } from '@wasnaker/module-region/api/manifest';

/**
 * Backend module manifest registry.
 *
 * The registry is the host's integration point for module-owned metadata.
 * Module implementation remains inside each independently versioned package.
 */
export const BACKEND_MODULE_MANIFESTS = [regionModuleManifest] as const;
