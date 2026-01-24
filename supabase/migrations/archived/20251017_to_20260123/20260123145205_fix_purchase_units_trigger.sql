/*
  # Fix Purchase Units Trigger - Use item_id

  ## Problem
  The trigger function `ensure_single_default_purchase_unit()` references
  `master_item_id` which doesn't exist. The frontend uses `item_id`.

  This causes: "column master_item_id does not exist" error on INSERT.

  ## Fix
  Update the trigger function to use `item_id` instead of `master_item_id`.
*/

-- Drop existing trigger first
DROP TRIGGER IF EXISTS trigger_ensure_single_default_purchase_unit ON public.store_product_purchase_units;

-- Drop and recreate the function
DROP FUNCTION IF EXISTS public.ensure_single_default_purchase_unit();

CREATE FUNCTION public.ensure_single_default_purchase_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If setting this as default, unset all other defaults for this store/item
  IF NEW.is_default = true THEN
    UPDATE public.store_product_purchase_units
    SET is_default = false, updated_at = now()
    WHERE store_id = NEW.store_id
      AND item_id = NEW.item_id
      AND id != NEW.id
      AND is_default = true;
  END IF;

  -- Ensure at least one default exists
  IF NEW.is_default = false THEN
    -- Check if there are any other defaults
    IF NOT EXISTS (
      SELECT 1 FROM public.store_product_purchase_units
      WHERE store_id = NEW.store_id
        AND item_id = NEW.item_id
        AND id != NEW.id
        AND is_default = true
    ) THEN
      -- If no other defaults, keep this one as default
      NEW.is_default := true;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_ensure_single_default_purchase_unit
  BEFORE INSERT OR UPDATE ON public.store_product_purchase_units
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_purchase_unit();

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
