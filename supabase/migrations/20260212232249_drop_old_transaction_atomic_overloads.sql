-- Drop old overloads of create_inventory_transaction_atomic.
--
-- The draft migration (20260212180253) added p_status as an 11th param,
-- which created a NEW overload instead of replacing the old ones.
-- PostgREST can't disambiguate when p_status is omitted (PGRST203).
-- The 11-param version with p_status DEFAULT 'pending' handles all cases.
--
-- Three overloads exist:
--   9-param (original, before store-to-store transfers)
--  10-param (added p_destination_store_id for transfers)
--  11-param (added p_status for drafts) ← keep this one

-- Drop the 9-parameter version (pre-transfer)
DROP FUNCTION IF EXISTS public.create_inventory_transaction_atomic(
  uuid, text, uuid, uuid, uuid, text, text, boolean, boolean
);

-- Drop the 10-parameter version (pre-draft)
DROP FUNCTION IF EXISTS public.create_inventory_transaction_atomic(
  uuid, text, uuid, uuid, uuid, text, text, boolean, boolean, uuid
);

NOTIFY pgrst, 'reload schema';
