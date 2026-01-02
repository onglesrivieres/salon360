# Commission Pay Type Setup

This document explains the Commission pay type feature and how to complete the setup.

## Overview

The Commission pay type has been added to the employee management system. Commission employees:

1. **Do NOT need to check in or check out** - Attendance tracking is optional for them
2. **Can only view their individual data** in:
   - Tickets page - Only tickets containing services they performed
   - Approvals page - Only approval requests for tickets they worked on
3. **Cannot see other employees' data** - Restricted view for privacy and simplicity

## Database Migration Required

To enable the Commission pay type in the database, you need to run the following SQL in your Supabase SQL Editor:

```sql
-- Drop the existing pay_type constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_pay_type_valid;

-- Add new constraint to include 'commission'
ALTER TABLE employees ADD CONSTRAINT employees_pay_type_valid
CHECK (pay_type IN ('hourly', 'daily', 'commission'));
```

### How to Apply the Migration

**Option 1: Supabase Dashboard (Recommended)**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Paste the SQL above
5. Click "Run" to execute

**Option 2: Using the provided script**
```bash
node apply_commission_pay_type.mjs
```
Note: This script may require additional setup if your Supabase instance doesn't have an `exec_sql` function.

## Using Commission Pay Type

### Setting Up a Commission Employee

1. Go to the Employees page
2. Create a new employee or edit an existing one
3. As an Owner or Manager, you'll see a "Pay Type" dropdown
4. Select "Commission" from the options:
   - Hourly
   - Daily
   - Commission

### Commission Employee Experience

**Check-in/Check-out:**
- Commission employees are automatically exempt from check-in/check-out requirements
- They won't be prompted to check in before joining the ready queue
- The attendance_display field can be used to further control visibility

**Tickets Page:**
- Commission employees only see tickets that include services they performed
- They cannot view tickets assigned to other employees
- All ticket details for their own work remain visible

**Approvals Page:**
- Commission employees only see approval requests for tickets they worked on
- They use the same approval workflow as regular technicians
- They cannot approve tickets they didn't work on

**Navigation:**
- Full access to Tickets and Approvals pages
- Normal access to other assigned features based on their role

## Technical Implementation

### Code Changes

1. **Database Schema:**
   - Updated `employees` table pay_type constraint to include 'commission'
   - No new tables or columns added

2. **TypeScript Types:**
   - Updated `Employee` interface to include 'commission' in pay_type union type
   - Updated `AttendanceRecord` interface for consistency

3. **UI Updates:**
   - Added "Commission" option to Pay Type dropdown in EmployeesPage
   - Only visible to Owners and Managers

4. **Business Logic:**
   - Check-in/out logic already exempts non-hourly employees (now includes commission)
   - TicketsPage filters tickets for commission employees (same as technicians)
   - PendingApprovalsPage filters approvals for commission employees

### Files Modified

- `src/lib/supabase.ts` - Type definitions
- `src/pages/EmployeesPage.tsx` - UI for selecting pay type
- `src/pages/TicketsPage.tsx` - Ticket filtering logic
- `src/pages/PendingApprovalsPage.tsx` - Approval filtering logic
- `apply_commission_pay_type.mjs` - Migration script (new file)

## Troubleshooting

### Commission option not appearing in dropdown
- Ensure you're logged in as an Owner or Manager
- Check that the TypeScript build completed successfully
- Clear browser cache and reload

### Database constraint error
- Ensure the SQL migration has been run in Supabase
- Check that the `employees_pay_type_valid` constraint exists with all three values

### Commission employees seeing all tickets
- Verify the employee's pay_type is set to 'commission' in the database
- Check browser console for any JavaScript errors
- Ensure the employee is logged in with the correct account

## Notes

- Commission employees maintain their existing role assignments (Technician, Spa Expert, etc.)
- The pay type only affects attendance tracking and data visibility
- Commission employees can still be assigned to multiple stores
- All existing RLS policies and security measures remain in place
