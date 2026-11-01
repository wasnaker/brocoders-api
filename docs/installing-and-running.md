# Installation and running

This project uses **PostgreSQL as its only database**, with TypeORM migrations and seeds.

## Comfortable local development

1. Clone the repository:

   ```bash
   git clone --depth 1 https://github.com/wasnaker/brocoders-api.git my-app
   cd my-app
   ```

2. Copy the PostgreSQL environment example:

   ```bash
   cp env-example-relational .env
   ```

3. For services running on your host machine, set `DATABASE_HOST=localhost` and `MAIL_HOST=localhost`. When the API runs in Docker Compose, use the service names `postgres` and `maildev`.

4. Start PostgreSQL, Adminer, and Maildev:

   ```bash
   docker compose up -d postgres adminer maildev
   ```

5. Install dependencies:

   ```bash
   npm ci
   ```

6. Run the one-time project setup if initializing an application from this boilerplate. Contributors should skip this step:

   ```bash
   npm run app:config
   ```

7. Apply migrations and seed data:

   ```bash
   npm run migration:run
   npm run seed:run:relational
   ```

8. Start the API:

   ```bash
   npm run start:dev
   ```

Open <http://localhost:3001>. Swagger is available at <http://localhost:3001/docs>.

## Quick Docker run

Copy the PostgreSQL environment file and start all default services:

```bash
cp env-example-relational .env
docker compose up -d
docker compose logs
```

The API is available at <http://localhost:3001>; Adminer is at <http://localhost:8080>; Maildev is at <http://localhost:1080>.

## Database rule

The application, migrations, seeds, generators, Docker setup, and CI all use PostgreSQL. Database selection is not part of `app:config`; do not add MySQL or MongoDB/Mongoose alternatives.

Previous: [Introduction](introduction.md)

Next: [Architecture](architecture.md)
