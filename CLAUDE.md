# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Common Commands](#common-commands)
3. [Architecture](#architecture)
4. [Features & Pages](#features--pages)
5. [User Roles & Permissions](#user-roles--permissions)
6. [Business Rules](#business-rules)
7. [Workflows](#workflows)
8. [Database Schema Reference](#database-schema-reference)
9. [Key Patterns](#key-patterns)
10. [Recent Changes](#recent-changes)

---

## Project Overview

Salon360 is a multi-store salon management application built with React, TypeScript, and Supabase. It provides comprehensive functionality for:

- **Ticket/Service Tracking**: Create, edit, close, and approve service tickets
- **Employee Management**: Roles, schedules, multi-store assignments
- **Tip Reports**: Daily/weekly tip tracking by technician
- **Attendance**: Check-in/out, payroll periods, overtime calculation
- **Inventory**: Items, lots, distributions, suppliers
- **Financial Operations**: End-of-day reconciliation, safe balance tracking
- **Client Management**: Customer database with blacklist support
- **Analytics**: Sales insights and reporting

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Icons**: lucide-react
- **Internationalization**: en, fr, vi, km

---

## Common Commands

```bash
# Development
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking (uses tsconfig.app.json)

# Database Migrations
npm run db:new <name>         # Create new migration file
npm run db:lint               # Lint migrations for common issues
npm run db:check-duplicates   # Check for duplicate migrations
supabase db push              # Push migrations to remote
supabase db reset             # Reset local database (destructive)

# Run migration scripts (Node.js scripts in /scripts/migrations/)
node scripts/migrations/apply_<migration_name>.mjs
```

---

## Architecture

### Source Structure (`/src`)

```
/src
├── App.tsx                    # Main app with routing, page state, context hierarchy
├── pages/                     # 15 full-page components
│   ├── HomePage.tsx           # PIN auth, check-in/out, queue
│   ├── TicketsPage.tsx        # Core sales ticket management
│   ├── AttendancePage.tsx     # Bi-weekly payroll tracking
│   ├── TipReportPage.tsx      # Technician tips
│   ├── EndOfDayPage.tsx       # Cash reconciliation
│   ├── SafeBalancePage.tsx    # Safe deposits/withdrawals
│   ├── EmployeesPage.tsx      # Employee management
│   ├── ServicesPage.tsx       # Service catalog
│   ├── ClientsPage.tsx        # Client management
│   ├── InventoryPage.tsx      # Inventory with 5 tabs
│   ├── InsightsPage.tsx       # Analytics dashboard
│   ├── ConfigurationPage.tsx  # Store settings
│   ├── SettingsPage.tsx       # User preferences
│   ├── PendingApprovalsPage.tsx # Approval hub (8 tabs)
│   └── LoginPage.tsx          # PIN authentication
├── components/
│   ├── ui/                    # Base UI primitives (Button, Modal, Input, Toast, etc.)
│   ├── insights/              # Sales and analytics components
│   ├── clients/               # Client management components
│   ├── inventory/             # Inventory modals and components
│   └── tickets/               # Ticket editor, service timer components
├── contexts/
│   ├── AuthContext.tsx        # Authentication, store selection, locale
│   ├── SettingsContext.tsx    # App settings per store
│   ├── PermissionsContext.tsx # Role-based permission checking
│   ├── PermissionsCacheContext.tsx # Permission caching (5-min TTL)
│   └── NumericKeypadContext.tsx    # Shared numeric keypad for mobile
├── hooks/                     # Custom hooks (useSalesData, useClients, useWorkingHoursCheck, etc.)
└── lib/
    ├── supabase.ts            # Supabase client + TypeScript interfaces
    ├── permissions.ts         # Permission checking logic per role
    ├── i18n.ts                # Translations (en, fr, vi, km)
    └── timezone.ts            # EST timezone utilities
```

### Context Provider Hierarchy (in App.tsx)

```
ToastProvider → AuthProvider → PermissionsProvider → PermissionsCacheProvider → SettingsProvider → NumericKeypadProvider → AppContent
```

### Database / Supabase

- Migrations in `/supabase/migrations/` with format `YYYYMMDDHHMMSS_description.sql`
- Use `_TEMPLATE.sql` as starting point for new migrations
- All migrations must be idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`)
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- After DDL migrations (`ALTER TABLE ADD COLUMN`), always run `NOTIFY pgrst, 'reload schema'`

---

## Features & Pages

**HomePage** (`HomePage.tsx`): PIN auth (4-digit), check-in/out flow, ready queue management, multi-store selection, language selector. Different flows for commission vs. salaried employees; auto queue joining on check-in.

**TicketsPage** (`TicketsPage.tsx`): Core ticket management with 3 view modes (table, daily report, period report). Filters: approval status, payment method, technician, date range. TicketEditor modal for create/edit. Self-service ticket creation for Technician/Supervisor. Color-coded service badges by category. Date navigation restricted for Cashier/Receptionist.

**AttendancePage** (`AttendancePage.tsx`): Bi-weekly payroll period view. Check-in/out recording, hours + overtime calculation, multi-store tracking. CSV export. Change request proposals. Employees grouped by pay type. Technician/Receptionist see own attendance only.

**TipReportPage** (`TipReportPage.tsx`): Daily/weekly tip views by technician. Customer tips (cash+card) and receptionist-paired tips. Service duration status indicators (green/yellow/red). Multi-select technician filter. CSV export. Commission employees can't see tips unless Manager+.

**EndOfDayPage** (`EndOfDayPage.tsx`): Cash reconciliation — opening cash, denomination counting, cash in/out transactions, variance calculation. Expected = Cash payments + Cash tips - Discounts. Balanced when variance < $0.01.

**SafeBalancePage** (`SafeBalancePage.tsx`): Safe deposit/withdrawal tracking, 14-day balance history. Warnings when opening ≠ previous closing. Change request proposals for transactions.

**EmployeesPage** (`EmployeesPage.tsx`): Employee CRUD with search/filter (status, role, store). PIN reset, multi-store assignment (`employee_stores`), weekly schedule, pay type (hourly/daily/commission). Clickable column sorting.

**ServicesPage** (`ServicesPage.tsx`): Service catalog CRUD (code, name, price, duration). Category management with colors. Per-service `requires_photos` flag (mandatory photos & notes on tickets). Table/grid views.

**ClientsPage** (`ClientsPage.tsx`): Client CRUD with blacklist support. Visit stats (count, last visit, total spending). Phone visibility role-based. Clickable column sorting. `batchIn()` helper for chunked queries (50 IDs per batch).

**InventoryPage** (`InventoryPage.tsx`): 5 tabs — Items (CRUD, low stock alerts, master/sub hierarchies), Transactions (stock in, store-to-store transfers, approval workflow), Lots (purchase tracking, statuses: active/depleted/expired/archived), Distributions (pending→acknowledged→in-use→returned/consumed), Suppliers (master data).

**InsightsPage** (`InsightsPage.tsx`): 4 tabs — Sales Overview, Sales Report, Payment Types, Employee Sales. Time filters: today, week, month, 30 days, custom range.

**ConfigurationPage** (`ConfigurationPage.tsx`): Store info, operating hours, holidays, feature toggles.

**SettingsPage** (`SettingsPage.tsx`): User preferences, display settings, change own PIN.

**PendingApprovalsPage** (`PendingApprovalsPage.tsx`): 8 approval tabs — Tickets, Inventory, Cash Transactions, Transaction Changes, Attendance, Violations (voting system), Queue History, Ticket Changes (reopen requests; Supervisor sees Receptionist/Cashier requests only).

**LoginPage** (`LoginPage.tsx`): 4-digit PIN entry, check-in/out action, auto-submit on completion.

---

## User Roles & Permissions

### 5.1 Role Hierarchy (Highest to Lowest)

```
1. Admin     (highest authority)
2. Owner
3. Manager
4. Supervisor
5. Receptionist
6. Cashier
7. Technician
8. Trainee   (most restricted, same permissions as Technician)
```

When a user has multiple roles, the highest-ranking role determines their permission level. Trainee maps to Technician-level permissions internally.

---

### 5.2 Permission Matrix

| Feature | Admin | Owner | Manager | Supervisor | Receptionist | Cashier | Technician | Trainee |
|---------|:-----:|:-----:|:-------:|:----------:|:------------:|:-------:|:----------:|:-------:|
| **Tickets** |
| View All Tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Own only | Own only |
| Create Tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Self-service | Self-service |
| Edit Tickets | ✓ | ✓ | ✓ | Own only | ✓ | ✓ | ✗ | ✗ |
| Close Tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Delete Tickets | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Void Tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Approve Tickets | ✓ | ✓ | ✓ | Worked* | Worked† | ✗ | ✗ | ✗ |
| Reopen Tickets | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Request Reopen | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Review Reopen Requests | ✓ | ✓ | ✓ | R/C only‡ | ✗ | ✗ | ✗ | ✗ |
| View Full Phone (Ticket) | ✓ | ✓ | ✓ | Masked | Masked | Masked | Masked | Masked |
| **Financial** |
| View EOD | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit EOD | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| View Safe Balance | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| View Insights | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Tips** |
| View All Tips | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Own only | Own only |
| Export Tips | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Employees** |
| View Employees | ✓ | ✓ | Limited | ✗ | ✗ | ✗ | ✗ | ✗ |
| Create Employees | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Edit Employees | All | Non-Admin | Non-Mgmt | ✗ | ✗ | ✗ | ✗ | ✗ |
| Delete Employees | All | Non-Admin | Non-Mgmt | ✗ | ✗ | ✗ | ✗ | ✗ |
| Reset PIN | All | Non-Admin | Non-Mgmt | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Inventory** |
| View Inventory | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Create Items | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Create Transactions | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Approve Transactions | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Distribute Inventory | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| View Own Inventory | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ |
| **Clients** |
| View Clients | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create Clients | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit Clients | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete Clients | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Blacklist Clients | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| View Full Phone | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Services** |
| View Services | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Create Services | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Delete Services | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Configuration** |
| View Configuration | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Edit Configuration | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Queue** |
| View All Queue | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Remove from Queue | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

\* **Supervisor**: Must have worked on the ticket. Cannot approve tickets at manager/owner level.
† **Receptionist**: Must have worked on the ticket. Can only approve technician-level tickets (hidden for supervisor+ level).
‡ **Supervisor**: Can only review reopen requests from Receptionists and Cashiers. Cannot review own requests or other Supervisors' requests.

**Ticket Approval by `approval_required_level`**:

| `approval_required_level` | Technician | Receptionist | Supervisor | Manager+ |
|---|---|---|---|---|
| `technician` | If worked on ticket | If worked on ticket | If worked on ticket | Yes |
| `supervisor` | No | No (hidden) | If worked on ticket | Yes |
| `manager` | No | No | No | Yes |
| `owner` | No | No | No | Owner/Admin only |

### 5.3 Access Restrictions

- **Time-Based**: Technician, Trainee, Cashier, Receptionist, Supervisor restricted to 8:45 AM – 30 min after store closing. Admin/Owner/Manager exempt.
- **Date Lock**: Cashier/Receptionist locked to today's date on Tickets, Tip Report, EOD, Safe Balance pages.
- **Check-In Required**: Receptionist, Supervisor, Technician, Trainee must check in before accessing the app.
- **Multi-Store**: Admin/Manager/Owner access all stores. Others access only assigned stores via `employee_stores`. Store switching blocked while checked in (for Receptionist/Supervisor/Technician/Trainee).
- **Employee Management**: Admin manages all; Owner manages everyone except Admin; Manager manages Supervisor and below.

---

## Business Rules

### 6.1 Ticket Rules

- **Minimum Requirements**: At least one item with payment method and amount
- **Self-Service Tickets**: Technician/Trainee/Supervisor/Receptionist-created tickets require approval
- **Approval Level Routing** (`approval_required_level`): Receptionist self-service → `supervisor`; Supervisor → `manager`; Manager → `owner`; Tips > $20 → `manager`; Standard (different performer/closer) → `technician`
- **Auto-Approval**: After 24 hours, pending tickets auto-approve
- **Edit Restrictions**: Approved tickets → Admin/Owner only; Closed → no one; Technician → create only; Supervisor → own self-service only
- **Rejection**: Rejected tickets can be reopened (Manager+ only)
- **Delete**: Admin only — permanent removal
- **Void**: Owner/Manager/Supervisor/Receptionist/Cashier — soft-delete with required reason. Voided tickets visible (grayed out, amber badge) but excluded from all financial reports (Tip Report, EOD, Insights, client stats). Read-only. Admin sees Delete instead of Void.

### 6.2 Tip Visibility Rules

| Pay Type | Can See Tips? |
|----------|---------------|
| Commission | No (unless Manager+) |
| Hourly | Yes |
| Daily | Yes |

- Customer tips and receptionist-paired tips tracked separately
- Only approved tickets count (legacy tickets always counted)
- Store isolation for multi-store employees

### 6.3 Attendance Rules

- **Overtime**: 8-hour threshold, hourly employees only with `count_ot` flag
- **Auto Check-Out**: At store closing if not manual (shown in orange)
- **Change Proposals**: Require manager approval
- **Payroll Period**: Bi-weekly (14 days)

### 6.4 EOD Cash Rules

- **Opening Cash**: Required before first ticket of the day
- **Expected Cash** = Cash payments + Cash tips - Discounts
- **Variance** = Actual Count - Expected Cash; Balanced when < $0.01
- **Transaction Categories**: Expenses, safe deposit, refunds, HQ deposit, etc.

### 6.5 Inventory Rules

- **Lot Numbers**: Auto-generated with store prefix (e.g., `OM-2026-00001`)
- **Distribution Workflow**: pending → acknowledged → in-use → returned/consumed
- **Low Stock Alerts**: quantity < reorder level
- **Transaction Approval**: Manager required; only Admin can self-approve
- **Store-to-Store Transfers**: `transaction_type = 'transfer'`, requires destination manager approval. Partial receipt supported (`received_quantity` per item). Stock moves atomically on approval: deducted from source, added to destination. Transaction numbers prefixed `XFER-`. Items are global catalog (`inventory_items`), per-store stock in `store_inventory_levels`

### 6.6 Employee Management Rules

- 4-digit unique PIN per employee
- Multi-store assignment via `employee_stores`
- Weekly schedule configurable per employee
- Active/Inactive status (inactive cannot log in)

### 6.7 Queue Rules

- **Statuses**: ready, busy, neutral, small_service
- **Priority**: `queue_priority` column (0=normal, 1=low). Trainees get low priority. Order: `(queue_priority, ready_at)`
- **Skip Turn**: Requires reason (Too difficult, Health, Lunch, Washroom, Others). Moves to end within priority group. Logged in `queue_skip_log`
- **Leave Queue**: All queue-eligible roles, requires reason (Tired, Cannot perform service, Other). Logged in `queue_leave_log`
- **Cooldown**: After removal, wait period before rejoining
- **Auto Status**: Opens ticket below threshold → small_service (yellow, stays in queue); above threshold → busy (red). Completing ticket returns small_service to ready; removes busy
- **Timeout**: Auto-removed after 30 min inactivity
- **Cashier Blocked**: Cannot join ready queue (frontend + RPC guard)
- **skip_queue_on_checkin**: Employee flag; checks in without joining queue, blocks manual join

### 6.8 Client Rules

- **Blacklist**: With reason tracking
- **Phone Visibility**: Supervisor+ on Clients page. On tickets: Technicians see `***-***-XXXX`; non-management see masked on closed tickets; Admin/Owner/Manager always see full
- **Deletion**: Admin/Manager/Owner only

---

## Workflows

### 7.1 Ticket Lifecycle

CREATE → OPEN → SERVICES_IN_PROGRESS → READY_FOR_CLOSING → CLOSED → PENDING_APPROVAL → APPROVED / AUTO_APPROVED / REJECTED → (if rejected) REOPENED → OPEN (loop). Can be VOIDED at any open state (soft-delete, excluded from reports).

**Steps**: Create (select customer, assign technician) → Add Services (catalog or custom) → Start Timer → Complete Service → Close Ticket (collect payment) → Approval (if required) → Reopen (if rejected)

### 7.2 End-of-Day Workflow

Enter opening cash (or auto-fill from previous day) → Record transactions throughout day → Add cash in/out → Enter closing cash count (all denominations) → System calculates variance → Save EOD record (balanced or unbalanced)

### 7.3 Inventory Workflow

Purchase lot created → Available → Distributed or Used in service. Distribution: pending → acknowledged → in-use → returned/consumed. Transactions: created → pending → manager review → approved/rejected. Store-to-store transfers: created at source → pending → destination manager reviews (can adjust received qty for partial receipt) → approved (stock moves) / rejected (no change).

### 7.4 Attendance Workflow

Check-in → Active shift → Check-out → Hours calculated → Overtime flagged (if > 8 hrs) → Record saved. If change needed: proposal submitted → manager review → approved/rejected → record updated.

### 7.5 Universal Approval Pattern

Action created → Pending → Review required? If yes: approval pending → manager review → approved/rejected. If no: auto-approved. Applies to: Tickets, Inventory Transactions, Cash Transactions, Attendance Changes, Ticket Reopens.

### 7.6 Queue Workflow

Technician ready → In queue → (skip turn → back to end of queue) → Assigned to ticket → Busy → Service complete → Back to queue. If removed by manager: removal logged → cooldown enforced → wait → can rejoin.

---

## Database Schema Reference

### Core Tables

| Table | Purpose |
|-------|---------|
| `stores` | Multi-tenant store data (name, address, hours) |
| `employees` | Employee master data (name, role, PIN, pay_type) |
| `employee_stores` | Junction table for multi-store assignment |
| `sale_tickets` | Ticket header (date, customer, payment, status, approval) |
| `ticket_items` | Line items (service, technician, tips, timer) |
| `ticket_activity_log` | Change tracking for tickets |
| `ticket_reopen_requests` | Reopen request tracking |
| `attendance_records` | Check-in/out times, hours worked |
| `attendance_change_proposals` | Proposed time changes |
| `attendance_comments` | Comments on attendance records |
| `end_of_day_records` | Daily cash reconciliation |
| `cash_transactions` | Cash in/out transactions |
| `cash_transaction_change_proposals` | Proposed transaction edits |
| `safe_balance_history` | Safe balance tracking |
| `inventory_items` | Inventory master data |
| `inventory_transactions` | Stock in/out transactions |
| `inventory_transaction_items` | Transaction line items |
| `inventory_purchase_lots` | Purchase lot tracking |
| `inventory_distributions` | Employee distributions |
| `employee_inventory_lots` | Employee-lot assignments |
| `suppliers` | Supplier master data |
| `clients` | Customer data with blacklist support |
| `client_color_history` | Color preference tracking |
| `store_services` | Service catalog per store |
| `service_categories` | Service category definitions |
| `technician_ready_queue` | Queue status tracking (includes `queue_priority` column) |
| `queue_removal_history` | Queue removal audit |
| `queue_leave_log` | Voluntary queue departures with reason/notes |
| `queue_skip_log` | Skip turn actions with reason/notes |
| `violation_reports` | Employee violation tracking |

### Important Fields

**sale_tickets**: `ticket_no` (auto-generated), `ticket_date` (YYYY-MM-DD), `opened_at`/`closed_at`/`completed_at` (timestamps), `payment_method` (cash/card/mixed/gift_card), `approval_status` (pending_approval/approved/auto_approved/rejected), `approval_required_level` (technician/supervisor/manager/owner), `requires_admin_review` (boolean), `voided_at`/`voided_by`/`void_reason` (void fields)

**ticket_items**: `started_at`/`timer_stopped_at`/`completed_at` (service timer), `tip_customer_cash`/`tip_customer_card`, `tip_receptionist`, `payment_cash`/`payment_card`/`payment_gift_card`

**store_services**: `requires_photos` — when true, tickets with this service require min 1 photo + notes

**inventory_purchase_lots**: `lot_number` (auto-generated, e.g. OM-2026-00001), `quantity_received`/`quantity_remaining`, `status` (active/depleted/expired/archived)

**inventory_transactions**: `transaction_type` (in/out/transfer), `destination_store_id` (for transfers), `transaction_number` (prefixed IN-/OUT-/XFER-)

**inventory_transaction_items**: `received_quantity` (nullable, set by destination manager for partial receipt on transfers)

**inventory_distributions**: `status` (pending/acknowledged/in_use/returned/consumed/cancelled)

---

## Key Patterns

### Lazy Loading with Stale Chunk Recovery
Non-critical pages use `lazyWithReload()` for code splitting with automatic recovery from stale chunks after deployments (see App.tsx).

```typescript
const InsightsPage = lazyWithReload(() => import('./pages/InsightsPage'));
const ConfigurationPage = lazyWithReload(() => import('./pages/ConfigurationPage'));
```

**Stale chunk handling**: When a dynamic import fails (e.g., old chunk hash after deployment), `lazyWithReload` auto-reloads the page once (tracked via `sessionStorage('chunk_reload')`). If the reload doesn't fix it, `ChunkErrorBoundary` catches the error and shows a "Something went wrong" fallback with a Reload button.

### Date Handling
All dates are processed in EST timezone.

```typescript
import { getCurrentDateEST } from './lib/timezone';

const today = getCurrentDateEST(); // Returns 'YYYY-MM-DD' in EST
```

**Important**: Cashiers and Receptionists are locked to today's date only.

### Supabase Queries
Direct queries via `supabase.from('table').select()` pattern. No ORM layer.

```typescript
const { data, error } = await supabase
  .from('sale_tickets')
  .select('*, ticket_items(*)')
  .eq('store_id', storeId)
  .eq('ticket_date', date);
```

### Permission Checking
Always use `Permissions.feature.canXxx()` checks rather than role string comparisons.

```typescript
import { Permissions } from './lib/permissions';

// Good
if (Permissions.tickets.canEdit(userRole)) { ... }

// Bad
if (userRole === 'Admin' || userRole === 'Manager') { ... }
```

### Context Usage
Access contexts via hooks in components:

```typescript
const { selectedStoreId, session, effectiveRole } = useAuth();
const { settings } = useSettings();
const { checkPermission } = usePermissions();
```

### Multi-Store Filtering
Always filter by `store_id` when querying store-specific data:

```typescript
.eq('store_id', selectedStoreId)
```

---

## Recent Changes

### 2026-02-10
- **Store-to-store inventory transfers**: Replaced "Inventory Out" button with purple "Store-to-Store" transfer button. Transfers move inventory between stores with destination manager approval and partial receipt support. New `transfer` transaction type, `destination_store_id` on `inventory_transactions`, `received_quantity` on `inventory_transaction_items`. Transfer approval modal shows each item with editable received qty. Stock moves atomically on approval via trigger (deduct from source, add to destination using `COALESCE(received_quantity, quantity)`). New `approve_inventory_transfer` RPC. Updated `get_pending_inventory_approvals` to include transfers where destination is current store. Transaction numbers prefixed `XFER-YYYYMMDD-NNNN`. Files: `InventoryPage.tsx`, `InventoryTransactionModal.tsx`, `PendingApprovalsPage.tsx`, `supabase.ts`, `i18n.ts` + migration
- **Inventory Transaction form as right-side panel**: Converted "New Inventory Transaction" from centered `Modal` to full-height right-side `Drawer` panel (`size="xl"`, 896px). Added `size` prop to `Drawer` component (`sm`/`md`/`lg`/`xl`) with `md` as default (no breaking change). Fixed Drawer animation class to use correct `animate-slide-in-right`. Files: `Drawer.tsx`, `InventoryTransactionModal.tsx`
- **Searchable parent item dropdown in Inventory**: Replaced plain `<Select>` with `<SearchableSelect>` for the Parent Master Item field when creating sub-items. Auto-fills category from selected parent (still editable). Modal uses full viewport height. Files: `InventoryItemModal.tsx`
- **Simplify ticket service edit permissions**: Technicians/Trainees can edit services until completed (removed closed check). Other roles can edit services until ticket is closed (removed approval check). Files: `permissions.ts`
- **Configurable app slogan setting**: Added `app_slogan` to `app_global_settings` (Branding category), configurable from Configuration page. HomePage subtitle now reads from this setting instead of hardcoded `t('home.subtitle')`. Text input with 100-char max. Files: `SettingsContext.tsx`, `ConfigurationPage.tsx`, `HomePage.tsx` + migration
- **Fixed header/footer layout for inventory drawers**: Added `footer` prop to `Drawer` component with flex-column layout (fixed header, scrollable content, fixed footer). Backward-compatible — existing consumers unaffected. `InventoryTransactionModal` footer (buttons + approval info) now stays pinned at bottom. `EmployeeDistributionModal` converted from centered `Modal` to right-side `Drawer` with fixed footer (buttons + audit trail text). Both use `form="id"` attribute for submit buttons outside `<form>`. Files: `Drawer.tsx`, `InventoryTransactionModal.tsx`, `EmployeeDistributionModal.tsx`

### 2026-02-09
- **Remove header pending approvals badge**: Removed the standalone red pending approvals count badge next to the store name in the header. Redundant now that per-store badges exist in the store dropdown. Sidebar nav badge and per-store dropdown badges remain. Files: `Layout.tsx`
- **Per-store pending approvals badge in store dropdown**: Each store in the header store dropdown now shows its own red pending approvals count badge. Uses `fetchAllStoresApprovalsCount()` which fetches counts for all stores in parallel via `Promise.all`. Badges update on 30-second polling and realtime changes. Only shown when user has multiple stores and approval permissions. Files: `Layout.tsx`
- **Remove auto-redirect to Approvals page on login**: Removed `usePendingApprovalsRedirect` hook and all related logic. Users now always land on Tickets page after login regardless of pending approvals. Deleted `usePendingApprovalsRedirect.ts`. Files: `App.tsx`, `AuthContext.tsx`
- **Allow Supervisors to approve Cashier cash transactions**: Updated Pending Approvals Cash Transactions filter so Supervisors see transactions created by both Receptionists and Cashiers (previously only Receptionists). Client-side filter only, no DB migration needed. Files: `PendingApprovalsPage.tsx`
- **Fix voided tickets blocking new ticket creation**: Updated `check_previous_unclosed_tickets()` and `validate_no_previous_unclosed_tickets()` to exclude voided tickets (`AND voided_at IS NULL`). Voided tickets have `closed_at` still NULL, so the unclosed-ticket trigger was incorrectly counting them. Files: migration
- **Auto-show Technician Queue modal on login**: Queue modal automatically opens after login for users currently in the ready queue (ready, busy, or small_service status). Uses a ref (`hasAutoShownQueueModal`) to fire once per login session. Respects `enable_ready_queue` feature flag. Files: `Layout.tsx`
- **Restore approvals badge on sidebar nav item**: Re-added pending approvals count badge to the Approvals sidebar nav item so the badge appears in both the header (next to store name) and the sidebar navigation. Files: `Layout.tsx`
- **Remove "View As" role impersonation feature**: Removed the View As selector and banner that allowed Admin/Owner to impersonate other roles. Removed `viewingAsRole`, `startViewingAs`, `stopViewingAs`, `isViewingAs` from AuthContext. Simplified `effectiveRole` to `session?.role || null`. Deleted `ViewAsSelector.tsx` and `ViewAsBanner.tsx`. Files: `AuthContext.tsx`, `Layout.tsx`

### 2026-02-08
- **Fix small service queue bugs**: Fixed two bugs preventing small_service (yellow) queue status. Bug 1: `mark_technician_busy_smart()` required technician to be last in queue (`is_last_in_ready_queue` gate) — removed, now any technician below threshold gets `small_service`. Bug 2: `trigger_mark_technicians_available()` was regressed to blanket DELETE instead of calling `handle_ticket_close_smart()` — fixed so small_service technicians return to `ready` at same queue position on ticket completion. Files: migration + updated squash/source migrations
- **Delete icon on all service items in TicketEditor**: Trash2 icon on every service item header row, allowing users to remove any individual service. Shown when `canEditServices` and ticket is not closed/voided. Files: `TicketEditor.tsx`
- **Live Payment Summary in Payment Details modal**: Payment Summary now reads from `tempPaymentData` (temporary input state) instead of `formData` (saved state), so all 5 summary values (Total Payments, Total Discounts, Total Tips, Grand Total Collected, Tips Paired by Receptionist) update in real time as the user types. Files: `TicketEditor.tsx`
- **Customer name column in Tickets table**: Added customer name column to both desktop table view (between Time and Service columns) and mobile card view (bold name before time). Displays `customer_name` or '-' if empty. Files: `TicketsPage.tsx`
- **Remove customer_type from tickets**: Removed `customer_type` field (Appointment/Assigned/Requested) from TicketEditor UI, form state, validation, save/update payloads, Tickets table (desktop + mobile), PendingApprovals rejected view, `SaleTicket` interface, and i18n keys. DB migration drops column and recreates `get_rejected_tickets_for_admin` RPC without it. Files: `TicketEditor.tsx`, `TicketsPage.tsx`, `PendingApprovalsPage.tsx`, `supabase.ts`, `i18n.ts` + migration
- **Remove service item delete buttons**: Removed Trash2 delete buttons from individual service item rows in TicketEditor (both general and custom service single-item). Removed dead `removeItem` function. Footer Delete ticket button unchanged. Files: `TicketEditor.tsx`
- **Small service button styling in TicketEditor**: Services below `small_service_threshold` (default $30) render with italic text and `rounded-full` (pill shape). Category services sorted by price DESC (Popular tab keeps usage-count order). Files: `TicketEditor.tsx`
- **Color-coded service badges in Tickets table**: Replaced plain text service codes with colored badges matching category colors (pink/blue/purple/green/yellow). Fetches `categoryColors` from `store_service_categories`. Files: `TicketsPage.tsx`
- **Today button in TipReport weekly view**: Added "Today" button in weekly nav (hidden when viewing current week). Files: `TipReportPage.tsx`
- **TicketEditor footer button restyling**: Buttons evenly spaced with distinct colors — Delete: red, Void: yellow, Save: white/gray outline, Complete: green, Close/Reopen: blue. Files: `TicketEditor.tsx`

### 2026-02-07
- **Void ticket feature**: Admin-only Delete, new Void soft-delete for Owner/Manager/Supervisor/Receptionist/Cashier with required reason. Voided tickets visible but excluded from all financial reports via `.is('voided_at', null)`. Added `voided_at`/`voided_by`/`void_reason` columns, `canVoid` permission, "Voided" filter. All input fields blocked on voided tickets. Admin can still hard-delete voided tickets. Files: `permissions.ts`, `supabase.ts`, `TicketEditor.tsx`, `TicketsPage.tsx`, `TipReportPage.tsx`, `TipReportDetailView.tsx`, `TipReportWeeklyView.tsx`, `EndOfDayPage.tsx`, `useSalesData.ts`, `useClients.ts`, `i18n.ts` + migration
- **Supervisor reopen request review**: Supervisors can approve/reject reopen requests from Receptionists/Cashiers only. Self-review blocked at DB level. Updated RPCs and frontend filtering. Files: `permissions.ts`, `PendingApprovalsPage.tsx`, `Layout.tsx`, `TicketReopenRequestModal.tsx` + migration
- **Service picker grid for "Add Another Service"**: Replaced dropdown with category filter pills + colored service buttons (same as new-ticket UI). Trash button visible on single service items. Files: `TicketEditor.tsx`
- **Fix infinite reopen after change request navigation**: Clear `highlightedTicketId` in `closeEditor()`. Files: `TicketsPage.tsx`
- **Fix missing `ticket_reopen_requests` on salon365**: Created idempotent migration with table + 6 RPCs
- **Fix auto check-out 1 hour early (EST)**: Added time guard `IF v_eastern_time::time < '22:00'` to `auto_checkout_employees_by_context()`
- **`requires_photos` validation on close**: Added photo/notes check to `handleCloseTicket()`, exposed `totalPhotoCount` on ref. Files: `TicketEditor.tsx`, `TicketPhotosSection.tsx`
- **Fix queue join timezone regression**: Replaced `CURRENT_DATE` (UTC) with store-timezone-aware date in `join_ready_queue_with_checkin`
- **Multi-select technician filter on Tip Report**: Replaced single-select with scrollable checkbox list. Files: `TipReportPage.tsx`

### 2026-02-06
- **Independent per-page date navigation**: Each page has its own date state in App.tsx instead of shared `selectedDate`. Files: `App.tsx`, `AttendancePage.tsx`, `InsightsPage.tsx`, `PendingApprovalsPage.tsx`
- **"Today" button on date navigation**: Added to 5 pages (Tickets, TipReport, EOD, SafeBalance, PendingApprovals). Hidden when viewing today.
- **Clickable column sorting**: Added to Clients (5 columns) and Employees (5 columns) pages. Files: `ClientsPage.tsx`, `ClientsTable.tsx`, `EmployeesPage.tsx`
- **Fix clients page batch queries**: Added `batchIn()` helper chunking `.in()` to 50 IDs (PostgREST URL length limit). Removed DB pagination, fetch all clients for client-side sort. Files: `useClients.ts`
- **Technician filter on Tip Report**: Filter button with dropdown panel. Files: `TipReportPage.tsx`
- **TicketEditor layout fixes**: Flex column layout (action buttons always visible), larger action buttons (`min-h-[44px]`), Payment Summary moved into Payment Details modal, removed Collection Summary and Approved banner
- **Per-service `requires_photos` flag**: Services can require photos & notes. Validation on new ticket save (min 1 photo + notes). Files: `TicketEditor.tsx`, `TicketPhotosSection.tsx`, `ServicesPage.tsx` + migration
- **Fix `set_approval_deadline()`**: Fixed broken `status` column reference (use `closed_at IS NOT NULL`), removed non-existent `store_settings` lookup
- **Remove Spa Expert role**: Dropped defunct role from DB constraints, RPCs, and translations
- **Fix Receptionist & Supervisor approval rules**: Receptionist self-service → `supervisor` level; must have worked on ticket to approve technician-level
- **Stale chunk recovery**: `lazyWithReload()` wrapper auto-reloads on chunk failure. `ChunkErrorBoundary` fallback.

### 2026-02-05
- **Trainee role**: 8th role with Technician-level permissions. Low queue priority (`queue_priority=1`). Files: permissions, RPCs, i18n
- **Queue skip/leave with reasons**: Skip requires reason (logged in `queue_skip_log`), leave requires reason (logged in `queue_leave_log`). `QueueReasonModal` shared component
- **Block `skip_queue_on_checkin` from queue**: Frontend + RPC guards
- **Fix ticket photos infinite loading**: Replaced unstable object dependency with stable primitives in `useTicketPhotos.ts`
- **PIN auth error logging**: Differentiated `console.error`/`console.warn` in `authenticateWithPIN()`

### 2026-02-04
- **Block Cashiers from ready queue**: Frontend + RPC (`ROLE_NOT_ELIGIBLE`) guards. Files: `HomePage.tsx`, RPC
- **Skip Turn in queue**: Yellow button, moves to end via `skip_queue_turn` RPC. Later updated to require reasons.
- **Leave queue with reason (all roles)**: Reason modal, `queue_leave_log` table, updated `leave_ready_queue` RPC
- **Receptionist ticket approval**: Can approve technician-level only if worked on ticket. Later tightened (2026-02-06).

### 2026-02-03
- **Client Visit History tab**: Replaced Color History in `ClientDetailsModal`. Last 20 tickets with expandable rows. Batch queries. Files: `ClientDetailsModal.tsx`, `supabase.ts`

### 2026-02-02
- **Ticket phone number masking**: Technicians see `***-***-XXXX`. Non-management see masked on closed tickets. Added `canViewFullPhoneWhenClosed` permission.

### 2026-01-23
- **Inventory improvements**: Fixed Admin approval permissions, lot creation race conditions, enhanced Distributions/Lots tabs
- **Initial CLAUDE.md documentation**
