-- Add void ticket feature: soft-delete with reason tracking
-- Voided tickets remain visible in ticket list but are excluded from all financial reports

-- Add void columns to sale_tickets
ALTER TABLE public.sale_tickets
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.employees(id),
  ADD COLUMN IF NOT EXISTS void_reason text;

-- Index for filtering voided tickets in queries
CREATE INDEX IF NOT EXISTS idx_sale_tickets_voided_at ON public.sale_tickets (voided_at);

-- Update ticket_activity_log action constraint to include 'voided'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_activity_log_action_check'
      AND table_name = 'ticket_activity_log'
  ) THEN
    ALTER TABLE public.ticket_activity_log
      DROP CONSTRAINT ticket_activity_log_action_check;
  END IF;

  ALTER TABLE public.ticket_activity_log
    ADD CONSTRAINT ticket_activity_log_action_check
    CHECK (action IN ('created', 'updated', 'closed', 'reopened', 'approved', 'status_corrected', 'deleted', 'voided'));
END
$$;
