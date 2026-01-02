# Attendance Change Proposals - Database Fix

## Problem Identified

The attendance change proposals feature was fully implemented in the application code, but the database table `attendance_change_proposals` was never created in your Supabase database. This caused the error:

```
Could not find the table "public_attenadance_change_proposals" in the schema cache
```

## What Was Done

1. **Analyzed the Issue**: Confirmed that the table doesn't exist in the database
2. **Created Migration Script**: Generated `apply_attendance_proposals_table.mjs` with clear instructions
3. **Verified Build**: Confirmed the application builds successfully

## What You Need To Do

### Step 1: Run the Migration Script

Run the following command to see the SQL migration:

```bash
node apply_attendance_proposals_table.mjs
```

### Step 2: Apply the SQL to Your Database

1. Open your Supabase Dashboard SQL Editor:
   https://supabase.com/dashboard/project/kycnryuiramusmdedqnq/sql/new

2. Copy all the SQL output from the script (between the separator lines)

3. Paste it into the SQL Editor

4. Click "Run" to execute the migration

### Step 3: Verify the Fix

After running the SQL, verify the table was created:

```bash
node check_and_create_proposals_table.mjs
```

You should see:
- ✅ Table EXISTS
- ✅ has_pending_proposal function EXISTS
- ✅ get_pending_proposals_count function EXISTS

## What This Enables

Once the migration is applied, the shift change proposal feature will work:

### For Employees:
- Can view their shift history
- Can propose changes to check-in/check-out times
- Must provide a reason for the change
- Can track status of their proposals (pending/approved/rejected)
- Shifts with pending proposals show a yellow pulsing background

### For Managers/Supervisors:
- Can view all pending proposals in their stores
- Can approve or reject proposals with comments
- Get notifications of pending proposals
- Can track proposal history

## Database Schema Created

The migration creates:

1. **Table**: `attendance_change_proposals`
   - Stores proposed time changes with reason and status
   - Links to attendance records and employees
   - Tracks reviewer and review comments

2. **Indexes**: For fast lookups on:
   - attendance_record_id
   - employee_id
   - status
   - reviewed_by_employee_id

3. **RLS Policies**:
   - Employees can view and create their own proposals
   - Managers/Supervisors can view and update proposals in their stores

4. **Functions**:
   - `has_pending_proposal(attendance_record_id)` - Check for pending proposals
   - `get_pending_proposals_count(store_id)` - Count pending proposals
   - `update_attendance_change_proposals_updated_at()` - Auto-update timestamp

## Files Reference

- `apply_attendance_proposals_table.mjs` - Script to display migration SQL
- `check_and_create_proposals_table.mjs` - Verification script
- `ATTENDANCE_PROPOSALS_MIGRATION.sql` - Full migration SQL
- `src/components/ShiftDetailModal.tsx` - Employee proposal UI
- `src/components/AttendanceProposalReviewModal.tsx` - Manager review UI

## Troubleshooting

If you encounter any errors after applying the migration:

1. Check that the migration completed successfully (no red errors in SQL Editor)
2. Verify Row Level Security is enabled on the table
3. Ensure all policies were created
4. Run the verification script to check all components are in place

## Next Steps

After applying the migration:
1. Test the feature by having an employee propose a shift change
2. Test manager approval/rejection flow
3. Verify the yellow pulsing indicator appears for pending proposals
4. Check that notifications work correctly
