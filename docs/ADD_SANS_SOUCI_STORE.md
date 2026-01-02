# Add Sans Souci Store - Implementation Guide

A new store "Sans Souci" has been prepared and is ready to be added to your system.

## Migration File Created

The migration file has been created at:
```
supabase/migrations/20251229185127_add_sans_souci_store.sql
```

## How to Apply the Migration

You have three options to apply this migration:

### Option 1: Supabase Dashboard (Recommended)

1. Log in to your Supabase dashboard at https://supabase.com
2. Select your project (kycnryuiramusmdedqnq)
3. Navigate to the SQL Editor
4. Copy and paste the contents of `supabase/migrations/20251229185127_add_sans_souci_store.sql`
5. Click "Run" to execute the migration

### Option 2: Supabase CLI (If Installed)

If you have the Supabase CLI installed locally, run:

```bash
supabase db push
```

This will automatically apply all pending migrations, including the new Sans Souci store migration.

### Option 3: Use the Standalone SQL File

The same SQL has been saved to `add_sans_souci_store.sql` in the project root for convenience.

## What This Migration Does

1. **Creates the Sans Souci store** with code "SS"
2. **Sets opening hours:**
   - Monday-Friday: 10:00 AM
   - Saturday: 09:00 AM
   - Sunday: 10:00 AM

3. **Sets closing hours:**
   - Monday-Wednesday: 7:00 PM (19:00)
   - Thursday-Friday: 9:00 PM (21:00)
   - Saturday: 7:00 PM (19:00)
   - Sunday: 6:00 PM (18:00)

## After Migration

Once the migration is applied, the Sans Souci store will:

- ✅ Appear in the store selection dropdown for all users
- ✅ Be available for employee assignments
- ✅ Be ready for service configuration
- ✅ Have proper opening/closing hours for check-in validation

## Next Steps

After applying the migration, you'll want to:

1. **Assign employees** to the Sans Souci store through the Employees page
2. **Configure services** and pricing for this store through the Services page
3. **Set up store-specific settings** if needed through the Configuration page

## Verification

To verify the store was added successfully, you can:

1. Check the store selection dropdown in your application
2. Or run this query in the Supabase SQL Editor:

```sql
SELECT * FROM stores WHERE code = 'SS';
```

You should see the Sans Souci store with all its configured hours.
