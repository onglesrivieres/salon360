export type RolePermission = 'Admin' | 'Receptionist' | 'Technician';

export interface PermissionCheck {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  message?: string;
}

export const Permissions = {
  tickets: {
    canView: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist', 'Technician'].includes(role);
    },
    canCreate: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist'].includes(role);
    },
    canEdit: (role: RolePermission, isClosed: boolean, isApproved?: boolean): boolean => {
      if (role === 'Admin') return true;
      if (role === 'Receptionist') return !isClosed && !isApproved;
      return false;
    },
    canDelete: (role: RolePermission): boolean => {
      return role === 'Admin';
    },
    canViewAll: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist'].includes(role);
    },
    canClose: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist'].includes(role);
    },
    canReopen: (role: RolePermission): boolean => {
      return role === 'Admin';
    },
    canApprove: (role: RolePermission): boolean => {
      return ['Admin', 'Technician'].includes(role);
    },
    canViewPendingApprovals: (role: RolePermission): boolean => {
      return ['Admin', 'Technician'].includes(role);
    },
    canReviewRejected: (role: RolePermission): boolean => {
      return role === 'Admin';
    },
  },

  endOfDay: {
    canView: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist', 'Technician'].includes(role);
    },
    canViewAll: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist'].includes(role);
    },
    canExport: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist'].includes(role);
    },
  },

  employees: {
    canView: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist'].includes(role);
    },
    canCreate: (role: RolePermission): boolean => {
      return role === 'Admin';
    },
    canEdit: (role: RolePermission): boolean => {
      return role === 'Admin';
    },
    canDelete: (role: RolePermission): boolean => {
      return role === 'Admin';
    },
    canResetPIN: (role: RolePermission): boolean => {
      return role === 'Admin';
    },
    canAssignRoles: (role: RolePermission): boolean => {
      return role === 'Admin';
    },
  },

  services: {
    canView: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist'].includes(role);
    },
    canCreate: (role: RolePermission): boolean => {
      return role === 'Admin';
    },
    canEdit: (role: RolePermission): boolean => {
      return role === 'Admin';
    },
    canDelete: (role: RolePermission): boolean => {
      return role === 'Admin';
    },
  },

  profile: {
    canChangePIN: (role: RolePermission): boolean => {
      return true;
    },
  },

  attendance: {
    canView: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist', 'Technician'].includes(role);
    },
    canComment: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist', 'Technician'].includes(role);
    },
    canExport: (role: RolePermission): boolean => {
      return ['Admin', 'Receptionist'].includes(role);
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
  page: 'tickets' | 'eod' | 'technicians' | 'services' | 'profile' | 'attendance' | 'approvals',
  role: RolePermission
): boolean {
  switch (page) {
    case 'tickets':
      return Permissions.tickets.canView(role);
    case 'eod':
      return Permissions.endOfDay.canView(role);
    case 'technicians':
      return Permissions.employees.canView(role);
    case 'services':
      return Permissions.services.canView(role);
    case 'profile':
      return true;
    case 'attendance':
      return Permissions.attendance.canView(role);
    case 'approvals':
      return Permissions.tickets.canViewPendingApprovals(role);
    default:
      return false;
  }
}

export function getAccessiblePages(role: RolePermission): string[] {
  const pages: string[] = ['tickets', 'profile'];

  if (Permissions.tickets.canViewPendingApprovals(role)) {
    pages.push('approvals');
  }

  if (Permissions.endOfDay.canView(role)) {
    pages.push('eod');
  }

  if (Permissions.attendance.canView(role)) {
    pages.push('attendance');
  }

  if (Permissions.employees.canView(role)) {
    pages.push('technicians');
  }

  if (Permissions.services.canView(role)) {
    pages.push('services');
  }

  return pages;
}
