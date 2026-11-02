# Backend module runtime

## Universal package contract

Install module packages from immutable Git commit SHAs. A package may expose
`api`, `web`, or both. Backend-capable packages expose a named
`moduleDefinition` from `<package>/api/definition`. The definition contains
the module manifest, an asynchronous NestJS registration function, entity
classes, migration classes and seed service classes. A module without entities,
migrations or seeds exports an empty array for that capability.

The module package owns implementation, entities, repositories, DTOs, seed data
and migration classes. The host owns the PostgreSQL DataSource, JWT strategy,
authorization persistence, migration execution and seed lifecycle.

## Automatic discovery

Run `npm run modules:generate:backend-registry`. The generator inspects installed
`@wasnaker/module-*` dependencies, skips web-only packages, and requires every
API-capable package to expose the universal `api/definition` contract. It
generates one registry for module definitions, permissions, NestJS registration,
entities, migrations and seed providers.

The registry is regenerated before production builds, development startup,
relational seed execution and TypeORM CLI commands. Installing a backend-capable
module package is sufficient for the host to discover its API module, entities,
migrations, permissions and seed services. No package-specific host imports or
manual entity/migration/seed lists should be added.

## Authorization

Each module declares action permissions in its backend manifest and receives
the host authorization adapter through `registerAsync()`. The host's
`ModuleAuthorizationService` resolves the authenticated role against the
PostgreSQL role-permission relation. Modules must not assume a fixed host role
ID or own the host's roles and permissions tables.

## PostgreSQL lifecycle

The host uses one PostgreSQL DataSource and collects entity/migration classes
from the generated registry in both NestJS runtime TypeORM configuration and
the standalone TypeORM CLI DataSource. Migration execution is an explicit
deployment operation. Never run migrations implicitly during package install
or application startup.

Module seed services are discovered from the same definitions and executed only
by the host's explicit relational seed runner. Every seed must be idempotent.
Core and module permission definitions are seeded before new permissions are
appended to the default admin role; existing role assignments are preserved.
