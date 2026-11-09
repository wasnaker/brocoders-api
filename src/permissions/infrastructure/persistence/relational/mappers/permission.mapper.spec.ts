import { Permission } from '../../../../domain/permission';
import { PermissionEntity } from '../entities/permission.entity';
import { PermissionMapper } from './permission.mapper';

describe('PermissionMapper stable keys', () => {
  it('uses the permission name as the initial stable key for legacy callers', () => {
    const domain = Object.assign(new Permission(), {
      name: 'create:user',
      description: 'Create users',
    });

    expect(PermissionMapper.toPersistence(domain).permissionKey).toBe(
      'create:user',
    );
  });

  it('preserves an established stable key when the display name changes', () => {
    const entity = Object.assign(new PermissionEntity(), {
      id: 1,
      name: 'Manage users',
      permissionKey: 'user.manage',
      description: 'Manage users',
    });

    const domain = PermissionMapper.toDomain(entity);
    domain.name = 'User administration';

    const updated = PermissionMapper.toPersistence(domain);
    expect(updated.permissionKey).toBe('user.manage');
    expect(updated.name).toBe('User administration');
  });
});
