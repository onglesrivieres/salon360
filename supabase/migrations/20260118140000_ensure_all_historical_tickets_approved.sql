-- Ensure ALL historical tickets before January 19, 2025 are marked as "approved"
-- This is a comprehensive fix that updates any ticket not already approved/auto_approved/rejected

-- Update all tickets that are not already in a final approved state
UPDATE sale_tickets
SET
  approval_status = 'approved',
  approved_at = COALESCE(approved_at, closed_at, NOW())
WHERE
  ticket_date < '2025-01-19'
  AND (approval_status IS DISTINCT FROM 'approved')
  AND (approval_status IS DISTINCT FROM 'auto_approved')
  AND (approval_status IS DISTINCT FROM 'rejected');
