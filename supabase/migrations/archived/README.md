# Archived Migrations

This directory contains migrations that have been archived and should NOT be applied.

## Reasons for Archiving

1. **Duplicate migrations** - Same SQL applied twice with different timestamps
2. **Superseded migrations** - Replaced by newer, corrected versions
3. **Failed experiments** - Migrations that were rolled back

## Archived Files

### Duplicate Migrations (Moved Jan 2026)

These are exact duplicates of earlier migrations with different timestamps:

| Archived File | Original File | Reason |
|---------------|---------------|--------|
| `20251020072557_20251020072200_create_multi_store_schema.sql` | `20251020072200_create_multi_store_schema.sql` | Duplicate |
| `20251020104942_20251020103000_create_technician_ready_queue.sql` | `20251020103000_create_technician_ready_queue.sql` | Duplicate |
| `20251020104957_20251020103100_create_queue_triggers.sql` | `20251020103100_create_queue_triggers.sql` | Duplicate |
| `20251020185412_add_completed_status_to_tickets.sql` | `20251020180000_add_completed_status_to_tickets.sql` | Duplicate |

### Safe Balance Experiments (Jan 2026)

These migrations were part of iterative development and have been superseded:

- `20260103004419_update_safe_balance_function_remove_withdrawals.sql`
- `20260103011624_fix_safe_balance_table_name.sql`
- `20260103013223_restore_safe_withdrawals_to_balance_function.sql`
- `20260103013703_fix_safe_withdrawal_to_use_cash_payout.sql`
- `20260103014011_fix_safe_balance_table_name_reference.sql`

## Important Notes

- **Never move files back** from `archived/` to `migrations/` without updating the Supabase migration history
- These files are kept for reference and audit purposes only
- If you need similar functionality, create a new migration instead
