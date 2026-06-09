# Staff authentication & admin (Laravel-style)

Acquisition OS uses a **staff user directory** separate from leads: `StaffUser` + `StaffRole` in Postgres, JWT sessions, and permission strings on each role (similar to Laravel Spatie / Filament gates, simplified for this app).

## Architecture

| Layer | Location | Role |
|-------|----------|------|
| Database | `StaffUser`, `StaffRole` in `apps/backend/prisma/schema.prisma` | Users, bcrypt password hashes, role permissions array |
| API auth | `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/change-password` | Issue & validate JWT |
| API admin | `GET/POST/PATCH/DELETE /api/v1/admin/users`, `.../roles` | User & role CRUD (requires staff JWT + permissions) |
| Bootstrap | `POST /api/v1/auth/bootstrap` | **Once**, when zero users exist |
| Frontend cookie | `staff_token` (HttpOnly, 7 days) | Set by `POST /api/frontend/api/auth/login` proxy |
| Frontend guard | `apps/frontend/src/middleware.ts` | Redirects unauthenticated users to `/admin/login` |
| Admin UI | `/admin`, `/admin/roles` | User management, role permission checkboxes |
| Login UI | `/admin/login` | Branded sign-in screen |

**Important:** Lead ingest (`/api/v1/ingest`, webhooks, n8n automation) does **not** use staff auth. It uses `INTERNAL_AUTOMATION_SECRET` on selected automation routes. The **dashboard** is staff-only via the cookie + middleware.

## Default roles (seeded on login)

| Key | Label | Permissions |
|-----|-------|-------------|
| `admin` | Super Admin | `*` (everything) |
| `operator` | Operator | analytics, leads read/write, bookings, follow-ups read/write |
| `viewer` | Viewer | read-only on analytics, leads, bookings, follow-ups |

Defined in `apps/backend/src/lib/staffRoles.ts`. Permission catalog UI groups in `apps/backend/src/lib/permissionCatalog.ts`.

## Environment variables

**Backend** (`apps/backend/.env`):

```env
JWT_SECRET=long_random_string_min_16_chars
INTERNAL_AUTOMATION_SECRET=与n8n共享的密钥
```

**Frontend** (`apps/frontend/.env.local`):

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

`JWT_SECRET` must be set before the API starts or login will throw.

## First admin user (bootstrap)

Only works when **no** `staff_users` rows exist.

```bash
curl -sS -X POST "http://localhost:4000/api/v1/auth/bootstrap" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@socialfunnel.agency",
    "password": "YourSecurePassword123",
    "name": "Tyrese",
    "secret": "YOUR_INTERNAL_AUTOMATION_SECRET"
  }'
```

Or use the helper script (from repo root):

```bash
INTERNAL_AUTOMATION_SECRET=your-secret \
BOOTSTRAP_EMAIL=admin@socialfunnel.agency \
BOOTSTRAP_PASSWORD=YourSecurePassword123 \
./scripts/bootstrap-staff-admin.sh
```

Response includes a `token` you can use for API calls, but normally you sign in at **`/admin/login`** in the browser.

## Day-to-day use

1. Open the dashboard → redirected to **`/admin/login`** if not signed in.
2. Sign in with staff email + password.
3. If `mustChangePassword` is true (new users created by an admin), you are sent to **`/admin/change-password`** before other pages.
4. **Administration** (`/admin`): create staff, assign roles, reset passwords.
5. **Roles & permissions** (`/admin/roles`): create custom roles, tick module permissions (admin role always `*`).
6. **Sign out** — header button or Administration page.

## Creating additional users

Use **Administration → Create staff user** (requires `admin.users`). New users get a **temporary password** and `mustChangePassword: true` until they set their own password.

## API authorization pattern

```http
Authorization: Bearer <jwt from login>
```

Admin routes chain:

1. `requireStaff` — valid JWT + active user  
2. `requireStaffPermission("admin.users")` etc.

## What is *not* protected yet

- **Per-page permission UI** — operators can still open `/admin` if they type the URL; server returns 403 on API calls without permission. Nav does not yet hide links by permission (future polish).
- **Automation lead APIs** — still open to anyone who can reach the backend URL (intended for n8n + internal network). Lock down with network rules or add staff auth to read endpoints if exposing API publicly.

## File reference

| File | Purpose |
|------|---------|
| `apps/backend/src/routes/auth.ts` | Login, bootstrap, change-password, me |
| `apps/backend/src/routes/admin.ts` | Users & roles CRUD |
| `apps/backend/src/middleware/staffAuth.ts` | JWT middleware |
| `apps/backend/src/lib/jwt.ts` | Sign / verify tokens |
| `apps/frontend/src/middleware.ts` | Route protection |
| `apps/frontend/src/lib/admin-fetch.ts` | Server components → backend with cookie |
| `apps/frontend/src/app/admin/actions.ts` | Server actions for admin forms |

---

*Rotating `JWT_SECRET` invalidates all sessions; staff must sign in again.*
