# Database

This project uses **PostgreSQL only**, through TypeORM. There is no MongoDB/Mongoose or MySQL adapter.

## Configuration

Copy `env-example-relational` to `.env`. For local development, set `DATABASE_HOST=localhost`; inside Docker Compose, use `DATABASE_HOST=postgres`.

The TypeORM driver is fixed to PostgreSQL in application and migration configuration. `DATABASE_TYPE`, when present, must be `postgres`.

## Schema and migrations

Create entity files with the `.entity.ts` suffix under the resource's `infrastructure/persistence/relational/entities` directory.

Example:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity()
export class Post extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  body: string;
}
```

Generate, apply, and revert migrations:

```bash
npm run migration:generate -- src/database/migrations/CreatePostTable
npm run migration:run
npm run migration:revert
```

To drop the schema in a disposable development database:

```bash
npm run schema:drop
```

Never edit a migration that has already been applied to a shared or production database. Add a new forward migration instead.

## Seeds

Create a TypeORM seed:

```bash
npm run seed:create:relational -- --name Post
```

Implement its `run` method under `src/database/seeds/relational`, then run:

```bash
npm run seed:run:relational
```

## PostgreSQL performance

- Add indexes to foreign-key columns when query patterns require them; PostgreSQL does not create those indexes automatically.
- Tune `DATABASE_MAX_CONNECTIONS` for the expected application concurrency. The default is 100.
- Keep `DATABASE_SYNCHRONIZE=false` outside disposable local development; use migrations for schema changes.

---

Previous: [Command Line Interface](cli.md)

Next: [Auth](auth.md)
