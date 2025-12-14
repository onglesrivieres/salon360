/*
  # Add Performance Indexes for Auto-Approval Queries

  ## Overview
  Adds composite indexes to optimize the auto-approval query which joins
  sale_tickets with app_settings and filters by approval_status and deadline.

  ## Indexes Created

  1. `idx_sale_tickets_auto_approval_eligible`
     - Composite index on (store_id, approval_deadline)
     - Partial index only including pending_approval tickets without manual approval
     - Optimizes the main WHERE clause of auto_approve_expired_tickets()

  2. `idx_app_settings_store_setting_lookup`
     - Index on (store_id, setting_key) for efficient setting lookups
     - Used by the JOIN to check if auto-approval is enabled

  ## Performance Impact
  - Reduces full table scans on sale_tickets
  - Faster auto-approval queries for large ticket tables
*/

-- Index for finding eligible tickets (pending approval past deadline)
CREATE INDEX IF NOT EXISTS idx_sale_tickets_auto_approval_eligible 
  ON public.sale_tickets (store_id, approval_deadline)
  WHERE approval_status = 'pending_approval' AND approved_by IS NULL;

-- Index for quickly looking up store settings
CREATE INDEX IF NOT EXISTS idx_app_settings_store_setting_lookup
  ON public.app_settings (store_id, setting_key);

-- Add comment documenting the indexes
COMMENT ON INDEX public.idx_sale_tickets_auto_approval_eligible IS 
'Partial index for efficiently finding tickets eligible for auto-approval (pending, past deadline, not manually approved)';

COMMENT ON INDEX public.idx_app_settings_store_setting_lookup IS 
'Index for quick store setting lookups by store_id and setting_key';
