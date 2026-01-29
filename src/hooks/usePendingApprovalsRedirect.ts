import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Permissions, Role } from '../lib/permissions';

interface PendingApprovalsRedirectState {
  isLoading: boolean;
  shouldRedirect: boolean;
  pendingCount: number;
  hasChecked: boolean;
}

const REDIRECT_CHECK_KEY = 'salon360_approvals_redirect_checked';

/**
 * Hook to check if the user has pending approvals and should be redirected
 * to the Approvals page on app load.
 *
 * Only checks once per session per employee-store combination.
 */
export function usePendingApprovalsRedirect(
  employeeId: string | null | undefined,
  storeId: string | null,
  roles: Role[] | undefined,
  rolePermission: string | null | undefined,
  isReady: boolean
): PendingApprovalsRedirectState {
  const [state, setState] = useState<PendingApprovalsRedirectState>({
    isLoading: true,
    shouldRedirect: false,
    pendingCount: 0,
    hasChecked: false,
  });

  const checkPendingApprovals = useCallback(async () => {
    // Skip if prerequisites not met
    if (!isReady || !employeeId || !storeId || !roles || !rolePermission) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Cashiers cannot access approvals page at all
    if (rolePermission === 'Cashier') {
      setState({ isLoading: false, shouldRedirect: false, pendingCount: 0, hasChecked: true });
      return;
    }

    // Check if user can access approvals page
    if (!Permissions.tickets.canViewPendingApprovals(roles)) {
      setState({ isLoading: false, shouldRedirect: false, pendingCount: 0, hasChecked: true });
      return;
    }

    // Check if we already checked this session (same employee + store)
    const lastCheckSession = sessionStorage.getItem(REDIRECT_CHECK_KEY);
    const currentSession = `${employeeId}-${storeId}`;

    if (lastCheckSession === currentSession) {
      // Already checked this session, don't redirect again
      setState(prev => ({ ...prev, isLoading: false, hasChecked: true }));
      return;
    }

    try {
      let totalCount = 0;
      const isSupervisor = rolePermission === 'Supervisor';
      const isTechnician = rolePermission === 'Technician';
      const isManagement = roles.some(role => ['Admin', 'Owner', 'Manager', 'Supervisor'].includes(role));
      const canReviewTransactionChanges = Permissions.cashTransactions.canReviewChangeProposal(roles);
      const canReviewReopenRequests = Permissions.tickets.canReviewReopenRequests(roles);

      if (isSupervisor) {
        // Supervisors only see cash transactions
        const { data: cashData } = await supabase.rpc('get_pending_cash_transaction_approvals', {
          p_store_id: storeId,
        });
        totalCount = cashData?.length || 0;
      } else if (isTechnician && !isManagement) {
        // Technicians see only their own items
        const [ticketsRes, inventoryRes] = await Promise.all([
          supabase.rpc('get_pending_approvals_for_management', { p_store_id: storeId }),
          supabase.rpc('get_pending_inventory_approvals', { p_employee_id: employeeId, p_store_id: storeId }),
        ]);

        // Filter tickets to only those where technician worked
        const ticketCount = (ticketsRes.data || []).filter(
          (ticket: { technician_ids?: string[] }) => ticket.technician_ids?.includes(employeeId)
        ).length;

        // Filter inventory to only those where they are recipient
        const inventoryCount = (inventoryRes.data || []).filter(
          (item: { recipient_id?: string }) => item.recipient_id === employeeId
        ).length;

        totalCount = ticketCount + inventoryCount;
      } else {
        // Management/Receptionist - check all tabs
        const [
          ticketsRes,
          inventoryRes,
          cashRes,
          transactionChangesRes,
          attendanceRes,
          violationsRes,
          ticketChangesRes,
        ] = await Promise.all([
          supabase.rpc('get_pending_approvals_for_management', { p_store_id: storeId }),
          supabase.rpc('get_pending_inventory_approvals', { p_employee_id: employeeId, p_store_id: storeId }),
          supabase.rpc('get_pending_cash_transaction_approvals', { p_store_id: storeId }),
          canReviewTransactionChanges
            ? supabase.rpc('get_pending_cash_transaction_change_proposals', { p_store_id: storeId })
            : Promise.resolve({ data: [] }),
          supabase.from('attendance_change_proposals').select('id, attendance_records!inner(store_id)').eq('attendance_records.store_id', storeId).eq('status', 'pending'),
          supabase.rpc('get_violation_reports_for_approval', { p_store_id: storeId }),
          canReviewReopenRequests
            ? supabase.rpc('get_pending_ticket_reopen_requests', { p_store_id: storeId })
            : Promise.resolve({ data: [] }),
        ]);

        totalCount =
          (ticketsRes.data?.length || 0) +
          (inventoryRes.data?.length || 0) +
          (cashRes.data?.length || 0) +
          (transactionChangesRes.data?.length || 0) +
          (attendanceRes.data?.length || 0) +
          (violationsRes.data?.length || 0) +
          (ticketChangesRes.data?.length || 0);
      }

      // Mark as checked for this session
      sessionStorage.setItem(REDIRECT_CHECK_KEY, currentSession);

      setState({
        isLoading: false,
        shouldRedirect: totalCount > 0,
        pendingCount: totalCount,
        hasChecked: true,
      });
    } catch (error) {
      console.error('Error checking pending approvals for redirect:', error);
      // On error, don't redirect (fail safe to default tickets page)
      sessionStorage.setItem(REDIRECT_CHECK_KEY, `${employeeId}-${storeId}`);
      setState({ isLoading: false, shouldRedirect: false, pendingCount: 0, hasChecked: true });
    }
  }, [employeeId, storeId, roles, rolePermission, isReady]);

  useEffect(() => {
    checkPendingApprovals();
  }, [checkPendingApprovals]);

  return state;
}

/**
 * Clear the redirect check flag. Call this on logout or store switch
 * to allow re-checking on next session.
 */
export function clearPendingApprovalsRedirectCheck(): void {
  sessionStorage.removeItem(REDIRECT_CHECK_KEY);
}
