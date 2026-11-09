import { QueryRunner } from 'typeorm';
import { AddAuthorizationRoleIdentityConstraints1794500000000 } from './1794500000000-AddAuthorizationRoleIdentityConstraints';

describe('AddAuthorizationRoleIdentityConstraints1794500000000', () => {
  it('backfills stable Core keys and creates unique Role identity indexes', async () => {
    const statements: string[] = [];
    const runner = {
      query: jest.fn(async (sql: string) => { statements.push(sql); return []; }),
    } as unknown as QueryRunner;
    await new AddAuthorizationRoleIdentityConstraints1794500000000().up(runner);
    const sql = statements.join('\n');
    expect(sql).toContain('moduleRoleKey" = \'admin\'');
    expect(sql).toContain('moduleRoleKey" = \'user\'');
    expect(sql).toContain('UQ_role_core_role_key');
    expect(sql).toContain('UQ_role_module_role_key');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "scope"');
    expect(sql).toContain("THEN 'global' ELSE 'scoped'");
    expect(sql).toContain('UQ_role_name_case_insensitive');
    expect(sql).toContain('RAISE EXCEPTION');
    expect(sql).toContain('DELETE FROM "roles_permissions_role"');
    expect(sql).toContain('r."moduleId" IS NULL');
    expect(sql).toContain('specific_deny');
  });

  it('drops only the indexes introduced by this migration', async () => {
    const statements: string[] = [];
    const runner = {
      query: jest.fn(async (sql: string) => { statements.push(sql); return []; }),
    } as unknown as QueryRunner;
    await new AddAuthorizationRoleIdentityConstraints1794500000000().down(runner);
    const sql = statements.join('\n');
    expect(sql).toContain('DROP INDEX IF EXISTS "UQ_role_core_role_key"');
    expect(sql).not.toContain('DROP INDEX IF EXISTS "UQ_role_module_role_key"');
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
  });
});
