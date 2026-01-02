# Apply Opening Cash Validation Configuration Fix

## Overview
This fix makes the opening cash validation respect the Configuration setting. When "Require Opening Cash Validation" is turned OFF in the Configuration page, tickets can be created without recording opening cash first.

## CRITICAL: Database Migration Required

**The database trigger function MUST be updated for this fix to work!**

The frontend code has been updated, but the database trigger is still enforcing validation regardless of the setting. You must execute the SQL below to complete the fix.

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

### Step-by-Step Instructions:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query" button

3. **Execute the Migration**
   - Copy the SQL code from the section above (lines 11-52)
   - Paste it into the SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter

4. **Verify Success**
   - You should see "Success. No rows returned"
   - If you see an error, check that you copied the complete SQL statement

## Changes Made

### Frontend (TicketEditor.tsx)
- Added check for `require_opening_cash_validation` setting before validating
- Only enforces validation when the setting is explicitly enabled

### Database (validate_opening_cash_before_ticket function)
- Updated trigger function to query `app_settings` table
- Checks `require_opening_cash_validation` setting for the store
- Only validates if setting is `true`
- Defaults to no validation if setting doesn't exist (backward compatible)

## Verification

After applying the migration, run this verification script:

```bash
node verify_opening_cash_fix.mjs
```

This will confirm the trigger function was updated correctly.

## Testing

After applying the migration:

1. Go to Sans Souci store Configuration page
2. Turn OFF "Require Opening Cash Validation"
3. Try to create a new ticket
4. It should now work without requiring opening cash count
5. Turn ON the setting and verify validation is enforced again

## Troubleshooting

**Issue: Still getting "Opening cash count must be recorded" error**
- Cause: Database migration was not applied
- Solution: Follow the "How to Apply" steps above to execute the SQL

**Issue: SQL execution fails**
- Cause: Insufficient permissions
- Solution: Make sure you're logged in as the project owner in Supabase Dashboard

**Issue: Function doesn't exist error**
- Cause: Wrong database selected
- Solution: Verify you're in the correct Supabase project
