-- Mark all historical tickets before January 19, 2025 as "approved"
-- This ensures legacy tickets without approval status are properly marked

UPDATE sale_tickets
SET
  approval_status = 'approved',
  approved_at = NOW()
WHERE
  ticket_date < '2025-01-19'
  AND (approval_status IS NULL OR approval_status = '');
