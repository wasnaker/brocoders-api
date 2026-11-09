import { ModuleAuthorizationReconciliationService } from './module-authorization-reconciliation.service';

describe('ModuleAuthorizationReconciliationService validation', () => {
  it('validate-only inspects installed manifests without opening a transaction', () => {
    const dataSource = { transaction: jest.fn() };
    const service = new ModuleAuthorizationReconciliationService(dataSource as never);
    const result = service.validateOnly();
    expect(result).toEqual(expect.objectContaining({ valid: true, errors: [] }));
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('reports an unknown module without writing synchronization state', () => {
    const dataSource = { transaction: jest.fn() };
    const service = new ModuleAuthorizationReconciliationService(dataSource as never);
    const result = service.validateOnly('unknown-module');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toBe('Unknown backend module');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
