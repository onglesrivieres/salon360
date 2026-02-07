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
│   ├── AuthContext.tsx        # Authentication, store selection, locale, "view as"
│   ├── SettingsContext.tsx    # App settings per store
│   ├── PermissionsContext.tsx # Role-based permission checking
│   ├── PermissionsCacheContext.tsx # Permission caching (5-min TTL)
│   └── NumericKeypadContext.tsx    # Shared numeric keypad for mobile
├── hooks/                     # Custom hooks
│   ├── useSalesData.ts        # Sales data fetching
│   ├── useClients.ts          # Client operations
│   ├── useWorkingHoursCheck.ts # Time restriction checking
│   └── ...
└── lib/
    ├── supabase.ts            # Supabase client + TypeScript interfaces
    ├── permissions.ts         # Permission checking logic per role
    ├── i18n.ts                # Translations (en, fr, vi)
    └── timezone.ts            # EST timezone utilities
```

### Context Provider Hierarchy (in App.tsx)

```
ToastProvider
  └── AuthProvider
        └── PermissionsProvider
              └── PermissionsCacheProvider
                    └── SettingsProvider
                          └── NumericKeypadProvider
                                └── AppContent
```

### Database / Supabase

- Migrations in `/supabase/migrations/` with format `YYYYMMDDHHMMSS_description.sql`
- Use `_TEMPLATE.sql` as starting point for new migrations
- All migrations must be idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`)
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Scripts

- `/scripts/migrations/`: Node.js scripts (.mjs) for database changes
- `/scripts/analysis/`: Data analysis and verification scripts

---

## Features & Pages

### 4.1 HomePage (`HomePage.tsx`)

**Purpose**: Welcome screen and authentication entry point.

**Key Functionality**:
- PIN-based employee authentication (4-digit)
- Check-in/check-out flow (creates attendance records)
- Ready queue management for technicians (join queue on check-in)
- Multi-store selection modal
- Language selector (English, French, Vietnamese)
- Version notification for app updates

**Business Logic**:
- Different flows for commission vs. salaried employees
- Store detection based on checked-in location
- Automatic queue joining on check-in
- Cooldown enforcement for queue removal
- Daily paid employees skip check-in flow

---

### 4.2 TicketsPage (`TicketsPage.tsx`)

**Purpose**: Core sales ticket management - create, edit, view, and approve service tickets.

**Key Functionality**:
- Ticket list view with filtering (open, closed, pending approval)
- **View Modes**:
  - Tickets table (default)
  - Daily report
  - Period report
- Ticket creation via TicketEditor modal
- Ticket editing and approval workflow
- **Filters**:
  - Approval status (pending, approved, rejected, auto-approved)
  - Payment method (cash, card, mixed, gift card)
  - Technician
  - Date range
- Date navigation (restricted for Cashiers/Receptionists)
- Mobile-responsive table and card views

**Advanced Features**:
- Time deviation detection (service completion vs. expected duration)
- Ticket approval status badges
- Self-service ticket creation (Technician/Supervisor)
- Commission employee tip hiding for non-management roles
- Service duration monitoring with color-coded status

**Ticket States**: Open → Completed → Closed → (Pending Approval) → Approved/Rejected

---

### 4.3 AttendancePage (`AttendancePage.tsx`)

**Purpose**: Employee attendance tracking and time-off management for payroll processing.

**Key Functionality**:
- Bi-weekly payroll period view (14-day calendar)
- Attendance by employee with daily shift details
- Check-in/check-out time recording
- Hours calculation with overtime tracking
- Support for hourly, daily, and commission employees
- Multi-store employee tracking with store codes
- CSV export for payroll
- Attendance change request proposals

**Business Logic**:
- 8-hour threshold for overtime calculation
- Overtime only counted for hourly employees when `count_ot` flag enabled
- Auto check-out timestamps shown in orange
- Pending change requests highlighted
- Employees grouped by pay type (Hourly, Daily, Commission)
- Technician/Receptionist restricted to viewing only their own attendance

---

### 4.4 TipReportPage (`TipReportPage.tsx`)

**Purpose**: Track and report technician tips from services performed.

**Key Functionality**:
- Daily and weekly tip views
- Tips breakdown by technician
- **Tip Types**:
  - Customer tips (cash + card)
  - Receptionist tips (paired with service)
- Multi-service ticket grouping
- Service duration tracking with timer status
- Service completion status indicators:
  - On-time (green)
  - Moderate deviation (yellow)
  - Extreme deviation (red)
- "Last ticket" detection (within 45min of store closing)
- Weekly calendar view with store breakdown
- CSV export

**Business Logic**:
- Only counts tips from approved tickets (legacy tickets counted)
- Commission employees cannot see tips (unless Manager+ role)
- Store isolation for multi-store employees
- Optional detailed tip breakdown per employee setting

---

### 4.5 EndOfDayPage (`EndOfDayPage.tsx`)

**Purpose**: Daily cash reconciliation and financial closure.

**Key Functionality**:
- **Opening Cash**: Manual entry or auto-fill from previous day's closing
- **Closing Cash**: Count all denominations
  - Bills: $100, $50, $20, $10, $5, $2, $1
  - Coins: $0.25, $0.10, $0.05, $0.01
- Cash in/out transactions (deposits, withdrawals)
- Cash discrepancy detection

**Formulas**:
```
Expected Cash = Cash payments + Cash tips - Discounts
Cash Variance = Actual Count - Expected Cash
Balanced = Variance < $0.01
```

**Business Logic**:
- Opening cash required before first ticket of the day
- Transaction categories: expenses, safe deposit, refunds, etc.
- Safe balance snapshot generation
- Transaction approval workflow

---

### 4.6 SafeBalancePage (`SafeBalancePage.tsx`)

**Purpose**: Track safe deposit/withdrawal operations and balance history.

**Key Functionality**:
- Opening/closing balance displays
- Safe deposits (cash-in transactions)
- Safe withdrawals (cash-out transactions)
- 14-day balance history table
- Balance mismatch warnings
- Change request proposals for approved transactions
- Date navigation with "Go to Today" button

**Business Logic**:
- Warning when opening balance ≠ previous closing balance
- Pending proposals shown on transactions
- Edit history for transactions

---

### 4.7 EmployeesPage (`EmployeesPage.tsx`)

**Purpose**: Employee master data management and scheduling.

**Key Functionality**:
- Employee list with search and filtering
- **Filters**: status (active/inactive), role, store
- Employee CRUD operations
- PIN reset functionality
- Multi-store assignment via `employee_stores`
- Weekly schedule setting (per-employee work days)
- **Pay Types**: hourly, daily, commission
- Role assignment (7 roles available)

**Employee Settings**:
- Tip display preference
- Paired tips calculation
- Attendance tracking enabled
- Overtime counting (OT) enabled

**Data Fields**:
- Display name, legal name
- Role, status (Active/Inactive)
- Pay type, hourly rate (if applicable)
- Notes and comments

---

### 4.8 ServicesPage (`ServicesPage.tsx`)

**Purpose**: Service catalog management for the store.

**Key Functionality**:
- Service list with search
- **Filters**: status (active/inactive/archived), category
- Service CRUD with: code, name, price, duration
- Service categories management (CRUD)
- Sorting and view modes (table/grid)
- Category color customization
- Average service duration calculation from past services
- Per-service `requires_photos` flag (mandatory photos & notes on new tickets)
- Service availability toggle

---

### 4.9 ClientsPage (`ClientsPage.tsx`)

**Purpose**: Client/customer management and blacklist system.

**Key Functionality**:
- Client list with search and filter
- **Filter Tabs**: All, Active, Blacklisted
- Client CRUD operations
- Blacklist/unblacklist with reason tracking
- Client deletion (permission required)
- Client statistics:
  - Visit count
  - Last visit date
  - Total spending
- Full phone number visibility (role-based)
- Client details modal with history

---

### 4.10 InventoryPage (`InventoryPage.tsx`)

**Purpose**: Comprehensive inventory management system.

**5 Tabs**:

#### Items Tab
- Inventory item CRUD
- Search and filter by: category, supplier, brand, status
- Low stock indicators (quantity < reorder level)
- Master/sub-item hierarchies
- Purchase unit configuration
- Item activation/deactivation

#### Transactions Tab
- Stock in/out transactions
- Transaction detail view
- Supplier attribution
- Approval workflow

#### Lots Tab
- Purchase lot tracking
- **Lot Statuses**: active, depleted, expired, archived
- Lot quantity tracking (received vs. remaining)
- Purchase date and supplier info
- Date range filtering
- Lot expansion view with distributions

#### Distributions Tab
- Employee inventory distribution tracking
- **Distribution Status Workflow**:
  ```
  pending → acknowledged → in-use → returned/consumed
  ```
- Distribution date range filtering
- Item-to-employee assignment
- Condition tracking

#### Suppliers Tab
- Supplier master data management
- Contact info and notes
- Status management (active/inactive)

---

### 4.11 InsightsPage (`InsightsPage.tsx`)

**Purpose**: Business analytics and reporting dashboard.

**4 Tabs**:
1. **Sales Overview**: High-level sales metrics and trends
2. **Sales Report**: Detailed sales breakdown by date/period
3. **Payment Types**: Payment method analysis (cash, card, mixed, gift card)
4. **Employee Sales**: Per-employee performance metrics

**Time Filtering**: Today, This Week, This Month, Last 30 days, Custom date range

---

### 4.12 ConfigurationPage (`ConfigurationPage.tsx`)

**Purpose**: Store-level settings and configuration.

**Key Functionality**:
- Store information management (name, address, contact)
- Operating hours setup per day of week
- Holiday configuration
- Store-specific feature toggles

---

### 4.13 SettingsPage (`SettingsPage.tsx`)

**Purpose**: Application-wide user settings.

**Key Functionality**:
- User preferences
- Display settings
- Notification preferences
- Change own PIN

---

### 4.14 PendingApprovalsPage (`PendingApprovalsPage.tsx`)

**Purpose**: Central approval workflow hub for all pending items.

**8 Tabs**:

1. **Tickets Tab**
   - Pending ticket approvals
   - Approve/reject with reasons
   - View historical approvals

2. **Inventory Tab**
   - Pending inventory transaction approvals
   - Two-tier approval (recipient + manager)

3. **Cash Transactions Tab**
   - Cash in/out transaction approvals
   - Amount, description, created by

4. **Transaction Changes Tab**
   - Proposed edits to existing transactions
   - Review and approve/reject

5. **Attendance Tab**
   - Attendance change proposals
   - Review proposed time changes

6. **Violations Tab**
   - Employee violation reports with voting system
   - Manager review and decision
   - Actions: warning, suspension, etc.

7. **Queue History Tab**
   - Queue removal records
   - Cooldown tracking

8. **Ticket Changes Tab**
   - Ticket reopen requests
   - Admin/Manager/Supervisor review (Supervisor: Receptionist/Cashier requests only)

---

### 4.15 LoginPage (`LoginPage.tsx`)

**Purpose**: Employee PIN authentication and check-in/out from lock screen.

**Key Functionality**:
- 4-digit PIN entry interface
- Check-in/out action (if `selectedAction` is 'checkin')
- Auto-submit on 4-digit completion
- Clear/reset button
- Keyboard number input support
- Error handling and feedback

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

---

### 5.3 Time-Based Access Restrictions

**Affected Roles**: Technician, Trainee, Cashier, Receptionist, Supervisor

**Access Window**: 8:45 AM to 30 minutes after store closing time

**Behavior**: Users in these roles see an "Outside Working Hours" page when accessing outside the window.

**Exempt Roles**: Admin, Owner, Manager (unrestricted access)

---

### 5.4 Date Restrictions

**Affected Roles**: Cashier, Receptionist

**Restriction**: Locked to viewing today's date only

**Behavior**: Date picker changes are silently ignored

**Affected Pages**: Tickets, Tip Report, End of Day, Safe Balance

**Other Roles**: Admin, Manager, Owner, Supervisor, Technician can view any historical dates

---

### 5.5 Check-In Requirements

**Affected Roles**: Receptionist, Supervisor, Technician, Trainee

**Requirement**: Must check in at a store before accessing the application

**Blocking Behavior**:
- "Check In Required" modal displayed
- Forced logout if not checked in
- Must be within store's access hours

---

### 5.6 Multi-Store Access Rules

**Admin/Manager/Owner**: Can access ALL active stores

**Other Roles**: Can only access stores explicitly assigned via `employee_stores` table

**Store Switching**:
- Allowed if employee is not checked in
- **Blocked** if Receptionist, Supervisor, Technician, or Trainee is currently checked in

---

### 5.7 Role Impersonation ("View As")

**Available To**: Admin and Owner only

**Purpose**: View application as another role for debugging/support

**Indicator**: Banner displayed when viewing as another role

**Behavior**: All permissions checked against impersonated role, not actual role

---

### 5.8 Employee Management Role Restrictions

| Actor Role | Can Manage |
|------------|------------|
| Admin | All employees (no restrictions) |
| Owner | Everyone except Admin |
| Manager | Supervisor, Receptionist, Cashier, Technician, Trainee only |

---

## Business Rules

### 6.1 Ticket Rules

- **Minimum Requirements**: Tickets must have at least one item with payment method and amount
- **Self-Service Tickets**: Technician/Trainee/Supervisor/Receptionist-created tickets require approval
- **Approval Level Routing** (`approval_required_level`):
  - Receptionist performs + closes → `supervisor` level
  - Supervisor performs + closes → `manager` level
  - Manager performs + closes → `owner` level
  - Tips > $20 → `manager` level
  - Standard (different performer/closer) → `technician` level
- **Auto-Approval**: After 24 hours (configurable), pending tickets auto-approve
- **Edit Restrictions**:
  - Approved tickets: Only Admin/Owner can edit
  - Closed tickets: Cannot be edited by anyone
  - Technician: Cannot edit any tickets (only create self-service)
  - Supervisor: Can edit only their own self-service tickets
- **Approval Hierarchy**: Self-service tickets require review by someone higher in hierarchy
- **Rejection**: Rejected tickets can be reopened for editing (Manager+ only)
- **Delete**: Admin only — permanently removes the ticket from the database
- **Void**: Owner/Manager/Supervisor/Receptionist/Cashier — soft-deletes the ticket with a required reason. Voided tickets remain visible in the ticket list (grayed out, amber "Voided" badge) but are excluded from all financial reports (Tip Report, EOD, Insights, client visit stats). Voided tickets are read-only. Admin sees Delete instead of Void.

---

### 6.2 Tip Visibility Rules

| Pay Type | Can See Tips? |
|----------|---------------|
| Commission | No (unless Manager+) |
| Hourly | Yes |
| Daily | Yes |

**Additional Rules**:
- Customer tips and receptionist-paired tips tracked separately
- Only approved tickets count toward tip reports
- Legacy tickets (pre-approval system) always counted
- Store isolation: Multi-store employees see tips per-store

---

### 6.3 Attendance Rules

- **Overtime Threshold**: 8 hours per day
- **Overtime Eligibility**: Only hourly employees with `count_ot` flag enabled
- **Auto Check-Out**: If not manually checked out, system auto-checks out at store closing (shown in orange)
- **Change Proposals**: Employees can propose time changes; requires manager approval
- **Payroll Period**: Bi-weekly (14 days)

---

### 6.4 EOD Cash Rules

- **Opening Cash**: Required before first ticket creation
- **Expected Cash Formula**:
  ```
  Expected = Cash payments + Cash tips - Discounts
  ```
- **Variance Calculation**:
  ```
  Variance = Actual Count - Expected Cash
  ```
- **Balanced Status**: When variance < $0.01
- **Transaction Categories**: Expenses, safe deposit, refunds, HQ deposit, etc.

---

### 6.5 Inventory Rules

- **Lot Numbers**: Auto-generated with store prefix (e.g., `OM-2026-00001`)
- **Distribution Workflow**:
  ```
  pending → acknowledged → in-use → returned/consumed
  ```
- **Low Stock Alerts**: Triggered when quantity < reorder level
- **Transaction Approval**: Manager approval required for stock in/out
- **Self-Approval**: Only Admin can approve their own transactions

---

### 6.6 Employee Management Rules

- **PIN Requirements**: 4-digit unique PIN per employee
- **Multi-Store**: Employee can be assigned to multiple stores
- **Schedule**: Weekly work days configurable per employee
- **Status**: Active or Inactive (inactive employees cannot log in)

---

### 6.7 Queue Rules

- **Ready Queue**: Technicians/Trainees mark themselves ready for next service
- **Queue Statuses**: ready, busy, neutral, small_service
- **Queue Priority**: `queue_priority` column (0=normal, 1=low). Trainees-only get low priority (positioned after Technicians). Ordering is `(queue_priority, ready_at)`
- **Skip Turn**: Technician can skip their turn with a reason (Too difficult, Health, Lunch, Washroom, Others). Moves to end of queue within same priority group. Logged in `queue_skip_log` table
- **Leave Queue**: All queue-eligible roles can leave with a reason (Tired, Cannot perform service, Other). Logged in `queue_leave_log` table
- **Cooldown**: After removal, cooldown period before rejoining
- **Auto Status**:
  - Opens ticket → status = busy
  - Completes service < 15 min → status = small_service
- **Timeout**: Auto-removed after 30 minutes of inactivity
- **Cashier Blocked**: Cashiers cannot join the ready queue (guarded in frontend PIN flow and `join_ready_queue_with_checkin` RPC)
- **skip_queue_on_checkin**: Employee-level flag; when true, employee checks in without joining the queue. Returns `SKIP_QUEUE_ENABLED` error if they try to join manually

---

### 6.8 Client Rules

- **Blacklist**: Clients can be blacklisted with reason tracking
- **Phone Visibility**: Full phone number only visible to Supervisor+ roles on the Clients page. On tickets, Technicians always see masked phone (`***-***-XXXX`); other non-management roles see masked phone on closed tickets; Admin/Owner/Manager always see full phone
- **Deletion**: Requires Admin/Manager/Owner permission

---

## Workflows

### 7.1 Ticket Lifecycle

```
CREATE ──→ OPEN ──→ SERVICES_IN_PROGRESS ──→ READY_FOR_CLOSING ──→ CLOSED
               │                                                       │
               │                                                       ▼
               │                                            PENDING_APPROVAL
               │                                                       │
               │                               ┌───────────────────────┼───────────────────────┐
               │                               ▼                       ▼                       ▼
               │                           APPROVED              AUTO_APPROVED             REJECTED
               │                                                                              │
               │                                                                              ▼
               │                                                                          REOPENED
               │                                                                              │
               │                                                                              ▼
               │                                                                            OPEN
               │                                                                           (loop)
               ▼
            VOIDED (soft-delete, excluded from reports)
```

**Step Details**:
1. **Create**: User opens TicketEditor, selects customer, assigns technician(s)
2. **Add Services**: Select from catalog or create custom service
3. **Start Timer**: Technician starts service timer
4. **Complete Service**: Technician marks service completed
5. **Close Ticket**: Cashier/Receptionist collects payment, closes ticket
6. **Approval** (if required): Manager reviews and approves/rejects
7. **Reopen** (if rejected): Manager can reopen for editing

---

### 7.2 End-of-Day Workflow

```
1. OPEN EOD PAGE
       │
       ▼
2. ENTER OPENING CASH (or auto-fill from previous day)
       │
       ▼
3. RECORD TRANSACTIONS ◄────────────────────────┐
       │                                         │
       │  (throughout the day)                   │
       │                                         │
       ▼                                         │
4. ADD CASH IN/OUT ──────────────────────────────┘
       │
       ▼
5. ENTER CLOSING CASH COUNT (all denominations)
       │
       ▼
6. SYSTEM CALCULATES VARIANCE
       │
       ▼
7. SAVE EOD RECORD
       │
       ├──→ Balanced (variance < $0.01)
       │
       └──→ Unbalanced (investigate discrepancy)
```

---

### 7.3 Inventory Workflow

```
                    PURCHASE LOT CREATED
                           │
                           ▼
                       AVAILABLE
                           │
                           ▼
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
   DISTRIBUTED                        USED IN SERVICE
         │
         ▼
 PENDING (recipient notified)
         │
         ▼
   ACKNOWLEDGED
         │
         ▼
      IN_USE
         │
    ┌────┴────┐
    ▼         ▼
RETURNED   CONSUMED
```

**Transaction Approval Flow**:
```
TRANSACTION_CREATED → PENDING → MANAGER_REVIEW → APPROVED / REJECTED
```

---

### 7.4 Attendance Workflow

```
CHECK_IN ──→ ACTIVE_SHIFT ──→ CHECK_OUT ──→ HOURS_CALCULATED
                                                    │
                                                    ▼
                                            OVERTIME_FLAGGED (if > 8 hrs)
                                                    │
                                                    ▼
                                               RECORD_SAVED
                                                    │
                                        (if change needed)
                                                    ▼
                                         PROPOSAL_SUBMITTED
                                                    │
                                                    ▼
                                            MANAGER_REVIEW
                                                    │
                                    ┌───────────────┴───────────────┐
                                    ▼                               ▼
                                APPROVED                        REJECTED
                                    │
                                    ▼
                              RECORD_UPDATED
```

---

### 7.5 Approval Workflow (Universal Pattern)

```
ACTION_CREATED
      │
      ▼
   PENDING
      │
      ▼
 REVIEW_REQUIRED? ───────────────────────┐
      │                                   │
      │ YES                               │ NO
      ▼                                   ▼
APPROVAL_PENDING                    AUTO_APPROVED
      │
      ▼
 MANAGER_REVIEW
      │
┌─────┴─────┐
▼           ▼
APPROVED  REJECTED
```

**Applies To**: Tickets, Inventory Transactions, Cash Transactions, Attendance Changes, Ticket Reopens

---

### 7.6 Queue Management Workflow

```
TECHNICIAN_READY
      │
      ▼
  IN_QUEUE ◄─────────────────────────┐
      │                               │
      ├──→ SKIP_TURN (move to end)────┘
      │                               │
      ▼                               │
ASSIGNED_TO_TICKET                    │
      │                               │
      ▼                               │
    BUSY                              │
      │                               │
      ▼                               │
SERVICE_COMPLETE ─────────────────────┘
      │
      │ (if removed by manager)
      ▼
REMOVAL_LOGGED
      │
      ▼
COOLDOWN_ENFORCED
      │
      ▼
 (wait period)
      │
      ▼
CAN_REJOIN
```

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

---

### Key Relationships

```
stores
   │
   ├── employees (via employee_stores junction)
   │      │
   │      ├── attendance_records
   │      ├── ticket_items (as technician)
   │      ├── inventory_distributions (as recipient)
   │      └── technician_ready_queue
   │
   ├── sale_tickets
   │      │
   │      ├── ticket_items
   │      │      │
   │      │      └── store_services
   │      │
   │      ├── ticket_activity_log
   │      └── ticket_reopen_requests
   │
   ├── end_of_day_records
   │
   ├── cash_transactions
   │      │
   │      └── cash_transaction_change_proposals
   │
   ├── safe_balance_history
   │
   ├── inventory_items
   │      │
   │      ├── inventory_purchase_lots
   │      │      │
   │      │      └── inventory_distributions
   │      │
   │      └── inventory_transactions
   │             │
   │             └── inventory_transaction_items
   │
   ├── store_services
   │      │
   │      └── service_categories
   │
   ├── clients
   │      │
   │      └── client_color_history
   │
   └── suppliers
```

---

### Important Fields

**sale_tickets**:
- `ticket_no`: Auto-generated ticket number
- `ticket_date`: Date of ticket (YYYY-MM-DD)
- `opened_at`, `closed_at`, `completed_at`: Timestamps
- `payment_method`: cash, card, mixed, gift_card
- `approval_status`: pending_approval, approved, auto_approved, rejected
- `approval_required_level`: technician, supervisor, manager, or owner — determines who can approve
- `requires_admin_review`: Boolean flag for escalation
- `voided_at`: Timestamp when ticket was voided (null = not voided)
- `voided_by`: Employee UUID who voided the ticket
- `void_reason`: Required text reason for voiding

**ticket_items**:
- `started_at`, `timer_stopped_at`, `completed_at`: Service timer
- `tip_customer_cash`, `tip_customer_card`: Customer tips
- `tip_receptionist`: Paired receptionist tip
- `payment_cash`, `payment_card`, `payment_gift_card`: Payment split

**store_services**:
- `requires_photos`: Boolean flag; when true, new tickets with this service require min 2 photos + notes

**inventory_purchase_lots**:
- `lot_number`: Auto-generated (e.g., OM-2026-00001)
- `quantity_received`, `quantity_remaining`: Tracking
- `status`: active, depleted, expired, archived

**inventory_distributions**:
- `status`: pending, acknowledged, in_use, returned, consumed, cancelled

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
const { selectedStoreId, user, effectiveRole } = useAuth();
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

### 2026-02-07: Show Trash Button on Single Service Items
- Previously, the Trash2 delete button on service items in TicketEditor only appeared when `items.length > 1` — a ticket with a single service had no way to remove it
- Removed the `items.length > 1` guard so the delete button is always visible when `canEditServices` is true
- Deleting the last remaining service item returns `items` to `[]`, which naturally shows the service picker grid
- Closed/voided tickets unaffected (`canEditServices` is false)
- File modified: `TicketEditor.tsx`

### 2026-02-07: Use Service Button Grid for "Add Another Service"
- Previously, clicking "Add Another Service" on an existing ticket appended an empty item that rendered as a `<Select>` dropdown — inconsistent with the new-ticket UI
- Replaced with the same service picker grid used for new tickets: category filter pills, colored service code buttons, and CUSTOM button
- Clicking "Add Another Service" now toggles a picker panel below existing items; selecting a service appends a fully-populated item (with `service_id`, `price_each`, `service` object) and collapses the picker
- CUSTOM button appends a custom service item (same as new-ticket flow)
- X close button dismisses the picker without adding any item
- Added `showAddServicePicker` state variable to control picker visibility
- New-ticket UI (items.length === 0) unchanged; existing item rendering unchanged
- File modified: `TicketEditor.tsx`

### 2026-02-07: Block All Input Fields on Voided Tickets
- Voided tickets are open (`closed_at = null`) so many input fields used `isTicketClosed` to disable themselves — these remained interactive on voided tickets despite `isReadOnly = true`
- Added `!isVoided` or `|| isVoided` guards to 9 input areas in `TicketEditor.tsx`:
  1. Client status indicator / "Add New Client" button — hidden
  2. Today's Color input — disabled
  3. Last Color Used display — hidden
  4. "No employees scheduled" warning — hidden
  5. Technician selection — shows static display instead of interactive queue
  6. Service category pills + service grid — hidden
  7. Custom service name input — disabled
  8. Service select dropdown — disabled
  9. "Add Another Service" button — hidden
- Fields already blocked via `isReadOnly` (customer type buttons, phone, name, price, add-on, payment fields, photos, save/complete/close) unchanged
- File modified: `TicketEditor.tsx`

### 2026-02-07: Show Delete Button on Voided Tickets for Admin
- Admin could hard-delete open tickets but not voided tickets — Delete button was hidden by `!isVoided` condition
- Since `isReadOnly` is `true` for voided tickets, the `!isReadOnly` guard also blocked it
- Fix: changed Delete button condition from `!isTicketClosed && !isVoided && !isReadOnly && canDelete` to `!isTicketClosed && (!isReadOnly || isVoided) && canDelete`
- Voided tickets now pass via the `isVoided` branch of the OR; `canDelete` remains Admin-only so non-Admin users are unaffected
- No backend changes needed — voided tickets have `closed_at = null` so `handleDeleteTicket()` works as-is
- File modified: `TicketEditor.tsx`

### 2026-02-07: Fix PostgREST Stale Schema Cache After Void Migration
- After applying the void ticket migration (`20260207230000_add_void_ticket_feature.sql`), PostgREST on both salon365 and salon360qc still had old schema cached
- PATCH requests with `void_reason` column returned `400 PGRST204: Could not find the 'void_reason' column of 'sale_tickets' in the schema cache`
- The DB columns (`voided_at`, `voided_by`, `void_reason`) existed but PostgREST hadn't refreshed
- Fix: sent `NOTIFY pgrst, 'reload schema'` to both salon365 and salon360qc databases
- Both tenants verified working (PATCH returns 204 instead of 400)
- **Lesson**: After any DDL migration (`ALTER TABLE ADD COLUMN`), always run `NOTIFY pgrst, 'reload schema'` or restart the PostgREST container

### 2026-02-07: Fix TicketEditor Crash (Temporal Dead Zone in Void Feature)
- TicketEditor crashed on every render with `ReferenceError` — `isVoided` was referenced by `isReadOnly` (line 108) but declared later (line 143)
- `const` temporal dead zone meant `isVoided` was hoisted but inaccessible before its declaration
- `ChunkErrorBoundary` caught the error and showed "Something went wrong loading this page" for all tickets
- Fix: moved `isVoided` and `canVoid` declarations above `isReadOnly` so the dependency is satisfied
- File modified: `TicketEditor.tsx`

### 2026-02-07: Restrict Delete to Admin-Only & Add Void Ticket Feature
- **Delete** now restricted to Admin only (was available to Admin/Owner/Manager/Supervisor/Receptionist/Cashier)
- **Void** added as a new soft-delete action for Owner/Manager/Supervisor/Receptionist/Cashier (Admin sees Delete instead)
- Void requires a mandatory reason; sets `voided_at`, `voided_by`, `void_reason` on `sale_tickets`
- Voided tickets: remain visible in ticket list with amber "Voided" badge, grayed-out row styling (`bg-gray-200 opacity-60`), read-only in editor with amber info banner
- Voided tickets excluded from all financial reports via `.is('voided_at', null)` filter: Tip Report (3 views), EOD, Insights (all hooks), client visit stats, client visit history
- "Voided" filter option added to TicketsPage approval filter dropdown
- Activity log records `'voided'` action; updated `ticket_activity_log_action_check` constraint
- DB: Added 3 columns (`voided_at`, `voided_by`, `void_reason`) + index to `sale_tickets`
- Added `canVoid` permission to `Permissions.tickets`; `canDelete` restricted to `['Admin']`
- i18n: Added void-related keys to all 4 languages (en, fr, vi, km)
- Migration applied to both salon360qc and salon365 databases
- Files modified: `permissions.ts`, `supabase.ts`, `TicketEditor.tsx`, `TicketsPage.tsx`, `TipReportPage.tsx`, `TipReportDetailView.tsx`, `TipReportWeeklyView.tsx`, `EndOfDayPage.tsx`, `TicketsDetailView.tsx`, `TicketsPeriodView.tsx`, `useSalesData.ts`, `useClients.ts`, `useClientLookup.ts`, `ClientDetailsModal.tsx`, `i18n.ts`
- File added: `supabase/migrations/20260207230000_add_void_ticket_feature.sql`

### 2026-02-07: Allow Supervisors to Review Ticket Reopen Requests
- Supervisors can now see and approve/reject ticket reopen requests from Receptionists and Cashiers on the PendingApprovalsPage "Ticket Changes" tab
- Supervisor-created requests remain Manager+ only (Supervisors cannot see or act on them)
- Self-approval/rejection blocked at DB level (cannot review own request)
- DB: Updated `approve_ticket_reopen_request` and `reject_ticket_reopen_request` RPCs to allow Supervisor with hierarchy guards
- DB: Recreated `get_pending_ticket_reopen_requests` with new `created_by_roles text[]` column for frontend filtering
- DB: Updated `get_pending_ticket_reopen_requests_count` with optional `p_reviewer_employee_id` for Supervisor-aware counting
- Frontend: Added Supervisor to `canReviewReopenRequests` permission, updated `canViewTab()` to show ticket-changes tab
- Frontend: Supervisor filtering in `fetchTicketReopenRequests()` and `fetchAllTabCounts()` to show only Receptionist/Cashier requests
- Frontend: Layout badge count now includes ticket reopen requests for Supervisor-only users
- Frontend: TicketReopenRequestModal info text updated — Receptionist/Cashier see "Supervisor, Manager, Owner, or Admin" as reviewers
- Migration applied to both salon360qc and salon365 databases
- Files modified: `permissions.ts`, `supabase.ts`, `PendingApprovalsPage.tsx`, `Layout.tsx`, `TicketReopenRequestModal.tsx`, `TicketEditor.tsx`
- File added: `supabase/migrations/20260207220816_allow_supervisor_review_reopen_requests.sql`

### 2026-02-07: Fix TicketEditor Infinite Reopen After Change Request Navigation
- When approving a ticket change request on PendingApprovalsPage, user is navigated to TicketsPage and TicketEditor auto-opens via highlight effect
- After closing the editor, it kept reopening infinitely — user could not dismiss it
- Root cause: highlight effect dependencies (`tickets`, `loading`) change when `fetchTickets()` runs after closing editor; since `highlightedTicketId` was still set, the effect re-opened the editor in a loop; the 5-second cleanup timer never fired because the effect's own cleanup cancelled it on each re-trigger
- Fix: added `onHighlightComplete?.()` call in `closeEditor()` to clear `highlightedTicketId` immediately when the editor is dismissed, preventing the highlight effect from re-triggering
- No-op in normal (non-navigated) scenarios since `highlightedTicketId` is already null
- File modified: `src/pages/TicketsPage.tsx`

### 2026-02-07: Fix Missing `ticket_reopen_requests` Table on salon365
- Receptionist/Supervisor/Cashier "Request Changes" on closed tickets failed with 404 on salon365 (`relation "public.ticket_reopen_requests" does not exist`)
- Table and 6 RPC functions were defined in squash_08 but never applied to the salon365 database
- Created idempotent migration with: table (12 columns, 3 indexes, RLS), and 6 functions (`create_ticket_reopen_request`, `approve_ticket_reopen_request`, `reject_ticket_reopen_request`, `get_pending_ticket_reopen_requests`, `get_pending_ticket_reopen_requests_count`, `has_pending_ticket_reopen_request`)
- Uses latest function versions with `role` array checks (not old `role_permission`) and includes Cashier
- Migration applied to both salon365 (primary fix) and salon360qc (idempotent safety run)
- No frontend changes needed — existing RPC calls in TicketEditor, Layout, and PendingApprovalsPage already correct
- File added: `supabase/migrations/20260207_fix_missing_ticket_reopen_requests_salon365.sql`

### 2026-02-07: Fix Auto Check-Out Firing 1 Hour Early During EST (Winter)
- Two pg_cron jobs handle daylight saving: `auto-checkout-2200-edt` at 2:00 UTC and `auto-checkout-2200-est` at 3:00 UTC
- During winter (EST), the EDT job fires at 9 PM EST — 1 hour early — and `auto_checkout_employees_by_context()` had no time guard, so it checked out all employees prematurely
- Added time guard at top of function: `IF v_eastern_time::time < '22:00'::time THEN RETURN; END IF;`
- This makes the wrong-season cron job a true no-op (returns immediately if Eastern time is before 10 PM)
- During summer (EDT), the EST job fires at 11 PM EDT — harmless since employees are already checked out
- Migration applied to both salon360qc and salon365 databases
- File added: `supabase/migrations/20260207020702_fix_auto_checkout_early_trigger_est.sql`

### 2026-02-07: Enforce `requires_photos` Validation When Closing Tickets
- Previously, `requires_photos` validation only ran for brand-new unsaved tickets (`!ticketId` guard) — existing tickets could be closed with 0 photos and empty notes
- Added photo/notes validation to `handleCloseTicket()`: requires non-empty notes and at least 1 photo (uploaded + pending) when any service has `requires_photos` flag
- Exposed `totalPhotoCount` on `TicketPhotosSectionRef` (uploaded + pending count) so parent can check total photos
- Lowered new-ticket photo threshold from 2 to 1 to match close-ticket validation
- Files modified: `TicketEditor.tsx`, `TicketPhotosSection.tsx`

### 2026-02-07: Fix Queue Join Timezone Regression
- Fixed `join_ready_queue_with_checkin` RPC using `CURRENT_DATE` (UTC) instead of store-timezone-aware date
- After 7 PM EST (when UTC rolls to the next day), employees got false "must check in" errors when tapping "Ready"
- Root cause: the original timezone fix (Jan 5) was carried into squash_07 but regressed when later migrations (Feb 4) rewrote the function with `CURRENT_DATE`
- Fix: replaced `v_today := CURRENT_DATE` with `v_store_timezone := public.get_store_timezone(p_store_id); v_today := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::date`
- Matches the pattern used by `check_in_employee` and the original Jan 5 fix
- Migration applied to both salon360qc and salon365 databases
- File added: `supabase/migrations/20260207004350_fix_join_queue_timezone_regression.sql`

### 2026-02-07: Multi-Select Technician Filter on Tip Report Page
- Replaced single-select `<select>` dropdown with a scrollable checkbox list for multi-technician filtering
- State changed from `useState<string>('all')` to `useState<string[]>([])` — empty array means show all
- Filter badge now shows count of selected technicians (was always 1 when active)
- Checkbox list styled with blue filled squares and `Check` icon; scrollable at `max-h-[200px]`
- Clear button resets to empty array; filter logic uses `.includes()` for multi-match
- File modified: `src/pages/TipReportPage.tsx`

### 2026-02-06: Add Clickable Column Sorting to Clients and Employees Pages
- Clients page: added sort state (`sortColumn`/`sortDirection`) defaulting to `last_visit` DESC (preserves existing behavior)
- Replaced hardcoded `last_visit` sort with dynamic comparator supporting 5 columns: name, phone, last visit, total visits, status
- Clients without visits always sort to end regardless of direction
- `ClientsTable.tsx`: replaced static `<th>` elements with clickable headers using `ChevronUp`/`ChevronDown` icons
- Employees page: replaced hardcoded name+status sort with dynamic comparator supporting 5 columns: display name, role, status, assigned stores, schedule
- Employees table headers made clickable with same chevron icon pattern
- Clicking a column sorts ascending; clicking again toggles descending
- Clients page resets to page 1 on sort change
- Files modified: `ClientsPage.tsx`, `ClientsTable.tsx`, `EmployeesPage.tsx`

### 2026-02-06: Fix Clients Page Last Visit & Total Visits Showing Empty
- After the batch query refactor, all clients showed Last Visit = "Never" and Total Visits = 0 despite having ticket data
- Root cause: `.in('client_id', clientIds)` with 200+ UUIDs exceeded PostgREST/Kong URL length limits → silent 414 error → `data` returned `null` → `ticketRows || []` silently produced empty array
- Added `batchIn()` helper that chunks `.in()` calls into groups of 50 IDs, runs each query separately, and concatenates results
- Applied chunked querying to all 3 batch queries (sale_tickets, client_color_history, employees)
- `batchIn` throws on query errors (caught by existing `try/catch`) instead of silently returning empty
- File modified: `src/hooks/useClients.ts`

### 2026-02-06: Fix Clients Page Sorting & Batch Query Optimization
- Clients page was showing alphabetical order (A-names first) instead of sorting by most recent visit because `useClients.ts` fetched only the first 50 clients alphabetically from the DB, then client-side sort only operated within that subset
- Removed DB-level pagination (`limit`/`offset`/`.range()`) — all clients for the store are now fetched so `ClientsPage.tsx` client-side sort by `last_visit` DESC works correctly across the full dataset
- Replaced N+1 query pattern (~200 queries for 50 clients) with 3 batch queries using `.in('client_id', clientIds)`: one for visit stats (`sale_tickets`), one for last color (`client_color_history`), one for blacklisted-by names (`employees`). Total: 4 queries instead of ~200
- Added missing `store_id` filter to `sale_tickets` query so visit stats are per-store
- File modified: `src/hooks/useClients.ts`

### 2026-02-06: Remove New Ticket Button from End of Day Page
- Removed the "New Ticket" button from the End of Day (Cash Balance) page header
- Removed the `openNewTicket()` function that was only used by that button
- TicketEditor, `isEditorOpen`/`editingTicketId` state, and `closeEditor` remain (used for editing existing tickets)
- `Plus` icon import remains (used elsewhere on the page for cash transaction buttons)
- File modified: `src/pages/EndOfDayPage.tsx`

### 2026-02-06: Add "Today" Button to Date Navigation
- Added a "Today" button to the left of the date navigation (`[< ] [date] [> ]`) on all 5 pages with date pickers
- Button is hidden when already viewing today's date (no visual clutter)
- Styled as small blue link-like button (`text-xs text-blue-600`) with mobile touch target (`min-h-[44px]`)
- TicketsPage: only shown for non-Cashier/non-Receptionist (they're locked to today via `isLocalDateRole`)
- TipReportPage: added in both mobile and desktop date nav blocks; only for non-Receptionist roles
- EndOfDayPage: added `t` to `useAuth()` destructuring; button inside Manager/Supervisor branch
- SafeBalancePage: replaced old "Go to Today" link (below date picker) with consistent button to the left
- PendingApprovalsPage: button before ChevronLeft nav
- Uses `t('common.today')` i18n key (already translated in all 4 languages) except SafeBalancePage (hardcoded, matching page convention)
- Files modified: `TicketsPage.tsx`, `TipReportPage.tsx`, `EndOfDayPage.tsx`, `SafeBalancePage.tsx`, `PendingApprovalsPage.tsx`

### 2026-02-06: Add Technician Filter to Tip Report Page
- Added a Filter button next to Export/Print buttons on the Tip Report page header
- Dropdown panel with technician select to filter the report by individual technician
- **Updated 2026-02-07**: Replaced single-select dropdown with multi-select checkbox list (see above)
- Active filter badge (blue circle with count) shown on button when filter is active
- Filter applies to daily detail view, weekly calendar view, empty state check, and CSV export
- Active timer refresh stays on unfiltered `summaries` so timers keep ticking regardless of filter
- Derived `technicians` list and `filteredSummaries` via `useMemo` for performance
- Click-outside handler closes the filter panel (same pattern as view mode dropdown)
- Reuses existing i18n keys: `tickets.filters`, `tickets.allTechnicians`, `tickets.clearAllFilters`
- File modified: `src/pages/TipReportPage.tsx`

### 2026-02-06: Increase TicketEditor Action Button Size & Spacing
- Enlarged all action buttons in the TicketEditor bottom bar for easier tapping/clicking
- Outer container: `gap-1.5` → `gap-3`, `p-2` → `p-3` (more breathing room)
- Inner button group: `gap-1.5` → `gap-2.5` (more space between buttons)
- All 9 buttons: `px-2 py-1` → `px-3 py-2`, `text-xs` → `text-sm`, `min-h-[36px]` → `min-h-[44px]` on mobile
- All 3 icons (Trash2, CheckCircle, Clock): `w-3 h-3` → `w-4 h-4`
- File modified: `src/components/TicketEditor.tsx`

### 2026-02-06: Independent Per-Page Date Navigation
- Previously, 4 pages (Tickets, TipReport, EOD, SafeBalance) shared a single `selectedDate` in App.tsx — changing date on one page changed all of them
- 3 additional pages (Attendance, Insights, PendingApprovals) had local date state that reset to today on every page switch (component unmount)
- Replaced shared `selectedDate` with 10 per-page state variables in App.tsx: `ticketsDate`, `tipReportDate`, `eodDate`, `safeBalanceDate`, `attendanceDate`, `insightsFilter`, `insightsCustomDateRange`, `approvalsDate`, `approvalsQueueStartDate`, `approvalsQueueEndDate`
- AttendancePage, InsightsPage, PendingApprovalsPage now receive date/filter state via props instead of local `useState`
- Cashier/Receptionist date lock updated to reset all 4 string-date pages independently
- Per-page `makeDateHandler` factory replaces single `handleDateChange`
- Files modified: `App.tsx`, `AttendancePage.tsx`, `InsightsPage.tsx`, `PendingApprovalsPage.tsx`

### 2026-02-06: Fix `set_approval_deadline()` Non-Existent `store_settings` Table
- Migration `20260206000004` referenced `public.store_settings` table which does not exist (PostgreSQL 42P01)
- The `store_settings` lookup for configurable `approval_deadline_hours` was never part of the real schema
- Replaced with hardcoded `INTERVAL '24 hours'` matching the intended default
- Removed unused `v_deadline_hours` variable from DECLARE block
- Migration `20260206000005_fix_set_approval_deadline_store_settings.sql` applied to both salon360qc and salon365

### 2026-02-06: Fix `set_approval_deadline()` Broken Status Column Reference
- Migrations `20260206000002` and `20260206000003` recreated `set_approval_deadline()` with `IF NEW.status = 'closed'` but `sale_tickets` has no `status` column — caused PostgreSQL error 42703 when closing tickets
- Fixed condition to `IF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL` (matching original logic from `squash_08`)
- Migration `20260206000004_fix_set_approval_deadline_status_column.sql` applied to both salon360qc and salon365

### 2026-02-06: TicketEditor Flex Layout (No-Scroll Action Buttons)
- Converted TicketEditor slide-in panel from single scrollable container to flex column layout
- Header and action buttons are now always visible; only the middle content area scrolls
- Outer container: `overflow-y-auto` → `flex flex-col`
- Content area: added `flex-1 overflow-y-auto min-h-0`, removed mobile padding hack (`pb-20`)
- Action buttons: moved outside content div as sibling, removed `fixed md:static` positioning, added `border-t border-gray-200 flex-shrink-0`

### 2026-02-06: Extend Payment Details Modal Height
- Added optional `className` prop to shared `Modal` component (`src/components/ui/Modal.tsx`) for callers to override default styles
- Payment Details modal in `TicketEditor.tsx` now uses `max-h-[98vh]` (up from default `90vh`) so Payment Summary and buttons are visible without scrolling

### 2026-02-06: Remove Collection Summary from Payment Details Modal
- Removed the "Collection Summary" section (Total Cash Collected, Total Card Collected, Gift Card Redeemed) from the Payment Details modal in `TicketEditor.tsx`
- Redundant with the "Payment Summary" block already in the same modal
- Removed three dead helper functions: `calculateTempCashCollected()`, `calculateTempCardCollected()`, `calculateTempGiftCardCollected()`

### 2026-02-06: Move Payment Summary into Payment Details Modal
- Moved the Payment Summary block (Total Payments, Total Discounts, Tips, Grand Total Collected) from inline in `TicketEditor.tsx` into the bottom of the Payment Details modal popup
- Summary now appears above the Cancel/Save buttons inside the modal instead of below the payment method section
- Uses `formData` values (not `tempPaymentData`) to always reflect the saved state

### 2026-02-06: Remove Ticket Approved Banner from TicketEditor
- Removed the green "Ticket Approved" / "Auto-Approved by System" banner from closed tickets in `TicketEditor.tsx`
- The `bg-green-50` banner with CheckCircle icon, approval text, and timestamp is no longer displayed
- `isApproved` variable and `CheckCircle` import retained (used elsewhere in the component)

### 2026-02-06: Fix Stale Chunk Loading After Deployments
- Added `lazyWithReload()` wrapper in `App.tsx` replacing all 13 `lazy()` calls
- On chunk load failure (stale hash after rebuild), auto-reloads page once via `sessionStorage('chunk_reload')` flag
- Added `ChunkErrorBoundary` around `<Suspense>` as last-resort fallback with "Something went wrong" + Reload button
- Cleared `chunk_reload` flag in `useServiceWorkerUpdate.ts` `handleUpdate` to prevent interference with future detection
- Prevents blank page with "Expected a JavaScript module but got text/html" error when nginx serves HTML for missing old chunks

### 2026-02-06: Remove Spa Expert Role
- Removed defunct "Spa Expert" role from entire codebase (no employees held this role)
- Dropped and recreated `employees_role_valid` and `valid_role_name` constraints without 'Spa Expert'
- Cleaned `set_approval_deadline()` trigger: removed `v_closer_is_spa_expert` variable
- Cleaned `approve_ticket()` RPC: removed `v_is_spa_expert` variable and condition
- Removed `spaExpert` translation key from all 4 languages (en, fr, vi, km)
- Updated migration scripts to replace 'Spa Expert' with 'Trainee' in role arrays/constraints
- Migration applied to both salon360qc and salon365 databases

### 2026-02-06: Fix Receptionist & Supervisor Ticket Approval Rules
- Fixed `set_approval_deadline()` trigger bug: Receptionist self-service tickets (performs + closes) now correctly get `approval_required_level = 'supervisor'` instead of silently falling through to `'technician'` (dead-code dual-role conditions never matched since employees have one role)
- Fixed `approve_ticket()` RPC: Receptionist can no longer approve supervisor-level tickets; Receptionist and Supervisor must have worked on ticket to approve technician-level tickets (same rule as Technician)
- Added `approval_required_level` field to `SaleTicket` TypeScript interface
- UI hides approve button for Receptionist on non-technician-level tickets
- Updated 2026-02-04 Receptionist Ticket Approval entry below (rules tightened)

### 2026-02-06: Per-Service Requires Photos Flag
- Services can now be flagged with `requires_photos` in ServicesPage (checkbox: "Require photos & notes")
- New tickets containing any `requires_photos` service show the photo section immediately (before save)
- Validation enforces minimum 2 photos + non-empty notes before saving new tickets
- Existing ticket edits are not affected by the validation
- Photos uploaded with the newly created ticket ID after insertion (`uploadPendingPhotos(overrideTicketId)`)
- Added `requires_photos` boolean column to `store_services` table
- Updated `get_services_by_popularity` RPC to include `requires_photos` in return type
- Fixed `canEditNotes` returning null on new tickets (short-circuited when `ticket` was null)
- `TicketPhotosSection` and `useTicketPhotos` now accept `ticketId: string | null` for pre-save rendering
- Added `pendingCount` to `TicketPhotosSectionRef` for validation checks

### 2026-02-05: PIN Authentication Error Logging
- Added differentiated error logging in `authenticateWithPIN()` (`src/lib/auth.ts`)
- RPC errors logged with `console.error` (message + code); no-match cases logged with `console.warn`
- Helps debug login issues without code changes

### 2026-02-05: Queue Skip Turn Reason Modal
- Skip Turn now requires a reason selection (Too difficult, Health, Lunch, Washroom, Others)
- "Others" requires mandatory notes
- Created `queue_skip_log` table to record skip actions with reason/notes
- `QueueReasonModal` shared component used for both skip and leave actions

### 2026-02-05: Trainee Role
- Added 8th role: Trainee (identical permissions to Technician)
- Trainee maps to Technician permission level via `getRolePermission()`
- Queue priority: Trainees positioned AFTER Technicians (`queue_priority=1` vs `0`)
- Added `queue_priority` column to `technician_ready_queue`; all queue RPCs updated for priority-aware ordering
- Added DB constraints for Trainee in `employees` role and `role_permissions` valid roles
- Added Trainee translations to all 4 languages

### 2026-02-05: Block skip_queue_on_checkin from Ready Queue
- Employees with `skip_queue_on_checkin=true` cannot manually join the ready queue
- Three-layer guard: frontend check, RPC server-side check (`SKIP_QUEUE_ENABLED`), UI message

### 2026-02-05: Fix Ticket Photos Infinite Loading (ERR_INSUFFICIENT_RESOURCES)
- Fixed infinite fetch loop in `useTicketPhotos.ts` that exhausted browser connection pool
- Root cause: `getStorageConfig()` returned a new object every render → `useMemo([storageConfig])` re-created `storage` → `useCallback([storage])` re-created `fetchPhotos` → `useEffect([fetchPhotos])` fired every render → infinite loop
- Symptoms: photos never loading (infinite spinner), uploads failing, `ERR_INSUFFICIENT_RESOURCES` in console
- Fix: replaced unstable `[storageConfig]` object dependency with stable primitives `[storeId, storagePublicUrl]`
- Also passed `storageConfig` directly to `useTicketPhotos` hook instead of calling `getStorageConfig()` internally

### 2026-02-04: Block Cashiers from Ready Queue
- Cashiers clicking "Ready" on HomePage now get "Your role does not have access to the ready queue" error
- Three-layer guard: PIN submission (early reject), store selection (defense in depth), RPC error handler (`ROLE_NOT_ELIGIBLE`)
- Added Cashier role check to `join_ready_queue_with_checkin` RPC (server-side guard)
- Added `queueNotAvailableForRole` translation key to all 4 languages (en, fr, vi, km)
- Added `role` field to `authenticatedSession` state in HomePage for role checks after PIN auth

### 2026-02-04: Skip Turn in Queue
- Added yellow "Skip Turn" button next to red "Leave Queue" button in technician queue modal
- Moves technician to end of queue by resetting `ready_at` to `NOW()`
- Created `skip_queue_turn` RPC function accepting `p_employee_id` and `p_store_id`
- Both buttons disable each other while either action is in progress
- Added `skipTurn` and `skippingTurn` translation keys to all 4 languages (en, fr, vi, km)
- **Updated 2026-02-05**: Now requires reason selection via `QueueReasonModal` (see above)

### 2026-02-04: Leave Queue with Reason (All Roles)
- Changed `allowLeaveQueue` from Technician-only to all queue-eligible roles in `Layout.tsx`
- Replaced simple confirmation modal with reason-selection modal (Tired, Cannot perform service, Other)
- "Other" reason requires mandatory notes; other reasons have optional notes
- Created `queue_leave_log` table to record voluntary departures with reason/notes
- Updated `leave_ready_queue` RPC to accept optional `p_reason` and `p_notes` parameters
- Added leave reason translation keys to all 4 languages (en, fr, vi, km)
- HomePage check-in flow leave queue unchanged (no reason needed in that context)

### 2026-02-04: Receptionist Ticket Approval
- Added Receptionist to `Permissions.tickets.canApprove` in `permissions.ts`
- Updated `approve_ticket` RPC: Receptionist can approve technician-level tickets only if they worked on the ticket; cannot approve supervisor-level or higher tickets
- **Updated 2026-02-06**: Rules tightened — see "Fix Receptionist & Supervisor Ticket Approval Rules" above

### 2026-02-03: Client Visit History Tab
- Replaced "Color History" tab with "Visit History" in `ClientDetailsModal`
- Shows last 20 client tickets with services, technicians, totals, and color info
- Expandable rows: click to see ticket number, payment method, per-service details, and color badges
- Open tickets show "Open" badge instead of total amount
- Replaced N+1 query pattern with 2 batch queries (tickets + colors) joined in-memory
- Added `VisitHistoryEntry` interface to `supabase.ts`

### 2026-02-02: Ticket Phone Number Masking
- Technicians now see `***-***-XXXX` (last 4 digits) instead of `**********` on tickets
- Non-management roles (Cashier, Receptionist, Supervisor) see masked phone on closed tickets
- Admin/Owner/Manager always see full phone number on tickets
- Added `canViewFullPhoneWhenClosed` permission to `Permissions.tickets`

### 2026-01-23: Inventory System Improvements
- Fixed Admin role in inventory approval permissions
- Improved lot creation with race condition handling
- Enhanced Inventory page (Distributions/Lots tabs) and approval workflows

### 2026-01-23: Documentation Update
- Added comprehensive CLAUDE.md with full documentation of:
  - All 15 pages and their functionality
  - Complete permission matrix for 8 roles
  - Business rules for all features
  - Workflow diagrams for core processes
  - Database schema reference
