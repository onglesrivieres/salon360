# Safe Balance Management System

## Overview

The Safe Balance system tracks cash flow between the cash registers and the store safe. It provides a complete audit trail of deposits (cash going into the safe) and withdrawals (cash coming out of the safe).

## Key Concepts

### Transaction Types

The system uses two transaction types from the `cash_transactions` table:

- **`cash_out`**: Money leaving circulation (e.g., deposited to safe)
- **`cash_in`**: Money entering circulation (e.g., withdrawn from safe)

### Categories

Within the Safe Balance system, transactions are categorized as:

- **Safe Deposit**: Cash being deposited into the safe (`cash_out` type)
- **Safe Withdrawal**: Cash being withdrawn from the safe (`cash_in` type)

### Important Semantic Note

The transaction types represent cash flow from the perspective of **circulation**:
- When you deposit cash to the safe, it's `cash_out` (leaving circulation)
- When you withdraw cash from the safe, it's `cash_in` (entering circulation)

This might seem counterintuitive at first, but it's consistent with the accounting perspective where:
- The safe is a storage location
- Deposits remove money from active circulation
- Withdrawals return money to active circulation

## Database Schema

### Tables

#### `safe_balance_history`

Stores historical balance snapshots for each store by date.

```sql
CREATE TABLE safe_balance_history (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES stores(id),
  date date NOT NULL,
  opening_balance decimal(10, 2) NOT NULL,
  closing_balance decimal(10, 2) NOT NULL,
  total_deposits decimal(10, 2) NOT NULL,
  total_withdrawals decimal(10, 2) NOT NULL,
  created_by_id uuid NOT NULL REFERENCES employees(id),
  updated_by_id uuid REFERENCES employees(id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(store_id, date)
);
```

**Key Points:**
- One record per store per date
- Unique constraint prevents duplicate entries
- Opening balance carries forward from previous day's closing balance
- Totals are calculated from approved transactions

#### `cash_transactions`

Stores all cash transactions including Safe Deposits and Safe Withdrawals.

```sql
CREATE TABLE cash_transactions (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES stores(id),
  date date NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('cash_in', 'cash_out')),
  category text,
  amount decimal(10, 2) NOT NULL,
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  requires_manager_approval boolean NOT NULL,
  manager_approved boolean NOT NULL,
  manager_approved_by_id uuid REFERENCES employees(id),
  manager_approved_at timestamptz,
  rejection_reason text,
  created_by_id uuid NOT NULL REFERENCES employees(id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
```

**For Safe Balance:**
- Safe Deposits: `transaction_type = 'cash_out'` AND `category = 'Safe Deposit'`
- Safe Withdrawals: `transaction_type = 'cash_in'` AND `category = 'Safe Withdrawal'`
- Only `status = 'approved'` transactions affect balance calculations

#### `function_error_logs`

Logs errors from database functions for debugging.

```sql
CREATE TABLE function_error_logs (
  id uuid PRIMARY KEY,
  function_name text NOT NULL,
  error_message text NOT NULL,
  error_detail text,
  error_hint text,
  parameters jsonb,
  store_id uuid,
  occurred_at timestamptz NOT NULL,
  context text
);
```

## Database Functions

### `get_safe_balance_for_date(p_store_id, p_date)`

Returns the safe balance summary for a specific date.

**Parameters:**
- `p_store_id` (uuid): The store ID
- `p_date` (date): The date to calculate balance for

**Returns:**
```typescript
{
  opening_balance: number,   // Previous day's closing balance
  total_deposits: number,     // Sum of approved deposits for the date
  total_withdrawals: number,  // Sum of approved withdrawals for the date
  closing_balance: number     // opening + deposits - withdrawals
}
```

**Calculation Logic:**
```sql
-- Opening balance from previous day
opening_balance = get_previous_safe_balance(p_store_id, p_date)

-- Total deposits (cash_out + Safe Deposit)
total_deposits = SUM(amount) WHERE
  transaction_type = 'cash_out' AND
  category = 'Safe Deposit' AND
  status = 'approved'

-- Total withdrawals (cash_in + Safe Withdrawal)
total_withdrawals = SUM(amount) WHERE
  transaction_type = 'cash_in' AND
  category = 'Safe Withdrawal' AND
  status = 'approved'

-- Closing balance
closing_balance = opening_balance + total_deposits - total_withdrawals
```

**Error Handling:**
- Wraps all operations in try-catch blocks
- Logs errors to `function_error_logs` table
- Returns zeros on error to prevent crashes
- Check error logs if results seem incorrect

### `get_previous_safe_balance(p_store_id, p_date)`

Returns the closing balance from the previous day with a balance record.

**Parameters:**
- `p_store_id` (uuid): The store ID
- `p_date` (date): The current date

**Returns:** `decimal(10, 2)` - Previous closing balance or 0 if none exists

### `get_recent_function_errors(p_limit)`

Returns recent function errors for debugging.

**Parameters:**
- `p_limit` (integer, default 50): Maximum number of errors to return

**Returns:** Array of error log records

## Frontend Integration

### SafeBalancePage Component

Location: `src/pages/SafeBalancePage.tsx`

**Key Operations:**

1. **Loading Balance Data:**
```typescript
const { data: balanceData } = await supabase
  .rpc('get_safe_balance_for_date', {
    p_store_id: selectedStoreId,
    p_date: selectedDate,
  })
  .maybeSingle();
```

2. **Loading Deposits:**
```typescript
const { data: deposits } = await supabase
  .from('cash_transactions')
  .select('*')
  .eq('store_id', selectedStoreId)
  .eq('date', selectedDate)
  .eq('transaction_type', 'cash_out')
  .eq('category', 'Safe Deposit');
```

3. **Loading Withdrawals:**
```typescript
const { data: withdrawals } = await supabase
  .from('cash_transactions')
  .select('*')
  .eq('store_id', selectedStoreId)
  .eq('date', selectedDate)
  .eq('transaction_type', 'cash_in')
  .eq('category', 'Safe Withdrawal');
```

4. **Creating a Withdrawal:**
```typescript
await supabase.from('cash_transactions').insert({
  store_id: selectedStoreId,
  date: selectedDate,
  transaction_type: 'cash_in',      // Important: 'cash_in' not 'cash_out'
  category: 'Safe Withdrawal',
  amount: amount,
  description: description,
  status: 'pending_approval',
  created_by_id: userId,
});
```

## Common Workflows

### End of Day Process

1. Manager counts cash in registers
2. Excess cash is deposited to safe
3. System creates a `cash_out` transaction with `Safe Deposit` category
4. Transaction requires manager approval
5. Once approved, it affects the safe balance

### Requesting Safe Withdrawal

1. Employee needs cash (e.g., for change, supplies)
2. Employee creates withdrawal request via Safe Balance page
3. System creates a `cash_in` transaction with `Safe Withdrawal` category
4. Manager reviews and approves/rejects the request
5. Once approved, cash is withdrawn and balance is updated

### Checking Safe Balance

1. Navigate to Safe Balance page
2. Select desired date using date picker
3. System displays:
   - Opening balance (from previous day)
   - All deposits for the day
   - All withdrawals for the day
   - Calculated closing balance

## Troubleshooting

### Balance Calculation Issues

1. **Check Error Logs:**
   ```sql
   SELECT * FROM function_error_logs
   WHERE function_name = 'get_safe_balance_for_date'
   ORDER BY occurred_at DESC
   LIMIT 10;
   ```

2. **Verify Transaction Types:**
   - Deposits should be `cash_out` + `Safe Deposit`
   - Withdrawals should be `cash_in` + `Safe Withdrawal`
   - Check for incorrectly typed transactions:
   ```sql
   SELECT * FROM cash_transactions
   WHERE category = 'Safe Withdrawal'
   AND transaction_type = 'cash_out';  -- These are WRONG
   ```

3. **Check Approval Status:**
   Only `status = 'approved'` transactions affect balance:
   ```sql
   SELECT status, COUNT(*)
   FROM cash_transactions
   WHERE category IN ('Safe Deposit', 'Safe Withdrawal')
   GROUP BY status;
   ```

4. **Verify Function Exists:**
   ```sql
   SELECT proname FROM pg_proc
   WHERE proname = 'get_safe_balance_for_date'
   AND pronamespace = 'public'::regnamespace;
   ```

### Historical Data Issues

If historical balance records are missing:

1. Records are created during End of Day process
2. Can be manually created if needed:
   ```sql
   INSERT INTO safe_balance_history (
     store_id, date, opening_balance, closing_balance,
     total_deposits, total_withdrawals, created_by_id
   ) VALUES (...);
   ```

3. Use `get_safe_balance_for_date` to calculate correct values

## Testing

### Running Verification Script

```bash
node scripts/analysis/verify_safe_balance_complete.mjs
```

This script:
- Checks all tables exist
- Verifies functions work correctly
- Tests balance calculations with real data
- Checks for transaction type errors
- Reviews error logs
- Validates historical records

### Test Data

Seed data can be created by applying the migration:
- `seed_safe_balance_test_data.sql`

This creates:
- 7 days of historical balance records
- 5 approved deposits
- 3 approved withdrawals
- 2 pending deposits
- 1 pending withdrawal
- 1 rejected withdrawal

## Migration History

### Original Implementation
- `20251230000000_create_safe_balance_system.sql`
  - Created `safe_balance_history` table
  - Created initial functions
  - Set up RLS policies

### Bug Fixes
- `20260105000000_fix_safe_balance_comprehensive.sql`
  - Added error logging system
  - Fixed withdrawal query logic
  - Added comprehensive error handling

- `fix_safe_withdrawal_transaction_type.sql`
  - Corrected withdrawal transaction type from `cash_out` to `cash_in`
  - Updated function documentation

### Archived Migrations
The following migrations were consolidated and archived:
- `20260103004419_update_safe_balance_function_remove_withdrawals.sql`
- `20260103011624_fix_safe_balance_table_name.sql`
- `20260103013223_restore_safe_withdrawals_to_balance_function.sql`
- `20260103013703_fix_safe_withdrawal_to_use_cash_payout.sql`
- `20260103014011_fix_safe_balance_table_name_reference.sql`

These contained incorrect logic and have been replaced by the comprehensive fix.

## Best Practices

1. **Always Use Correct Transaction Types**
   - Safe Deposits: `cash_out` type
   - Safe Withdrawals: `cash_in` type

2. **Require Manager Approval**
   - Both deposits and withdrawals should require approval
   - Unapproved transactions don't affect balance

3. **Check Error Logs Regularly**
   - Monitor `function_error_logs` for issues
   - Address errors promptly

4. **Validate Data Integrity**
   - Run verification script after changes
   - Ensure historical records are consistent

5. **Document Custom Changes**
   - If modifying the system, update this documentation
   - Add comments to migrations

## Security Considerations

### Row Level Security (RLS)

All tables have RLS enabled with policies allowing:
- Anonymous and authenticated users can read all records
- Anonymous and authenticated users can insert new records
- Anonymous and authenticated users can update records

**Note:** Security is enforced at the application level through PIN authentication and role checks, not at the database level.

### Audit Trail

Every transaction records:
- Creator (`created_by_id`)
- Approver (`manager_approved_by_id`)
- Creation timestamp
- Approval timestamp
- Edit history (for modifications)

## Support

For issues or questions:
1. Check error logs: `SELECT * FROM function_error_logs`
2. Run verification script: `node scripts/analysis/verify_safe_balance_complete.mjs`
3. Review this documentation
4. Check frontend console for detailed error messages
