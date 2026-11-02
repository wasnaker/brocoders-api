# Backend module runtime

## Package contract

Install module packages from immutable Git commit SHAs. A package may expose
`api`, `web`, or both. API packages expose a NestJS module at
`<package>/api`, a named `moduleManifest` at `<package>/api/manifest`, and
TypeORM migrations at `<package>/api/migrations`.

The module package owns implementation, entities, repositories, DTOs, seed data
and migration classes. The host owns the PostgreSQL DataSource, JWT strategy,
authorization persistence, module registration and execution lifecycle.

## Backend manifest discovery

Run:

```bash
npm run modules:generate:backend-registry
```

The generator inspects installed `@wasnaker/module-*` dependencies and imports
only packages exposing an API manifest. Web-only packages are ignored. The
generated registry is consumed by `ModulePermissionSeedService`.

The registry is regenerated automatically before production builds, development
startup and the relational seed command. Add a module package dependency and
register its NestJS module in `AppModule`; its permission definitions are then
discovered without editing the permission seeder.

## Authorization

Modules declare action permissions in their backend manifest. The host's
`ModuleAuthorizationService` resolves the user's role against PostgreSQL role
permissions. A module receives this service through its asynchronous registration
contract and enforces permissions at its controller boundary. The module does
not assume role IDs or own host role tables.

## PostgreSQL lifecycle

The host's TypeORM DataSource explicitly includes each installed module's
migration class. Migration execution is separate from package installation.
Seed data is executed only by the host's explicit seed runner and must be
idempotent. Never run migrations or seeds implicitly while importing a module.
