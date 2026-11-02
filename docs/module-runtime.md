# Backend module runtime

## Package contract

Install module packages from immutable Git commit SHAs. A package may expose
`api`, `web`, or both. API packages expose a NestJS module at
`<package>/api`, a named `moduleManifest` at `<package>/api/manifest`,
and optionally the standard named exports `moduleEntities` and
`moduleMigrations` at `<package>/api/entities` and
`<package>/api/migrations`. Export empty arrays when a module does not own
entities or migrations.

The module package owns implementation, entities, repositories, DTOs, seed data
and migration classes. The host owns the PostgreSQL DataSource, JWT strategy,
authorization persistence, module registration and execution lifecycle.

## Generated registry

Run `npm run modules:generate:backend-registry`. The generator inspects installed
`@wasnaker/module-*` dependencies and imports API manifests plus any exported
entity and migration arrays. Web-only packages are ignored. The generated
registry is consumed by runtime TypeORM configuration, the CLI DataSource and
the module permission seeder. Do not hand-edit the generated registry.

The registry is regenerated before production builds, development startup,
relational seed execution, and TypeORM CLI commands. Installing a module package
and registering its NestJS module is the only host integration required for
module entities and migrations to join the shared PostgreSQL lifecycle.

## Authorization

Modules declare action permissions in their backend manifest. The host's
`ModuleAuthorizationService` resolves the user's role against PostgreSQL role
permissions. A module receives this service through its asynchronous registration
contract and enforces permissions at its controller boundary. The module does
not assume role IDs or own host role tables.

## PostgreSQL lifecycle

The host's TypeORM DataSource explicitly includes each installed module's
migration classes. Migration execution is separate from package installation.
Seed data is executed only by the host's explicit seed runner and must be
idempotent. Never run migrations or seeds implicitly while importing a module.
