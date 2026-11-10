import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const require = createRequire(import.meta.url);
const packageJson = JSON.parse(
  await readFile(resolve(root, 'package.json'), 'utf8'),
);
const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.optionalDependencies,
};
const candidates = Object.keys(dependencies)
  .filter((name) => name.startsWith('@wasnaker/module-'))
  .sort();

function canResolve(specifier) {
  try {
    require.resolve(specifier);
    return true;
  } catch {
    return false;
  }
}

const apiModules = [];
for (const packageName of candidates) {
  if (!canResolve(`${packageName}/api/manifest`)) {
    // A package without a backend manifest is a web-only module.
    continue;
  }
  if (!canResolve(`${packageName}/api/definition`)) {
    throw new Error(
      `Backend module ${packageName} must export the universal api/definition contract.`,
    );
  }
  const manifestModule = require(`${packageName}/api/manifest`);
  const manifest = manifestModule.moduleManifest ?? manifestModule.default;
  if (!manifest?.id) {
    throw new Error(`Backend module ${packageName} must export a manifest with a stable id.`);
  }
  apiModules.push({ packageName, manifest });
}

// Validate versioned public service contracts before generating the runtime registry.
function parseContractVersion(value) {
  const match = /^\^?(\d+)\.(\d+)\.(\d+)$/.exec(value ?? "");
  if (!match) {
    throw new Error(`Invalid module service contract version: ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function isCompatibleContractVersion(providedValue, requiredValue) {
  const provided = parseContractVersion(providedValue);
  const required = parseContractVersion(requiredValue);
  if (provided[0] !== required[0]) return false;
  for (let index = 0; index < 3; index += 1) {
    if (provided[index] !== required[index]) {
      return provided[index] > required[index];
    }
  }
  return true;
}

const serviceProviders = new Map([
  [
    'core.user-directory',
    {
      providerModuleId: 'core',
      contractId: 'core.user-directory',
      version: '1.0.0',
      consumers: ['customer', 'equipment'],
    },
  ],
  [
    'core.account-provisioning',
    {
      providerModuleId: 'core',
      contractId: 'core.account-provisioning',
      version: '1.0.0',
      consumers: ['customer'],
    },
  ],
  [
    'core.authorization.registry',
    {
      providerModuleId: 'core',
      contractId: 'core.authorization.registry',
      version: '1.0.0',
      consumers: ['customer', 'equipment', 'region', 'impersonate'],
    },
  ],
]);
for (const { manifest } of apiModules) {
  for (const provision of manifest.providesServices ?? []) {
    if (!provision.contractId?.startsWith(`${manifest.id}.`)) {
      throw new Error(
        `Module "${manifest.id}" service contract "${provision.contractId}" must be namespaced by its provider id.`,
      );
    }
    if (serviceProviders.has(provision.contractId)) {
      throw new Error(`Duplicate module service provider: ${provision.contractId}`);
    }
    parseContractVersion(provision.version);
    serviceProviders.set(provision.contractId, {
      providerModuleId: manifest.id,
      ...provision,
    });
  }
}
for (const { manifest } of apiModules) {
  for (const requirement of manifest.requiresServices ?? []) {
    const provider = serviceProviders.get(requirement.contractId);
    if (!provider || provider.providerModuleId !== requirement.providerModuleId) {
      throw new Error(
        `Module "${manifest.id}" requires unavailable service "${requirement.contractId}" from "${requirement.providerModuleId}".`,
      );
    }
    if (!(provider.consumers ?? []).includes(manifest.id)) {
      throw new Error(
        `Module "${manifest.id}" is not authorized by provider "${provider.providerModuleId}" to consume "${requirement.contractId}".`,
      );
    }
    if (!isCompatibleContractVersion(provider.version, requirement.version)) {
      throw new Error(
        `Module "${manifest.id}" requires ${requirement.contractId}@${requirement.version}, but provider offers ${provider.version}.`,
      );
    }
  }
}

// Order backend modules by their declared hard dependencies. This order is
// also used for module seed services, so a dependent module (e.g. customer)
// never seeds foreign keys before its required reference module (e.g. region).
const pending = [...apiModules];
const orderedModules = [];
const orderedIds = new Set();
while (pending.length > 0) {
  const ready = pending.filter(({ manifest }) =>
    (manifest.requires ?? []).every((requiredId) => orderedIds.has(requiredId)),
  );
  if (ready.length === 0) {
    const unresolved = pending.map(({ manifest }) =>
      `${manifest.id} requires ${(manifest.requires ?? []).filter((id) => !orderedIds.has(id)).join(', ')}`,
    );
    throw new Error(`Backend module dependency cycle or missing module: ${unresolved.join('; ')}`);
  }
  for (const module of ready) {
    const missing = (module.manifest.requires ?? []).filter(
      (requiredId) => !apiModules.some((candidate) => candidate.manifest.id === requiredId),
    );
    if (missing.length > 0) {
      throw new Error(`Backend module "${module.manifest.id}" requires unavailable module(s): ${missing.join(', ')}`);
    }
    orderedModules.push(module);
    orderedIds.add(module.manifest.id);
    pending.splice(pending.indexOf(module), 1);
  }
}

const imports = apiModules.map(
  ({ packageName }, index) =>
    `import { moduleDefinition as moduleDefinition${index} } from '${packageName}/api/definition';`,
);
const definitions = apiModules.map((_, index) => `moduleDefinition${index}`);
const seedDefinitions = orderedModules.map(({ packageName }) => {
  const index = apiModules.findIndex(
    (module) => module.packageName === packageName,
  );
  return `  moduleDefinition${index},`;
});
const source = [
  '/** Generated by scripts/generate-backend-module-registry.mjs. Do not edit. */',
  "import type { DynamicModule } from '@nestjs/common';",
  "import type { BackendModuleManifest } from './module-manifest.type';",
  ...imports,
  '',
  '/**',
  ' * Structural definition type: keeps the registry compilable with any',
  ' * number of modules (per-module generic inference breaks with 2+ modules).',
  ' */',
  'interface BackendModuleDefinition {',
  '  manifest: BackendModuleManifest;',
  '  registerAsync: (options: any) => DynamicModule;',
  '  entities: readonly (new (...args: any[]) => unknown)[];',
  '  migrations: readonly (new (...args: any[]) => unknown)[];',
  '  seedServices: readonly (new (...args: any[]) => unknown)[];',
  '}',
  '',
  'export const BACKEND_MODULE_DEFINITIONS: readonly BackendModuleDefinition[] = [',
  ...definitions.map((d) => `  ${d},`),
  '];',
  'export const BACKEND_MODULE_MANIFESTS: readonly BackendModuleManifest[] =',
  '  BACKEND_MODULE_DEFINITIONS.map(({ manifest }) => manifest);',
  'export const BACKEND_MODULE_ENTITIES = BACKEND_MODULE_DEFINITIONS.flatMap(',
  '  ({ entities }) => [...entities],',
  ');',
  'export const BACKEND_MODULE_MIGRATIONS = BACKEND_MODULE_DEFINITIONS.flatMap(',
  '  ({ migrations }) => [...migrations],',
  ');',
  'const BACKEND_MODULE_SEED_DEFINITIONS: readonly BackendModuleDefinition[] = [',
  ...seedDefinitions,
  '];',
  'export const BACKEND_MODULE_SEED_SERVICES =',
  '  BACKEND_MODULE_SEED_DEFINITIONS.flatMap(({ seedServices }) => [',
  '    ...seedServices,',
  '  ]);',
  '',
].join('\n');

const output = resolve(root, 'src/module-runtime/module-manifest.registry.ts');
await mkdir(dirname(output), { recursive: true });
let previous = '';
try {
  previous = await readFile(output, 'utf8');
} catch {
  // First generation.
}
if (previous !== source) {
  await writeFile(output, source, 'utf8');
}
console.log(`Registered ${apiModules.length} backend module definition(s).`);
