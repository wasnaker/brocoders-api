# M3 — Cross-module service contracts

## Goal

A consumer module calls a provider through a versioned public facade. It must not import the provider's controllers, repositories, ORM entities, database tables, or private service implementations.

## Contract identity and compatibility

- Contract ids are provider-namespaced: `customer.branch-directory`.
- Contract versions are independent of package versions and use `major.minor.patch`.
- Consumers declare the minimum compatible version (for example `^1.2.0`; exact `1.2.0` is also accepted). Resolution requires the same major and a provided version greater than or equal to the requested version. Other range operators and prerelease versions are intentionally not accepted yet.
- Providers explicitly allow-list consumer module ids. An empty allow-list grants no access.
- Duplicate contract ids are rejected unless the registration is identical (same provider, contract version, service object, and consumer allow-list); identical registration is idempotent. Provider shutdown/deactivation calls `unregisterModule(providerModuleId)`; consumers then fail closed.
- A registration disposer can remove one registration without affecting another.

## Runtime API

`ModuleServiceRegistry.register({ providerModuleId, contractId, version, consumers, service })` publishes a public facade.

`ModuleServiceRegistry.resolve<T>(consumerModuleId, contractId, requiredVersion)` resolves it only when the consumer is allow-listed and the contract version is compatible.

The service object is the public facade. Register only DTO-oriented methods, not repositories, EntityManager instances, entities, or internal service objects.

## Example public contract

```ts
export interface BranchDirectoryContractV1 {
  findBranch(input: { branchId: string }): Promise<{
    id: string;
    customerId: string;
    name: string;
  } | null>;
}
```

A Customer provider can publish `customer.branch-directory@1.0.0` for the Equipment consumer. Equipment depends on the contract, not Customer's persistence implementation. The provider may change repositories or database schema without breaking Equipment as long as the public contract remains compatible.

## Module package injection boundary

The host exports the registry under the stable DI token
`Symbol.for('@wasnaker/module-runtime/service-registry')`. A module package can
inject that token and type it against a narrow local port, avoiding an import
of Core's `ModuleServiceRegistry` implementation class. The token exposes the
registry boundary; it does not grant access to another module unless the
provider's consumer allow-list permits it.

## Current implementation boundary

This commit adds the registry, allow-list enforcement, version compatibility checks, lifecycle cleanup, unit tests, and manifest metadata types. It is the runtime primitive, not yet automatic provider discovery: module activation must register its public facade and unregister it on deactivation. The follow-up integration will wire module lifecycle registration and add a real Customer → Equipment contract consumer. No cross-module API should be exposed by directly exporting internal repositories.
