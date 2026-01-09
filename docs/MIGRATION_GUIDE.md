# Salon365 Database Migration Guide

## Quick Start

### Creating a New Migration

```bash
npm run db:new <migration_name>
```

Example:
```bash
npm run db:new add_customer_loyalty_points
```

This creates a new timestamped migration file from the template at `supabase/migrations/`.

### Checking Migrations

```bash
# Lint migrations for common issues
npm run db:lint

# Check for duplicate migrations
npm run db:check-duplicates
```

### Applying Migrations

```bash
# Push migrations to remote database (Supabase)
supabase db push

# Reset local database (destructive!)
supabase db reset
```

## Migration Best Practices

### 1. Always Use Idempotent Operations

Migrations should be safe to run multiple times without errors:

| Operation | Idempotent Pattern |
|-----------|-------------------|
| Create table | `CREATE TABLE IF NOT EXISTS` |
| Add column | `DO $$ IF NOT EXISTS ... END $$` |
| Create index | `CREATE INDEX IF NOT EXISTS` |
| Create function | `CREATE OR REPLACE FUNCTION` |
| Create trigger | `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` |
| Create policy | `DROP POLICY IF EXISTS` + `CREATE POLICY` |

### 2. Example: Adding a Column Safely

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'new_column'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN new_column text;
  END IF;
END $$;
```

### 3. Example: Creating a Policy Safely

```sql
-- Always DROP IF EXISTS before CREATE for policies
DROP POLICY IF EXISTS "Users can view own data" ON public.my_table;
CREATE POLICY "Users can view own data"
  ON public.my_table
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

### 4. Example: Creating a Trigger Safely

```sql
-- Always DROP IF EXISTS before CREATE for triggers
DROP TRIGGER IF EXISTS update_timestamp ON public.my_table;
CREATE TRIGGER update_timestamp
  BEFORE UPDATE ON public.my_table
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp_function();
```

### 5. Security: SECURITY DEFINER Functions

Always include `SET search_path` for security:

```sql
CREATE OR REPLACE FUNCTION public.my_secure_function()
RETURNS void
SECURITY DEFINER
SET search_path = public  -- Required for security!
LANGUAGE plpgsql
AS $$
BEGIN
  -- Function body
END;
$$;
```

### 6. Never Hardcode Credentials

Use environment variables in Node.js scripts:

```javascript
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials. Check .env file.');
  process.exit(1);
}
```

### 7. Insert Data Idempotently

```sql
-- Use ON CONFLICT to handle duplicates
INSERT INTO public.stores (id, name, code)
VALUES ('uuid-here', 'Store Name', 'CODE')
ON CONFLICT (code) DO NOTHING;
```

## Directory Structure

```
supabase/
├── migrations/
│   ├── _TEMPLATE.sql           # Template for new migrations
│   ├── YYYYMMDDHHMMSS_*.sql    # Migration files
│   └── archived/               # Deprecated/duplicate migrations
│       └── README.md           # Documentation of archived files
```

## Migration Naming Convention

All migrations follow the format:
```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Examples:
- `20260108150000_add_customer_rewards.sql`
- `20260108160000_fix_employee_rls_policies.sql`
- `20260108170000_update_attendance_function.sql`

Use snake_case for descriptive names (lowercase, underscores only).

## Troubleshooting

### "Policy already exists" Error

Add `DROP POLICY IF EXISTS` before `CREATE POLICY`:

```sql
DROP POLICY IF EXISTS "Policy name" ON public.table_name;
CREATE POLICY "Policy name" ON public.table_name ...
```

### "Trigger already exists" Error

Add `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`:

```sql
DROP TRIGGER IF EXISTS trigger_name ON public.table_name;
CREATE TRIGGER trigger_name ...
```

### "Function already exists" Error

Use `CREATE OR REPLACE FUNCTION` instead of `CREATE FUNCTION`.

### Migration Script Fails to Connect

1. Verify `.env` file exists with correct credentials
2. Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Verify network connectivity to Supabase

### Finding Duplicate Migrations

```bash
npm run db:check-duplicates
```

Move duplicates to `supabase/migrations/archived/` and update the README.

## Running Custom Migration Scripts

Located in `scripts/migrations/`:

```bash
# Apply a specific migration script
node scripts/migrations/apply_some_migration.mjs
```

These scripts require `.env` to be configured with Supabase credentials.

## Related Documentation

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
