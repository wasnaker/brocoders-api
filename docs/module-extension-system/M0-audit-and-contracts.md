# Brocoders Module Extension System
## M0 — Audit findings and target contracts

**Status:** Architecture baseline  
**Scope:** `brocoders-api`, `brocoders-react-web`, `bc-customer`, `bc-equipment`  
**Decision:** Preserve NestJS, React, TypeScript, PostgreSQL, and independent module packages. Extend the existing runtime; do not replace it.

## 1. Executive summary

The repositories already contain meaningful modular foundations:

- Backend modules are installed as `@wasnaker/module-*` packages and expose an API definition, manifest, entities, migrations, and seed services.
- The backend registry is generated from installed package dependencies.
- Frontend modules are package-owned and expose a manifest. The host generates a registry and locale registry from installed dependencies.
- The frontend already resolves module pages, sidebar menus, profile/settings tabs, and dashboard widgets.
- The host owns PostgreSQL, authentication, authorization persistence, and migration execution.
- Module manifests can declare hard dependencies.

These foundations should be retained. The current architecture is **package-discovered and manifest-driven**, but it is not yet a complete runtime extension system.

## 2. M0 audit findings

| Capability | Current evidence | Finding |
|---|---|---|
| Independent backend packages | `docs/module-runtime.md`, generated backend registry, package API definitions | Implemented foundation |
| Independent frontend packages | `docs/module-packages.md`, generated frontend registry | Implemented foundation |
| Backend action/filter hooks | No generic hook dispatcher or registration API found in the audited backend runtime | Missing |
| Entity lifecycle events | No shared before/after insert, update, delete dispatcher found | Missing |
| Post-commit delivery | No shared transaction-aware event publisher or outbox found | Missing |
| Frontend menu extension | `ModuleManifest.menu` and `resolve-menu.ts` | Implemented for sidebar only |
| Frontend page extension | `ModuleManifest.pages`, `getModulePage()` and catch-all route adapters | Implemented |
| Profile/settings tabs | `profileTabs`, `settingsTabs`, `resolve-tabs.ts` | Implemented |
| Dashboard widgets | `dashboardWidgets`, `resolve-widgets.ts` | Implemented |
| Generic action/form/table/detail slots | No universal slot registry or typed contribution contract found | Missing |
| Cross-module service contract | Backend `requires` metadata exists; Customer currently receives a host-built account adapter and has a Region-specific validation service | Partial; no general service registry |
| Cross-module events | No generic event subscription contract found | Missing |
| Dependency validation | Backend registry generator validates hard dependencies and orders seed services; frontend generator currently discovers package dependencies but does not validate a shared dependency graph | Partial |
| Install/discovery | Package install plus generated static registries | Implemented at build/install time |
| Runtime activate/deactivate | No persisted activation state or runtime contribution teardown found | Missing |
| Uninstall cleanup | npm dependency removal and registry regeneration only; no module-owned data policy/lifecycle hooks | Partial |
| Migration lifecycle | Host owns explicit PostgreSQL migration execution; no automatic install-time migration | Good safety boundary; module lifecycle integration still needed |
| AI developer contract | Separate docs exist, but no single complete extension API/testing contract | Partial |

### Specific architectural inconsistencies to address

1. `brocoders-api/src/config/modules.config.ts` describes itself as a static list and instructs maintainers to synchronize it manually with the frontend. This is a legacy parallel registry and must not become the source of truth for the new extension runtime.
2. Backend API module definitions are generated from package dependencies, but the generated registry is static at build time. That is acceptable and desirable for deterministic builds; it is not runtime filesystem discovery.
3. Frontend manifests currently support pages, menu, profile tabs, settings tabs, and dashboard widgets. They do not yet provide generic action, form-field, table-column/filter, or detail-panel extension slots.
4. `resolve-menu.ts` contains a temporary debug log. Remove it as a cleanup task when the frontend extension work is touched.
5. The backend Customer module provisions a user through a host-provided adapter. This is a useful existing cross-boundary pattern, but it is not a general-purpose service contract and its compensation logic is not a substitute for a shared transactional workflow.
6. Customer declares `requires: ['region']`; Equipment currently has no equivalent dependency metadata. Dependency semantics must be standardized across API and web manifests.
7. Frontend package installation still changes the host dependency metadata and lockfile and runs registry generation. The target means **no package-specific source-code edits in either Core repository**; dependency metadata and deployment/build artifacts remain expected installation operations.

## 3. Target architecture

The system is split into six cooperating runtime capabilities:

1. **Module Registry** — immutable module identity, version, capabilities, dependencies, and lifecycle state.
2. **Backend Extension Runtime** — module-scoped action/filter hooks, typed service contracts, and event subscriptions.
3. **Entity Lifecycle** — generic entity events with transaction-aware publication.
4. **Frontend Extension Registry** — typed slots for navigation, pages, tabs, actions, widgets, forms, tables, and detail panels.
5. **Module Lifecycle Manager** — install/discover, register, activate, deactivate, upgrade, and uninstall orchestration.
6. **Developer Contract** — manifest schemas, API contracts, examples, validation, and integration-test conventions.

Core owns the extension mechanisms and host adapters. A module owns its declarations, handlers, UI components, services, migrations, and data policy. Core must not contain module-name conditionals.

## 4. Backend hooks contract

The public API should be injectable and module-scoped:

```ts
interface HookRegistration {
  moduleId: string;
  hook: string;
  handler: (value: unknown, context: HookContext) => unknown | Promise<unknown>;
  priority?: number; // default 10; lower runs first
}

interface HookContext {
  moduleId: string;
  correlationId: string;
  signal?: AbortSignal;
}

interface HookRegistry {
  addAction(name: string, handler: ActionHandler, options?: HookOptions): Unregister;
  addFilter<T>(name: string, handler: FilterHandler<T>, options?: HookOptions): Unregister;
  doAction(name: string, payload: unknown, context?: HookContext): Promise<void>;
  applyFilters<T>(name: string, value: T, context?: HookContext): Promise<T>;
  unregisterModule(moduleId: string): void;
}
```

Normative behavior:

- Registration requires a stable module ID and a non-empty namespaced hook name.
- Lower numeric priority executes first; equal priorities preserve registration order.
- Actions execute sequentially and await asynchronous handlers.
- Filters execute sequentially; each handler receives the previous handler's output.
- A filter must return the next value. Returning `undefined` is a contract violation, not an implicit no-op.
- A handler may be registered only once per module + hook + stable registration key; repeated module bootstrap must be idempotent.
- Unregister closures remove only their own registration. `unregisterModule` removes all registrations owned by a module.
- Errors are never silently swallowed. Default behavior is fail-fast for filters and aggregate/report errors for actions while allowing remaining action handlers to run. Callers may choose a documented error policy for non-critical notifications.
- Hooks are in-process extension points, not a durable message broker. Durable cross-process work uses the outbox/event delivery layer.
- Payloads and context are versioned contracts. Breaking payload changes require a versioned event/hook name or an explicit compatibility window.

## 5. Entity lifecycle and event contract

Use a stable envelope rather than exposing ORM entities:

```ts
interface EntityEvent<T> {
  eventId: string;
  eventName: string;       // e.g. customer.branch.created
  entity: { module: string; type: string; id: string | number };
  operation: 'insert' | 'update' | 'delete';
  occurredAt: string;      // ISO-8601 UTC
  actorUserId?: string | number | null;
  correlationId: string;
  schemaVersion: 1;
  data: T;                  // explicit DTO/snapshot, never an ORM instance
}
```

Lifecycle phases:

- `entity.beforeInsert`, `entity.afterInsert`
- `entity.beforeUpdate`, `entity.afterUpdate`
- `entity.beforeDelete`, `entity.afterDelete`

Specific domain events follow `<module>.<entity>.<created|updated|deleted>`, for example `customer.branch.created`.

Transaction rules:

- Before-events/filters execute inside the application operation before persistence. A rejected before-hook aborts the operation.
- The database write and outbox insert occur in the **same PostgreSQL transaction**.
- After-events that are explicitly in-process may run after commit, but are not durable by themselves.
- Durable subscribers consume outbox records asynchronously and idempotently. Delivery is at-least-once; consumers must deduplicate by `eventId`.
- Never publish a durable `afterInsert` event before commit.
- Do not pass live TypeORM entities, repositories, managers, or mutable request objects across module boundaries.
- Delete events carry a pre-delete snapshot sufficient for subscribers; do not require a deleted row to be queried later.

## 6. Frontend extension contract

Keep `ModuleManifest` and add a typed, namespaced slot registry. A contribution has:

```ts
interface ExtensionContribution<T> {
  id: string;                 // unique within the slot
  moduleId: string;            // inferred from owning manifest at registration
  priority?: number;
  permission?: string;
  enabled?: boolean;
  value: T;
}
```

Initial slot families:

| Slot | Contribution | Host responsibility |
|---|---|---|
| `navigation.sidebar` | Menu item/tree | Render, sort, permission-filter |
| `route.admin` | Canonical page | Resolve route and shared auth boundary |
| `customer.detail.tabs` | Tab component | Render tab and permission-filter |
| `customer.detail.actions` | Action descriptor/component | Render action; module owns behavior |
| `customer.detail.panels` | Detail panel component | Place panel in defined layout |
| `customer.form.fields` | Typed field contribution | Merge fields and validate conflicts |
| `customer.table.columns` | Column contribution | Merge columns deterministically |
| `customer.table.filters` | Filter contribution | Merge filters and preserve query semantics |
| `dashboard.widgets` | Widget component | Layout, visibility, permission-filter |

The slot name is an explicit host-owned integration contract. A module may contribute to a known slot without the target module importing it. Slots must define their context props, rendering lifecycle, permission semantics, ordering, error boundary, and compatibility version.

Do not allow arbitrary global DOM injection or untyped React nodes. Prefer typed React component contracts with narrow, read-only context.

## 7. Cross-module service contract

Use explicit public capabilities rather than importing another module's internal services:

- A module declares hard dependencies by stable module ID and compatible version range.
- A provider publishes named, versioned service tokens/capabilities.
- A consumer declares the required capability and receives a typed interface through NestJS dependency injection.
- The registry validates missing dependencies, version incompatibility, and dependency cycles before activation.
- A module must not import another module's private repository, entity, controller, or service implementation.
- For simple domain facts, prefer a published API/service contract; for decoupled reactions, prefer events.
- Cross-module calls must preserve authorization context and must not bypass the owning module's authorization checks.

## 8. Module lifecycle contract

Lifecycle state is persisted centrally in PostgreSQL and is separate from package installation:

`discovered → installed → registered → active → inactive → uninstalled`

Upgrade is a controlled transition from an installed version to a new version.

- **Discover:** validate package identity, manifest schema, capabilities, and dependencies.
- **Install:** record package/version and ownership metadata; do not execute arbitrary package scripts as a database lifecycle.
- **Register:** load module definitions and collect migrations, entities, services, hooks, and UI contributions.
- **Activate:** validate dependencies, execute explicit approved migrations, register runtime contributions, then mark active.
- **Deactivate:** stop new work, unregister hooks/services/UI contributions, drain or cancel owned consumers, then mark inactive.
- **Uninstall:** require inactive state, apply the module's declared data-retention policy, remove owned registrations/metadata, and never silently drop customer data.
- **Rollback:** database migrations are forward-only by default. A rollback must be an explicit, reviewed migration with a tested data-safety plan; package uninstall is not a database rollback.

Package dependency removal from the host remains a deployment operation. Runtime activation/deactivation is a separate administrative lifecycle operation.

## 9. Authorization and security boundaries

- Keep the central PostgreSQL-backed Authorization Core as the source of truth.
- Module manifests may declare permissions and module-owned default roles; the Core owns role records, role assignments, permission registry, and enforcement adapters.
- Extension visibility checks in React are convenience only. Every backend operation re-authorizes the actor and resource scope.
- A module cannot grant itself permissions at runtime or bypass the central authorization service.
- Module IDs, hook names, service tokens, slot IDs, and event names are validated and ownership-scoped.
- Treat module packages as trusted application code. The registry is not a sandbox; package provenance, immutable refs, review, and deployment controls remain required.

## 10. Milestones and commit boundaries

| Milestone | Scope | Expected commit groups |
|---|---|---|
| M0 | Audit and contracts | This architecture baseline; no runtime behavior change |
| M1 | Backend hooks + entity events | Hook registry; lifecycle integration; PostgreSQL outbox; unit/integration tests |
| M2 | Frontend extension system | Slot types/registry/resolvers; adapters for existing menu/pages/tabs/widgets; new slots; renderer tests |
| M3 | Cross-module integration | Service capability registry; dependency validation; customer/equipment integration example |
| M4 | Module lifecycle | PostgreSQL lifecycle metadata; activation/deactivation; safe migration and uninstall policy |
| M5 | Integration testing | Customer + Equipment acceptance suite; package install smoke test; developer guide and templates |

Each commit should be independently buildable where practical. Do not start M1 implementation until the M0 contract is reviewed against the existing repository behavior and TypeORM transaction boundaries.

## 11. Acceptance scenarios

The implementation is complete only when automated tests demonstrate:

1. Equipment adds a sidebar entry without a Core source-code change.
2. Equipment contributes a tab and action to Customer detail without changing Customer.
3. Customer create/update/delete operations emit correctly ordered lifecycle events.
4. A subscriber receives only committed events; a failed transaction emits no durable event.
5. An event subscriber can call a published user/account service capability without importing User module internals.
6. A deactivated module has no active hooks, event subscriptions, routes, menus, or slot contributions.
7. Reactivating the module restores contributions exactly once.
8. Uninstall removes active registrations and metadata while honoring the data-retention policy.
9. Installing Equipment changes package metadata/lockfile and generated build artifacts only; it requires no module-specific Core source edit.
10. All tests run against PostgreSQL for persistence/transaction behavior; mocks alone are insufficient for outbox guarantees.

## 12. M0 exit criteria

- [x] Existing module foundations inspected in both Core repositories.
- [x] Customer and Equipment manifests inspected as real module examples.
- [x] Missing versus existing capabilities recorded.
- [x] Target API and transaction/lifecycle boundaries documented.
- [ ] Contract review and sign-off before M1 implementation.
