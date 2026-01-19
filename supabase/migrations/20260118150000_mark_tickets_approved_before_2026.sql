-- Ensure ALL historical tickets before January 19, 2026 are marked as "auto_approved"
-- Using auto_approved status since it doesn't require approved_by field

UPDATE sale_tickets
SET
  approval_status = 'auto_approved',
  approved_at = COALESCE(approved_at, closed_at, NOW())
WHERE
  ticket_date < '2026-01-19'
  AND (approval_status IS DISTINCT FROM 'approved')
  AND (approval_status IS DISTINCT FROM 'auto_approved')
  AND (approval_status IS DISTINCT FROM 'rejected');
