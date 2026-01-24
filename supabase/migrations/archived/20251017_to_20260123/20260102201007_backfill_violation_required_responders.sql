/*
  # Backfill Required Responder IDs for Existing Violation Reports

  1. Purpose
    - Update any existing violation reports that have empty required_responder_ids
    - Reconstruct the responder list based on who was checked in on the violation date

  2. Notes
    - This is a one-time backfill for existing reports
    - New reports will automatically populate this field
*/

-- Backfill required_responder_ids for existing reports
UPDATE public.queue_violation_reports vr
SET required_responder_ids = (
  SELECT COALESCE(array_agg(DISTINCT ar.employee_id), ARRAY[]::uuid[])
  FROM public.attendance_records ar
  WHERE ar.store_id = vr.store_id
    AND ar.check_in_time::date = vr.violation_date
    AND ar.employee_id NOT IN (vr.reporter_employee_id, vr.reported_employee_id)
    AND ar.check_out_time IS NULL
)
WHERE required_responder_ids IS NULL 
   OR required_responder_ids = ARRAY[]::uuid[]
   OR array_length(required_responder_ids, 1) IS NULL;
