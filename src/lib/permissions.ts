export type RolePermission = 'Admin' | 'Receptionist' | 'Technician';
export type Role = 'Technician' | 'Receptionist' | 'Manager' | 'Owner';

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
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Technician', 'Manager', 'Owner']);
    },
    canCreate: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Manager', 'Owner']);
    },
    canEdit: (roles: Role[] | RolePermission, isClosed: boolean, isApproved?: boolean): boolean => {
      if (hasAnyRole(roles, ['Admin', 'Owner'])) return true;
      if (hasAnyRole(roles, ['Receptionist', 'Manager'])) return !isClosed && !isApproved;
      return false;
    },
    canEditNotes: (roles: Role[] | RolePermission, isClosed: boolean): boolean => {
      if (hasAnyRole(roles, ['Admin', 'Owner'])) return true;
      if (hasAnyRole(roles, ['Receptionist', 'Manager'])) return !isClosed;
      if (hasAnyRole(roles, ['Technician'])) return !isClosed;
      return false;
    },
    canDelete: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
    canViewAll: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Manager', 'Owner']);
    },
    canClose: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Manager', 'Owner']);
    },
    canReopen: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
    canApprove: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Technician', 'Owner']);
    },
    canViewPendingApprovals: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Technician', 'Owner']);
    },
    canReviewRejected: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
  },

  endOfDay: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Technician', 'Manager', 'Owner']);
    },
    canViewAll: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Manager', 'Owner']);
    },
    canExport: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Manager', 'Owner']);
    },
  },

  employees: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Manager', 'Owner']);
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
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
    canAssignRoles: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Owner']);
    },
  },

  services: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Manager', 'Owner']);
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
  },

  profile: {
    canChangePIN: (roles: Role[] | RolePermission): boolean => {
      return true;
    },
  },

  attendance: {
    canView: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Technician', 'Manager', 'Owner']);
    },
    canComment: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Technician', 'Manager', 'Owner']);
    },
    canExport: (roles: Role[] | RolePermission): boolean => {
      return hasAnyRole(roles, ['Admin', 'Receptionist', 'Manager', 'Owner']);
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
  roles: Role[] | RolePermission
): boolean {
  switch (page) {
    case 'tickets':
      return Permissions.tickets.canView(roles);
    case 'eod':
      return Permissions.endOfDay.canView(roles);
    case 'technicians':
      return Permissions.employees.canView(roles);
    case 'services':
      return Permissions.services.canView(roles);
    case 'profile':
      return true;
    case 'attendance':
      return Permissions.attendance.canView(roles);
    case 'approvals':
      return Permissions.tickets.canViewPendingApprovals(roles);
    default:
      return false;
  }
}

export function getAccessiblePages(roles: Role[] | RolePermission): string[] {
  const pages: string[] = ['tickets', 'profile'];

  if (Permissions.tickets.canViewPendingApprovals(roles)) {
    pages.push('approvals');
  }

  if (Permissions.endOfDay.canView(roles)) {
    pages.push('eod');
  }

  if (Permissions.attendance.canView(roles)) {
    pages.push('attendance');
  }

  if (Permissions.employees.canView(roles)) {
    pages.push('technicians');
  }

  if (Permissions.services.canView(roles)) {
    pages.push('services');
  }

  return pages;
}
