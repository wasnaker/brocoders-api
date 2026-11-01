# Project instructions

This NestJS API uses **PostgreSQL only**, with TypeORM. Do not add MySQL, MongoDB, Mongoose, document persistence adapters, or database-selection branches.

## Entities and properties

Use the `generate` skill ( [.claude/skills/generate/SKILL.md](.claude/skills/generate/SKILL.md) ) for resource and property generation. The only supported commands are `npm run generate:resource:relational` and `npm run add:property:to-relational`.

## Read-only aggregate endpoints

Untuk angka statistik (KPI dashboard, dsb) jangan tambah field `total` ke `InfinityPaginationResponseDto` — DTO itu dipakai SEMUA response list, jadi perubahannya merambat ke seluruh tipe frontend dan test generator.

Buat endpoint agregat terpisah yang read-only, dengan module sendiri yang meng-import modul pemilik data:

- `src/stats/` — `GET /api/v1/stats/summary` → `{ totalUsers, newUsers7d, totalRoles }`.
- `StatsModule` meng-import `UsersModule` (untuk `UserRepository`) dan `RolesModule` (untuk `RolesService`). Tidak ada entity/DTO persistence baru.

Count berasal dari repository, bukan query di service:

- Tambah method ke abstract `UserRepository` dan implementasikan di `UsersRelationalRepository` menggunakan TypeORM `count()`.
- TypeORM `count()` memakai `withDeleted: false` sehingga user soft-deleted otomatis tidak ikut dihitung, konsisten dengan `findManyWithPagination`.

## Broadcast (System Banner)

- `src/broadcast/` — `GET/POST/DELETE /api/v1/broadcast`. `GET` hanya `AuthGuard('jwt')` (semua user terautentikasi), `POST`/`DELETE` tambah `RolesGuard(admin)`. Guard tidak bisa di level class karena dua METHOD itu butuh guard berbeda — dipasang per-route.
- Disimpan sebagai baris `setting` (`key = system.broadcast`, `group = system`, `type = json`). Nol migrasi, nol entitas, nol generator.
- `version` disimpan eksplisit di dalam JSON `value`, bukan memakai `setting.updatedAt`.
- JSON rusak diperlakukan sebagai "tidak ada broadcast", bukan exception — endpoint ini dibaca semua user.
