---
name: rbac
description: Manage role-based access control (RBAC) with permissions in this NestJS boilerplate. Use when adding permissions, assigning permissions to roles, checking user permissions, or implementing permission-based authorization.
---

# RBAC (Role-Based Access Control)

This project uses a **role-permission** model:
- **Role** (id, name) — assigned to user via `user.roleId`
- **Permission** (id, name, description) — assigned to role via many-to-many `roles_permissions_role`
- **Guard** (`RolesGuard`) — checks `request.user.role.id` against decorator

## Architecture

```
User (1)───(*) Role (1)───(*) Permission
                ↑
          RolesGuard checks role.id
```

## Key Files

| File | Purpose |
|------|---------|
| `src/roles/roles.enum.ts` | Enum: `admin=1`, `user=2` |
| `src/roles/roles.decorator.ts` | `@Roles(RoleEnum.admin)` |
| `src/roles/roles.guard.ts` | `RolesGuard` — checks role ID |
| `src/permissions/permissions.module.ts` | Permissions module |
| `src/permissions/permissions.controller.ts` | CRUD `/api/v1/permissions` |
| `src/permissions/permissions.service.ts` | Business logic |
| `src/permissions/infrastructure/persistence/relational/entities/permission.entity.ts` | TypeORM entity |
| `src/permissions/infrastructure/persistence/document/entities/permission.schema.ts` | Mongoose schema |
| `src/database/migrations/1715028537218-CreatePermission.ts` | Migration |

## Usage

### Protect a route with role

```ts
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';

@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Get()
findAll() { ... }
```

### Add a permission

```bash
npm run migration:run
# Then via API:
POST /api/v1/permissions { "name": "create:post", "description": "..." }
```

### Assign permission to role

Update the role entity directly or via SQL:
```sql
INSERT INTO roles_permissions_role (permissionId, roleId) VALUES (1, 1);
```

### Check permission in service

```ts
const role = await this.roleRepository.findOne({ where: { id: userId }, relations: ['permissions'] });
const hasPermission = role.permissions.some(p => p.name === 'create:user');
```

## Constraints

- **Never generate `User` or `File` entities** — they already exist
- **Never add `id`, `createdAt`, `updatedAt`** — predefined
- Use `npm run generate:resource:*` and `npm run add:property:to-*` for new entities
- Permissions are **admin-only** CRUD (`@Roles(RoleEnum.admin)`)
