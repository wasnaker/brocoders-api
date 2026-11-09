import { QueryRunner } from 'typeorm';
import { CreateAuthorizationCoreGrants1794400000000 } from './1794400000000-CreateAuthorizationCoreGrants';

describe('CreateAuthorizationCoreGrants1794400000000', () => {
  it('creates provenance tables and migrates legacy links without dropping the old relation', async () => {
    const statements: string[] = [];
    const runner = {
      query: jest.fn(async (sql: string) => {
        statements.push(sql);
        return [];
      }),
    } as unknown as QueryRunner;

    await new CreateAuthorizationCoreGrants1794400000000().up(runner);

    const sql = statements.join('\n');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "permissionKey"');
    expect(sql).toContain('UPDATE "permission"');
    expect(sql).toContain('"module_default"');
    expect(sql).toContain('"admin_manual"');
    expect(sql).toContain('"role_permission_override"');
    expect(sql).toContain('"module_authorization_sync"');
    expect(sql).toContain('"authorization_audit_log"');
    expect(sql).toContain('FROM "roles_permissions_role"');
    expect(sql).toContain("'legacy'");
    expect(sql).not.toMatch(/DROP\s+TABLE\s+"roles_permissions_role"/i);
  });

  it('keeps rollback scoped to new objects and leaves the legacy relation intact', async () => {
    const statements: string[] = [];
    const runner = {
      query: jest.fn(async (sql: string) => {
        statements.push(sql);
        return [];
      }),
    } as unknown as QueryRunner;

    await new CreateAuthorizationCoreGrants1794400000000().down(runner);

    const sql = statements.join('\n');
    expect(sql).toContain('DROP TABLE IF EXISTS "role_permission_grant"');
    expect(sql).toContain('DROP TABLE IF EXISTS "role_permission_override"');
    expect(sql).not.toMatch(/DROP\s+TABLE\s+"roles_permissions_role"/i);
  });
});
