export type RolePermission = 'Admin' | 'Receptionist' | 'Technician' | 'Supervisor' | 'Cashier';
export type Role = 'Admin' | 'Technician' | 'Receptionist' | 'Supervisor' | 'Manager' | 'Owner' | 'Spa Expert' | 'Cashier';

export interface PermissionCheck {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  message?: string;
}

function hasAnyRole(roles: Role[] | RolePermission, allowedRoles: string[]): boolean {
  if (typeof roles === 'string') {
    return allowedRoles.includes(roles);
  }
  return roles.some(role => allowedRoles.includes(role));
}

export const Permissions = {
  tickets: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Technician', 'Spa Expert', 'Supervisor', 'Manager', 'Owner', 'Cashier']);
    },
    canCreate: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Technician', 'Spa Expert', 'Supervisor', 'Manager', 'Owner', 'Cashier']);
    },
    isSelfServiceRole: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Technician', 'Spa Expert', 'Supervisor']);
    },
    canViewAllTechniciansInEditor: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
    canReviewSelfServiceTicket: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
    canEditSelfServiceTicket: (
      roles: Role[] | RolePermission,
      currentEmployeeId: string,
      ticketCreatedBy?: string
    ): boolean => {
      // Technicians and Spa Experts cannot edit tickets at all, even their own
      if (hasAnyRole(roles, ['Technician', 'Spa Expert'])) {
        return false;
      }
      // Supervisors can edit their own self-service tickets
      const isSelfServiceRole = hasAnyRole(roles, ['Supervisor']);
      if (!isSelfServiceRole || !ticketCreatedBy) {
        return false;
      }
      return currentEmployeeId === ticketCreatedBy;
    },
    canEdit: (roles: Role[] | RolePermission, isClosed: boolean, isApproved?: boolean): boolean => {
      if (hasAnyRole(roles, ['Admin', 'Owner'])) return true;
      if (hasAnyRole(roles, ['Receptionist', 'Supervisor', 'Manager', 'Cashier'])) return !isClosed && !isApproved;
      return false;
    },
    canEditNotes: (roles: Role[] | RolePermission, isClosed: boolean): boolean => {
      if (hasAnyRole(roles, ['Admin', 'Owner'])) return true;
      if (hasAnyRole(roles, ['Receptionist', 'Supervisor', 'Manager', 'Cashier'])) return !isClosed;
      // Technicians and Spa Experts cannot edit notes
      return false;
    },
    canDelete: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']);
    },
    canViewAll: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']);
    },
    canClose: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']);
    },
    canMarkCompleted: (roles: Role[] | RolePermission): boolean => {
      // Only roles that can close tickets can also mark them as completed
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']);
    },
    canReopen: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
    canApprove: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Technician', 'Spa Expert', 'Supervisor', 'Owner']);
    },
    canViewPendingApprovals: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Owner', 'Manager']);
    },
    canReviewRejected: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
  },

  endOfDay: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
    canViewAll: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
    canExport: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
  },

  tipReport: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Technician', 'Spa Expert', 'Supervisor', 'Manager', 'Owner']);
    },
    canViewAll: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
    canViewPeriodReports: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Manager', 'Owner']);
    },
    canExport: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
    canViewUnlimitedHistory: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
  },

  employees: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Manager', 'Owner']);
    },
    canCreate: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
    canEdit: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
    canDelete: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
    canResetPIN: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Manager', 'Owner']);
    },
    canAssignRoles: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
  },

  services: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Manager', 'Owner']);
    },
    canCreate: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Supervisor', 'Owner']);
    },
    canEdit: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Supervisor', 'Owner']);
    },
    canArchive: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Supervisor', 'Owner']);
    },
    canDelete: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
  },

  profile: {
    canChangePIN: (roles: Role[] | RolePermission): boolean => {
      return true;
    },
  },

  attendance: {
    canView: (roles: Role[] | RolePermission, payType?: 'hourly' | 'daily' | 'commission'): boolean => {
      // Management roles can always view attendance
      if (hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner'])) {
        return true;
      }
      // All pay types (hourly, daily, commission) can view attendance
      return hasAnyRole(roles, ['Technician', 'Spa Expert']);
    },
    canComment: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Technician', 'Spa Expert', 'Supervisor', 'Manager', 'Owner']);
    },
    canExport: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
  },

  inventory: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
    canCreateItems: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canEditItems: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canCreateTransactions: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
    canApprove: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canViewLots: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canCreateLots: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canDistribute: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Manager', 'Owner']);
    },
    canViewEmployeeInventory: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Manager', 'Owner']);
    },
    canViewOwnInventory: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Technician', 'Spa Expert', 'Supervisor', 'Manager', 'Owner']);
    },
    canCreateAudit: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Manager', 'Owner']);
    },
    canApproveAudit: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
  },

  suppliers: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canCreate: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canEdit: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canDelete: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
  },

  queue: {
    canViewAllQueueStatuses: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
    canRemoveTechnicians: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Manager', 'Owner']);
    },
    canViewRemovalHistory: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Manager', 'Owner']);
    },
  },

  insights: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
  },

  safeBalance: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canManage: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
  },

  configuration: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
    canEdit: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
  },

  cashTransactions: {
    canEdit: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canViewEditHistory: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canCreateChangeProposal: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canReviewChangeProposal: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Owner', 'Admin']);
    },
  },

  clients: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']);
    },
    canCreate: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']);
    },
    canEdit: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']);
    },
    canDelete: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Manager', 'Owner']);
    },
    canBlacklist: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Manager', 'Owner']);
    },
    canViewFullPhone: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Supervisor', 'Manager', 'Owner']);
    },
  },
};

export function getPermissionMessage(
  action: string,
  requiredRole: RolePermission
): string {
  return `Permission required: ${requiredRole} only - ${action}`;
}

export function canAccessPage(
  page: 'tickets' | 'eod' | 'tipreport' | 'technicians' | 'services' | 'profile' | 'settings' | 'attendance' | 'approvals' | 'inventory' | 'insights' | 'configuration' | 'safebalance' | 'queue-removal-history' | 'clients',
  roles: Role[] | RolePermission,
  payType?: 'hourly' | 'daily' | 'commission'
): boolean {
  switch (page) {
    case 'tickets':
      return Permissions.tickets.canView(roles);
    case 'eod':
      return Permissions.endOfDay.canView(roles);
    case 'tipreport':
      return Permissions.tipReport.canView(roles);
    case 'technicians':
      return Permissions.employees.canView(roles);
    case 'services':
      return Permissions.services.canView(roles);
    case 'profile':
      return true;
    case 'settings':
      return true;
    case 'attendance':
      return Permissions.attendance.canView(roles, payType);
    case 'approvals':
      return Permissions.tickets.canViewPendingApprovals(roles);
    case 'inventory':
      return Permissions.inventory.canView(roles);
    case 'insights':
      return Permissions.insights.canView(roles);
    case 'configuration':
      return Permissions.configuration.canView(roles);
    case 'safebalance':
      return Permissions.safeBalance.canView(roles);
    case 'queue-removal-history':
      return Permissions.queue.canViewRemovalHistory(roles);
    case 'clients':
      return Permissions.clients.canView(roles);
    default:
      return false;
  }
}

export function getAccessiblePages(roles: Role[] | RolePermission, payType?: 'hourly' | 'daily' | 'commission'): string[] {
  const pages: string[] = ['tickets', 'profile'];

  if (Permissions.tickets.canViewPendingApprovals(roles)) {
    pages.push('approvals');
  }

  if (Permissions.tipReport.canView(roles)) {
    pages.push('tipreport');
  }

  if (Permissions.endOfDay.canView(roles)) {
    pages.push('eod');
  }

  if (Permissions.attendance.canView(roles, payType)) {
    pages.push('attendance');
  }

  if (Permissions.employees.canView(roles)) {
    pages.push('technicians');
  }

  if (Permissions.inventory.canView(roles)) {
    pages.push('inventory');
  }

  if (Permissions.services.canView(roles)) {
    pages.push('services');
  }

  if (Permissions.insights.canView(roles)) {
    pages.push('insights');
  }

  if (Permissions.safeBalance.canView(roles)) {
    pages.push('safebalance');
  }

  if (Permissions.configuration.canView(roles)) {
    pages.push('configuration');
  }

  if (Permissions.clients.canView(roles)) {
    pages.push('clients');
  }

  return pages;
}
