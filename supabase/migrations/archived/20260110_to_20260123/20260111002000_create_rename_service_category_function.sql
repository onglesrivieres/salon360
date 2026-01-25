/*
  # Create rename_service_category stored function
  
  ## Overview
  Creates an atomic transaction function to rename a service category and update all associated services.
  This ensures both store_service_categories and store_services are updated in a single database transaction,
  preventing race conditions and partial updates.
  
  ## Function: rename_service_category
  - Renames a category in store_service_categories
  - Updates all services with the old category name to the new name
  - Performs both operations atomically (all-or-nothing)
  - Returns success/failure status
*/

CREATE OR REPLACE FUNCTION public.rename_service_category(
  p_category_id uuid,
  p_store_id uuid,
  p_original_name text,
  p_new_name text,
  p_color text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_category_exists boolean;
  v_services_updated integer;
BEGIN
  -- Verify the category exists and belongs to the specified store
  SELECT EXISTS(
    SELECT 1 FROM store_service_categories
    WHERE id = p_category_id
    AND store_id = p_store_id
  ) INTO v_category_exists;
  
  IF NOT v_category_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Category not found or does not belong to this store'
    );
  END IF;
  
  BEGIN
    -- Update the category itself
    UPDATE store_service_categories
    SET 
      name = p_new_name,
      color = COALESCE(p_color, color),
      updated_at = now()
    WHERE id = p_category_id;
    
    -- Update all services with the old category name to the new name
    UPDATE store_services
    SET 
      category = p_new_name,
      updated_at = now()
    WHERE store_id = p_store_id
    AND category = p_original_name;
    
    GET DIAGNOSTICS v_services_updated = ROW_COUNT;
    
    RETURN jsonb_build_object(
      'success', true,
      'services_updated', v_services_updated,
      'message', 'Category renamed successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
  END;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.rename_service_category(uuid, uuid, text, text, text) IS 
'Atomically rename a service category and update all associated services in a single transaction';
