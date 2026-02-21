-- Add commission_paired_enabled column to employees table
-- Controls whether the Commission field is editable in TicketEditor for tickets performed by this employee
-- Default true preserves existing behavior (Commission always editable)

ALTER TABLE employees ADD COLUMN IF NOT EXISTS commission_paired_enabled boolean DEFAULT true;

NOTIFY pgrst, 'reload schema';
