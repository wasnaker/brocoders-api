import type { QueryRunner } from 'typeorm';
import { CreateAuthorizationCoreGrants1794400000000 } from './1794400000000-CreateAuthorizationCoreGrants';

describe('CreateAuthorizationCoreGrants1794400000000', () => {
  it('should use a valid PostgreSQL dollar-quoted block for the destructive rollback guard', async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: (sql: string) => {
        queries.push(sql);
        return Promise.resolve([]);
      },
    } as unknown as QueryRunner;

    await new CreateAuthorizationCoreGrants1794400000000().down(queryRunner);

    const rollbackGuard = queries[0].trim();
    expect(rollbackGuard.startsWith('DO $$')).toBe(true);
    expect(rollbackGuard.endsWith('$$;')).toBe(true);
    expect(rollbackGuard).toContain('admin_manual');
    expect(rollbackGuard).toContain('administrator deny overrides exist');
    expect(rollbackGuard).toContain('audit history exists');
  });
});
