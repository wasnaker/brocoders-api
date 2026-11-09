import {
  BackendModuleManifest,
  BackendModuleRoleGrantDefinition,
} from './module-manifest.type';

export interface NormalizedModuleRoleGrant {
  sourceModuleId: string;
  sourceKey: string;
  targetRole: { moduleId: string; key: string };
  permissions: readonly string[];
}

/** Convert legacy Role.permissions to explicit self-owned grants. */
export function normalizeModuleRoleGrants(
  manifest: BackendModuleManifest,
): NormalizedModuleRoleGrant[] {
  const normalized: NormalizedModuleRoleGrant[] = [];
  for (const role of manifest.roles ?? []) {
    const permissions = role.permissions ?? [];
    if (permissions.length) {
      normalized.push({
        sourceModuleId: manifest.id,
        sourceKey: `legacy-role:${role.key}`,
        targetRole: { moduleId: manifest.id, key: role.key },
        permissions: [...new Set(permissions)],
      });
    }
  }
  for (const [index, grant] of (manifest.roleGrants ?? []).entries()) {
    normalized.push({
      sourceModuleId: manifest.id,
      sourceKey: `role-grant:${grant.targetRole.moduleId}:${grant.targetRole.key}`,
      targetRole: { ...grant.targetRole },
      permissions: [...new Set(grant.permissions)],
    });
  }
  return normalized;
}

export interface ManifestAuthorizationValidationError {
  moduleId: string;
  path: string;
  message: string;
}

export function validateModuleAuthorizationManifests(
  manifests: readonly BackendModuleManifest[],
): ManifestAuthorizationValidationError[] {
  const errors: ManifestAuthorizationValidationError[] = [];
  const moduleById = new Map<string, BackendModuleManifest>();
  const roleOwners = new Map<string, string>();
  const permissionOwners = new Map<string, string>();
  const add = (moduleId: string, path: string, message: string) =>
    errors.push({ moduleId, path, message });
  const keyOf = (value: string | undefined) =>
    typeof value === 'string' ? value.trim() : '';

  for (const manifest of manifests) {
    const id = keyOf(manifest.id);
    if (!id) {
      add(manifest.id ?? '', 'id', 'Module id is required');
      continue;
    }
    if (moduleById.has(id)) {
      add(id, 'id', 'Duplicate module id');
      continue;
    }
    moduleById.set(id, manifest);
  }

  for (const manifest of manifests) {
    const id = manifest.id;
    const localPermissions = new Set<string>();
    for (const [index, permission] of manifest.permissions.entries()) {
      const key = keyOf(permission.key) || keyOf(permission.name);
      if (!key || key.length > 160) {
        add(id, `permissions[${index}].key`, 'Permission key is required and must be at most 160 characters');
        continue;
      }
      if (key === '*') add(id, `permissions[${index}].key`, 'Wildcard permission is reserved for Core');
      if (localPermissions.has(key)) add(id, `permissions[${index}].key`, `Duplicate permission key "${key}"`);
      localPermissions.add(key);
      const existingOwner = permissionOwners.get(key);
      if (existingOwner && existingOwner !== id) {
        add(id, `permissions[${index}].key`, `Permission key "${key}" is already owned by module "${existingOwner}"`);
      } else {
        permissionOwners.set(key, id);
      }
    }

    const localRoles = new Set<string>();
    for (const [index, role] of (manifest.roles ?? []).entries()) {
      const key = keyOf(role.key);
      if (!key || key.length > 160) {
        add(id, `roles[${index}].key`, 'Role key is required and must be at most 160 characters');
        continue;
      }
      if (localRoles.has(key)) add(id, `roles[${index}].key`, `Duplicate Role key "${key}"`);
      localRoles.add(key);
      roleOwners.set(`${id}:${key}`, id);
      if (!keyOf(role.name) || !keyOf(role.scope)) add(id, `roles[${index}]`, 'Role name and scope are required');
    }
  }

  for (const manifest of manifests) {
    const id = manifest.id;
    const dependencies = new Set(manifest.requires ?? []);
    for (const dependency of dependencies) {
      if (!moduleById.has(dependency)) add(id, 'requires', `Unknown module dependency "${dependency}"`);
    }

    for (const [index, grant] of normalizeModuleRoleGrants(manifest).entries()) {
      const target = moduleById.get(grant.targetRole.moduleId);
      const targetIdentity = `${grant.targetRole.moduleId}:${grant.targetRole.key}`;
      if (!target || !(target.roles ?? []).some((role) => role.key === grant.targetRole.key)) {
        add(id, `roleGrants[${index}].targetRole`, `Unknown target Role "${targetIdentity}"`);
      }
      if (grant.targetRole.moduleId !== id && !dependencies.has(grant.targetRole.moduleId)) {
        add(id, `roleGrants[${index}].targetRole`, `Granting module must declare dependency on Role owner "${grant.targetRole.moduleId}"`);
      }
      if (!grant.permissions.length) add(id, `roleGrants[${index}].permissions`, 'At least one permission is required');
      for (const permissionKey of grant.permissions) {
        const owner = permissionOwners.get(permissionKey);
        if (!owner) add(id, `roleGrants[${index}].permissions`, `Unknown permission key "${permissionKey}"`);
        else if (owner !== id) add(id, `roleGrants[${index}].permissions`, `Permission "${permissionKey}" is owned by "${owner}", not granting module "${id}"`);
      }
    }
  }
  return errors;
}

export function assertValidModuleAuthorizationManifests(
  manifests: readonly BackendModuleManifest[],
): void {
  const errors = validateModuleAuthorizationManifests(manifests);
  if (errors.length) {
    throw new Error(`Invalid module authorization manifests:\n${errors
      .map((error) => `- ${error.moduleId} ${error.path}: ${error.message}`)
      .join('\n')}`);
  }
}

export type ModuleRoleGrantInput = BackendModuleRoleGrantDefinition;
