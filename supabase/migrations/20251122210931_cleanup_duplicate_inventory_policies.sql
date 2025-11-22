/*
  # Clean Up Duplicate Inventory RLS Policies

  ## Problem
  - Multiple overlapping policies exist on inventory tables
  - Old restrictive policies still present alongside new permissive ones
  - Can cause confusion and performance issues

  ## Solution
  - Remove all old authenticated-only policies
  - Keep only the new anon-friendly policies created in previous migration

  ## Changes
  - Drop duplicate/old policies on inventory_items
  - Drop duplicate/old policies on inventory_transactions
  - Drop duplicate/old policies on inventory_transaction_items
*/

-- =====================================================
-- 1. CLEAN UP inventory_items POLICIES
-- =====================================================

-- Remove old/duplicate policies
DROP POLICY IF EXISTS "Authenticated users can view inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Employees can view items in their store" ON public.inventory_items;
DROP POLICY IF EXISTS "Managers can insert items" ON public.inventory_items;
DROP POLICY IF EXISTS "Management can insert inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Managers can update items" ON public.inventory_items;
DROP POLICY IF EXISTS "Management can update inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Management can delete inventory items" ON public.inventory_items;

-- =====================================================
-- 2. CLEAN UP inventory_transactions POLICIES
-- =====================================================

-- Remove old/duplicate policies
DROP POLICY IF EXISTS "Employees can view transactions in their store" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Employees can create transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Employees can update pending transactions" ON public.inventory_transactions;

-- =====================================================
-- 3. CLEAN UP inventory_transaction_items POLICIES
-- =====================================================

-- Remove old/duplicate policies
DROP POLICY IF EXISTS "Employees can view transaction items in their store" ON public.inventory_transaction_items;
DROP POLICY IF EXISTS "Employees can insert transaction items" ON public.inventory_transaction_items;
