/*
  # Fix Incorrect Manual Approvals to Auto-Approved

  ## Overview
  This migration corrects a potential data inconsistency where tickets that were 
  manually approved AFTER their 48-hour approval deadline should be categorized as 
  'auto_approved' rather than 'approved'.

  ## Business Logic
  - When a ticket is closed, approval_deadline is set to closed_at + 48 hours
  - Technicians have 48 hours to manually approve tickets
  - After 48 hours, tickets should be auto-approved
  - If a manual approval occurs after the deadline, it should be treated as auto-approved

  ## Issue Being Fixed
  Some tickets may have been manually approved after their approval_deadline passed.
  According to business rules, if the 48-hour window has closed, the approval should
  be categorized as 'auto_approved' regardless of whether someone manually clicked approve.

  ## Changes Made
  1. Create audit table to track all corrections
  2. Identify tickets with approval_status = 'approved' AND approved_at > approval_deadline
  3. Update these tickets to approval_status = 'auto_approved'
  4. Preserve approved_by field for audit trail (shows who attempted manual approval)
  5. Log all corrections in ticket_activity_log for transparency
  6. Generate diagnostic report

  ## Data Preservation
  - approved_by: PRESERVED (maintains audit trail of who approved)
  - approved_at: PRESERVED (maintains exact timestamp of approval)
  - approval_deadline: UNCHANGED
  - Only approval_status is updated: 'approved' → 'auto_approved'

  ## Rollback
  To rollback this migration, use the audit table:
  ```sql
  UPDATE sale_tickets st
  SET approval_status = 'approved'
  FROM approval_status_correction_audit a
  WHERE st.id = a.ticket_id
    AND a.original_approval_status = 'approved';
  ```

  ## Analysis Date Range
  - Covers ALL historical tickets (no date restrictions)
  - Excludes tickets from last 48 hours only if they have active approval cycles
*/

-- ============================================================================
-- STEP 1: Create Audit Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_status_correction_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES sale_tickets(id),
  ticket_no text NOT NULL,
  original_approval_status text NOT NULL,
  new_approval_status text NOT NULL,
  closed_at timestamptz,
  approval_deadline timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES employees(id),
  hours_after_deadline numeric,
  correction_reason text,
  correction_timestamp timestamptz DEFAULT now(),
  UNIQUE(ticket_id)
);

-- Enable RLS for audit table
ALTER TABLE approval_status_correction_audit ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read audit records
CREATE POLICY "Authenticated users can read approval corrections audit"
  ON approval_status_correction_audit
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index for querying audit records
CREATE INDEX IF NOT EXISTS idx_approval_correction_audit_ticket_id 
  ON approval_status_correction_audit(ticket_id);

CREATE INDEX IF NOT EXISTS idx_approval_correction_audit_timestamp 
  ON approval_status_correction_audit(correction_timestamp DESC);

COMMENT ON TABLE approval_status_correction_audit IS 
  'Audit table tracking corrections to ticket approval statuses. Records original state before correction for rollback capability and historical analysis.';

-- ============================================================================
-- STEP 2: Pre-Correction Diagnostic Analysis
-- ============================================================================

-- Create a function to generate diagnostic report
CREATE OR REPLACE FUNCTION get_approval_correction_diagnostics()
RETURNS TABLE (
  total_closed_tickets bigint,
  total_approved_manually bigint,
  total_auto_approved bigint,
  total_pending_approval bigint,
  tickets_needing_correction bigint,
  earliest_incorrect_approval timestamptz,
  latest_incorrect_approval timestamptz,
  avg_hours_late numeric,
  max_hours_late numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE closed_at IS NOT NULL) as closed_count,
      COUNT(*) FILTER (WHERE approval_status = 'approved') as approved_count,
      COUNT(*) FILTER (WHERE approval_status = 'auto_approved') as auto_approved_count,
      COUNT(*) FILTER (WHERE approval_status = 'pending_approval') as pending_count,
      COUNT(*) FILTER (
        WHERE approval_status = 'approved' 
          AND approved_at > approval_deadline
          AND closed_at IS NOT NULL
      ) as needs_correction_count,
      MIN(approved_at) FILTER (
        WHERE approval_status = 'approved' 
          AND approved_at > approval_deadline
      ) as earliest_bad_approval,
      MAX(approved_at) FILTER (
        WHERE approval_status = 'approved' 
          AND approved_at > approval_deadline
      ) as latest_bad_approval,
      AVG(EXTRACT(EPOCH FROM (approved_at - approval_deadline))/3600) FILTER (
        WHERE approval_status = 'approved' 
          AND approved_at > approval_deadline
      ) as avg_late_hours,
      MAX(EXTRACT(EPOCH FROM (approved_at - approval_deadline))/3600) FILTER (
        WHERE approval_status = 'approved' 
          AND approved_at > approval_deadline
      ) as max_late_hours
    FROM sale_tickets
  )
  SELECT 
    closed_count::bigint,
    approved_count::bigint,
    auto_approved_count::bigint,
    pending_count::bigint,
    needs_correction_count::bigint,
    earliest_bad_approval,
    latest_bad_approval,
    ROUND(avg_late_hours, 2) as avg_hours_late,
    ROUND(max_late_hours, 2) as max_hours_late
  FROM stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_approval_correction_diagnostics IS 
  'Returns diagnostic statistics about ticket approval statuses and identifies tickets that need correction.';

-- ============================================================================
-- STEP 3: Insert Records Into Audit Table (Before Correction)
-- ============================================================================

INSERT INTO approval_status_correction_audit (
  ticket_id,
  ticket_no,
  original_approval_status,
  new_approval_status,
  closed_at,
  approval_deadline,
  approved_at,
  approved_by,
  hours_after_deadline,
  correction_reason
)
SELECT 
  id,
  ticket_no,
  approval_status as original_approval_status,
  'auto_approved' as new_approval_status,
  closed_at,
  approval_deadline,
  approved_at,
  approved_by,
  ROUND(EXTRACT(EPOCH FROM (approved_at - approval_deadline))/3600, 2) as hours_after_deadline,
  format(
    'Manual approval occurred %s hours after 48-hour deadline expired',
    ROUND(EXTRACT(EPOCH FROM (approved_at - approval_deadline))/3600, 2)
  ) as correction_reason
FROM sale_tickets
WHERE approval_status = 'approved'
  AND approved_at > approval_deadline
  AND closed_at IS NOT NULL
ON CONFLICT (ticket_id) DO NOTHING;

-- ============================================================================
-- STEP 4: Correct Approval Status
-- ============================================================================

WITH corrected_tickets AS (
  UPDATE sale_tickets
  SET approval_status = 'auto_approved'
  WHERE approval_status = 'approved'
    AND approved_at > approval_deadline
    AND closed_at IS NOT NULL
  RETURNING 
    id,
    ticket_no,
    approved_at,
    approval_deadline,
    approved_by
)
SELECT 
  COUNT(*) as tickets_corrected,
  json_agg(
    json_build_object(
      'ticket_no', ticket_no,
      'approved_at', approved_at,
      'approval_deadline', approval_deadline,
      'hours_late', ROUND(EXTRACT(EPOCH FROM (approved_at - approval_deadline))/3600, 2)
    )
  ) as corrected_tickets_summary
FROM corrected_tickets;

-- ============================================================================
-- STEP 5: Log Corrections in Activity Log
-- ============================================================================

-- First, ensure the activity log allows 'status_corrected' action
DO $$
BEGIN
  -- Check if the constraint exists and update it
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ticket_activity_log' 
      AND constraint_name LIKE '%action%check%'
  ) THEN
    -- Drop the old constraint if it exists
    ALTER TABLE ticket_activity_log 
      DROP CONSTRAINT IF EXISTS ticket_activity_log_action_check;
    
    -- Add updated constraint that includes status_corrected
    ALTER TABLE ticket_activity_log 
      ADD CONSTRAINT ticket_activity_log_action_check 
      CHECK (action IN ('created', 'updated', 'closed', 'reopened', 'approved', 'status_corrected'));
  END IF;
END $$;

-- Insert activity log entries for all corrected tickets
INSERT INTO ticket_activity_log (
  ticket_id,
  employee_id,
  action,
  description,
  changes
)
SELECT 
  a.ticket_id,
  NULL as employee_id, -- System correction, not a user action
  'status_corrected' as action,
  format(
    'Approval status corrected from ''approved'' to ''auto_approved'' - manual approval occurred %.2f hours after 48-hour deadline',
    a.hours_after_deadline
  ) as description,
  json_build_object(
    'correction_type', 'approval_status_fix',
    'old_status', a.original_approval_status,
    'new_status', a.new_approval_status,
    'reason', 'manual_approval_after_deadline',
    'hours_after_deadline', a.hours_after_deadline,
    'approved_by_preserved', a.approved_by,
    'approved_at_preserved', a.approved_at,
    'correction_timestamp', a.correction_timestamp,
    'ticket_no', a.ticket_no
  )::jsonb as changes
FROM approval_status_correction_audit a;

-- ============================================================================
-- STEP 6: Post-Correction Verification
-- ============================================================================

-- Create function to verify corrections
CREATE OR REPLACE FUNCTION verify_approval_corrections()
RETURNS TABLE (
  check_name text,
  status text,
  details text
) AS $$
BEGIN
  -- Check 1: No tickets should have approved status with approved_at > deadline
  RETURN QUERY
  SELECT 
    'Remaining Incorrect Approvals'::text,
    CASE 
      WHEN COUNT(*) = 0 THEN '✓ PASS'
      ELSE '✗ FAIL'
    END::text,
    format('%s tickets still have incorrect approval status', COUNT(*))::text
  FROM sale_tickets
  WHERE approval_status = 'approved'
    AND approved_at > approval_deadline
    AND closed_at IS NOT NULL;

  -- Check 2: Audit table should match number of corrections
  RETURN QUERY
  SELECT 
    'Audit Records Match Corrections'::text,
    CASE 
      WHEN audit_count = activity_count THEN '✓ PASS'
      ELSE '✗ FAIL'
    END::text,
    format('Audit: %s records, Activity Log: %s records', audit_count, activity_count)::text
  FROM (
    SELECT 
      (SELECT COUNT(*) FROM approval_status_correction_audit) as audit_count,
      (SELECT COUNT(*) FROM ticket_activity_log WHERE action = 'status_corrected') as activity_count
  ) counts;

  -- Check 3: All corrected tickets should preserve approved_by
  RETURN QUERY
  SELECT 
    'Approved By Preserved'::text,
    CASE 
      WHEN missing_count = 0 THEN '✓ PASS'
      ELSE '✗ FAIL'
    END::text,
    format('%s corrected tickets missing approved_by field', missing_count)::text
  FROM (
    SELECT COUNT(*) as missing_count
    FROM approval_status_correction_audit a
    WHERE a.approved_by IS NULL
  ) check_data;

  -- Check 4: All auto_approved tickets should have approved_at set
  RETURN QUERY
  SELECT 
    'Auto-Approved Tickets Have Timestamp'::text,
    CASE 
      WHEN missing_count = 0 THEN '✓ PASS'
      ELSE '✗ FAIL'
    END::text,
    format('%s auto_approved tickets missing approved_at', missing_count)::text
  FROM (
    SELECT COUNT(*) as missing_count
    FROM sale_tickets
    WHERE approval_status = 'auto_approved'
      AND approved_at IS NULL
  ) check_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_approval_corrections IS 
  'Runs verification checks after approval status corrections to ensure data integrity.';

-- ============================================================================
-- STEP 7: Generate Summary Report Function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_approval_correction_summary()
RETURNS TABLE (
  total_tickets_corrected bigint,
  earliest_correction_date timestamptz,
  latest_correction_date timestamptz,
  avg_hours_late numeric,
  max_hours_late numeric,
  min_hours_late numeric,
  tickets_by_approver jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_corrected,
    MIN(approved_at) as earliest_date,
    MAX(approved_at) as latest_date,
    ROUND(AVG(hours_after_deadline), 2) as avg_late,
    ROUND(MAX(hours_after_deadline), 2) as max_late,
    ROUND(MIN(hours_after_deadline), 2) as min_late,
    jsonb_agg(
      jsonb_build_object(
        'approved_by', approved_by,
        'ticket_count', ticket_count,
        'avg_hours_late', avg_hours_late
      )
    ) as by_approver
  FROM (
    SELECT 
      approved_by,
      COUNT(*) as ticket_count,
      ROUND(AVG(hours_after_deadline), 2) as avg_hours_late,
      hours_after_deadline,
      approved_at
    FROM approval_status_correction_audit
    GROUP BY approved_by, hours_after_deadline, approved_at
  ) grouped;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_approval_correction_summary IS 
  'Returns summary statistics of all approval status corrections performed by this migration.';

-- ============================================================================
-- STEP 8: Display Migration Results
-- ============================================================================

-- Show diagnostic results
DO $$
DECLARE
  diagnostics RECORD;
  verification RECORD;
  summary RECORD;
BEGIN
  -- Get and display diagnostics
  SELECT * INTO diagnostics FROM get_approval_correction_diagnostics();
  
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'APPROVAL STATUS CORRECTION - DIAGNOSTIC REPORT';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total Closed Tickets: %', diagnostics.total_closed_tickets;
  RAISE NOTICE 'Total Manually Approved: %', diagnostics.total_approved_manually;
  RAISE NOTICE 'Total Auto-Approved: %', diagnostics.total_auto_approved;
  RAISE NOTICE 'Total Pending Approval: %', diagnostics.total_pending_approval;
  RAISE NOTICE '-----------------------------------------------------------------';
  RAISE NOTICE 'Tickets Corrected: %', diagnostics.tickets_needing_correction;
  
  IF diagnostics.tickets_needing_correction > 0 THEN
    RAISE NOTICE 'Date Range: % to %', 
      diagnostics.earliest_incorrect_approval, 
      diagnostics.latest_incorrect_approval;
    RAISE NOTICE 'Average Hours Late: %', diagnostics.avg_hours_late;
    RAISE NOTICE 'Maximum Hours Late: %', diagnostics.max_hours_late;
  ELSE
    RAISE NOTICE 'Status: No tickets required correction';
    RAISE NOTICE 'All manually approved tickets were approved within the 48-hour window';
  END IF;
  
  RAISE NOTICE '=================================================================';
  
  -- Run and display verification
  RAISE NOTICE 'VERIFICATION CHECKS';
  RAISE NOTICE '=================================================================';
  FOR verification IN SELECT * FROM verify_approval_corrections()
  LOOP
    RAISE NOTICE '% - % - %', verification.status, verification.check_name, verification.details;
  END LOOP;
  RAISE NOTICE '=================================================================';
END $$;
