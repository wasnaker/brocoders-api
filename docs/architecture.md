# Architecture

---

## Table of Contents

- [Hexagonal Architecture](#hexagonal-architecture)
- [Motivation](#motivation)
- [Description of the module structure](#description-of-the-module-structure)
- [Recommendations](#recommendations)
- [FAQ](#faq)

## Hexagonal Architecture

NestJS Boilerplate is based on [Hexagonal Architecture](<https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)>), also known as Ports and Adapters.

![Hexagonal Architecture Diagram](https://github.com/brocoders/nestjs-boilerplate/assets/6001723/6a6a763e-d1c9-43cc-910a-617cda3a71db)

## Motivation

Hexagonal Architecture separates business logic from infrastructure. In this repository, persistence is implemented with PostgreSQL and TypeORM. The port/adapter boundary keeps business services independent of TypeORM repository details without implying support for other database engines.

## Module structure

```txt
.
├── domain
│   └── [DOMAIN_ENTITY].ts
├── dto
│   ├── create.dto.ts
│   ├── find-all.dto.ts
│   └── update.dto.ts
├── infrastructure
│   └── persistence
│       ├── relational
│       │   ├── entities
│       │   │   └── [ENTITY].entity.ts
│       │   ├── mappers
│       │   │   └── [MAPPER].ts
│       │   ├── relational-persistence.module.ts
│       │   └── repositories
│       │       └── [ADAPTER].repository.ts
│       └── [PORT].repository.ts
├── controller.ts
├── module.ts
└── service.ts
```

- `[DOMAIN_ENTITY].ts` is used by business logic and has no database dependency.
- `[ENTITY].entity.ts` defines the PostgreSQL table structure through TypeORM.
- `[MAPPER].ts` converts between TypeORM entities and domain objects.
- `[PORT].repository.ts` defines the persistence operations used by business logic.
- `[ADAPTER].repository.ts` implements that port using TypeORM.

The `infrastructure` folder contains infrastructure-specific components such as persistence, uploaders, and senders. Ports define the operations; adapters implement them.

## Recommendations

Avoid universal repository methods that are difficult to extend. Prefer methods with a single responsibility.

```ts
export class UsersRelationalRepository implements UserRepository {
  async findByEmail(email: string): Promise<User> {
    // ...
  }

  async findByRoles(roles: string[]): Promise<User> {
    // ...
  }

  async findByIds(ids: number[]): Promise<User> {
    // ...
  }
}
```

## FAQ

### Can I generate a new resource with Hexagonal Architecture?

Yes. Use the PostgreSQL/TypeORM [CLI generators](cli.md).

---

Previous: [Installing and Running](installing-and-running.md)

Next: [Command Line Interface](cli.md)
