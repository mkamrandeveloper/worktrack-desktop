# WorkTrack — Feature Amendments Implementation Plan

**Status:** Draft for approval — no code written yet.
**Scope:** All 10 feature areas, across `worktrack-desktop` (Electron/React/TS) and `worktrack-backend` (Express/SQLite/JS).
**Guiding constraint:** Extend, don't rebuild. Preserve existing UI/UX, workflows, and backward compatibility. All schema changes are additive (non-destructive `ALTER`/`CREATE IF NOT EXISTS`).

---

## 0. Ground truth (what already exists)

Good news — much is scaffolded. This is "complete + enforce + wire-up," not greenfield.

| Concern | Already present | Missing / to build |
|---|---|---|
| Roles | `OWNER/ADMIN/MANAGER/EMPLOYEE` in types + backend middleware (`requireOwner`, `requireAdminOrAbove`, `requireManagerOrAbove`) | `CLIENT` role end-to-end; generic `requireRole`; **data scoping** (employees/clients still receive org-wide data) |
| Client | `clients` table, `projects.client_invite_token/client_email`, `sendClientInvitation()` email, public token portal (`/api/clients/portal`) | CLIENT as an authenticated user; client login; access-scoped portal; screenshots for clients |
| Task ↔ Project | Separate `tasks` + `projects` tables/routes/pages; `tasks.project_id` column **already added** | Merge UX: remove standalone Tasks module, nest tasks in Projects |
| Project create | `POST /api/projects`, `projects` table has all needed columns | 6-step wizard UI; auto-invite on create |
| Reports | `reports.js` route (overview/employee/attendance/productivity) | daily/weekly/monthly views; **Excel export** |
| Timesheets | `timesheets.js` (daily/weekly/monthly/team) | redesigned drill-down UI, per-day timeline, charts |
| Export | — | **No PDF export exists in either repo.** "Replace PDF" = implement `.xlsx` net-new. `exceljs` not installed. |
| Email | `nodemailer` wired in `emailService.js` | Requires SMTP creds in backend `.env` to actually deliver (see §Open Questions) |

**Single-Owner** is effectively already enforced: `signup/create-org` is the only path that creates `role='OWNER'`, and it creates exactly one. We'll add a guard to keep it that way.

---

## Cross-cutting conventions (used by every phase)

- **Role hierarchy:** `OWNER > ADMIN ≈ MANAGER > EMPLOYEE`, with `CLIENT` as an orthogonal external role (not in the internal hierarchy).
- **Backend authorization = two layers:** (1) *role gate* (can this role hit this route at all?) + (2) *data scope* (which rows may this user see?). Today only layer 1 exists partially; **layer 2 is the main security gap.**
- **Desktop authorization = UX only** (hide/disable). Never the source of truth — the backend enforces.
- **Additive DB changes only**, guarded so re-runs are safe.

---

# Phase 1 — Foundation: RBAC + Client Role  ✅ DONE (verified per-role via API)

Goal: a correct, enforced role system including a real `CLIENT` role, with the sidebar/routes gated per role and every backend route both role-gated and data-scoped.

### 1.1 Shared types (`worktrack-desktop/src/shared/types/index.ts`)
- `UserRole`: add `'CLIENT'`.
- Add `ClientPortalProject` / scoping helper types as needed.

### 1.2 Desktop auth store (`src/renderer/store/authStore.ts`)
- Add `isClient()`.
- `getRoleBadge()`: add `CLIENT` case (e.g. teal badge).
- Employees currently land on `/dashboard`, managers on `/`. Add: clients land on `/client-portal`.

### 1.3 Desktop navigation & route guards
- **`src/renderer/App.tsx`:** introduce a generic `<RoleRoute allow={[...]}>` (keep `ProtectedRoute`/`ManagerRoute` as thin wrappers for back-compat). Add:
  - `EmployeeRoute` gating (employees: Dashboard, Projects, Timesheets, Notifications, Settings only).
  - `ClientRoute` for the client portal; redirect non-clients away and clients *into* it.
- **`src/renderer/components/Sidebar.tsx`:** already section-gates via `isManagerOrAbove()`. Add a **client nav set** (Portal + Settings only) and ensure employees don't see manager items (already handled). Remove the standalone **Tasks** item in Phase 2.
- **New page `src/renderer/pages/ClientPortal.tsx`:** in-app, view-only list of the client's invited projects → project detail (progress, tasks, timeline, screenshots). Reuses existing primitives/StatusBadge; matches current design language.

### 1.4 Backend RBAC (`worktrack-backend/src/middleware/auth.js`)
- Add `requireRole(...roles)` generic and `requireClient`.
- Add `scopeToSelfOrManager(req)` helper + a `requireOrg` assertion (every query filters by `req.user.organization_id`).
- Keep existing named guards (back-compat).

### 1.5 Backend data-scoping pass (the security-critical part)
Audit every route; apply this matrix. "Self" = `WHERE user_id = req.user.id`; "Org" = `WHERE organization_id = req.user.organization_id`; "Invited" = client's linked projects only.

| Route group | OWNER/ADMIN/MANAGER | EMPLOYEE | CLIENT |
|---|---|---|---|
| `projects` (list/get) | Org | **only projects they're a member of** | **only invited** |
| `projects` (create/update/delete/assign) | ✅ | ❌ 403 | ❌ 403 |
| `tasks` (in project) | Org | own + own projects | read-only, invited |
| `reports/*`, `manager/*`, `attendance/*`, `departments` | ✅ | ❌ 403 | ❌ 403 |
| `timesheets/*`, `timelogs/*` | Org (any user) | **Self only** | ❌ |
| `screenshots` | Org | Self only | invited projects only |
| `dashboard/me` | Self analytics | Self | — |
| `clients/invite` | ✅ | ❌ | ❌ |

### 1.6 Client as a real authenticated user — CLIENT logs into the desktop app  ✅ decided
Clients log into the **same Electron desktop app** as staff, but are routed to a **read-only client portal** with every monitoring feature hidden.
- On invite acceptance (new `POST /api/clients/accept` from an in-app "Accept invitation / set password" screen, keyed by the invite token): create/find a `users` row with `role='CLIENT'`, `status='ACTIVE'`, tied to the org; client sets their password.
- Link client → project(s) via `project_members(project_id, user_id, role='client')` (reuses existing table; supports multiple projects per client).
- Login is role-agnostic already; a CLIENT user logs in normally and `App.tsx` sends them to `/client-portal`. Data scoping (§1.5) guarantees they only ever see invited projects.
- Keep the existing public token portal (`/api/clients/portal`) as a lightweight fallback, but the primary experience is the in-app CLIENT view.
- **Monitoring stays off for clients:** the desktop main process must not start screenshot/heartbeat/idle services when the logged-in user is a CLIENT (guard in `src/main` bootstrap).

### 1.7 Role management (Owner/Admin capabilities)
- `POST /api/manager/invite-user` (exists as add-employee? verify) → allow OWNER/ADMIN to invite with a chosen role (`ADMIN`/`MANAGER`/`EMPLOYEE`).
- `PATCH /api/users/:id/role` (new, `requireAdminOrAbove`) → change a user's role; **guard: cannot create a second OWNER, cannot demote the sole OWNER.**
- Desktop: a Roles/Team management affordance for Owner/Admin (extend existing Team page).

**Phase 1 acceptance:** log in as each role → sidebar/routes differ correctly; an employee hitting a manager API gets 403; an employee's timesheet/screenshot calls return only their own rows; a client can accept an invite, log into the portal, and see only their invited project(s).

---

# Phase 2 — Projects overhaul (merge Task→Project, wizard, auto-invite)  ✅ DONE (verified via API)

### 2.1 Merge Tasks into Projects
- **Desktop:** remove `/tasks` route + `TasksPage` + Tasks sidebar item; fold task list/board into the **Project detail** view. Keep `taskStore` (renamed conceptually to project-tasks) so timer flows that reference `taskId` keep working — **the timer still tracks a task inside a project** (backward compatible; `sessions.task_id` unchanged).
- **Backend:** keep `tasks` table/routes (timer depends on them); tasks are always accessed *through* a project. `GET /api/projects/:id/tasks` becomes the primary listing.

### 2.2 Project detail model (spec §2)
Project detail surfaces: name, description, client name/email, assigned employees, status, priority, due date, progress, comments, attachments, activity timeline, time tracking, screenshots, work history. Most columns exist; **new:** `attachments` (new table `project_attachments`), `comments`/`activity_log` (already on tasks — lift to project level or aggregate).

### 2.3 Six-step creation wizard (spec §3)
- New `src/renderer/components/CreateProjectWizard.tsx` (stepper): (1) name+desc → (2) client name+email → (3) assign employees (multi-select from team) → (4) priority `LOW/MEDIUM/HIGH/URGENT` → (5) due date → (6) confirm+create.
- **Priority:** spec uses `URGENT`; current enum uses `CRITICAL`. Decision: add `URGENT` as an alias/label or migrate `CRITICAL→URGENT` in the UI while keeping DB tolerant (TEXT). Recommend: display "Urgent", store `URGENT`, keep `CRITICAL` readable for old rows.
- Backend `POST /api/projects` already accepts these fields + `memberIds`.

### 2.4 Auto client invitation on create (spec §4)
- After successful create, backend automatically calls `sendClientInvitation()` if `client_email` present (today it's a separate `/invite` call). Email already includes org/project/link/instructions.
- Returns `portalUrl`; desktop shows a "client invited" confirmation.

---

# Phase 3 — Reports + Excel export  ✅ DONE (verified via API — real .xlsx binary confirmed)

### 3.1 Reports (spec §5)
- Backend `reports.js`: add `GET /api/reports/timesheet?period=daily|weekly|monthly&from&to&userId?&projectId?` returning per-row: employee, project, working hours, break, overtime, idle, productivity %, date range. Aggregates from `attendance` + `time_logs` + `sessions`.
- Desktop `ReportsPage`: replace mock data with real calls; add Daily/Weekly/Monthly toggle and the full column set; keep current layout/design.

### 3.2 Excel export (spec §6) — replaces the (non-existent) PDF
- Add `exceljs` to **backend**. New `GET /api/reports/export.xlsx?...` streams a formatted workbook (headers bold, frozen header row, column widths, number formats): Employee, Project, Date, Clock-In, Clock-Out, Total Working Hours, Break Duration, Overtime, Idle Time, Productivity %.
- Desktop: "Export to Excel" button → IPC → main process downloads the stream → native Save dialog (`dialog.showSaveDialog`) → write file. New IPC channel `reports:exportXlsx`.
- No PDF anywhere (spec: do not generate PDF).

---

# Phase 4 — Timesheets (drill-down) + Dashboard  ✅ DONE (verified via API + live WebSocket test)

### 4.1 Timesheets (spec §7 & §8)
- `TimesheetsPage` redesign preserving design language, three views:
  - **Daily:** KPI tiles (work/break/OT/idle/productivity) + charts; click a day → detailed timeline (clock-in/out, every break start/end, totals, chronological activity log).
  - **Weekly:** Mon–Sun rows with per-day metrics + bar/line/stacked charts (Recharts, already a dep); click a day → daily detail.
  - **Monthly:** calendar/overview + trend charts; click a date → daily detail.
- **Drill-down navigation:** Monthly → Weekly → Daily → Timeline (breadcrumb state in the page).
- Backend: `timesheets.js` largely supports this; add a `GET /api/timesheets/day/:date` detailed-timeline endpoint assembling ordered `time_logs` + sessions for the chronological log.

### 4.2 Dashboard integration (spec §9)
- Extend `dashboard/me` + a manager `dashboard/org` to feed: daily/weekly/monthly working hours, break, overtime, productivity, active projects, running timers, employees online, recent activities, project progress, and D/W/M analytics charts.
- Real-time: reuse existing Socket.IO (`SyncService`) to push updates; dashboard subscribes.

---

## Sequencing & dependencies

```
Phase 1 (RBAC + Client)  ──┬─► Phase 2 (Projects + invite)  ──► Phase 3 (Reports/Excel)
                           └─────────────────────────────────► Phase 4 (Timesheets/Dashboard)
```
Phase 1 is the hard dependency for everything (scoping + client role). 2 precedes 3–4 only loosely (reports read project/task data).

## Risks & mitigations
- **Data scoping regressions** (biggest risk): add per-role integration checks in Phase 1 before moving on.
- **Timer/back-compat:** merging Tasks→Projects must not break the running-timer flow — keep `tasks`/`sessions` intact, change only navigation/presentation.
- **Email deliverability:** without SMTP creds, invites won't actually send — the flow still records the token + portal URL so it's testable offline.
- **Priority enum drift** (`CRITICAL` vs `URGENT`): handled by tolerant storage + display mapping.

## Decisions (resolved)
1. **Client access surface:** ✅ **CLIENT role inside the desktop app** — read-only in-app portal, monitoring services disabled for clients (see §1.6).
2. **SMTP:** ✅ **Real delivery.** `emailService.js` already reads SMTP config from env — I'll finalize that wiring; **you provide `SMTP_HOST/PORT/USER/PASS/FROM` in `worktrack-backend/.env`** (I'll add the keys with placeholders; drop in real values). Invites still record the token + portal URL so the flow is testable even before creds land.
3. **Priority labels:** default → display "Urgent", store `URGENT`, still render legacy `CRITICAL`. (Flag if you'd rather fully migrate.)
4. **Screenshots for clients:** default → clients see **work screenshots for their invited project(s) only**, scoped by `project_members`. (Sensitive — flag if clients should *not* see screenshots.)
```
