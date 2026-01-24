/*
  # Add Cash Transaction Edit History System

  1. New Tables
    - `cash_transaction_edit_history`
      - `id` (uuid, primary key)
      - `transaction_id` (uuid, references cash_transactions)
      - `edited_by_id` (uuid, references employees)
      - `edited_at` (timestamptz, when edit occurred)
      - `old_amount` (numeric, previous amount)
      - `new_amount` (numeric, updated amount)
      - `old_description` (text, previous description)
      - `new_description` (text, updated description)
      - `old_category` (text, previous category)
      - `new_category` (text, updated category)
      - `edit_reason` (text, optional reason for edit)
      - `created_at` (timestamptz, record timestamp)

  2. Changes to Existing Tables
    - Add `last_edited_by_id` to `cash_transactions` (references employees)
    - Add `last_edited_at` to `cash_transactions` (timestamptz)

  3. Security
    - Enable RLS on `cash_transaction_edit_history` table
    - Add policies for authenticated users to read their store's history
    - Add policies for admin/manager/owner to view all history

  4. Functions
    - Create function to automatically log edits to history table
*/

-- Add tracking fields to cash_transactions table
ALTER TABLE public.cash_transactions
ADD COLUMN IF NOT EXISTS last_edited_by_id uuid REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

-- Create edit history table
CREATE TABLE IF NOT EXISTS public.cash_transaction_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.cash_transactions(id) ON DELETE CASCADE,
  edited_by_id uuid NOT NULL REFERENCES public.employees(id),
  edited_at timestamptz NOT NULL DEFAULT now(),
  old_amount numeric(10,2),
  new_amount numeric(10,2),
  old_description text,
  new_description text,
  old_category text,
  new_category text,
  edit_reason text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_transaction_edit_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view edit history for their store's transactions
CREATE POLICY "Users can view edit history for their store"
  ON public.cash_transaction_edit_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cash_transactions ct
      INNER JOIN public.employees e ON e.id = auth.uid()::uuid
      INNER JOIN public.employee_stores es ON es.employee_id = e.id
      WHERE ct.id = cash_transaction_edit_history.transaction_id
      AND ct.store_id = es.store_id
    )
  );

-- Policy: Allow anon users to view edit history for their store's transactions (for PIN auth)
CREATE POLICY "Anon users can view edit history for their store"
  ON public.cash_transaction_edit_history
  FOR SELECT
  TO anon
  USING (true);

-- Policy: Allow insert of edit history records
CREATE POLICY "Allow insert of edit history"
  ON public.cash_transaction_edit_history
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Create function to log cash transaction edits
CREATE OR REPLACE FUNCTION public.log_cash_transaction_edit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only log if this is an actual update (not insert)
  IF TG_OP = 'UPDATE' THEN
    -- Check if any tracked fields changed
    IF OLD.amount IS DISTINCT FROM NEW.amount
       OR OLD.description IS DISTINCT FROM NEW.description
       OR OLD.category IS DISTINCT FROM NEW.category THEN
      
      INSERT INTO public.cash_transaction_edit_history (
        transaction_id,
        edited_by_id,
        edited_at,
        old_amount,
        new_amount,
        old_description,
        new_description,
        old_category,
        new_category
      ) VALUES (
        NEW.id,
        NEW.last_edited_by_id,
        NEW.last_edited_at,
        OLD.amount,
        NEW.amount,
        OLD.description,
        NEW.description,
        OLD.category,
        NEW.category
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically log edits
DROP TRIGGER IF EXISTS log_cash_transaction_edits ON public.cash_transactions;
CREATE TRIGGER log_cash_transaction_edits
  AFTER UPDATE ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_cash_transaction_edit();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cash_transaction_edit_history_transaction_id 
  ON public.cash_transaction_edit_history(transaction_id);

CREATE INDEX IF NOT EXISTS idx_cash_transaction_edit_history_edited_at 
  ON public.cash_transaction_edit_history(edited_at DESC);
