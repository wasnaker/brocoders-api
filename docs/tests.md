# Tests

## Unit tests

```bash
npm run test
```

## E2E tests

```bash
npm run test:e2e
```

## PostgreSQL Docker tests

Run the API e2e suite with PostgreSQL:

```bash
npm run test:e2e:relational:docker
```

Run the TypeORM generator CRUD suite with PostgreSQL:

```bash
npm run test:e2e:generators:relational:docker
```

The repository has one database test target: PostgreSQL.

---

Previous: [File uploading](file-uploading.md)

Next: [Benchmarking](benchmarking.md)
