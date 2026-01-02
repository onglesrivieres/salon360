# Role-Based Permission Management System

This guide explains how to set up and use the role-based permission management system.

## Overview

The system allows Admin and Owner roles to customize permissions for each of the 8 roles in the application:
- Admin
- Owner
- Manager
- Supervisor
- Receptionist
- Technician
- Spa Expert
- Cashier

Each role can have over 60 individual permissions customized across 13 modules.

## Database Setup

### Step 1: Apply Schema Migration

Run the schema migration to create the necessary tables:

```sql
-- Run the contents of: role_permissions_migration.sql
```

This creates:
- `permission_definitions` - All available permissions
- `role_permissions` - Custom permission settings per store/role
- `role_permissions_audit` - Audit trail of changes

### Step 2: Create Database Functions

Run the functions file to create helper functions:

```sql
-- Run the contents of: role_permissions_functions.sql
```

This creates:
- `get_role_permissions()` - Retrieves permissions for a role
- `update_role_permission()` - Updates a single permission
- `reset_role_permissions_to_default()` - Resets to defaults
- `bulk_update_role_permissions()` - Updates multiple permissions
- `copy_role_permissions()` - Copies permissions between roles
- `get_permission_audit_log()` - Views change history

### Step 3: Seed Permission Definitions

Run the seed file to populate all permission definitions:

```sql
-- Run the contents of: seed_permissions.sql
```

This populates the `permission_definitions` table with all 60+ permissions.

## How It Works

### Default Behavior

- By default, all permissions use the hardcoded values from `src/lib/permissions.ts`
- These are the same permissions the app has always used
- No database records needed for default behavior

### Custom Permissions

- When you customize a permission in the UI, a record is created in `role_permissions`
- Custom permissions override the defaults
- All changes are logged in `role_permissions_audit`

### Permission Caching

- Permissions are loaded once at login and cached in memory
- Also stored in sessionStorage for persistence across page reloads
- Changes take effect **after users log out and back in**
- This ensures consistent behavior during active sessions

## Using the UI

### Accessing Role Permissions

1. Log in as Admin or Owner
2. Navigate to Configuration page
3. Click the "Role Permissions" tab
4. Select a role from the dropdown

### Managing Permissions

**View Permissions:**
- Permissions are grouped by module (Tickets, Employees, Services, etc.)
- Expand/collapse modules by clicking the header
- Green toggle = enabled, Gray toggle = disabled
- Critical permissions are marked with an orange badge

**Search:**
- Use the search bar to filter permissions by name or description

**Toggle Individual Permissions:**
- Click the toggle switch to enable/disable
- Changes are saved immediately to database
- A notification confirms the change

**Bulk Actions:**
- "Enable All" / "Disable All" - Apply to entire module
- "Reset to Defaults" - Restore all permissions for the role

**View Changes:**
- "Modified" badge shows permissions that differ from defaults
- Permission key displayed for reference

### Safety Features

1. **Critical Permissions Warning:**
   - Permissions marked as critical show a warning badge
   - Examples: Delete Employees, Assign Roles, Edit Configuration

2. **Confirmation Required:**
   - Resetting to defaults requires confirmation
   - Cannot be undone

3. **Impact Message:**
   - Shows when changes take effect (after logout/login)

## Permission Modules

The system organizes permissions into these modules:

1. **Tickets** (15 permissions)
   - View, Create, Edit, Delete, Close, Approve, etc.

2. **End of Day** (3 permissions)
   - View, Export reports

3. **Tip Reports** (4 permissions)
   - View, Export, View unlimited history

4. **Employees** (6 permissions)
   - View, Create, Edit, Delete, Reset PIN, Assign Roles

5. **Services** (5 permissions)
   - View, Create, Edit, Archive, Delete

6. **Profile** (1 permission)
   - Change own PIN

7. **Attendance** (3 permissions)
   - View, Comment, Export

8. **Inventory** (12 permissions)
   - View, Create items, Approve, Distribute, Audit, etc.

9. **Suppliers** (4 permissions)
   - View, Create, Edit, Delete

10. **Queue** (1 permission)
    - View all queue statuses

11. **Insights** (1 permission)
    - View analytics

12. **Safe Balance** (2 permissions)
    - View, Manage

13. **Configuration** (2 permissions)
    - View, Edit settings

## Example Workflows

### Restricting Technician Access

To prevent technicians from viewing the End of Day page:

1. Go to Configuration > Role Permissions
2. Select "Technician" role
3. Expand "End of Day" module
4. Toggle off "View End of Day"
5. Users will need to log out and back in

### Allowing Receptionists to Manage Services

To let receptionists create and edit services:

1. Select "Receptionist" role
2. Expand "Services" module
3. Toggle on "Create Services"
4. Toggle on "Edit Services"
5. Changes apply after logout/login

### Copying Permissions Between Roles

To make Supervisor permissions match Manager:

```sql
SELECT copy_role_permissions(
  'YOUR_STORE_ID'::uuid,
  'Manager',
  'Supervisor',
  'YOUR_EMPLOYEE_ID'::uuid
);
```

## Audit Trail

### Viewing Change History

All permission changes are logged. To view the audit log:

```sql
SELECT * FROM get_permission_audit_log('YOUR_STORE_ID'::uuid, 50);
```

This shows:
- What permission changed
- Old and new values
- Who made the change
- When it was changed
- Optional change reason

### Audit Log Columns

- `role_name` - Which role was modified
- `permission_key` - Which permission changed
- `old_value` / `new_value` - Before and after
- `changed_by_name` - Employee who made the change
- `changed_at` - Timestamp
- `change_reason` - Optional explanation

## Technical Details

### Database Schema

**permission_definitions:**
- Stores metadata about all available permissions
- Read-only for the app (seeded during setup)
- Includes display name, description, module, criticality

**role_permissions:**
- Stores custom permission settings
- Unique constraint on (store_id, role_name, permission_key)
- Only created when permission differs from default

**role_permissions_audit:**
- Immutable log of all changes
- Triggered automatically on updates

### RLS Policies

- All tables have Row Level Security enabled
- Users can only read permissions for their assigned stores
- Only Admin and Owner can modify permissions
- Audit logs are readable by all authenticated users

### Caching Strategy

1. **Session Storage** - Persists across page reloads
2. **Memory Cache** - Fast access during session
3. **Database** - Source of truth
4. **Fallback** - Uses hardcoded defaults if database unavailable

### Performance

- Permissions loaded once at login (8 queries, one per role)
- All subsequent checks use cached Map structures
- O(1) lookup time for permission checks
- Indexed on (store_id, role_name) for fast retrieval

## Troubleshooting

### Permissions Not Taking Effect

- Users must log out and back in after changes
- Check browser sessionStorage is enabled
- Verify the permission was saved to database

### Can't Modify Permissions

- Ensure logged in as Admin or Owner
- Check RLS policies are enabled
- Verify employee is assigned to the store

### Database Errors

- Ensure all migrations are applied in order:
  1. role_permissions_migration.sql
  2. role_permissions_functions.sql
  3. seed_permissions.sql

### Reset Everything

To reset all custom permissions for a store:

```sql
DELETE FROM role_permissions WHERE store_id = 'YOUR_STORE_ID';
```

This will revert all roles to default permissions.

## Best Practices

1. **Test in Development First**
   - Try permission changes with test accounts
   - Verify desired behavior before rolling out

2. **Document Changes**
   - Use the audit log to track what was changed
   - Keep notes on why permissions were modified

3. **Minimize Customization**
   - Start with defaults
   - Only change what's necessary
   - Too many custom settings become hard to maintain

4. **Regular Reviews**
   - Periodically review permission settings
   - Ensure they still match business needs
   - Remove unnecessary customizations

5. **Communication**
   - Inform users when permissions change
   - Explain why they need to log out/in
   - Set expectations about new access levels

## Support

If you encounter issues:

1. Check the browser console for errors
2. Review the audit log for recent changes
3. Verify database migrations are applied
4. Test with a different user account
5. Reset to defaults if configuration becomes corrupt

---

**Note:** This system is designed for flexibility while maintaining security. Always test permission changes with non-production accounts first to ensure desired behavior.
