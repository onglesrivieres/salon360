/*
  # Standardize Safe Transaction Categories

  1. Changes
    - Update all "Safe Drop" transactions to "Safe Deposit"
    - Update all "Safe Withdrawal" transactions to "Safe Deposit" with a note
    - This consolidates all safe-related transactions under a single "Safe Deposit" category

  2. Background
    - The system previously had multiple safe-related categories (Safe Drop, Safe Deposit, Safe Withdrawal)
    - Simplifying to use only "Safe Deposit" for all safe-related transactions
    - This migration ensures existing data is consistent with the new category structure

  3. Impact
    - Historical "Safe Drop" transactions will be relabeled as "Safe Deposit"
    - Historical "Safe Withdrawal" transactions will be relabeled as "Safe Deposit" with "(formerly Safe Withdrawal)" appended to their description
*/

-- Update "Safe Drop" to "Safe Deposit"
UPDATE public.cash_transactions
SET category = 'Safe Deposit'
WHERE category = 'Safe Drop';

-- Update "Safe Withdrawal" to "Safe Deposit" and append note to description
UPDATE public.cash_transactions
SET
  category = 'Safe Deposit',
  description = CASE
    WHEN description IS NULL OR description = '' THEN '(formerly Safe Withdrawal)'
    ELSE description || ' (formerly Safe Withdrawal)'
  END
WHERE category = 'Safe Withdrawal';
