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
- **Internationalization**: en, fr, vi

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
   - Admin/Manager review

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
7. Technician (most restricted)
```

When a user has multiple roles, the highest-ranking role determines their permission level.

---

### 5.2 Permission Matrix

| Feature | Admin | Owner | Manager | Supervisor | Receptionist | Cashier | Technician |
|---------|:-----:|:-----:|:-------:|:----------:|:------------:|:-------:|:----------:|
| **Tickets** |
| View All Tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Own only |
| Create Tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Self-service |
| Edit Tickets | ✓ | ✓ | ✓ | Own only | ✓ | ✓ | ✗ |
| Close Tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Delete Tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Approve Tickets | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Reopen Tickets | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Request Reopen | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |
| **Financial** |
| View EOD | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit EOD | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| View Safe Balance | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| View Insights | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Tips** |
| View All Tips | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | Own only |
| Export Tips | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Employees** |
| View Employees | ✓ | ✓ | Limited | ✗ | ✗ | ✗ | ✗ |
| Create Employees | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Edit Employees | All | Non-Admin | Non-Mgmt | ✗ | ✗ | ✗ | ✗ |
| Delete Employees | All | Non-Admin | Non-Mgmt | ✗ | ✗ | ✗ | ✗ |
| Reset PIN | All | Non-Admin | Non-Mgmt | ✗ | ✗ | ✗ | ✗ |
| **Inventory** |
| View Inventory | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create Items | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Create Transactions | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Approve Transactions | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Distribute Inventory | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| View Own Inventory | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| **Clients** |
| View Clients | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Create Clients | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Edit Clients | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Delete Clients | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Blacklist Clients | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| View Full Phone | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Services** |
| View Services | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Create Services | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete Services | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Configuration** |
| View Configuration | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Edit Configuration | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Queue** |
| View All Queue | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Remove from Queue | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

---

### 5.3 Time-Based Access Restrictions

**Affected Roles**: Technician, Cashier, Receptionist, Supervisor

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

**Affected Roles**: Receptionist, Supervisor, Technician

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
- **Blocked** if Receptionist, Supervisor, or Technician is currently checked in

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
| Manager | Supervisor, Receptionist, Cashier, Technician only |

---

## Business Rules

### 6.1 Ticket Rules

- **Minimum Requirements**: Tickets must have at least one item with payment method and amount
- **Self-Service Tickets**: Technician/Supervisor-created tickets require approval
- **Auto-Approval**: After 24 hours (configurable), pending tickets auto-approve
- **Edit Restrictions**:
  - Approved tickets: Only Admin/Owner can edit
  - Closed tickets: Cannot be edited by anyone
  - Technician: Cannot edit any tickets (only create self-service)
  - Supervisor: Can edit only their own self-service tickets
- **Approval Hierarchy**: Self-service tickets require review by someone higher in hierarchy
- **Rejection**: Rejected tickets can be reopened for editing (Manager+ only)

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

- **Ready Queue**: Technicians mark themselves ready for next service
- **Queue Statuses**: ready, busy, neutral, small_service
- **Cooldown**: After removal, cooldown period before rejoining
- **Auto Status**:
  - Opens ticket → status = busy
  - Completes service < 15 min → status = small_service
- **Timeout**: Auto-removed after 30 minutes of inactivity

---

### 6.8 Client Rules

- **Blacklist**: Clients can be blacklisted with reason tracking
- **Phone Visibility**: Full phone number only visible to Supervisor+ roles
- **Deletion**: Requires Admin/Manager/Owner permission

---

## Workflows

### 7.1 Ticket Lifecycle

```
CREATE ──→ OPEN ──→ SERVICES_IN_PROGRESS ──→ READY_FOR_CLOSING ──→ CLOSED
                                                                       │
                                                                       ▼
                                                            PENDING_APPROVAL
                                                                       │
                                               ┌───────────────────────┼───────────────────────┐
                                               ▼                       ▼                       ▼
                                           APPROVED              AUTO_APPROVED             REJECTED
                                                                                              │
                                                                                              ▼
                                                                                          REOPENED
                                                                                              │
                                                                                              ▼
                                                                                            OPEN
                                                                                           (loop)
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
| `technician_ready_queue` | Queue status tracking |
| `queue_removal_history` | Queue removal audit |
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
- `requires_admin_review`: Boolean flag for escalation

**ticket_items**:
- `started_at`, `timer_stopped_at`, `completed_at`: Service timer
- `tip_customer_cash`, `tip_customer_card`: Customer tips
- `tip_receptionist`: Paired receptionist tip
- `payment_cash`, `payment_card`, `payment_gift_card`: Payment split

**inventory_purchase_lots**:
- `lot_number`: Auto-generated (e.g., OM-2026-00001)
- `quantity_received`, `quantity_remaining`: Tracking
- `status`: active, depleted, expired, archived

**inventory_distributions**:
- `status`: pending, acknowledged, in_use, returned, consumed, cancelled

---

## Key Patterns

### Lazy Loading
Non-critical pages use `React.lazy()` for code splitting (see App.tsx).

```typescript
const InsightsPage = lazy(() => import('./pages/InsightsPage'));
const ConfigurationPage = lazy(() => import('./pages/ConfigurationPage'));
```

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

### 2026-01-23: Inventory System Improvements
- Fixed Admin role in inventory approval permissions
- Improved lot creation with race condition handling
- Enhanced Inventory page (Distributions/Lots tabs) and approval workflows

### 2026-01-23: Documentation Update
- Added comprehensive CLAUDE.md with full documentation of:
  - All 15 pages and their functionality
  - Complete permission matrix for 7 roles
  - Business rules for all features
  - Workflow diagrams for core processes
  - Database schema reference
