# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Salon360 is a multi-store salon management application built with React, TypeScript, and Supabase. It handles ticket/service tracking, employee management, tip reports, attendance, inventory, and financial operations (end-of-day, safe balance).

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

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Icons**: lucide-react

### Source Structure (`/src`)
- **`App.tsx`**: Main application with routing logic, page state, and context provider hierarchy
- **`pages/`**: Full-page components (TicketsPage, AttendancePage, TipReportPage, etc.)
- **`components/`**: Reusable UI components and modals
  - `ui/`: Base UI primitives (Button, Modal, Input, Toast, etc.)
  - `insights/`: Sales and analytics components
  - `clients/`: Client management components
- **`contexts/`**: React contexts for global state
  - `AuthContext`: Authentication, store selection, locale (i18n), "view as" role impersonation
  - `SettingsContext`: App settings per store
  - `PermissionsContext` / `PermissionsCacheContext`: Role-based permission checking
  - `NumericKeypadContext`: Shared numeric keypad for mobile input
- **`hooks/`**: Custom hooks (useSalesData, useClients, useWorkingHoursCheck, etc.)
- **`lib/`**: Utilities and services
  - `supabase.ts`: Supabase client + TypeScript interfaces for database entities
  - `permissions.ts`: Permission checking logic per role
  - `i18n.ts`: Translations (en, fr, vi)
  - `timezone.ts`: EST timezone utilities

### Role-Based Permissions

Roles hierarchy: `Admin/Manager/Owner > Supervisor > Receptionist > Cashier > Technician`

Permission system in `lib/permissions.ts` controls access to features. Always use `Permissions.feature.canXxx()` checks rather than role string comparisons.

Time-restricted roles (Technician, Cashier, Receptionist, Supervisor) are blocked outside working hours (8:45 AM to 30 min after closing).

### Database / Supabase

- Migrations are in `/supabase/migrations/` with format `YYYYMMDDHHMMSS_description.sql`
- Use `_TEMPLATE.sql` as starting point for new migrations
- All migrations must be idempotent (use `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`)
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Multi-Store Support

The app supports multiple stores. `selectedStoreId` from AuthContext determines current store context. Employees can be assigned to multiple stores via `employee_stores` junction table.

### Scripts

- `/scripts/migrations/`: Node.js scripts (.mjs) to apply database changes programmatically
- `/scripts/analysis/`: Data analysis and verification scripts for debugging

## Key Patterns

### Lazy Loading
Non-critical pages use `React.lazy()` for code splitting (see App.tsx).

### Date Handling
All dates are processed in EST timezone. Use `getCurrentDateEST()` from `lib/timezone.ts`. Cashiers and Receptionists are locked to today's date only.

### Supabase Queries
Direct queries via `supabase.from('table').select()` pattern. No ORM layer.

### Context Provider Order (in App.tsx)
ToastProvider > AuthProvider > PermissionsProvider > PermissionsCacheProvider > SettingsProvider > NumericKeypadProvider
