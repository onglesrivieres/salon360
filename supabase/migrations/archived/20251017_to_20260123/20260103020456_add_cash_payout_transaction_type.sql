/*
  # Add Cash Payout Transaction Type for Safe Withdrawals

  1. Changes
    - Add 'cash_payout' as a valid transaction_type value
    - This type is specifically for cash leaving the safe (Payroll, Tip Payout)
    - Separates safe cash payouts from End of Day cash_in/cash_out system

  2. Purpose
    - 'cash_in': Money entering cash drawer (sales, safe withdrawals)
    - 'cash_out': Money leaving cash drawer (safe deposits, expenses)
    - 'cash_payout': Money leaving safe (payroll, tip payouts)

  3. Impact
    - Existing transactions remain unchanged
    - New safe withdrawal transactions will use 'cash_payout' type
    - Safe balance calculations will be updated to use this new type
*/

-- Drop the existing constraint
ALTER TABLE public.cash_transactions
DROP CONSTRAINT IF EXISTS cash_transactions_transaction_type_check;

-- Add new constraint with cash_payout included
ALTER TABLE public.cash_transactions
ADD CONSTRAINT cash_transactions_transaction_type_check
CHECK (transaction_type IN ('cash_in', 'cash_out', 'cash_payout'));

-- Add comment to document the transaction types
COMMENT ON COLUMN public.cash_transactions.transaction_type IS
'Transaction type: cash_in (money entering drawer), cash_out (money leaving drawer to safe/expenses), cash_payout (money leaving safe for payroll/tips)';
