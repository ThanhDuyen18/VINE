VINE — System Description
=========================

This document describes the VINE application: modules, primary activities, data model & flow, triggers/events, permissions, and implementation notes. It aggregates how the frontend components and Supabase backend interact and where to look in the codebase for each concern.

Goal & Audience
----------------
- Purpose: High-level and developer-facing reference for VINE architecture and runtime behavior.
- Audience: Developers onboarding to the repo, maintainers, and integrators.

Repository layout (relevant)
---------------------------
- `src/` — React + TypeScript app (Vite).
  - `components/` — UI components grouped by feature (attendance, tasks, organization, leave, rooms, ui primitives).
    - `components/attendance/` — `AttendanceWidget.tsx`, `AdminAttendanceManager.tsx`, `AttendanceSettings.tsx` (in `organization`), etc.
    - `components/tasks/` — `TaskBoard.tsx`, `TaskList.tsx`, `CreateTaskDialog.tsx`, `EditTaskDialog.tsx`, `TaskCard.tsx`, etc.
    - `components/organization/` — `UsersManagement.tsx`, `RoleManagement.tsx`, `LeaderTeamDashboard.tsx`, `AttendanceSettings.tsx`, etc.
    - `components/leave/` — `LeaveRequestForm.tsx`, `LeaveHistory.tsx`, `LeaderLeaveApproval.tsx`, `LeaveTypeManagement.tsx`.
    - `components/rooms/` — booking and room management components.
    - `components/ui/` — shared UI primitives (Card, Table, Dialog, Select, Badge, Button, etc.).
  - `pages/` — top-level pages (`Leave.tsx`, `Tasks.tsx`, `Organization.tsx`, `Attendance.tsx`, `Dashboard.tsx`, etc.).
  - `lib/` — helpers: `auth.ts`, `notifications.ts`, `utils.ts`, `attendance-debug.ts`.
  - `integrations/supabase/` — Supabase client and generated types.
- `supabase/` — migrations and Supabase specific server-side scripts (policies, config).
- `public/`, `package.json`, `vite.config.ts`, `tailwind.config.ts` etc.

Tech stack & key libraries
--------------------------
- Frontend: React 18 + TypeScript, Vite.
- UI: Tailwind CSS, Radix primitives, custom UI components.
- State & side effects: React state + Supabase realtime subscriptions; React Query present but used minimally.
- Backend: Supabase (Postgres) — authentication, RLS, Postgres functions/migrations, storage.
- Other libs: `date-fns`, `lucide-react` icons, `sonner` toasts.

High-level modules and responsibilities
--------------------------------------
1. Authentication & User Profile
   - Files: `src/lib/auth.ts`, `integrations/supabase/client`.
   - Stores: Supabase `auth` (users) and `profiles` table.
   - Responsibilities: get current user, session, user role (from `user_roles` table), and profile metadata (name, team, shift, avatar, phone, DOB, leave balance).

2. Organization
   - Files: `src/pages/Organization.tsx`, `components/organization/*`.
   - Responsibilities: manage users, teams, shifts, roles. Admin-facing UI for user/role management. Includes `UserDirectory` (read-only listing), `RoleManagement` (view user details), Teams and Shifts management.

3. Attendance
   - Files: `components/attendance/AttendanceWidget.tsx`, `components/organization/AttendanceSettings.tsx`, `AdminAttendanceManager.tsx`.
   - Responsibilities:
     - Check-in / Check-out actions that insert records into `attendance` table with fields (user_id, type, timestamp, location, notes).
     - Attendance Settings (admin UI) stored in `localStorage.attendanceSettings` (onTime cutoff). Note: settings currently client-local (not persisted server-side).
     - Calculations: working hours, days worked, average hours, and On-time Rate (computed client-side by comparing check-in time against cutoff). Also history listing and tags (On-time/Late) per record.
     - Admin manager: show today's check-ins/check-outs, rankings, and debug hook for RLS issues.
   - Realtime: subscriptions to `attendance` table changes scoped by user (or channel names used) to update UI live.

4. Tasks / Task Board
   - Files: `components/tasks/*`, `pages/Tasks.tsx`.
   - Responsibilities:
     - Kanban-style TaskBoard with columns (task_columns table) and cards (tasks table).
     - Task CRUD: create tasks (assignee required, deadline required), edit task (prefill form, permission checks), delete tasks.
     - Status/Columns: logical statuses map to columns (To Do, In Progress, Review, Done). The board reads columns from DB; code ensures defaults exist and inserts missing columns if necessary.
     - Permission rules: Admin can edit anyone's task; staff/leader can only edit tasks assigned to themselves (client-side check + messaging). There is room to add RLS policies server-side for enforcement.
     - Notifications: creating a task may create a notification for assignee (via `createTaskNotification`).
   - Realtime: channels watching `tasks` and `task_columns` changes to refresh board.

5. Leave Management
   - Files: `components/leave/*`, `pages/Leave.tsx`.
   - Responsibilities: request leaves (staff), manage leave types (admin), leader-specific flows for team approval (LeaderLeaveApproval component), history. Leave requests stored in `leave_requests` table (status: pending/approved/rejected) and profile leave balances updated accordingly.

6. Meeting Rooms / Bookings
   - Files: `components/rooms/*`.
   - Responsibilities: create/edit room bookings, calendar view, availability checks.

7. Notifications
   - Files: `src/lib/notifications.ts`
   - Responsibilities: create user notifications for events (task assigned, leave approved, etc.), likely stored in a `notifications` table and surfaced by `NotificationBell`.

8. Integrations
   - Supabase: DB, Auth, Realtime, Storage for CVs and attachments.
   - Files: `integrations/supabase/*` and `supabase/` migrations/policies.

Primary database tables (high-level)
-----------------------------------
- `profiles` — user profile data (id PK matching auth.uid), personal fields, team_id, shift_id, leave balance, avatar, phone, DOB, approval metadata.
- `user_roles` — map user_id -> role (admin | leader | staff) used by RLS and UI logic.
- `attendance` — id, user_id, type (check_in/check_out), timestamp (timestamptz), location, notes.
- `tasks` — id, title, description, priority, status (todo,in_progress,review,done), creator_id, assignee_id, deadline, column_id, created_at, completed_at (optional), etc.
- `task_columns` — kanban columns with position, color, created_by, is_default.
- `leave_requests` — leave requests with status, created_by, approved_by, dates, rejection_reason.
- `notifications` — application notifications per user (message, link, read/unread flag).

Data flows and triggers
----------------------
This section explains typical flows, where data is created/updated, and what triggers UI updates or side-effects.

1. User Login
   - Trigger: user authenticates via Supabase Auth.
   - Flow: frontend calls `supabase.auth.getUser()` and `getCurrentUser()` helper. Then `getUserRole()` and `getUserProfile()` are used to load role and profile. UI routing and tabs (e.g., in `Tasks`, `Leave`, `Organization`) use role to show/hide features.
   - Side-effects: set role in `DashboardLayout` and per-page permission checks.

2. Check-in / Check-out
   - Trigger: user clicks Check In or Check Out in `AttendanceWidget`.
   - Flow:
     - Creates an `attendance` row via `supabase.from('attendance').insert({ user_id, type, timestamp })`.
     - UI immediately calls `loadTodayAttendance` to refresh today's records and may show a toast.
     - Background: browser geolocation fetch updates `location` field via an `update` on the inserted row (matching by timestamp/user/type).
   - Triggers:
     - Realtime subscription listens for changes on `attendance` (channel `attendance-changes`) and refreshes lists and stats.
     - `calculateStats` recalculates hours and on-time percentage when `allRecords` changes.

3. Attendance Settings (On-time cutoff)
   - Trigger: Admin saves the time in `AttendanceSettings`.
   - Flow: saved to `localStorage.attendanceSettings` by current implementation; not persisted server-side (choice: quick client-only configuration). Attendance UI reads `localStorage` to determine cutoff when computing On-time Rate and tags.
   - Note: If multi-device/global settings desired, this should be a DB row (e.g., `organization_settings`) and read server-side.

4. Task creation & assignment
   - Trigger: `CreateTaskDialog` submit.
   - Flow:
     - Validate required fields (title, assignee, deadline).
     - Insert task into `tasks` table, setting `creator_id` from current user. Insert includes `completed_at` optional field.
     - If assignee present, call `createTaskNotification(assigneeId, title, creatorName)` to create a notification.
     - UI refreshes board (`fetchTasks`) and realtime channel broadcasts an update.
   - Triggers:
     - Realtime: `tasks-changes` channel triggers a board refresh for connected users.
     - Notifications: visible in the NotificationBell component and persisted to `notifications` table.

5. Task editing
   - Trigger: open `EditTaskDialog` and submit.
   - Flow & rules:
     - The dialog prefills fields with current task data (title, description, priority, column, deadline, assignee, completed_at).
     - Client enforces: admin may edit all tasks; staff/leader can only edit tasks assigned to themselves. The current code checks this client-side before issuing the update.
     - The DB `tasks` row is updated via Supabase `update`.
   - Recommended: enforce server-side RLS policy to only allow authorized users to update tasks (the repo has migrations for RLS changes; consider adding policies to protect updates).

6. Leave request and approval
   - Trigger: staff submits a leave request; leader approves/rejects (via `LeaderLeaveApproval`).
   - Flow:
     - Insert into `leave_requests` table with status `pending`.
     - Leader's UI (when enabled) lists `pending` requests for team members and updates status to `approved`/`rejected` via `update` with `approved_by` and `approved_at`.
     - On rejection, `rejection_reason` saved and the user's leave balance may be adjusted (the code calls `updateLeaveBalanceForReject`).
     - Admin can manage leave types in `LeaveTypeManagement`.

7. Rooms booking
   - Trigger: user creates a booking via `CreateBookingDialog`.
   - Flow: booking inserted into `room_bookings` (or `bookings`) table; calendar reads bookings to show availability. Conflict detection is implemented client-side/server-side checks and enforced on insert.

Realtime & subscriptions
------------------------
- The app uses Supabase Realtime channels to listen for table changes and refresh UI where appropriate:
  - `attendance-changes` (attendance updates per user)
  - `tasks-changes` and `task_columns` channel updates for the Board
  - `team-leave-changes` for leave requests
- Subscriptions are added with `supabase.channel(...).on('postgres_changes', ...)` and removed on cleanup.

Permissions & Row Level Security (RLS)
--------------------------------------
- Pattern in repo:
  - Some migration SQLs exist under `supabase/migrations/` to add RLS policies for admin read access (example: enabling admin read for `attendance`).
  - The frontend often relies on `user_roles` to decide UI and client-side permission checks.
- Recommended enforcement:
  - Add Postgres RLS policies that align with UI rules, e.g.:
    - `attendance`: allow users to select their own attendance; allow admin role to select all (policy that checks `user_roles` table).
    - `tasks`: allow creators to create; allow assignees to update certain fields; allow admins full access.
  - Keep sensitive operations validated on server-side where possible (webhooks, server functions), not only client-side checks.

Triggers (events that cause side-effects)
----------------------------------------
- DB inserts/updates via Supabase client cause realtime payloads that the app subscribes to and uses to refresh UI.
- UI actions (create task, check-in) cause:
  - toast notifications (client-side),
  - notification rows (notifications table),
  - optional geolocation update (async update for attendance location),
  - recalculation of local derived stats (hours, on-time rate).

Common places to change behavior
--------------------------------
- Add server-side setting for attendance cutoff: create `organization_settings` table and load it in `AttendanceWidget` instead of localStorage.
- Harden permissions: add migrations in `supabase/migrations/` to enforce RLS policies so front-end authorization is not the sole mechanism.
- Move `attendance` on-time/late logic server-side if you need consistent cross-device calculations (and avoid timezone pitfalls on clients).

Implementation notes & gotchas
-----------------------------
- Timezones: the system stores timestamps as ISO strings (Supabase returns `timestamptz`), but client code must be careful to compare times consistently. Some previous issues were caused by mixing UTC vs local times when computing on-time tags.
- Settings: `attendanceSettings.onTime` is stored in `localStorage` (client-local). This is convenient but not global; consider DB-persisted settings for organization-level configuration.
- Permissions: several client-side permission checks exist for UX (e.g., only assignees can edit tasks). These need to be backed by RLS policies to be secure.
- Column/Status consistency: `TaskBoard` expects up to 4 default columns. The code now programmatically inserts default columns back into DB if missing. If you prefer explicit migrations for columns, add a migration SQL.
- Auditing: critical actions (approvals, deletes) should write audit trails if required for compliance.

Where to look in code for specific behaviors
-------------------------------------------
- On-time settings UI: `src/components/organization/AttendanceSettings.tsx`
- Attendance widget and history: `src/components/attendance/AttendanceWidget.tsx`
- Admin attendance manager: `src/components/attendance/AdminAttendanceManager.tsx`
- Tasks (board + card + dialogs): `src/components/tasks/TaskBoard.tsx`, `TaskCard.tsx`, `CreateTaskDialog.tsx`, `EditTaskDialog.tsx`, `TaskList.tsx`
- Leave flows: `src/components/leave/*` and page `src/pages/Leave.tsx`
- Organization admin: `src/pages/Organization.tsx`, `src/components/organization/*`
- Supabase client and types: `src/integrations/supabase/client.ts` and `src/integrations/supabase/types.ts`
- Migrations & policies: `supabase/migrations/*`

Suggested next steps / improvements
----------------------------------
- Persist Attendance settings server-side (organization-level settings table).
- Add RLS policies for `tasks` and `attendance` to match frontend authorization.
- Add explicit DB migrations to ensure `task_columns` default values exist (instead of inserting at runtime).
- Centralize timezone handling and document timestamp conventions (store and compare in UTC, show in local time, or vice versa — but be consistent).
- Add more unit/integration tests for critical flows (task permissions, attendance calculations).

Appendix: Quick diagram (text)
------------------------------
User (browser)
  -> Supabase Auth (login)
  -> Fetch Profile & Role -> UI (renders modules/tabs)
  -> User action: Check-in / Task Create / Leave Request
     -> Supabase: insert row
     -> Realtime event -> clients subscribe -> UI updates
     -> Background: notifications, geolocation update, stats recalculation

Database (Supabase) tables:
  profiles, user_roles, attendance, tasks, task_columns, leave_requests, notifications

Contact / Maintainers
---------------------
- Check repository owner and Git history. For any DB-side changes, test migrations in a staging Supabase project before applying to production.

---

File created by developer assistant. If you want this content moved to `DOCUMENTATION_INDEX.md` or into a `docs/` subfolder, I can relocate it. I can also expand any section into further subsections (e.g., a step-by-step sequence diagram for Task lifecycle or SQL examples for RLS policies).