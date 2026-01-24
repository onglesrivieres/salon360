/*
  # Add Missing Violation Report Columns

  ## Problem
  The queue_violation_reports table is missing four columns that are referenced
  by violation processing functions created in later migrations. These columns
  were supposed to be added by migration 20260102212424 but that migration has
  a bug and exits early without creating them.

  ## Missing Columns
  1. min_votes_required_snapshot - Stores the threshold at report creation time
  2. insufficient_responders - Flag if not enough people can vote
  3. votes_violation_confirmed - Count of YES votes
  4. threshold_met - Flag if vote threshold has been met

  ## Functions Expecting These Columns
  - get_pending_violation_responses (tries to SELECT these columns)
  - create_queue_violation_report (tries to INSERT these columns)
  - update_violation_report_creation_with_threshold_logic
  - Other violation processing functions

  ## Solution
  Add the missing columns to queue_violation_reports table with appropriate
  defaults and data types.
*/

-- Add missing columns to queue_violation_reports
ALTER TABLE public.queue_violation_reports
ADD COLUMN IF NOT EXISTS min_votes_required_snapshot integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS insufficient_responders boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS votes_violation_confirmed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS threshold_met boolean DEFAULT false;

-- Add column comments for documentation
COMMENT ON COLUMN public.queue_violation_reports.min_votes_required_snapshot IS
'Snapshot of the minimum votes required at the time the report was created. Used to determine if the vote threshold has been met.';

COMMENT ON COLUMN public.queue_violation_reports.insufficient_responders IS
'True if there are not enough responders to meet the minimum vote threshold. Set to true if fewer people than min_votes_required_snapshot can respond.';

COMMENT ON COLUMN public.queue_violation_reports.votes_violation_confirmed IS
'Count of YES votes confirming the violation. Incremented as responses are collected.';

COMMENT ON COLUMN public.queue_violation_reports.threshold_met IS
'True if the number of YES votes (votes_violation_confirmed) has reached or exceeded min_votes_required_snapshot. Used to determine if a violation is confirmed.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
