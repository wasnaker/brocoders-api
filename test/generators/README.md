# PostgreSQL generator e2e tests

End-to-end tests for the TypeORM/PostgreSQL Hygen generators.

## Coverage

- Primitive, reference, and denormalized properties.
- Primitive types: string, number, boolean, and Date.
- Relations: one-to-one, one-to-many, many-to-one, and many-to-many.
- DTO inclusion, optionality, and nullability permutations.

## Run locally

Static generator, lint, build, and file assertion checks:

```bash
npm run test:generators:relational
```

PostgreSQL CRUD tests (Docker Compose v2 required):

```bash
npm run test:e2e:generators:relational:docker
```

The test runner requires a clean tracked working tree because it temporarily generates source files and restores them during cleanup. PostgreSQL is the only supported database variant.
