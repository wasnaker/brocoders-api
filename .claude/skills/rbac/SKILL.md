---
name: rbac
description: Manage role-based access control (RBAC) with permissions in this NestJS/PostgreSQL boilerplate.
---

# RBAC (Role-Based Access Control)

This project uses a role-permission model:

- **Role** (id, name) — assigned to user via `user.roleId`.
- **Permission** (id, name, description) — assigned to role via many-to-many `roles_permissions_role`.
- **Guard** (`RolesGuard`) — checks `request.user.role.id` against the decorator.

## Key files

| File                                                                                  | Purpose                    |
| ------------------------------------------------------------------------------------- | -------------------------- |
| `src/roles/roles.enum.ts`                                                             | Enum: `admin=1`, `user=2`  |
| `src/roles/roles.decorator.ts`                                                        | `@Roles(RoleEnum.admin)`   |
| `src/roles/roles.guard.ts`                                                            | Guard checking role ID     |
| `src/permissions/permissions.module.ts`                                               | Permissions module         |
| `src/permissions/permissions.controller.ts`                                           | CRUD `/api/v1/permissions` |
| `src/permissions/permissions.service.ts`                                              | Business logic             |
| `src/permissions/infrastructure/persistence/relational/entities/permission.entity.ts` | TypeORM entity             |
| `src/database/migrations/1715028537218-CreatePermission.ts`                           | PostgreSQL migration       |

## Protect a route with a role

```ts
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';

@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Get()
findAll() { /* ... */ }
```

## Add a permission

Apply migrations, then create the permission through the API:

```bash
npm run migration:run
```

```http
POST /api/v1/permissions
Content-Type: application/json

{ "name": "create:post", "description": "Create posts" }
```

## Assign a permission to a role

Use the role service or the PostgreSQL join table:

```sql
INSERT INTO roles_permissions_role ("permissionId", "roleId") VALUES (1, 1);
```

Permissions CRUD is admin-only and should use `@Roles(RoleEnum.admin)`.
