# Documentation Index

This directory contains all project documentation files related to features, migrations, fixes, and implementation notes.

## Overview

This documentation covers the evolution of the nail salon management system, including major features, database migrations, performance optimizations, and bug fixes implemented throughout the project's development.

## Table of Contents

### Feature Implementation Guides

- **[ROLE_PERMISSIONS_SETUP.md](./ROLE_PERMISSIONS_SETUP.md)** - Complete guide for role-based permission management system setup and usage
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Comprehensive summary of the role-based permission system implementation (60+ permissions across 13 modules)
- **[COMMISSION_PAY_TYPE_SETUP.md](./COMMISSION_PAY_TYPE_SETUP.md)** - Setup guide for commission-based pay type for employees

### Store Configuration & Setup

- **[ADD_SANS_SOUCI_STORE.md](./ADD_SANS_SOUCI_STORE.md)** - Documentation for adding the Sans Souci store location
- **[SANS_SOUCI_SETTINGS_SYNC_REPORT.md](./SANS_SOUCI_SETTINGS_SYNC_REPORT.md)** - Report on synchronizing settings for Sans Souci store

### Migration Instructions & Fixes

- **[APPLY_MIGRATION_INSTRUCTIONS.md](./APPLY_MIGRATION_INSTRUCTIONS.md)** - General instructions for applying database migrations
- **[APPLY_OPENING_CASH_FIX.md](./APPLY_OPENING_CASH_FIX.md)** - Instructions for applying the opening cash validation fix
- **[OPENING_CASH_FIX_SUMMARY.md](./OPENING_CASH_FIX_SUMMARY.md)** - Summary of the opening cash fix implementation
- **[ATTENDANCE_PROPOSALS_FIX.md](./ATTENDANCE_PROPOSALS_FIX.md)** - Fix for attendance change proposal system
- **[FIX_VERIFICATION_REPORT.md](./FIX_VERIFICATION_REPORT.md)** - Verification report for various system fixes

### Performance Optimizations

- **[PERMISSION_LOADING_OPTIMIZATION.md](./PERMISSION_LOADING_OPTIMIZATION.md)** - Documentation on permission loading performance improvements
- **[PERMISSION_LOADING_SPEED_OPTIMIZATIONS.md](./PERMISSION_LOADING_SPEED_OPTIMIZATIONS.md)** - Detailed guide on permission loading speed optimizations

### Implementation Status

- **[IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)** - Status report marking completion of major implementations

## Related Directories

### Scripts

- **`/scripts/migrations/`** - Contains migration runner scripts (.mjs files) for applying database changes
- **`/scripts/analysis/`** - Contains data analysis and verification scripts for troubleshooting and validation

### Database Migrations

- **`/supabase/migrations/`** - Contains all timestamped SQL migration files that define the database schema

## Key Features Documented

### 1. Role-Based Permission System
Comprehensive permission management allowing admins to customize access control at the individual action level for all 8 roles (Admin, Owner, Manager, Supervisor, Receptionist, Technician, Spa Expert, Cashier).

**Related Files:**
- ROLE_PERMISSIONS_SETUP.md
- IMPLEMENTATION_SUMMARY.md
- /supabase/migrations/role_permissions_migration.sql
- /supabase/migrations/role_permissions_functions.sql
- /supabase/migrations/seed_permissions.sql

### 2. Multi-Store Support
Support for multiple store locations with independent configurations and settings.

**Related Files:**
- ADD_SANS_SOUCI_STORE.md
- SANS_SOUCI_SETTINGS_SYNC_REPORT.md
- /scripts/migrations/apply_sans_souci_migration.mjs

### 3. Attendance & Shift Management
Complete attendance tracking with check-in/check-out, shift proposals, and auto-checkout functionality.

**Related Files:**
- ATTENDANCE_PROPOSALS_FIX.md
- /supabase/migrations/ATTENDANCE_PROPOSALS_MIGRATION.sql
- /scripts/migrations/apply_attendance_proposals_migration.mjs

### 4. Opening Cash Validation
End-of-day cash management with opening balance tracking and validation.

**Related Files:**
- APPLY_OPENING_CASH_FIX.md
- OPENING_CASH_FIX_SUMMARY.md
- /scripts/migrations/apply_opening_cash_fix_final.mjs

### 5. Performance Optimizations
Database query optimizations, caching strategies, and permission loading improvements.

**Related Files:**
- PERMISSION_LOADING_OPTIMIZATION.md
- PERMISSION_LOADING_SPEED_OPTIMIZATIONS.md
- /supabase/migrations/APPLY_OPTIMIZED_PERMISSIONS.sql

## Chronological Timeline

1. **October 2025** - Initial schema creation and multi-store support
2. **October 2025** - Role-based permission system implementation
3. **November 2025** - Attendance proposals and shift management features
4. **November 2025** - Inventory system with purchase lots and distribution
5. **December 2025** - Opening cash validation and safe balance system
6. **December 2025** - Queue removal and violation reporting system
7. **January 2026** - Sans Souci store addition and settings synchronization

## How to Use This Documentation

1. **For New Features**: Check the implementation guides for step-by-step setup instructions
2. **For Troubleshooting**: Review the fix reports and verification documents
3. **For Database Changes**: Use migration instructions along with scripts in `/scripts/migrations/`
4. **For Performance Issues**: Consult the optimization documents
5. **For Data Analysis**: Use scripts in `/scripts/analysis/` to investigate data issues

## Maintenance

When adding new documentation:
1. Place the file in this `/docs/` directory
2. Update this README.md with a link and brief description
3. Add relevant links to related migration files or scripts
4. Update the chronological timeline if applicable

## Support & Development

For questions about specific features or implementations, refer to the detailed documentation files listed above. Each document contains comprehensive information about its respective feature, including database schema, functions, UI components, and testing instructions.
