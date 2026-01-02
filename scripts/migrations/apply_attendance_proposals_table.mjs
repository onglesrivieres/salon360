import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kycnryuiramusmdedqnq.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║   ATTENDANCE CHANGE PROPOSALS TABLE MIGRATION                     ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

console.log('⚠️  IMPORTANT: This script needs to be run from the Supabase SQL Editor');
console.log('   because table creation requires elevated privileges.\n');

console.log('📋 INSTRUCTIONS:\n');
console.log('1. Open your Supabase Dashboard SQL Editor:');
console.log('   https://supabase.com/dashboard/project/kycnryuiramusmdedqnq/sql/new\n');
console.log('2. Copy the SQL below and paste it into the SQL Editor\n');
console.log('3. Click "Run" to execute the migration\n');
console.log('4. Verify the table was created successfully\n');

console.log('═'.repeat(70));
console.log('MIGRATION SQL - COPY EVERYTHING BELOW THIS LINE');
console.log('═'.repeat(70));
console.log();

const migrationSQL = `
-- ============================================================================
-- CREATE ATTENDANCE CHANGE PROPOSALS TABLE
-- ============================================================================
-- This migration enables the shift change proposal feature
-- ============================================================================

-- Create the attendance_change_proposals table
CREATE TABLE IF NOT EXISTS public.attendance_change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id uuid NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  proposed_check_in_time timestamptz,
  proposed_check_out_time timestamptz,
  current_check_in_time timestamptz NOT NULL,
  current_check_out_time timestamptz,
  reason_comment text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT at_least_one_proposed_time CHECK (
    proposed_check_in_time IS NOT NULL OR proposed_check_out_time IS NOT NULL
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_change_proposals_attendance_record
  ON public.attendance_change_proposals(attendance_record_id);

CREATE INDEX IF NOT EXISTS idx_attendance_change_proposals_employee
  ON public.attendance_change_proposals(employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_change_proposals_status
  ON public.attendance_change_proposals(status);

CREATE INDEX IF NOT EXISTS idx_attendance_change_proposals_reviewed_by
  ON public.attendance_change_proposals(reviewed_by_employee_id);

-- Enable RLS
ALTER TABLE public.attendance_change_proposals ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can view their own proposals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'attendance_change_proposals'
    AND policyname = 'Employees can view own proposals'
  ) THEN
    CREATE POLICY "Employees can view own proposals"
      ON public.attendance_change_proposals
      FOR SELECT
      TO authenticated
      USING (
        employee_id IN (
          SELECT id FROM public.employees WHERE pin_hash = encode(digest(current_setting('request.jwt.claims', true)::json->>'pin', 'sha256'), 'hex')
        )
      );
  END IF;
END $$;

-- Policy: Employees can create proposals for their own attendance records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'attendance_change_proposals'
    AND policyname = 'Employees can create own proposals'
  ) THEN
    CREATE POLICY "Employees can create own proposals"
      ON public.attendance_change_proposals
      FOR INSERT
      TO authenticated
      WITH CHECK (
        employee_id IN (
          SELECT id FROM public.employees WHERE pin_hash = encode(digest(current_setting('request.jwt.claims', true)::json->>'pin', 'sha256'), 'hex')
        )
        AND attendance_record_id IN (
          SELECT id FROM public.attendance_records WHERE employee_id = attendance_change_proposals.employee_id
        )
      );
  END IF;
END $$;

-- Policy: Managers and supervisors can view all proposals in their stores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'attendance_change_proposals'
    AND policyname = 'Managers can view store proposals'
  ) THEN
    CREATE POLICY "Managers can view store proposals"
      ON public.attendance_change_proposals
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.employees e
          INNER JOIN public.employee_stores es ON e.id = es.employee_id
          INNER JOIN public.attendance_records ar ON ar.id = attendance_change_proposals.attendance_record_id
          WHERE e.pin_hash = encode(digest(current_setting('request.jwt.claims', true)::json->>'pin', 'sha256'), 'hex')
            AND ('manager' = ANY(e.roles) OR 'supervisor' = ANY(e.roles))
            AND es.store_id = ar.store_id
        )
      );
  END IF;
END $$;

-- Policy: Managers and supervisors can update (review) proposals in their stores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'attendance_change_proposals'
    AND policyname = 'Managers can update store proposals'
  ) THEN
    CREATE POLICY "Managers can update store proposals"
      ON public.attendance_change_proposals
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.employees e
          INNER JOIN public.employee_stores es ON e.id = es.employee_id
          INNER JOIN public.attendance_records ar ON ar.id = attendance_change_proposals.attendance_record_id
          WHERE e.pin_hash = encode(digest(current_setting('request.jwt.claims', true)::json->>'pin', 'sha256'), 'hex')
            AND ('manager' = ANY(e.roles) OR 'supervisor' = ANY(e.roles))
            AND es.store_id = ar.store_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.employees e
          INNER JOIN public.employee_stores es ON e.id = es.employee_id
          INNER JOIN public.attendance_records ar ON ar.id = attendance_change_proposals.attendance_record_id
          WHERE e.pin_hash = encode(digest(current_setting('request.jwt.claims', true)::json->>'pin', 'sha256'), 'hex')
            AND ('manager' = ANY(e.roles) OR 'supervisor' = ANY(e.roles))
            AND es.store_id = ar.store_id
        )
      );
  END IF;
END $$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_attendance_change_proposals_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS update_attendance_change_proposals_updated_at ON public.attendance_change_proposals;
CREATE TRIGGER update_attendance_change_proposals_updated_at
  BEFORE UPDATE ON public.attendance_change_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_attendance_change_proposals_updated_at();

-- Function to check if an attendance record has a pending proposal
CREATE OR REPLACE FUNCTION public.has_pending_proposal(p_attendance_record_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.attendance_change_proposals
    WHERE attendance_record_id = p_attendance_record_id
      AND status = 'pending'
  );
END;
$$;

-- Function to get pending proposals count for a store
CREATE OR REPLACE FUNCTION public.get_pending_proposals_count(p_store_id uuid)
RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM public.attendance_change_proposals acp
    INNER JOIN public.attendance_records ar ON ar.id = acp.attendance_record_id
    WHERE ar.store_id = p_store_id
      AND acp.status = 'pending'
  );
END;
$$;

-- Grant permissions for anonymous role
GRANT SELECT, INSERT, UPDATE ON public.attendance_change_proposals TO anon;
GRANT SELECT, INSERT, UPDATE ON public.attendance_change_proposals TO authenticated;
`;

console.log(migrationSQL);
console.log();
console.log('═'.repeat(70));
console.log('END OF MIGRATION SQL');
console.log('═'.repeat(70));
console.log();

console.log('\n✅ After running the SQL in Supabase Dashboard:');
console.log('   - Employees will be able to propose shift time changes');
console.log('   - Managers/Supervisors can review and approve/reject proposals');
console.log('   - The app will show a yellow pulsing indicator for pending proposals');
console.log();
