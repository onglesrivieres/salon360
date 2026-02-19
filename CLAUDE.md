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
│   ├── ResourcesPage.tsx      # Dynamic resource tabs with unread tracking
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
    ├── timezone.ts            # EST timezone utilities
    └── image-utils.ts         # Shared image compression (canvas resize + JPEG 85%)
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
- **Production databases**: Only apply migrations to `supabase-salon360qc-db` and `supabase-salon365-db`. Never apply to `supabase-checkin-db` or any other database

---

## Features & Pages

**HomePage** (`HomePage.tsx`): PIN auth (4-digit), check-in/out flow, ready queue management, multi-store selection, language selector. Different flows for commission vs. salaried employees; auto queue joining on check-in.

**TicketsPage** (`TicketsPage.tsx`): Core ticket management with 3 view modes (table, daily report, period report). Filters: approval status, payment method, technician, date range. TicketEditor modal for create/edit. Self-service ticket creation for Technician/Supervisor. Color-coded service badges by category. Date navigation restricted for Cashier/Receptionist.

**AttendancePage** (`AttendancePage.tsx`): Bi-weekly payroll period view. Check-in/out recording, hours + overtime calculation, multi-store tracking. CSV export. Change request proposals. Employees grouped by pay type. Technician/Receptionist see own attendance only.

**TipReportPage** (`TipReportPage.tsx`): Daily/weekly/period tip views by technician. Customer tips (cash+card) and receptionist-paired tips. Service duration status indicators (green/yellow/red). Multi-select technician filter. CSV export. Commission employees can't see tips unless Manager+. Period tab shows 14-day bi-weekly payroll cycle (same anchor as AttendancePage: Oct 13, 2024) using WeeklyCalendarView with 14 columns.

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

**ResourcesPage** (`ResourcesPage.tsx`): Dynamic resource tabs (from `resource_tabs` table) with per-tab subcategory management. Managers can create/rename/delete tabs with icon picker (10 lucide icons). Unread resource tracking via `resource_read_status` table — blue dots on unread cards, red badge pills on tab headers, sidebar badge via Layout.tsx (60s polling + realtime). "Mark as Read" button in resource view popup. Resources organized by subcategories within each tab. Tab reordering via up/down arrow buttons in Manage Tabs modal. Auto-redirect to Resources on login when unread content exists (once per session, via `get_unread_resources_count` RPC in App.tsx).

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
| Distribute Inventory | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
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
- **Photos/Notes Required**: Tickets with `requires_photos` services OR any item add-on > $15 require at least 1 photo and notes before closing

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
- **Expected Cash**: Cash tickets use `subtotal - discount + tax + tips` (Grand Total + tips); Mixed tickets use `payment_cash + tips`; Card/gift_card skipped
- **Variance** = Actual Count - Expected Cash; Balanced when < $0.01
- **Transaction Categories**: Expenses, safe deposit, refunds, HQ deposit, etc.

### 6.4.1 Tax Rules

- **Configurable**: Toggle `enable_tax` setting per store (off by default). Rates: `tax_rate_gst` (5%), `tax_rate_qst` (9.975%)
- **Additive**: Tax calculated on top of service prices. Tax base = `max(0, subtotal - discount)` for all payment methods. `matchCalculation` toggle (gated behind `enable_match_calculation`) overrides to use full `subtotal` (ignoring discounts)
- **Tips NOT taxed**: Tax applies to service charges only
- **Payment pre-fill**: Subtotal only (tax-exclusive). Payment Summary section shows full breakdown (Subtotal, GST, QST, Grand Total) for cashier reference. Discount entry does NOT auto-update payment fields
- **`payment_cash` semantics**: Stores **subtotal only** (tax-exclusive). EOD computes Cash ticket expected cash from `sale_tickets.subtotal` (not `payment_cash`), making it independent of pre-fill behavior. Fallback to `payment_cash` when `subtotal = 0` (old tickets). Discount % always calculated from `subtotal`
- **Stored on ticket**: `tax_gst`, `tax_qst`, `tax` (sum), `subtotal` columns on `sale_tickets`
- **Rounding**: GST and QST rounded independently to nearest cent
- **Insights**: "Tax Collected" metric card appears when `taxCollected > 0`

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
| `inventory_transaction_item_photos` | Photos per transaction item (proof of receipt) |
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
| `resources` | Resource items (SOPs, manuals, training materials) |
| `resource_categories` | Subcategories within resource tabs |
| `resource_tabs` | Dynamic tab definitions per store (slug, icon, order) |
| `resource_read_status` | Per-employee read tracking for resources |
| `resource_photos` | Photos attached to resources (thumbnails, procedure images) |
| `cash_transaction_photos` | Photos attached to cash transactions (withdrawal receipts) |

### Important Fields

**sale_tickets**: `ticket_no` (auto-generated), `ticket_date` (YYYY-MM-DD), `opened_at`/`closed_at`/`completed_at` (timestamps), `payment_method` (cash/card/mixed/gift_card), `approval_status` (pending_approval/approved/auto_approved/rejected), `approval_required_level` (technician/supervisor/manager/owner), `requires_admin_review` (boolean), `voided_at`/`voided_by`/`void_reason` (void fields), `subtotal`/`tax`/`tax_gst`/`tax_qst` (tax fields, default 0.00)

**ticket_items**: `started_at`/`timer_stopped_at`/`completed_at` (service timer), `tip_customer_cash`/`tip_customer_card`, `tip_receptionist`, `payment_cash`/`payment_card`/`payment_gift_card`

**store_services**: `requires_photos` — when true, tickets with this service require min 1 photo + notes

**inventory_purchase_lots**: `lot_number` (auto-generated, e.g. OM-2026-00001), `quantity_received`/`quantity_remaining`, `status` (active/depleted/expired/archived)

**inventory_transactions**: `transaction_type` (in/out/transfer), `destination_store_id` (for transfers), `transaction_number` (prefixed IN-/OUT-/XFER-)

**inventory_transaction_items**: `received_quantity` (nullable, set by destination manager for partial receipt on transfers)

**inventory_distributions**: `status` (pending/acknowledged/in_use/returned/consumed/cancelled), `distribution_batch_id` (groups rows from single distribute call), `manager_approved`/`manager_approved_by_id`/`manager_approved_at` (management approval), `distributed_by_role` (creator's highest role for approval routing)

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

### Batched `.in()` Queries
Use `batchIn()` from `src/lib/batch-queries.ts` when querying with large ID lists to avoid URL length limits. Chunks IDs into batches of 50.

```typescript
import { batchIn } from '../lib/batch-queries';

const items = await batchIn<{ id: string; name: string }>(
  (ids) => supabase.from('inventory_items').select('id, name').in('id', ids),
  inventoryItemIds
);
```

### Multi-Store Filtering
Always filter by `store_id` when querying store-specific data:

```typescript
.eq('store_id', selectedStoreId)
```

---

## Recent Changes (Jan 23 – Feb 19, 2026)

Changes grouped by feature area. All dates in 2026.

### Resources: Thumbnail Source Picker — Photo or URL (Feb 19)
- Replaced disconnected thumbnail UX (star buttons on photos + separate Thumbnail URL input) with unified Thumbnail section in ResourceModal. Pill toggle buttons ("From Photo" / "From URL") using same styling as Visibility section pills (`bg-blue-100 text-blue-700 border-blue-300` selected pattern). Photo mode shows clickable 16x16 grid of uploaded photos with `ring-2 ring-blue-500` + checkmark overlay (`Check` icon) on selection. URL mode shows text input with live image preview. Switching modes clears the other source (mutual exclusivity preserved). New `thumbnailMode` state (`'photo' | 'url'`) initialized from edit data in `loadExistingPhotos`: photo match → `'photo'`, standalone URL → `'url'`, default → `'photo'`. Removed `Star` import, added `Check` from lucide-react. No changes to `handleSetAsThumbnail`, `handleSave`, or photo operations. No DB changes. Files: `ResourceModal.tsx`

### Resources: Unread Ribbon with Navigation Blocking (Feb 19)
- Persistent emerald-green ribbon banner (`UnreadResourcesRibbon.tsx`) when employee has unread resources, modeled on `VersionNotification.tsx`. Fixed `top-0 z-50` positioning with `animate-slideDown`. Shows unread count and "Read Now" button that navigates to Resources page. Navigation guard (`guardedNavigate`) wraps all 3 `onNavigate` call sites in Layout (sidebar nav items, Settings button, Opening Cash "Count Now" button) — blocks with warning toast when `unreadResourcesCount > 0` and target is not Resources. Logout and store switching bypass guard naturally (different function calls). Ribbon hidden when on Resources page or when all resources are read. No DB changes — reuses existing `get_unread_resources_count` RPC + 60s polling + realtime. i18n keys added in all 4 locales. Files: `UnreadResourcesRibbon.tsx` (new), `Layout.tsx`, `i18n.ts`

### Resources: Visibility Targeting (Feb 19–20)
- Three-dimensional visibility control on resources: by stores (`visible_store_ids`), by roles (`visible_roles`), and by individual users (`visible_employee_ids`). Nullable array columns on `resources` — `NULL` means no restriction (backwards-compatible). AND logic: employees must match ALL non-null constraints. New collapsible Visibility section in ResourceModal with "All"/"Select Specific" pill toggles for each dimension. Role-scoped data fetching: Admin/Owner see all stores and all employees globally, "All Stores" saves `NULL`; Manager sees only their assigned stores (via `employee_stores`) and employees at those stores, "All My Stores" saves actual store ID array instead of `NULL`. UI labels change by role ("All Stores"/"All Users" vs "All My Stores"/"All My Users"). Manager editing an Admin-created global resource narrows visibility to Manager's stores on save. Client-side filtering in ResourcesPage: `visibleResources` memo applies store/role/user filters for non-management roles; Admin/Owner/Manager bypass. Tab counts and subcategory counts use visibility-filtered list. Unread badge RPCs updated with visibility WHERE clauses so restricted resources don't inflate counts for excluded employees. `Resource` interface updated with three nullable array fields. Migration applied to both Salon360QC and Salon365 production databases (Feb 19). Files: `ResourceModal.tsx`, `ResourcesPage.tsx`, `supabase.ts` + migration

### Inventory: Show All Stores in Transfer Destination (Feb 19)
- Removed role-based branching in `fetchAvailableStores()`. Previously, non-Admin/Manager/Owner roles (Supervisor, Receptionist, Cashier) could only see stores from their `employee_stores` assignments — single-store employees got an empty destination dropdown since their only store was filtered out. Now all roles query all active stores from the `stores` table. Current store exclusion preserved. No DB changes. Files: `InventoryTransactionModal.tsx`

### Prevent Future Date Navigation (Feb 19)
- All date navigators now prevent navigating into the future. Forward ChevronRight arrows hidden (CSS `invisible` — preserves layout) when at today or current period. Date inputs capped with `max={getCurrentDateEST()}`. Navigation functions have early-return guards. Group 1 (existing guards, disabled→invisible): TicketsPage, EndOfDayPage, TipReportPage detail view, PendingApprovalsPage. Group 2 (new guards): SafeBalancePage (`isAtToday` + `max` on date input + guard in `goToNextDay`), TipReportPage weekly view (`isCurrentWeek()` helper + guard in `navigateWeek`), TipReportPage period view (reuses `isCurrentPeriod()` + guard in `navigatePeriod`), AttendancePage (`isCurrentOrFuturePeriod()` using payroll anchor period math + guard in `navigateNext`), TicketsPeriodView and TipReportWeeklyView (`isCurrentOrFuturePeriod()` using `getDateRange()` comparison + guard in `navigatePeriod`). Group 3 (filter date inputs): InventoryPage Lots/Distributions "To Date" inputs, PendingApprovalsPage Queue History "End Date", CustomDateRangeModal both inputs — all get `max={getCurrentDateEST()}`. No DB changes. Files: `TicketsPage.tsx`, `EndOfDayPage.tsx`, `TipReportPage.tsx`, `PendingApprovalsPage.tsx`, `SafeBalancePage.tsx`, `AttendancePage.tsx`, `TicketsPeriodView.tsx`, `TipReportWeeklyView.tsx`, `InventoryPage.tsx`, `CustomDateRangeModal.tsx`

### Resources: Rich Text Editor for Descriptions (Feb 19)
- Replaced plain `<textarea>` with Tiptap WYSIWYG editor in ResourceModal. Toolbar: Bold, Italic, Underline, H2, H3, Bullet List, Ordered List, Inline Image. Image button opens file picker, compresses via `compressImage()`, uploads to R2 at `resources/{storeId}/inline/{ts}_{uuid}.jpg`, inserts `<img>` into editor. `RichTextEditor.tsx` lazy-loaded via `React.lazy()` inside ResourceModal (385KB chunk loads only when modal opens). New `RichTextContent.tsx` renders stored HTML in view modal using DOMPurify sanitization (strict whitelist: p, br, strong, em, u, h2, h3, ul, ol, li, img). New `description_text` column stores plain-text extraction (via `editor.getText()`) for card previews and search filtering — avoids matching HTML tags. Card previews use `description_text || description`. Search uses `description_text || description`. ProseMirror + `.rich-text-content` styles in `index.css`. Existing plain-text descriptions are backwards-compatible (Tiptap wraps in `<p>` on load). Fix: removed explicit `Underline` extension import — Tiptap v3 StarterKit bundles it by default; duplicate registration caused "Duplicate extension names" warning and content disappearing during editing. Fix: added `useEffect` to sync `content` prop into editor via `editor.commands.setContent()` — Tiptap's `useEditor` only reads `content` at creation time, so late-arriving data from `ResourceModal`'s `useEffect` was ignored, leaving the editor blank on edit. Guard `content !== editor.getHTML()` prevents infinite update loops. Files: `RichTextEditor.tsx` (new), `RichTextContent.tsx` (new), `ResourceModal.tsx`, `ResourcesPage.tsx`, `supabase.ts`, `index.css` + migration

### Match Calculation Toggle (Feb 19)
- Configurable `enable_match_calculation` setting (Payment category, display_order 75, default OFF). Depends on `enable_tax`. When enabled, a full-width "Match Calculation" toggle button appears below the Payment Summary box in the payment modal. Clicking activates emerald-green state; tax functions (`calculateTaxGst`/`calculateTaxQst`) use `subtotal` only as the tax base, ignoring discounts — same behavior as Cash payments. Disabled for closed/read-only tickets. ConfigurationPage auto-renders the toggle via existing boolean rendering with "Requires: Enable Tax" dependency indicator. New `match_calculation` boolean column on `sale_tickets` (default false) persists the toggle state. On ticket load, state initializes from DB; on View Payment Details of closed tickets, restores saved value instead of resetting to false. `SaleTicket` interface updated with `match_calculation`. Files: `TicketEditor.tsx`, `supabase.ts` + migration

### Card Options: Interac / Mastercard / Visa Toggle (Feb 19)
- Configurable `enable_card_options` setting (Payment category, display_order 95, default OFF). Depends on `enable_card_payments`. When enabled, three pill buttons (Interac, Mastercard, Visa) appear above the card payment input in the payment modal for Card and Mixed payment methods. Selection is required — `handlePaymentModalSave` blocks with toast if no card type selected. Selected card type persisted as `card_type` column on `sale_tickets` (nullable text: `'interac'`, `'mastercard'`, `'visa'`, or NULL). Cleared to NULL for Cash payments. Loaded on ticket edit. ConfigurationPage auto-renders the toggle via existing boolean rendering. `SaleTicket` interface updated with `card_type`. No changes to Insights page (existing placeholder logic unchanged). Files: `TicketEditor.tsx`, `supabase.ts` + migration

### Resources: Manage Categories Button Moved to Pills Row (Feb 19)
- Moved "Manage Categories" gear icon from the page header into the subcategory filter pills row, appearing as the last item after all category pills. Each tab shows its own inline gear button. Condition widened from `currentTabSubcategories.length > 0` to `(currentTabSubcategories.length > 0 || canManage)` so managers see the pills row (with just the gear icon) even on empty tabs — enabling them to add the first category. "All" pill wrapped in inner conditional to hide when no subcategories exist. Icon scaled down to `w-4 h-4` with subtle `text-gray-400` styling. No DB changes. Files: `ResourcesPage.tsx`

### Resources: Scroll-Gated "Mark as Read" Button (Feb 19)
- "Mark as Read" button in resource view popup now requires scrolling to the bottom of the content before becoming clickable. Three button states: disabled-gray with `ChevronDown` icon ("Scroll to Read") when unread and not scrolled, active-emerald ("Mark as Read") when scrolled to bottom, and disabled-emerald ("Read") for already-read resources. Short content that doesn't overflow auto-enables the button via a post-render `scrollHeight` check. 5px threshold accounts for sub-pixel rounding. State resets on resource change. No DB changes. Files: `ResourcesPage.tsx`

### Resources: Photo Upload in Add/Edit Resource Modal (Feb 19)
- Up to 3 photos per resource via camera capture or file picker in ResourceModal. Photos staged locally as compressed blobs, uploaded to R2 on save. Star button on each photo thumbnail lets user designate one as the resource card thumbnail (sets `thumbnail_url` on the resource). Mutually exclusive with the Thumbnail URL text field — selecting a photo clears the URL and vice versa. Edit mode loads existing photos from `resource_photos` table, supports remove + add + change thumbnail. Storage path: `resources/{storeId}/{resourceId}/{ts}_{uuid}.jpg`. New `resource_photos` table (same schema as `ticket_photos`/`cash_transaction_photos`). `ResourcePhoto`/`ResourcePhotoWithUrl` interfaces added. Files: `ResourceModal.tsx`, `supabase.ts` + migration

### Safe Withdrawal: Photo Upload + CashCountModal Drawer Conversion (Feb 19)
- Photo capture on safe withdrawal modal — up to 3 photos (receipts, proof of withdrawal) staged during form entry, uploaded to R2 after transaction creation. Photos stored in `cash_transaction_photos` table. `SafeWithdrawalModal` passes `pendingPhotos` array in `WithdrawalData`. `SafeBalancePage` handles R2 upload via `uploadWithdrawalPhotos()` after `create_cash_transaction_with_validation` RPC returns transaction ID. Storage path: `cash-transactions/{storeId}/{transactionId}/{ts}_{uuid}.jpg`. New `cash_transaction_photos` table. Files: `SafeWithdrawalModal.tsx`, `SafeBalancePage.tsx`, `CashCountModal.tsx`, `supabase.ts` + migration
- CashCountModal converted from centered Modal to right-slide Drawer component. Files: `CashCountModal.tsx`

### EOD Cash Modals: Drawer Conversion (Feb 19)
- Converted 3 remaining EOD cash-related popups from centered Modal to right-slide Drawer for consistency with CashCountModal and SafeWithdrawalModal. CashTransactionModal uses dynamic footer that switches between form mode (Void/Cancel/Submit) and void mode (Back/Request Void); form submit button linked via `form="cash-transaction-form"` attribute since it lives outside the `<form>` tag. TransactionListModal moves summary totals (Approved/Pending/Rejected) and Close button into sticky Drawer footer; removes `max-h-[400px]` constraint; edit history modal rendered as sibling (not child) to avoid z-index stacking issues. No DB changes. Files: `CashTransactionModal.tsx`, `TransactionListModal.tsx`, `CashTransactionEditHistoryModal.tsx`
- Widened CashCountModal and CashTransactionModal denomination drawers from `md` (384px) to `lg` (512px) to match TransactionListModal and CashTransactionEditHistoryModal. All 4 EOD cash drawers now consistently use `lg`. No DB changes. Files: `CashCountModal.tsx`, `CashTransactionModal.tsx`

### Inventory: Tab Reorder — Transactions Before Items (Feb 18)
- Swapped tab order in `tabConfig` array so Transactions appears first. Default `activeTab` changed from `'items'` to `'transactions'`. Final order: Transactions, Items, Lots, Distributions, Suppliers. No migration. Files: `InventoryPage.tsx`

### Resources: Login Redirect for Unread Content (Feb 18)
- On login, if the employee has unread resources at the selected store, auto-redirect to Resources page instead of Tickets. Uses existing `get_unread_resources_count` RPC. `useRef` flag (`hasCheckedUnreadRef`) ensures the check fires exactly once per login session — not on store switches or re-renders. Ref resets on logout so next login triggers a fresh check. If the RPC fails, silently falls through to default Tickets page. No migration. Files: `App.tsx`

### Match Calculation Save→View Persistence Fix (Feb 19)
- Fixed Match Calculation toggle reverting to OFF after Save (without close) then View Payment Details. Three root causes: (1) `handleViewPaymentDetails` gated `match_calculation` restore behind `isTicketClosed`, forcing `false` for open tickets; (2) `handlePaymentMethodClick` hardcoded `setMatchCalculation(false)`, losing state on payment method re-selection; (3) `handleSave` never synced `ticket` React state after DB write, leaving `ticket?.match_calculation` stale. Fixes: both reset sites now read `!!ticket?.match_calculation`, and `setTicket` call after update save syncs the local state. No DB changes. Files: `TicketEditor.tsx`

### Closed Ticket Tax Display Fix (Feb 19)
- Payment Summary on closed tickets now returns stored `tax_gst`/`tax_qst` from the database instead of recalculating. Previously, `calculateTaxGst()`/`calculateTaxQst()` always recalculated with `matchCalculation = false` (its default), showing wrong tax when Match Calculation was used at save time. Early-return pattern: `if (isTicketClosed) return Number(ticket?.tax_gst) || 0`. No DB changes. Files: `TicketEditor.tsx`

### Unified Tax Base — Always `subtotal - discount` (Feb 19)
- Reverted Feb 18 payment-method branching. Tax base is now `max(0, subtotal - discount)` for **all** payment methods (Cash, Card, Mixed, Gift Card). Discount always reduces the tax base. The `matchCalculation` toggle (gated behind `enable_match_calculation`) remains as an override to force tax on full `subtotal` when needed. No DB changes. Files: `TicketEditor.tsx`

### Resources: Tab Reordering in Manage Tabs Modal (Feb 18)
- Up/down arrow buttons on each tab row in TabManagementModal to swap adjacent tabs' `display_order` values. Arrows disabled at boundaries (first/last), during active edit, or during in-progress reorder. Swaps actual `display_order` values (not array indices) to correctly handle non-contiguous orders after deletions. No migration — uses existing `display_order` column and RLS policies. Files: `ResourcesPage.tsx`

### Resources: Unread Count RPC Type Fix (Feb 19)
- Fix `get_unread_resources_count_by_tab` RPC throwing PostgreSQL 42804 error. Function declared `RETURNS TABLE(tab_slug TEXT, ...)` but query returned `r.category` which is `VARCHAR(50)` — PostgreSQL strict return type matching rejected the mismatch. Added `::text` cast on `r.category` in the SELECT. No frontend changes. Migration only

### Resources: Dynamic Tabs + Unread Notification System (Feb 18)
- Replaced hardcoded 2-tab system (SOP, Employee Manual) with fully dynamic tabs. New `resource_tabs` table stores per-store tab definitions (name, slug, icon_name, display_order). Managers can create/rename/delete tabs via Tab Management Modal with icon picker (10 curated lucide icons). Slug auto-generated from name. Existing `sop` and `employee_manual` tabs seeded from current data. Dropped CHECK constraints on `resources.category` and `resource_categories.tab` — both now accept any string matching a `resource_tabs.slug`. `ResourceCategory` TypeScript type widened from union to `string`. Files: `ResourcesPage.tsx`, `ResourceModal.tsx`, `supabase.ts`, `permissions.ts`, `resource-icons.ts` (new), `i18n.ts` + migration
- Unread resource tracking via `resource_read_status` table (absence = unread). "Mark as Read" button in resource view popup footer (emerald green → disabled "Read" state after click). Blue dot indicator on unread resource cards, red badge pills on tab headers showing per-tab unread count. Sidebar badge in Layout.tsx via `get_unread_resources_count` RPC (60s polling + realtime on `resources` INSERT and `resource_read_status` changes). Optimistic UI updates with rollback. Two new RPCs: `get_unread_resources_count` (sidebar total) and `get_unread_resources_count_by_tab` (per-tab counts). Files: `ResourcesPage.tsx`, `Layout.tsx`, `supabase.ts` + migration

### Approvals: Inline Ticket Viewer on Tickets and Ticket Changes Tabs (Feb 18)
- Eye icon "View" button added to Pending Approvals → Tickets tab, reusing the same `handleViewTicket` / `viewingTicketId` state / `<TicketEditor>` drawer already built for the Ticket Changes tab. View button shown for all users (replaces "View only" text); Approve/Reject buttons still gated behind `canTakeActions`. `handleViewTicket` parameter widened from `PendingTicketReopenRequest` to `{ ticket_id: string; ticket_date: string }` so both tabs share one handler. No DB changes. Files: `PendingApprovalsPage.tsx`

### EOD Expected Cash: Grand Total for Cash Tickets (Feb 18)
- EOD "Expected Cash Collected" now branches by `payment_method`. Cash tickets: computes Grand Total from `sale_tickets.subtotal - discount + tax_gst + tax_qst + cash_tips`, independent of `payment_cash` pre-fill. Mixed tickets: uses `payment_cash + cash_tips` (user-entered cash portion). Card/gift_card: skipped. Fallback for old tickets (`subtotal = 0`): uses `payment_cash` as base. No DB changes. Files: `EndOfDayPage.tsx`

### Payment Prefill: Subtotal Only (Feb 18)
- Changed payment field prefill from `subtotal + tax` to subtotal only (tax-exclusive). Payment Summary section already shows full Grand Total breakdown, so cashiers reference that for collection amount. Removed `calculateTaxInclusivePayment()` helper — discount handlers no longer auto-update `payment_cash`/`payment_card`. DB backfill: subtracted stored tax from `payment_cash`/`payment_card` on Feb 17-18 closed tickets. Files: `TicketEditor.tsx`, `EndOfDayPage.tsx`

### Tickets — High Add-On Photo Requirement (Feb 17)
- Require photos and notes when any ticket item has an add-on price > $15. Reuses existing `requires_photos` validation (min 1 photo + notes on close). Photo upload section and required indicators shown on new tickets with high add-ons. No DB changes. Files: `TicketEditor.tsx`

### Tax Feature (Feb 17)
- Configurable GST/QST sales tax on service charges. 3 new `app_settings`: `enable_tax` (boolean, off by default), `tax_rate_gst` (5.0%), `tax_rate_qst` (9.975%). Tax is additive — calculated on `max(0, subtotal - discount)`. Tips are NOT taxed. Payment pre-fill is tax-inclusive (subtotal + GST + QST), keeping EOD formula unchanged. New columns on `sale_tickets`: `tax_gst`, `tax_qst` (numeric, default 0.00). Existing `subtotal` and `tax` columns now populated on save. Payment Summary in TicketEditor shows Service Subtotal, Discounts, GST/QST lines (when enabled), and updated Grand Total. ConfigurationPage auto-renders settings with `%` unit labels and decimal step for rate fields. Insights page adds conditional "Tax Collected" metric card (orange, Receipt icon) when `taxCollected > 0`. `SalesSummary` interface extended with `taxCollected`. i18n keys added: `gst`, `qst`, `serviceSubtotal`, `taxCollected` in all 4 languages. Files: `TicketEditor.tsx`, `SalesMetrics.tsx`, `useSalesData.ts`, `ConfigurationPage.tsx`, `supabase.ts`, `i18n.ts` + migration
- Tickets page Total column now tax-aware. `getGrandTotalCollected()` rewritten from payment-based to subtotal-based: sums `price_each + addon_price` across items, subtracts discount, conditionally adds stored `tax_gst + tax_qst` when `enable_tax` is ON, plus card tips. Old tickets (tax fields default 0) unaffected. No double-counting — previous payment-based approach replaced entirely. No DB changes. Files: `TicketsPage.tsx`

### Client Details Drawer Width (Feb 17)
- Widened Client Details drawer from `lg` (512px) to `xl` (896px) so Visit History table columns (Date, Service, Technician, Color, eye icon) display without truncation. No database changes. Files: `ClientDetailsModal.tsx`

### Client Visit History Redesign (Feb 17)
- Redesigned Visit History tab from expandable accordion rows to flat table with columns: Date, Service, Technician, Color, and eye icon button. All info visible at a glance without clicking to expand. Eye icon opens full TicketEditor as z-50 overlay on top of the Drawer. Removed `ChevronDown`/`ChevronUp` expand/collapse, added `Eye` icon. Commission employee tip hiding (`shouldHideTips`) passed to TicketEditor. "Open" badge shown next to date for unclosed tickets. Colors in purple text, technicians deduplicated. No database changes. Files: `ClientDetailsModal.tsx`

### Tip Report Period Tab (Feb 17)
- Added Period tab to Tip Report page showing 14-day bi-weekly payroll cycle tips per technician per day. Uses same payroll anchor as AttendancePage (Oct 13, 2024). Reuses `WeeklyCalendarView` with 14-column `periodDates`. New functions: `getPeriodDateRange()`, `getPeriodDates()`, `getCurrentPeriodLabel()`, `navigatePeriod()`, `isCurrentPeriod()`, `fetchPeriodData()`. Period navigation (prev/next ±14 days, Today button) on both mobile and desktop. Hidden from Receptionist/Cashier via existing `visibleViewModes` filter. No database changes. Files: `TipReportPage.tsx`

### Historical Approvals on All Tabs (Feb 16)
- Added Historical Approvals section to Inventory, Cash, Transaction Changes, and Ticket Changes tabs on Pending Approvals page. Previously only Tickets, Attendance, and Violations tabs showed history — approved/rejected items disappeared on other tabs. 4 new RPCs: `get_historical_inventory_approvals`, `get_historical_cash_transaction_approvals`, `get_historical_transaction_change_approvals`, `get_historical_ticket_reopen_approvals`. Each returns up to 50 recent records with reviewer info. Cash history applies same role-based filtering as pending (Supervisor sees Receptionist/Cashier only). Fixed `handleRejectInventory` and `handleRejectCashTransaction` not recording `manager_approved_by_id`/`manager_approved_at` on rejection. 4 new TypeScript interfaces. Historical sections use same visual pattern as Tickets tab (green/red borders, status+type badges, reviewer timestamp, "Showing X of Y"). Files: `PendingApprovalsPage.tsx`, `supabase.ts` + migration

### Cash Management Date Display Fix (Feb 16)
- Fix Cash Management tab showing dates one day behind (e.g., Feb 16 → Feb 15). `formatDateEST()` parsed date-only strings (`"2026-02-16"`) as UTC midnight, which rolled back to previous day in EST. Switched to `formatDateOnly()` which parses date components manually in local time. Files: `PendingApprovalsPage.tsx`

### Cash Transaction Approvals Inline Status (Feb 16)
- Show approver info inline on Pending Approvals Cash Management tab after approve/reject. Previously transactions disappeared immediately on action. Now processed transactions stay visible with green (approved) or red (rejected) styling, showing approver name, timestamp, and rejection reason. Uses local state (`processedCashTransactions`) — cleared on next data re-fetch (tab switch, date change, periodic refresh). No DB changes needed. Files: `PendingApprovalsPage.tsx`

### Inventory Master Item Expansion Fix (Feb 16)
- Fix master items with no sub-items showing blank expansion. After cleanup migrations some masters (e.g., "Original 066") had zero sub-items but still had stock/lots. Expansion only iterated `sub_items` array — empty array produced nothing. Added fallback: when a master has no sub-items, render its lots directly under the master row (blue styling, `pl-10`). Updated `isExpandable` to require sub-items OR master-level lots (masters with neither are no longer clickable). Badge shows "N lots" instead of "0 variants" when applicable. Files: `InventoryPage.tsx`

### Insights Schema Fix (Feb 15)
- Fix Insights page not loading on Salon365: `useSalesMetrics` selected `tax` column from `sale_tickets` but Salon365 was missing that column (schema divergence from initial migration). Removed unused `tax` from both current/previous period queries (dead code — never referenced in calculations). Added `subtotal`, `tax`, `line_subtotal` columns to Salon365 for schema consistency. Files: `useSalesData.ts` + migration

### Inventory Purchase Units Immediate Save (Feb 15)
- New purchase units now saved to database immediately on checkmark click instead of deferred as "pending" with temp IDs. Removed `PendingPurchaseUnit` interface and `pendingPurchaseUnits` state. `handleAddPurchaseUnit` is now async — inserts into `store_product_purchase_units`, handles 23505 duplicates, refreshes cache so unit appears in dropdown as normal saved entry. Removed pending unit persistence blocks from `handleSubmit` and `handleSaveDraft`. Removed ⏳ indicator options from dropdown. Checkmark/cancel buttons disabled with pulse animation while saving. Files: `InventoryTransactionModal.tsx`

### Inventory Product Preference RPC Fix (Feb 15)
- Fix `update_product_preference` RPC 404 errors on "In" transaction submit: frontend passed `p_unit_cost`/`p_employee_id` but DB function expects `p_purchase_cost`/`p_updated_by_id`. PostgREST matches by name+params, so mismatched names caused 404. Fixed both call sites (direct submit + draft submit). Files: `InventoryTransactionModal.tsx`

### Inventory Items Name Constraint Fix (Feb 15)
- Fix sub-item creation corrupting master item: creating a sub-item with parent's name triggered 23505 fallback that overwrote the parent's hierarchy fields. Replaced global `UNIQUE(name)` constraint with two partial indexes: `UNIQUE(name) WHERE parent_id IS NULL` for top-level items and `UNIQUE(name, parent_id) WHERE parent_id IS NOT NULL` for sub-items. 23505 fallback handlers in `InventoryItemModal.tsx`, `InventoryTransactionModal.tsx`, and `CsvImportModal.tsx` now query by name+parent_id scope and no longer overwrite `is_master_item`/`parent_id`. Files: `InventoryItemModal.tsx`, `InventoryTransactionModal.tsx`, `CsvImportModal.tsx` + migration

### Inventory Items (Feb 15)
- Items tab table: removed Description and Qty (Lot) columns (10→8 columns). Added `min-w-[200px]` to Name column, `whitespace-nowrap` to Supplier column. Files: `InventoryPage.tsx`
- Separate search state for Items and Suppliers tabs — each tab now has independent search query. Files: `InventoryPage.tsx`
- Removed redundant "DND DC " prefix from 362 item names (already categorized under DND categories). Migration only
- Converted all standalone items to master items (`is_master_item = true` where `parent_id IS NULL`). Added CHECK constraint enforcing top-level items must be masters. "In" transactions only allow sub-items (items with `parent_id`); masters are group headers. CSV import `itemLookup` restricted to sub-items only. Files: `InventoryTransactionModal.tsx` + migration

### Inventory Lots Cleanup (Feb 15)
- Removed expiration date functionality from inventory lots (unused by salon). Dropped `expiration_date` column, `expired` lot status, "Expiring Soon" summary card, and expiry warnings. Updated `update_lot_status()` and `get_available_lots_fifo()` functions. Files: `InventoryPage.tsx`, `supabase.ts`, `i18n.ts` + migration
- Show transaction number instead of batch number in Lots tab detail row. Reverse join through `inventory_transaction_items` → `inventory_transactions` to fetch `transaction_number`. Files: `InventoryPage.tsx`, `supabase.ts`

### Inventory Transaction Detail Fix (Feb 14)
- Fix "Failed to load transaction details" for large transactions (300+ items). Batched `.in()` queries for inventory items and photos using shared `batchIn()` utility. Files: `TransactionDetailModal.tsx`, `batch-queries.ts`, `useClients.ts`

### Inventory Transaction Photos (Feb 14–15)
- Per-item photo capture in "In" transaction drawer — camera icon per item row, up to 3 photos each. Photos held as pending blobs, uploaded to R2 after transaction submit. Files: `InventoryTransactionModal.tsx`, `useInventoryItemPhotos.ts`, `image-utils.ts` + migration
- Dual photo input: Camera icon (capture) + Paperclip icon (gallery/file picker) per item row. Same upload flow for both sources. Files: `InventoryTransactionModal.tsx`
- Invoice-level photos: up to 3 photos per transaction (proof of supplier invoice). `inventory_transaction_invoice_photos` table (FK to `inventory_transactions` with CASCADE delete). Upload on submit, display in TransactionDetailModal. Files: `InventoryTransactionModal.tsx`, `TransactionDetailModal.tsx`, `supabase.ts` + migration
- New `inventory_transaction_item_photos` table (FK to `inventory_transaction_items` with CASCADE delete). Files: migration
- Photo display in TransactionDetailModal — inline thumbnails under each item name. Files: `TransactionDetailModal.tsx`
- Shared `compressImage()` extracted from `useTicketPhotos.ts` into `lib/image-utils.ts`. Files: `image-utils.ts`, `useTicketPhotos.ts`
- `InventoryTransactionItemPhoto` / `InventoryTransactionItemPhotoWithUrl` / `InventoryTransactionInvoicePhoto` / `InventoryTransactionInvoicePhotoWithUrl` interfaces. Files: `supabase.ts`

### Inventory Items (Feb 10–15)
- Item types: master (group) and sub-item (variation) — 2 radio options. Standalone type fully removed (DB CHECK constraint prevents creation). Files: `InventoryItemModal.tsx`, `InventoryPage.tsx`, `InventoryTransactionModal.tsx`, `CsvImportModal.tsx` + migration
- Master-level stock tracking: "In" selects sub-items, approval routes stock to parent master. "Out"/"Transfer" show master items only. Files: `InventoryTransactionModal.tsx`, `InventoryPage.tsx` + migration
- InventoryItemModal converted to right-side Drawer (`size="lg"`), fixed footer with form buttons. Files: `InventoryItemModal.tsx`
- Delete button in item edit drawer — removes `store_inventory_levels` row, attempts full delete (FK-safe). `canDeleteItems` permission. Files: `InventoryItemModal.tsx`, `permissions.ts`
- Brand field: `SearchableSelect` with "+ Add New Brand" free-text toggle. Hidden for master items. Files: `InventoryItemModal.tsx`
- Brand/Size/Reorder Level shown on master items; sub-item auto-fills from parent on selection. Files: `InventoryItemModal.tsx`
- Item type switchable during edit (not just creation). Files: `InventoryItemModal.tsx`
- Searchable parent item dropdown with category auto-fill. Files: `InventoryItemModal.tsx`
- Supplier field removed from item drawer (captured at transaction/lot level). Files: `InventoryItemModal.tsx`
- Edit button enabled for master items in table view. Files: `InventoryPage.tsx`
- Lot rows shown under sub-items (expandable, blue styling). Files: `InventoryPage.tsx`
- Auto-refresh on visibility change + manual refresh button on Items tab. Files: `InventoryPage.tsx`
- Orphaned sub-items (parent missing from store) displayed as flat rows. Files: `InventoryPage.tsx`
- Duplicate item name: 23505 fallback links existing item to current store. Files: `InventoryItemModal.tsx`
- 23505 fallback in transaction modal updates item hierarchy fields. Files: `InventoryItemModal.tsx`
- Re-categorized 91 non-DND items into 7 correct categories (migration only)
- Seeded "Bottle" purchase unit for all 362 DND items across stores (migration only)
- Category sections collapsed by default on first load; items sorted A→Z by name. Files: `InventoryPage.tsx`
- Auto-expand all categories when search query is active; collapse state restored when search cleared. Files: `InventoryPage.tsx`

### Inventory CSV Import/Export (Feb 13–15)
- Items tab: Download CSV + Import CSV (3-step modal: upload → preview → results). Files: `InventoryPage.tsx`, `CsvImportModal.tsx`
- Transaction CSV: Import button in "In" drawer + CSV Template download. 4-phase logic with `parent_name`, `purchase_unit`, `purchase_qty`, `purchase_unit_price` columns. Files: `InventoryTransactionModal.tsx`, `InventoryPage.tsx`
- Auto-create purchase units from CSV when `multiplier` column present. Files: `InventoryTransactionModal.tsx`
- Brand column in CSV import/export for both items and transactions. Files: `CsvImportModal.tsx`, `InventoryTransactionModal.tsx`
- Fix CSV import dropping brand/category/size on update and 23505 fallback paths. Files: `CsvImportModal.tsx`
- Auto-select purchase unit on CSV import when item has exactly 1 unit (recalculates stock units/costs). Files: `InventoryTransactionModal.tsx`

### Inventory Transactions (Feb 10–15)
- Transaction form converted to right-side Drawer (`size="xl"`). Total/Notes pinned to footer. Files: `Drawer.tsx`, `InventoryTransactionModal.tsx`
- Save as Draft: `'draft'` status, placeholder `DRAFT-<uuid>` numbers, resume editing, submit for approval. RPCs: `update_draft_transaction`, `submit_draft_transaction`, `delete_draft_transaction`. Files: `InventoryTransactionModal.tsx`, `InventoryPage.tsx`, `TransactionDetailModal.tsx`, `supabase.ts` + migration
- Delete Draft button (red) in drawer footer. Close drawer after saving draft. Files: `InventoryTransactionModal.tsx`
- Fix Save Draft blanking form (removed premature `setDraftToEdit(null)`). Files: `InventoryPage.tsx`
- Fix purchase unit input lost on draft save (auto-save in-progress units). Files: `InventoryTransactionModal.tsx`
- Brand searchable dropdown between Item and Purchase Unit for "In" transactions. Files: `InventoryTransactionModal.tsx`
- Grid layout adjustments: wider Item/Purchase Unit columns, narrower Qty/Price. Files: `InventoryTransactionModal.tsx`
- "+ Add New Supplier" option in transaction form. Files: `InventoryTransactionModal.tsx`
- Default Sub-Item type when creating item from transaction drawer. Files: `InventoryItemModal.tsx`, `InventoryTransactionModal.tsx`
- Hide "Select Unit" placeholder in Purchase Unit dropdown when item has exactly 1 unit (already auto-selected). Files: `InventoryTransactionModal.tsx`
- Fix purchase unit duplicate detection: changed from name-only to name+multiplier matching. Allows same unit name with different multipliers (e.g., "box" x400 and "box" x800). Updated DB unique constraint `(store_id, item_id, unit_name)` → `(store_id, item_id, unit_name, multiplier)`. Pending purchase units now shown in dropdown with ⏳ indicator. Cancel restores previous selection. Files: `InventoryTransactionModal.tsx`, `PurchaseUnitManager.tsx` + migration

### Inventory Transfers (Feb 10–13)
- Store-to-store transfers: `transfer` type, `destination_store_id`, `received_quantity` for partial receipt. `XFER-` prefix. `approve_inventory_transfer` RPC. Stock moves atomically on approval. Files: `InventoryPage.tsx`, `InventoryTransactionModal.tsx`, `PendingApprovalsPage.tsx`, `supabase.ts` + migration
- Inbound transfers shown at destination store with directional labels (→/←). Files: `InventoryPage.tsx`, `supabase.ts`

### Inventory Distributions (Feb 12–14)
- Distribution approval workflow: employee acknowledgment (`pending` → `acknowledged`) + management approval (`manager_approved`). Post-facto — stock moves immediately. RPCs: `get_pending_distribution_approvals`, `acknowledge_distribution`, `approve_distribution_by_manager`. Files: `PendingApprovalsPage.tsx`, `Layout.tsx`, `supabase.ts` + migration
- Dual approval badges on Distributions tab (employee status + manager status). Files: `InventoryPage.tsx`, `supabase.ts`
- Receptionist & Cashier granted distribute permission. Files: `permissions.ts`
- Employee dropdown filtered by today's attendance. Files: `EmployeeDistributionModal.tsx`
- Fix empty dropdown after master-level stock migration. Files: `EmployeeDistributionModal.tsx`
- EmployeeDistributionModal converted to Drawer with fixed footer. Files: `EmployeeDistributionModal.tsx`
- Fix Technician not seeing pending distribution approvals (badge counts). Files: `PendingApprovalsPage.tsx`
- Fix `distribute_to_employee` RPC status constraint (use `'pending'` not `'completed'`). Migration only
- Fix `get_pending_distribution_approvals` RPC column reference (`ii.name` not `ii.item_name`). Migration only

### Inventory DB Fixes (Feb 12–15)
- Fix duplicate lot number: restored `pg_advisory_xact_lock`, global scope, `p_offset` param. Migration only
- Fix lot/transaction number regex: replaced `\d` with POSIX `[0-9]`. Migration only
- Drop old `create_inventory_transaction_atomic` overloads (9/10-param) causing PGRST203. Migration only
- Clean up DND DC Original 066 sub-item/lots, convert to standalone. Migration only
- Fix lot creation in AFTER trigger — snapshot isolation prevents per-item MAX visibility. Rewrote `create_lots_from_approved_transaction()` to query MAX once, compute lot numbers as `base + index` (batch sequence). Eliminates per-item `generate_lot_number()` calls, savepoints, and retry loops. Advisory lock acquired once at top. Migration only

### Tickets (Feb 2–14)
- Void ticket: soft-delete with reason, excluded from all financial reports. `voided_at`/`voided_by`/`void_reason` columns. Admin keeps hard-delete. Files: `permissions.ts`, `TicketEditor.tsx`, `TicketsPage.tsx`, many report pages + migration
- Fix voided tickets blocking new ticket creation (exclude from unclosed check). Migration only
- Service picker grid for "Add Another Service" (category pills + colored buttons). Files: `TicketEditor.tsx`
- Service edit permissions simplified: Tech/Trainee edit until completed, others until closed. Files: `permissions.ts`
- `requires_photos` flag on services — validation on ticket close (min 1 photo + notes). Files: `TicketEditor.tsx`, `TicketPhotosSection.tsx`, `ServicesPage.tsx` + migration
- Fix service timers restarting on reopen: explicit `timer_stopped_at` set before clearing ticket fields. DB trigger `guard_timer_stopped_at` prevents nulling. Files: `PendingApprovalsPage.tsx`, `TicketEditor.tsx` + migration
- Phone masking: Technicians see `***-***-XXXX`, non-management masked on closed tickets. Files: `TicketEditor.tsx`
- Customer name column in Tickets table (desktop + mobile). Files: `TicketsPage.tsx`
- Remove `customer_type` field entirely. Files: `TicketEditor.tsx`, `TicketsPage.tsx`, `supabase.ts` + migration
- Color-coded service badges matching category colors. Files: `TicketsPage.tsx`
- Tip/notes/photo icons in Tickets table. Files: `TicketsPage.tsx`
- Live Payment Summary reads from temp input state. Files: `TicketEditor.tsx`
- Small service button styling (italic, pill shape, sorted by price DESC). Files: `TicketEditor.tsx`
- TicketEditor: flex column layout, footer button restyling, delete icons on all services. Files: `TicketEditor.tsx`
- Fix infinite reopen after change request navigation. Files: `TicketsPage.tsx`
- Fix ticket photos infinite loading (stable deps in `useTicketPhotos.ts`)
- Fix `set_approval_deadline()` broken column reference. Migration only

### Approvals & Permissions (Feb 4–14)
- Supervisor reopen request review (Receptionist/Cashier requests only). Files: `permissions.ts`, `PendingApprovalsPage.tsx` + migration
- Receptionist/Supervisor ticket approval rules tightened (must work on ticket, level-based visibility). Files: `permissions.ts`, `PendingApprovalsPage.tsx`
- Supervisors approve Cashier cash transactions. Files: `PendingApprovalsPage.tsx`
- Per-store pending approvals badge in store dropdown (30s polling + realtime). Files: `Layout.tsx`
- Sidebar approvals badge restored. Header standalone badge removed. Files: `Layout.tsx`
- Remove auto-redirect to Approvals page on login. Files: `App.tsx`, `AuthContext.tsx`

### Queue (Feb 4–8)
- Fix small_service bugs: removed `is_last_in_ready_queue` gate, restored `handle_ticket_close_smart()`. Migration only
- Skip turn with reasons (logged in `queue_skip_log`). Files: `HomePage.tsx`, RPCs
- Leave queue with reasons (logged in `queue_leave_log`). `QueueReasonModal` shared component
- Block Cashiers from ready queue (frontend + RPC). Files: `HomePage.tsx`
- Block `skip_queue_on_checkin` employees from manual join
- Auto-show Queue modal on login for in-queue users. Files: `Layout.tsx`
- Fix queue join timezone regression (UTC → store-aware). Migration only

### Tips & Attendance (Feb 6–7)
- Multi-select technician filter on Tip Report. Files: `TipReportPage.tsx`
- Today button on TipReport weekly view. Files: `TipReportPage.tsx`
- Independent per-page date navigation (no shared `selectedDate`). Files: `App.tsx`, multiple pages
- "Today" button on 5 pages (Tickets, TipReport, EOD, SafeBalance, Approvals)
- Fix auto check-out 1 hour early (EST time guard). Migration only

### Clients (Feb 3–15)
- ClientDetailsModal converted from centered popup modal to right-side Drawer (`size="lg"`). Status badge and edit button in `headerActions`, Close button in `footer`. Files: `ClientDetailsModal.tsx`
- Visit History tab replacing Color History (last 20 tickets, expandable). Files: `ClientDetailsModal.tsx`, `supabase.ts`
- `batchIn()` helper extracted to shared `lib/batch-queries.ts` (chunked `.in()` queries, 50 IDs per batch). Files: `batch-queries.ts`, `useClients.ts`, `TransactionDetailModal.tsx`
- Clickable column sorting on Clients (5 cols) and Employees (5 cols). Files: `ClientsPage.tsx`, `EmployeesPage.tsx`

### Roles & Auth (Feb 5–9)
- Trainee role: 8th role, Technician-level permissions, low queue priority. Files: permissions, RPCs, i18n
- Remove Spa Expert role from DB constraints, RPCs, translations
- Remove "View As" role impersonation. Files: `AuthContext.tsx`, `Layout.tsx`
- PIN auth error logging improvements

### Layout & Navigation (Feb 6–13)
- Hide Home page from sidebar. Files: `Layout.tsx`
- Configurable `app_slogan` setting (Configuration page → HomePage subtitle). Files: `SettingsContext.tsx`, `ConfigurationPage.tsx`, `HomePage.tsx` + migration
- Stale chunk recovery: `lazyWithReload()` + `ChunkErrorBoundary` fallback. Files: `App.tsx`

### UI Components (Feb 10)
- Drawer component: `size` prop (sm/md/lg/xl), `footer` prop (fixed footer with flex layout), `animate-slide-in-right`. Files: `Drawer.tsx`

### Initial (Jan 23)
- Fixed Admin approval permissions, lot creation race conditions, enhanced Distributions/Lots tabs
- Initial CLAUDE.md documentation
