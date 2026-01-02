# Apply Opening Cash Validation Configuration Fix

## Overview
This fix makes the opening cash validation respect the Configuration setting. When "Require Opening Cash Validation" is turned OFF in the Configuration page, tickets can be created without recording opening cash first.

## Database Migration Required

Execute the following SQL in your Supabase SQL Editor:

```sql
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
```

## How to Apply

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the SQL above
4. Click "Run" to execute

## Changes Made

### Frontend (TicketEditor.tsx)
- Added check for `require_opening_cash_validation` setting before validating
- Only enforces validation when the setting is explicitly enabled

### Database (validate_opening_cash_before_ticket function)
- Updated trigger function to query `app_settings` table
- Checks `require_opening_cash_validation` setting for the store
- Only validates if setting is `true`
- Defaults to no validation if setting doesn't exist (backward compatible)

## Testing

After applying the migration:

1. Go to Sans Souci store Configuration page
2. Turn OFF "Require Opening Cash Validation"
3. Try to create a new ticket
4. It should now work without requiring opening cash count
5. Turn ON the setting and verify validation is enforced again
