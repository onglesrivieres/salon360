# Safe Balance Migration Instructions

## Problem
The Safe Balance page is failing because the required database functions and tables don't exist yet.

## Solution
Apply the migration manually through the Supabase Dashboard.

## Steps:

### Method 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
   - URL: https://kycnryuiramusmdedqnq.supabase.co
   - Navigate to: **SQL Editor** (in the left sidebar)

2. **Create a New Query**
   - Click "New query" button

3. **Copy and paste the SQL**
   - Open the file: `supabase/migrations/20251230000000_create_safe_balance_system.sql`
   - Copy ALL the contents
   - Paste into the SQL Editor

4. **Run the migration**
   - Click "Run" or press Ctrl+Enter (Cmd+Enter on Mac)
   - Wait for success message

5. **Verify**
   - You should see confirmation that tables and functions were created
   - Return to your app and refresh the Safe Balance page

### Method 2: Using Supabase CLI (If installed)

```bash
supabase db push
```

## What This Migration Creates:

1. **Table**: `safe_balance_history` - Tracks daily safe balances
2. **Function**: `get_safe_balance_for_date()` - Calculates balances for specific dates
3. **Function**: `get_previous_safe_balance()` - Gets previous day's closing balance
4. **RLS Policies** - Security policies for the table
5. **Indexes** - Performance optimization

## After Migration:
The Safe Balance page should load without errors and display:
- Opening Balance (from previous day)
- Total Deposits
- Total Withdrawals
- Current Balance
