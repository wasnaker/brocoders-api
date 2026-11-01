# Command Line Interface (CLI)

The resource and property generators target the project's single persistence implementation: PostgreSQL with TypeORM.

## Generate a resource

```bash
npm run generate:resource:relational -- --name Category
```

Replace `Category` with a singular PascalCase resource name.

## Add a property

```bash
npm run add:property:to-relational -- \
  --name Category \
  --property description \
  --kind primitive \
  --type string \
  --isAddToDto true \
  --isOptional true \
  --isNullable true
```

Supported property kinds:

- `primitive`: `string`, `number`, `boolean`, or `Date`.
- `reference`: relation to another entity (`oneToOne`, `oneToMany`, `manyToOne`, or `manyToMany`).
- `denormalized`: embedded copy of another entity's data.

Only pass `--referenceType` for reference or denormalized properties. Pass `--propertyInReference` only for `oneToMany`. The `--isAddToDto`, `--isOptional`, and `--isNullable` flags control request DTO behavior.

The generator suite is tested against PostgreSQL:

```bash
npm run test:generators:relational
npm run test:e2e:generators:relational:docker
```

Previous: [Architecture](architecture.md)

Next: [Database](database.md)
