/*
  # Create Queue Removals Log System
  
  ## Overview
  This migration creates a comprehensive queue removal tracking system with:
  - Removal logging with reasons and notes
  - 30-minute cooldown enforcement
  - Full audit trail for managers
  
  ## New Tables
  - `queue_removals_log`
    - `id` (uuid, primary key)
    - `employee_id` (uuid, who was removed, FK to employees)
    - `store_id` (uuid, FK to stores)
    - `removed_by_employee_id` (uuid, who removed them, FK to employees)
    - `reason` (text, dropdown selection)
    - `notes` (text, additional details)
    - `removed_at` (timestamptz, when removed)
    - `cooldown_expires_at` (timestamptz, removed_at + 30 minutes)
    - `created_at` (timestamptz, record creation)
  
  ## Security
  - Enable RLS on queue_removals_log
  - Allow authenticated users to view their own removal records
  - Manager, Supervisor, Admin, Owner roles can view all records for their stores
  
  ## Indexes
  - Index on employee_id for quick lookup of user's removals
  - Index on store_id for filtering by store
  - Index on removed_at for date range queries
  - Index on cooldown_expires_at for active cooldown checks
*/

-- Create queue_removals_log table
CREATE TABLE IF NOT EXISTS public.queue_removals_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  removed_by_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'Rule violation',
    'Left work area without permission',
    'Not following queue policy',
    'Attendance policy violation',
    'Other'
  )),
  notes text,
  removed_at timestamptz NOT NULL DEFAULT now(),
  cooldown_expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_queue_removals_employee_id ON public.queue_removals_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_queue_removals_store_id ON public.queue_removals_log(store_id);
CREATE INDEX IF NOT EXISTS idx_queue_removals_removed_at ON public.queue_removals_log(removed_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_removals_cooldown_expires ON public.queue_removals_log(cooldown_expires_at);

-- Enable RLS
ALTER TABLE public.queue_removals_log ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can view their own removal records
CREATE POLICY "Employees can view own removal records"
  ON public.queue_removals_log
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Policy: Managers, Supervisors, Admins, and Owners can view all records for their stores
CREATE POLICY "Management can view all removal records for their stores"
  ON public.queue_removals_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.employee_stores es ON e.id = es.employee_id
      WHERE e.id = auth.uid()
        AND es.store_id = queue_removals_log.store_id
        AND e.role && ARRAY['Manager', 'Supervisor', 'Admin', 'Owner']::text[]
    )
  );

-- Policy: Managers, Supervisors, Admins, and Owners can insert removal records
CREATE POLICY "Management can create removal records"
  ON public.queue_removals_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.employee_stores es ON e.id = es.employee_id
      WHERE e.id = auth.uid()
        AND es.store_id = queue_removals_log.store_id
        AND e.role && ARRAY['Manager', 'Supervisor', 'Admin', 'Owner']::text[]
    )
  );

-- Add comment
COMMENT ON TABLE public.queue_removals_log IS 'Tracks all queue removals with cooldown enforcement and audit trail';