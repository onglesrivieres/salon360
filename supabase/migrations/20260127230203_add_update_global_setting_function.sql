/*
  # Add RPC function to update global settings

  This function bypasses RLS issues by using SECURITY DEFINER.
  It ensures proper JSONB handling for setting values.

  ## Changes
  - Creates `update_global_setting` RPC function
  - Uses SECURITY DEFINER to bypass RLS
  - Handles JSONB serialization properly
*/

-- Create function to update a global setting by ID
CREATE OR REPLACE FUNCTION public.update_global_setting(
  p_id uuid,
  p_value jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_old_value jsonb;
  v_setting_key text;
  v_is_critical boolean;
BEGIN
  -- Get the current value for audit logging
  SELECT setting_key, setting_value, is_critical
  INTO v_setting_key, v_old_value, v_is_critical
  FROM public.app_global_settings
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Setting not found');
  END IF;

  -- Update the setting
  UPDATE public.app_global_settings
  SET
    setting_value = p_value,
    updated_at = now()
  WHERE id = p_id;

  -- Log to audit table
  INSERT INTO public.app_global_settings_audit (
    setting_key,
    old_value,
    new_value,
    is_critical
  ) VALUES (
    v_setting_key,
    v_old_value,
    p_value,
    v_is_critical
  );

  -- Return the updated row
  SELECT jsonb_build_object(
    'success', true,
    'data', row_to_json(s.*)
  )
  INTO v_result
  FROM public.app_global_settings s
  WHERE s.id = p_id;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_global_setting(uuid, jsonb) TO authenticated;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
