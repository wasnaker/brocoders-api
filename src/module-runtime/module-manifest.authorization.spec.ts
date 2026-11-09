import {
  normalizeModuleRoleGrants,
  validateModuleAuthorizationManifests,
} from './module-manifest.authorization';
import { BackendModuleManifest } from './module-manifest.type';
import { BACKEND_MODULE_MANIFESTS } from './module-manifest.registry';

const manifest = (
  input: Partial<BackendModuleManifest> & Pick<BackendModuleManifest, 'id'>,
): BackendModuleManifest => ({
  id: input.id,
  version: input.version ?? '1.0.0',
  capabilities: input.capabilities ?? ['api'],
  permissions: input.permissions ?? [],
  roles: input.roles ?? [],
  requires: input.requires ?? [],
  authorizationRequires: input.authorizationRequires ?? [],
  roleGrants: input.roleGrants,
});

describe('module authorization manifest contract', () => {
  it('adapts legacy Role.permissions into an owned same-module grant', () => {
    const customer = manifest({
      id: 'customer',
      permissions: [{ name: 'customer.read', description: 'Read customers' }],
      roles: [{ key: 'customer.manager', name: 'Customer Manager', description: 'Manager', scope: 'customer', permissions: ['customer.read'] }],
    });
    expect(normalizeModuleRoleGrants(customer)).toEqual([{
      sourceModuleId: 'customer',
      sourceKey: 'legacy-role:customer.manager',
      targetRole: { moduleId: 'customer', key: 'customer.manager' },
      permissions: ['customer.read'],
    }]);
    expect(validateModuleAuthorizationManifests([customer])).toEqual([]);
  });

  it('allows Equipment to grant its permission to a Customer-owned Role', () => {
    const customer = manifest({
      id: 'customer',
      roles: [{ key: 'customer.manager', name: 'Customer Manager', description: 'Manager', scope: 'customer' }],
    });
    const equipment = manifest({
      id: 'equipment',
      authorizationRequires: ['customer'],
      permissions: [{ key: 'equipment.read', name: 'equipment.read', description: 'Read equipment' }],
      roleGrants: [{ targetRole: { moduleId: 'customer', key: 'customer.manager' }, permissions: ['equipment.read'] }],
    });
    expect(validateModuleAuthorizationManifests([customer, equipment])).toEqual([]);
  });

  it('rejects an unknown Role and unknown permission', () => {
    const equipment = manifest({
      id: 'equipment',
      permissions: [{ key: 'equipment.read', name: 'equipment.read', description: 'Read equipment' }],
      roleGrants: [{ targetRole: { moduleId: 'customer', key: 'missing.role' }, permissions: ['not.owned'] }],
    });
    const errors = validateModuleAuthorizationManifests([equipment]);
    expect(errors.some((error) => error.message.includes('Unknown target Role'))).toBe(true);
    expect(errors.some((error) => error.message.includes('Unknown permission key'))).toBe(true);
  });

  it('requires a dependency on the target Role owner', () => {
    const customer = manifest({
      id: 'customer',
      roles: [{ key: 'customer.manager', name: 'Manager', description: 'Manager', scope: 'customer' }],
    });
    const equipment = manifest({
      id: 'equipment',
      permissions: [{ key: 'equipment.read', name: 'equipment.read', description: 'Read equipment' }],
      roleGrants: [{ targetRole: { moduleId: 'customer', key: 'customer.manager' }, permissions: ['equipment.read'] }],
    });
    expect(validateModuleAuthorizationManifests([customer, equipment]).some(
      (error) => error.message.includes('must declare authorizationRequires'),
    )).toBe(true);
  });

  it('rejects authorization dependency cycles', () => {
    const a = manifest({ id: 'a', authorizationRequires: ['b'] });
    const b = manifest({ id: 'b', authorizationRequires: ['a'] });
    expect(validateModuleAuthorizationManifests([a, b]).some(
      (error) => error.message.includes('dependency cycle'),
    )).toBe(true);
  });

  it('validates the installed Customer, Equipment, and Region manifest integration', () => {
    expect(validateModuleAuthorizationManifests(BACKEND_MODULE_MANIFESTS)).toEqual([]);
    const equipment = BACKEND_MODULE_MANIFESTS.find((item) => item.id === 'equipment');
    const region = BACKEND_MODULE_MANIFESTS.find((item) => item.id === 'region');
    expect(equipment?.roles ?? []).toHaveLength(0);
    expect(region?.roles ?? []).toHaveLength(0);
    expect(equipment?.roleGrants?.every((grant) => grant.targetRole.moduleId === 'customer')).toBe(true);
    expect(region?.roleGrants?.every((grant) => grant.targetRole.moduleId === 'customer')).toBe(true);
  });

  it('rejects Role keys that are not stable identifiers', () => {
    const a = manifest({
      id: 'a',
      roles: [{ key: 'Customer Admin', name: 'Customer Admin', description: 'Admin', scope: 'customer' }],
    });
    expect(validateModuleAuthorizationManifests([a]).some(
      (error) => error.message.includes('Role key must use lowercase stable-key'),
    )).toBe(true);
  });

  it('rejects duplicate permission names even when stable keys differ', () => {
    const a = manifest({ id: 'a', permissions: [{ key: 'a.read', name: 'read:shared', description: 'A' }] });
    const b = manifest({ id: 'b', permissions: [{ key: 'b.read', name: 'read:shared', description: 'B' }] });
    expect(validateModuleAuthorizationManifests([a, b]).some(
      (error) => error.message.includes('Permission name'),
    )).toBe(true);
  });

  it('reserves Core-owned permission keys from module manifests', () => {
    const a = manifest({ id: 'equipment', permissions: [{ key: 'read:user', name: 'read:user', description: 'Read users' }] });
    expect(validateModuleAuthorizationManifests([a]).some(
      (error) => error.message.includes('reserved for Core'),
    )).toBe(true);
  });

  it('rejects permission keys that are not stable identifiers', () => {
    const a = manifest({ id: 'a', permissions: [{ key: 'Read Permission', name: 'Read Permission', description: 'A' }] });
    expect(validateModuleAuthorizationManifests([a]).some(
      (error) => error.message.includes('lowercase stable-key'),
    )).toBe(true);
  });

  it('rejects duplicate global permission keys', () => {
    const a = manifest({ id: 'a', permissions: [{ key: 'shared.read', name: 'Read', description: 'A' }] });
    const b = manifest({ id: 'b', permissions: [{ key: 'shared.read', name: 'Read', description: 'B' }] });
    expect(validateModuleAuthorizationManifests([a, b]).some(
      (error) => error.message.includes('already owned'),
    )).toBe(true);
  });
});
