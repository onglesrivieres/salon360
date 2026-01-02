# Scripts Directory

This directory contains utility scripts for database migrations, data analysis, and system verification.

## Directory Structure

### `/scripts/migrations/`

Contains JavaScript/Node.js scripts (.mjs) for applying database migrations and running one-time setup tasks. These scripts connect to Supabase and execute SQL commands programmatically.

**Migration Runner Scripts:**
- `apply_attendance_proposals_migration.mjs` - Applies attendance proposal system migration
- `apply_attendance_proposals_table.mjs` - Creates attendance proposals table
- `apply_bulk_permissions_function.mjs` - Applies bulk permission update functions
- `apply_cleanup_migration.mjs` - Runs database cleanup operations
- `apply_commission_pay_type.mjs` - Adds commission pay type support
- `apply_opening_cash_fix_final.mjs` - Applies opening cash validation fix
- `apply_role_permissions_migration.mjs` - Applies role-based permissions system
- `apply_safe_balance_direct.mjs` - Direct safe balance migration
- `apply_safe_balance_migration.mjs` - Applies safe balance system migration
- `apply_sans_souci_migration.mjs` - Adds Sans Souci store
- `apply_sans_souci_settings_sync.mjs` - Synchronizes Sans Souci store settings
- `check_and_create_proposals_table.mjs` - Verifies/creates proposals table

**Ad-hoc SQL Scripts:**
- `add_sans_souci_store.sql` - SQL for adding Sans Souci store
- `cleanup_sans_souci_duplicates.sql` - Removes duplicate Sans Souci settings
- `fix_sans_souci_access.sql` - Fixes Sans Souci access permissions

### `/scripts/analysis/`

Contains data analysis and verification scripts for troubleshooting, validation, and investigating data discrepancies.

**Tip Analysis Scripts:**
- `analyze_all_tips.mjs` - Comprehensive tip data analysis
- `analyze_date_range.mjs` - Analyzes tips for date ranges
- `analyze_dec_data.mjs` - December tip data analysis
- `analyze_recent_week.mjs` - Recent week tip analysis
- `analyze_tip_report.mjs` - Detailed tip report analysis
- `find_tip_data.mjs` - Locates tip data in database
- `check_tip_structure.mjs` - Verifies tip data structure
- `verify_weekly_data.mjs` - Validates weekly tip data

**Store Configuration Analysis:**
- `analyze_sans_souci_settings.mjs` - Analyzes Sans Souci settings
- `compare_store_settings.mjs` - Compares settings between stores
- `list_sans_souci_settings.mjs` - Lists all Sans Souci settings
- `or_rivieres_analysis.mjs` - Or des Rivières store analysis

**Data Verification Scripts:**
- `check_app_settings_schema.mjs` - Validates app settings schema
- `check_available_dates.mjs` - Checks date availability
- `check_december_dates.mjs` - Verifies December dates
- `check_raw_data.mjs` - Raw data validation
- `comprehensive_fix_verification.mjs` - Comprehensive fix verification
- `final_analysis.mjs` - Final data analysis
- `full_december_analysis.mjs` - Complete December analysis
- `simple_check.mjs` - Quick data checks
- `working_analysis.mjs` - Work-in-progress analysis

**Migration Verification:**
- `verify_opening_cash_fix.mjs` - Verifies opening cash fix
- `verify_safe_balance_migration.mjs` - Validates safe balance migration
- `verify_sans_souci_settings.mjs` - Verifies Sans Souci settings

**Cleanup Scripts:**
- `cleanup_sans_souci_duplicate_settings.mjs` - Removes duplicate settings

## Usage

### Running Migration Scripts

Migration scripts typically connect to Supabase using environment variables:

```bash
node scripts/migrations/apply_some_migration.mjs
```

**Note:** Ensure your `.env` file contains the correct Supabase credentials:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Running Analysis Scripts

Analysis scripts are used for debugging and data validation:

```bash
node scripts/analysis/analyze_all_tips.mjs
```

These scripts typically:
- Connect to the database
- Query specific data
- Output analysis results to console
- Help identify discrepancies or issues

## Important Notes

### Security Considerations

1. **Never commit scripts with hardcoded credentials** - Use environment variables
2. **Review SQL before execution** - Migration scripts execute SQL directly
3. **Backup data before migrations** - Always backup before running migrations
4. **Test on non-production first** - Verify scripts work on development environment

### Script Organization

- **Migration scripts** should be run once to apply changes
- **Analysis scripts** can be run repeatedly for debugging
- **Verification scripts** should be run after migrations to confirm success

### Dependencies

All scripts require:
- Node.js (v18 or higher)
- `@supabase/supabase-js` package
- Valid Supabase credentials

Install dependencies:
```bash
npm install
```

## Maintenance

### Adding New Scripts

1. Place migration runners in `/scripts/migrations/`
2. Place analysis tools in `/scripts/analysis/`
3. Use `.mjs` extension for ES modules
4. Include clear comments explaining the script's purpose
5. Update this README with a description

### Script Naming Convention

- **Migration runners**: `apply_[feature_name].mjs`
- **Analysis tools**: `analyze_[data_type].mjs` or `check_[aspect].mjs`
- **Verification tools**: `verify_[feature_name].mjs`
- **Cleanup tools**: `cleanup_[issue].mjs`

## Related Documentation

- See `/docs/` for feature implementation guides
- See `/supabase/migrations/` for SQL migration files
- See `/docs/APPLY_MIGRATION_INSTRUCTIONS.md` for migration best practices

## Troubleshooting

### Common Issues

**Script fails to connect:**
- Verify `.env` file exists and contains correct credentials
- Check network connectivity to Supabase

**SQL execution errors:**
- Review the SQL being executed
- Check database logs in Supabase dashboard
- Verify required tables/columns exist

**Analysis returns unexpected results:**
- Verify date ranges are correct
- Check for timezone issues
- Ensure data exists for the period being analyzed

For more detailed troubleshooting, consult the specific documentation in `/docs/`.
