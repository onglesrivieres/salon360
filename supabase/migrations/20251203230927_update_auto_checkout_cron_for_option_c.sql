/*
  # Update Auto-Checkout Cron Jobs for Option C

  ## Overview
  Updates the cron job schedule to use the new auto_checkout_employees_by_context() function.
  Runs daily at 22:00 (10:00 PM) Eastern Time to auto-checkout all employees still checked in.

  ## Changes
  1. Remove all old auto-checkout cron jobs
     - auto-checkout-1700-edt
     - auto-checkout-1700-est
     - auto-checkout-1730-edt
     - auto-checkout-1730-est
     - auto-checkout-all-at-closing-edt
     - auto-checkout-all-at-closing-est
     - auto-checkout-inactive-daily
     - Any other related jobs

  2. Create new simplified cron jobs
     - Run at 22:00 Eastern Time daily
     - EDT (summer): 22:00 EDT = 02:00 UTC
     - EST (winter): 22:00 EST = 03:00 UTC
     - Single function handles all stores and all scenarios

  ## Rationale
  - 22:00 is 1 hour after latest store closing (21:00 at RIVIERES Thu-Fri)
  - Ensures all tickets are closed and employees can be processed
  - Unified function simplifies maintenance
  - Works for all stores regardless of their closing times

  ## Security
  - Cron jobs run with database permissions
  - Function uses SECURITY DEFINER with existing RLS
*/

-- Remove all old auto-checkout cron jobs
DO $$
BEGIN
  PERFORM cron.unschedule('auto-checkout-1700-edt');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-checkout-1700-est');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-checkout-1730-edt');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-checkout-1730-est');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-checkout-all-at-closing-edt');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-checkout-all-at-closing-est');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-checkout-inactive-daily');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-checkout-2200-edt');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-checkout-2200-est');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Create new cron jobs for 22:00 Eastern Time
-- EDT (Daylight): 22:00 EDT = 02:00 UTC (runs in summer)
SELECT cron.schedule(
  'auto-checkout-2200-edt',
  '0 2 * * *',
  $$SELECT auto_checkout_employees_by_context();$$
);

-- EST (Standard): 22:00 EST = 03:00 UTC (runs in winter)
SELECT cron.schedule(
  'auto-checkout-2200-est',
  '0 3 * * *',
  $$SELECT auto_checkout_employees_by_context();$$
);
