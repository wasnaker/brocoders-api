# Project instructions

NestJS boilerplate supporting both relational (TypeORM/PostgreSQL) and document (Mongoose/MongoDB) persistence.

## When adding entities, schemas, or properties

Use the `generate` skill (auto-loaded from [.claude/skills/generate/SKILL.md](.claude/skills/generate/SKILL.md)). It documents the project's CLI generators (`npm run generate:resource:*`, `npm run add:property:to-*`) which keep both database variants, DTOs, modules, and migrations in sync. Do not hand-write entity files.

## Read-only aggregate endpoints

Untuk angka statistik (KPI dashboard, dsb) jangan tambah field `total` ke
`InfinityPaginationResponseDto` — DTO itu dipakai SEMUA response list, jadi
perubahannya merambat ke seluruh tipe frontend dan test generator.

Buat endpoint agregat terpisah yang read-only, dengan module sendiri yang
meng-import modul pemilik data:

- `src/stats/` — `GET /api/v1/stats/summary` → `{ totalUsers, newUsers7d, totalRoles }`.
  `StatsModule` meng-import `UsersModule` (untuk `UserRepository`) dan
  `RolesModule` (untuk `RolesService`). Tidak ada entity/DTO persistence baru.

Count berasal dari repository, bukan query di service:

- Tambah method ke abstract `UserRepository` (`countAll`, `countCreatedSince`)
  **dan wajib isi di kedua implementasi**: `UsersRelationalRepository` (TypeORM
  `count()`) dan `UsersDocumentRepository` (Mongoose `countDocuments()`).
  Abstract class = injection token, jadi hanya mengisi satu sisi akan
  menggagalkan compile.
- TypeORM `count()` memakai `withDeleted: false` sehingga user soft-deleted
  otomatis tidak ikut dihitung, konsisten dengan `findManyWithPagination`.
  Di mode document `remove()` memakai `deleteOne` (hard delete), jadi angka
  total kedua mode bisa berbeda — itu perilaku boilerplate yang sudah ada.
