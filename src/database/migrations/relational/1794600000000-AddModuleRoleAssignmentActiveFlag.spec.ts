import { QueryRunner } from 'typeorm';
import { AddModuleRoleAssignmentActiveFlag1794600000000 } from './1794600000000-AddModuleRoleAssignmentActiveFlag';

describe('AddModuleRoleAssignmentActiveFlag1794600000000', () => {
  it('adds a backward-compatible active flag for existing assignments', async () => {
    const statements: string[] = [];
    const runner = {
      query: jest.fn(async (sql: string) => { statements.push(sql); return []; }),
    } as unknown as QueryRunner;
    await new AddModuleRoleAssignmentActiveFlag1794600000000().up(runner);
    expect(statements.join('\n')).toContain(
      'ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true',
    );
  });

  it('drops only the assignment flag on rollback', async () => {
    const statements: string[] = [];
    const runner = {
      query: jest.fn(async (sql: string) => { statements.push(sql); return []; }),
    } as unknown as QueryRunner;
    await new AddModuleRoleAssignmentActiveFlag1794600000000().down(runner);
    expect(statements.join('\n')).toContain('DROP COLUMN IF EXISTS "isActive"');
    expect(statements.join('\n')).not.toMatch(/DROP\s+TABLE/i);
  });
});
