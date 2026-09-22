Typed query helpers per domain (`people.ts`, `attendance.ts`, …). Each takes a user-scoped client and
returns rows typed from `Database`. List pages read views (`v_*`) to avoid N+1.
