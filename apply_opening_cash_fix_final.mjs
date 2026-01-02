import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const migrationSQL = `
-- Update the trigger function to check configuration setting first
CREATE OR REPLACE FUNCTION public.validate_opening_cash_before_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cash_recorded boolean;
  v_validation_required boolean := false;
  v_setting_value jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Check if the store has opening cash validation enabled
    SELECT setting_value INTO v_setting_value
    FROM public.app_settings
    WHERE store_id = NEW.store_id
      AND setting_key = 'require_opening_cash_validation';

    -- Parse the JSONB boolean value
    IF v_setting_value IS NOT NULL THEN
      IF jsonb_typeof(v_setting_value) = 'boolean' THEN
        v_validation_required := (v_setting_value)::boolean;
      ELSIF jsonb_typeof(v_setting_value) = 'object' AND v_setting_value ? 'value' THEN
        v_validation_required := (v_setting_value->>'value')::boolean;
      END IF;
    END IF;

    -- Only perform validation if the setting is enabled
    IF v_validation_required THEN
      v_cash_recorded := public.check_opening_cash_recorded(NEW.store_id, NEW.ticket_date);

      IF NOT v_cash_recorded THEN
        RAISE EXCEPTION 'Opening cash count must be recorded before creating sale tickets. Please go to End of Day page and count the opening cash first.'
          USING HINT = 'Record opening cash in the End of Day page before creating any tickets for this date.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
`;

console.log('Attempting to apply migration...\n');

try {
  const { data, error } = await supabase.rpc('exec_sql', { query: migrationSQL });

  if (error) {
    console.error('Error applying migration:', error.message);
    console.log('\nThis requires SERVICE_ROLE access. Please apply manually via Supabase Dashboard SQL Editor.');
    console.log('\n--- SQL TO EXECUTE ---\n');
    console.log(migrationSQL);
    console.log('\n--- END SQL ---\n');
    process.exit(1);
  }

  console.log('✓ Migration applied successfully!');
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  console.log('\nThis requires admin access. Please apply manually via Supabase Dashboard SQL Editor.');
  console.log('\n--- SQL TO EXECUTE ---\n');
  console.log(migrationSQL);
  console.log('\n--- END SQL ---\n');
  process.exit(1);
}
