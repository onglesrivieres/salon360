-- Force mark all historical tickets before January 19, 2025 as "approved"
-- This updates ALL tickets regardless of current approval_status (except rejected ones)

UPDATE sale_tickets
SET
  approval_status = 'approved',
  approved_at = COALESCE(approved_at, NOW())
WHERE
  ticket_date < '2025-01-19'
  AND (approval_status IS NULL
       OR approval_status = ''
       OR approval_status = 'pending_approval'
       OR approval_status NOT IN ('approved', 'auto_approved', 'rejected'));
