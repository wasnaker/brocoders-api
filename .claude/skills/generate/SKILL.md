---
name: generate
description: Generate TypeORM/PostgreSQL resources and properties with this project's CLI generators.
---

# Generate PostgreSQL Entities and Properties

## Database

This repository has one database implementation: PostgreSQL with TypeORM. Do not inspect or select a database variant, and do not generate Mongoose schemas or document persistence code.

## Add an entity

**Rules:**

- Never generate `User` or `File` entities — they already exist. They can be referenced in relationships.
- Entity names must be PascalCase and singular (e.g. `Post`, `Category`, `BlogComment`).

**Command:**

```bash
npm run generate:resource:relational -- --name {EntityName}
```

Run sequentially, one entity at a time.

## Add a property

**Rules:**

- Never add `id`, `createdAt`, or `updatedAt`; these are predefined.
- Property names must be camelCase.
- For a `oneToMany` relation, do not create the matching `manyToOne` manually; the generator creates it.
- `propertyInReference` is required only for `oneToMany`.
- File relations support `oneToOne` or `manyToMany`.

**Command:**

```bash
npm run add:property:to-relational -- --name {EntityName} --property {propertyName} --kind {kind} --type {type} --referenceType {referenceType} --propertyInReference {propertyInReference} --isAddToDto {isAddToDto} --isOptional {isOptional} --isNullable {isNullable} --shouldAutoLoad {shouldAutoLoad}
```

**Arguments:**

- `--kind`: `primitive` | `reference` | `denormalized`
- Primitive `--type`: `string` | `number` | `boolean` | `Date`
- Reference/denormalized `--type`: referenced entity name (e.g. `User`, `File`, `Category`)
- `--referenceType`: `oneToOne` | `oneToMany` | `manyToOne` | `manyToMany`
- `--isAddToDto`, `--isOptional`, `--isNullable`: `true` | `false`
- `--shouldAutoLoad`: `true` (default) | `false`; only applies to relations.

Omit arguments that do not apply. Run sequentially, one property at a time.
