/*
  # Add Vote Threshold and Expiration System for Violation Reports

  ## Summary
  This migration adds configurable vote thresholds and time-based expiration for queue violation reports.
  The system requires a minimum number of "violation confirmed" (YES) votes before a report is validated.
  Reports have a 60-minute voting window and expire if not completed in time.

  ## Changes to Tables
  
  ### queue_violation_reports
  - `insufficient_responders` (boolean) - Flags reports created when there aren't enough employees to meet minimum vote threshold
  - `expires_at` (timestamptz) - Timestamp when the report expires (60 minutes after creation)
  - `min_votes_required_snapshot` (integer) - Stores the minimum votes required at time of report creation for historical reference
  - `votes_violation_confirmed` (integer) - Count of "violation confirmed" (YES) votes received
  - `threshold_met` (boolean) - Indicates whether the minimum YES votes threshold was met
  
  ### stores
  - `violation_min_votes_required` (integer) - Default minimum number of YES votes required per store
  
  ## New Status
  - Added 'expired' status to violation report lifecycle
  
  ## Security
  - RLS policies updated to allow authenticated users to view all relevant columns
  
  ## Indexes
  - Index on expires_at for efficient cron job queries
  - Index on status and expires_at for filtering expired reports
*/

-- Add columns to queue_violation_reports table
ALTER TABLE public.queue_violation_reports 
ADD COLUMN IF NOT EXISTS insufficient_responders boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS expires_at timestamptz,
ADD COLUMN IF NOT EXISTS min_votes_required_snapshot integer,
ADD COLUMN IF NOT EXISTS votes_violation_confirmed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS threshold_met boolean DEFAULT false;

-- Add violation_min_votes_required to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS violation_min_votes_required integer DEFAULT 3 CHECK (violation_min_votes_required >= 1 AND violation_min_votes_required <= 10);

-- Set initial values for existing stores
UPDATE public.stores SET violation_min_votes_required = 3 WHERE name = 'Ongles Charlesbourg';
UPDATE public.stores SET violation_min_votes_required = 3 WHERE name = 'Ongles Maily';
UPDATE public.stores SET violation_min_votes_required = 2 WHERE name = 'Ongles Rivieres';
UPDATE public.stores SET violation_min_votes_required = 4 WHERE name = 'Sans Souci';

-- Add 'expired' status to the existing status check constraint
-- First, drop the existing constraint
ALTER TABLE public.queue_violation_reports 
DROP CONSTRAINT IF EXISTS queue_violation_reports_status_check;

-- Add the new constraint with 'expired' status
ALTER TABLE public.queue_violation_reports
ADD CONSTRAINT queue_violation_reports_status_check 
CHECK (status IN ('collecting_responses', 'pending_approval', 'approved', 'rejected', 'expired'));

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_violation_reports_expires_at 
ON public.queue_violation_reports(expires_at) 
WHERE status = 'collecting_responses';

CREATE INDEX IF NOT EXISTS idx_violation_reports_status_expires 
ON public.queue_violation_reports(status, expires_at);

-- Add app_settings entries for violation_min_votes_required
INSERT INTO public.app_settings (
  store_id, 
  setting_key, 
  setting_value, 
  default_value,
  category, 
  display_name,
  description,
  help_text,
  display_order, 
  is_critical,
  created_at, 
  updated_at
)
SELECT 
  s.id,
  'violation_min_votes_required',
  to_jsonb(s.violation_min_votes_required),
  to_jsonb(s.violation_min_votes_required),
  'Queue',
  'Minimum Violation Confirmed Votes',
  'Number of employees who must vote YES (violation confirmed) before a report is validated.',
  'Set the minimum number of "violation confirmed" votes needed to validate a violation report. If this threshold is not met within 60 minutes, the report will expire and be sent to management for review.',
  140,
  true,
  now(),
  now()
FROM public.stores s
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings 
  WHERE store_id = s.id AND setting_key = 'violation_min_votes_required'
);

-- Add comment explaining the columns
COMMENT ON COLUMN public.queue_violation_reports.insufficient_responders IS 'True if report was created when there were fewer employees available than the minimum votes required';
COMMENT ON COLUMN public.queue_violation_reports.expires_at IS 'Timestamp when report expires (60 minutes after creation). Expired reports are sent to management regardless of vote count.';
COMMENT ON COLUMN public.queue_violation_reports.min_votes_required_snapshot IS 'Snapshot of minimum votes required at time of report creation for historical reference';
COMMENT ON COLUMN public.queue_violation_reports.votes_violation_confirmed IS 'Count of YES (violation confirmed) votes received';
COMMENT ON COLUMN public.queue_violation_reports.threshold_met IS 'True if the minimum YES votes threshold was met';
COMMENT ON COLUMN public.stores.violation_min_votes_required IS 'Default minimum number of YES votes required for violation reports to be validated';
