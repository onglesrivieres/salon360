import { Role } from './permissions';

export interface PermissionMetadata {
  key: string;
  module: string;
  action: string;
  displayName: string;
  description: string;
  isCritical: boolean;
  defaultRoles: Role[];
}

export const permissionMetadata: PermissionMetadata[] = [
  {
    key: 'tickets.canView',
    module: 'tickets',
    action: 'view',
    displayName: 'View Tickets',
    description: 'Ability to view the tickets page and see ticket information',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Technician', 'Supervisor', 'Manager', 'Owner', 'Cashier']
  },
  {
    key: 'tickets.canCreate',
    module: 'tickets',
    action: 'create',
    displayName: 'Create Tickets',
    description: 'Ability to create new service tickets',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Technician', 'Supervisor', 'Manager', 'Owner', 'Cashier']
  },
  {
    key: 'tickets.isSelfServiceRole',
    module: 'tickets',
    action: 'self_service',
    displayName: 'Self-Service Tickets',
    description: 'Ability to create self-service tickets (technician creating their own)',
    isCritical: false,
    defaultRoles: ['Technician', 'Supervisor']
  },
  {
    key: 'tickets.canViewAllTechniciansInEditor',
    module: 'tickets',
    action: 'view_all_techs',
    displayName: 'View All Technicians in Editor',
    description: 'Ability to see and assign all technicians when editing tickets',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'tickets.canReviewSelfServiceTicket',
    module: 'tickets',
    action: 'review_self_service',
    displayName: 'Review Self-Service Tickets',
    description: 'Ability to review and edit self-service tickets created by technicians',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Manager', 'Owner']
  },
  {
    key: 'tickets.canEdit',
    module: 'tickets',
    action: 'edit',
    displayName: 'Edit Tickets',
    description: 'Ability to edit ticket details (subject to approval status)',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']
  },
  {
    key: 'tickets.canEditNotes',
    module: 'tickets',
    action: 'edit_notes',
    displayName: 'Edit Ticket Notes',
    description: 'Ability to edit notes on tickets',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']
  },
  {
    key: 'tickets.canDelete',
    module: 'tickets',
    action: 'delete',
    displayName: 'Delete Tickets',
    description: 'Ability to delete tickets from the system',
    isCritical: true,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']
  },
  {
    key: 'tickets.canViewAll',
    module: 'tickets',
    action: 'view_all',
    displayName: 'View All Tickets',
    description: 'Ability to view all tickets regardless of who created them',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']
  },
  {
    key: 'tickets.canClose',
    module: 'tickets',
    action: 'close',
    displayName: 'Close Tickets',
    description: 'Ability to mark tickets as closed',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']
  },
  {
    key: 'tickets.canMarkCompleted',
    module: 'tickets',
    action: 'mark_completed',
    displayName: 'Mark Tickets Completed',
    description: 'Ability to mark ticket items as completed',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']
  },
  {
    key: 'tickets.canSelectPaymentMethod',
    module: 'tickets',
    action: 'select_payment_method',
    displayName: 'Select Payment Method',
    description: 'Ability to select payment methods (Cash, Card, Mixed) on tickets',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Cashier']
  },
  {
    key: 'tickets.canReopen',
    module: 'tickets',
    action: 'reopen',
    displayName: 'Reopen Tickets',
    description: 'Ability to reopen closed tickets',
    isCritical: true,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'tickets.canApprove',
    module: 'tickets',
    action: 'approve',
    displayName: 'Approve Tickets',
    description: 'Ability to approve pending tickets',
    isCritical: false,
    defaultRoles: ['Admin', 'Technician', 'Supervisor', 'Owner']
  },
  {
    key: 'tickets.canViewPendingApprovals',
    module: 'tickets',
    action: 'view_approvals',
    displayName: 'View Pending Approvals',
    description: 'Ability to see tickets awaiting approval',
    isCritical: false,
    defaultRoles: ['Admin', 'Technician', 'Supervisor', 'Owner', 'Manager']
  },
  {
    key: 'tickets.canReviewRejected',
    module: 'tickets',
    action: 'review_rejected',
    displayName: 'Review Rejected Tickets',
    description: 'Ability to review and handle rejected tickets',
    isCritical: true,
    defaultRoles: ['Admin', 'Owner']
  },
  {
    key: 'endOfDay.canView',
    module: 'endOfDay',
    action: 'view',
    displayName: 'View End of Day',
    description: 'Ability to view the end of day page, reports, and opening cash banner',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'endOfDay.canViewAll',
    module: 'endOfDay',
    action: 'view_all',
    displayName: 'View All EOD Records',
    description: 'Ability to view all end of day records',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'endOfDay.canExport',
    module: 'endOfDay',
    action: 'export',
    displayName: 'Export EOD Data',
    description: 'Ability to export end of day data',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'tipReport.canView',
    module: 'tipReport',
    action: 'view',
    displayName: 'View Tip Reports',
    description: 'Ability to view tip reports',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Technician', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'tipReport.canViewAll',
    module: 'tipReport',
    action: 'view_all',
    displayName: 'View All Tip Data',
    description: 'Ability to view tip data for all employees',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'tipReport.canExport',
    module: 'tipReport',
    action: 'export',
    displayName: 'Export Tip Data',
    description: 'Ability to export tip report data',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'tipReport.canViewUnlimitedHistory',
    module: 'tipReport',
    action: 'unlimited_history',
    displayName: 'View Unlimited History',
    description: 'Ability to view tip history beyond the standard time limit',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'employees.canView',
    module: 'employees',
    action: 'view',
    displayName: 'View Employees',
    description: 'Ability to view the employees page and employee list',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'employees.canCreate',
    module: 'employees',
    action: 'create',
    displayName: 'Create Employees',
    description: 'Ability to add new employees to the system',
    isCritical: true,
    defaultRoles: ['Admin', 'Owner']
  },
  {
    key: 'employees.canEdit',
    module: 'employees',
    action: 'edit',
    displayName: 'Edit Employees',
    description: 'Ability to modify employee information',
    isCritical: true,
    defaultRoles: ['Admin', 'Owner']
  },
  {
    key: 'employees.canDelete',
    module: 'employees',
    action: 'delete',
    displayName: 'Delete Employees',
    description: 'Ability to remove employees from the system',
    isCritical: true,
    defaultRoles: ['Admin', 'Owner']
  },
  {
    key: 'employees.canResetPIN',
    module: 'employees',
    action: 'reset_pin',
    displayName: 'Reset Employee PIN',
    description: 'Ability to reset employee PIN codes',
    isCritical: true,
    defaultRoles: ['Admin', 'Owner']
  },
  {
    key: 'employees.canAssignRoles',
    module: 'employees',
    action: 'assign_roles',
    displayName: 'Assign Employee Roles',
    description: 'Ability to assign and change employee roles',
    isCritical: true,
    defaultRoles: ['Admin', 'Owner']
  },
  {
    key: 'services.canView',
    module: 'services',
    action: 'view',
    displayName: 'View Services',
    description: 'Ability to view the services page and service list',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'services.canCreate',
    module: 'services',
    action: 'create',
    displayName: 'Create Services',
    description: 'Ability to add new services',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Supervisor', 'Owner']
  },
  {
    key: 'services.canEdit',
    module: 'services',
    action: 'edit',
    displayName: 'Edit Services',
    description: 'Ability to modify service information and pricing',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Supervisor', 'Owner']
  },
  {
    key: 'services.canArchive',
    module: 'services',
    action: 'archive',
    displayName: 'Archive Services',
    description: 'Ability to archive services',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Supervisor', 'Owner']
  },
  {
    key: 'services.canDelete',
    module: 'services',
    action: 'delete',
    displayName: 'Delete Services',
    description: 'Ability to permanently delete services',
    isCritical: true,
    defaultRoles: ['Admin', 'Owner']
  },
  {
    key: 'profile.canChangePIN',
    module: 'profile',
    action: 'change_pin',
    displayName: 'Change Own PIN',
    description: 'Ability to change your own PIN code',
    isCritical: false,
    defaultRoles: ['Admin', 'Owner', 'Manager', 'Supervisor', 'Receptionist', 'Technician', 'Cashier']
  },
  {
    key: 'attendance.canView',
    module: 'attendance',
    action: 'view',
    displayName: 'View Attendance',
    description: 'Ability to view the attendance page and records',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Technician', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'attendance.canComment',
    module: 'attendance',
    action: 'comment',
    displayName: 'Comment on Attendance',
    description: 'Ability to add comments to attendance records',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Technician', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'attendance.canExport',
    module: 'attendance',
    action: 'export',
    displayName: 'Export Attendance Data',
    description: 'Ability to export attendance data',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canView',
    module: 'inventory',
    action: 'view',
    displayName: 'View Inventory',
    description: 'Ability to view the inventory page',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canCreateItems',
    module: 'inventory',
    action: 'create_items',
    displayName: 'Create Inventory Items',
    description: 'Ability to create new inventory items',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canEditItems',
    module: 'inventory',
    action: 'edit_items',
    displayName: 'Edit Inventory Items',
    description: 'Ability to modify inventory item information',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canCreateTransactions',
    module: 'inventory',
    action: 'create_transactions',
    displayName: 'Create Transactions',
    description: 'Ability to create inventory transactions',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canApprove',
    module: 'inventory',
    action: 'approve',
    displayName: 'Approve Transactions',
    description: 'Ability to approve inventory transactions',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canViewLots',
    module: 'inventory',
    action: 'view_lots',
    displayName: 'View Purchase Lots',
    description: 'Ability to view purchase lot information',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canCreateLots',
    module: 'inventory',
    action: 'create_lots',
    displayName: 'Create Purchase Lots',
    description: 'Ability to create new purchase lots',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canDistribute',
    module: 'inventory',
    action: 'distribute',
    displayName: 'Distribute Inventory',
    description: 'Ability to distribute inventory to employees',
    isCritical: false,
    defaultRoles: ['Admin', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canViewEmployeeInventory',
    module: 'inventory',
    action: 'view_employee_inv',
    displayName: 'View Employee Inventory',
    description: 'Ability to view other employees inventory',
    isCritical: false,
    defaultRoles: ['Admin', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canViewOwnInventory',
    module: 'inventory',
    action: 'view_own_inv',
    displayName: 'View Own Inventory',
    description: 'Ability to view your own inventory',
    isCritical: false,
    defaultRoles: ['Admin', 'Technician', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canCreateAudit',
    module: 'inventory',
    action: 'create_audit',
    displayName: 'Create Audits',
    description: 'Ability to create inventory audits',
    isCritical: false,
    defaultRoles: ['Admin', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'inventory.canApproveAudit',
    module: 'inventory',
    action: 'approve_audit',
    displayName: 'Approve Audits',
    description: 'Ability to approve inventory audits',
    isCritical: true,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'suppliers.canView',
    module: 'suppliers',
    action: 'view',
    displayName: 'View Suppliers',
    description: 'Ability to view supplier information',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'suppliers.canCreate',
    module: 'suppliers',
    action: 'create',
    displayName: 'Create Suppliers',
    description: 'Ability to add new suppliers',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'suppliers.canEdit',
    module: 'suppliers',
    action: 'edit',
    displayName: 'Edit Suppliers',
    description: 'Ability to modify supplier information',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'suppliers.canDelete',
    module: 'suppliers',
    action: 'delete',
    displayName: 'Delete Suppliers',
    description: 'Ability to delete suppliers',
    isCritical: true,
    defaultRoles: ['Admin', 'Owner']
  },
  {
    key: 'queue.canViewAllQueueStatuses',
    module: 'queue',
    action: 'view_all_statuses',
    displayName: 'View All Queue Statuses',
    description: 'Ability to see queue status for all technicians',
    isCritical: false,
    defaultRoles: ['Admin', 'Receptionist', 'Supervisor', 'Manager', 'Owner']
  },
  {
    key: 'insights.canView',
    module: 'insights',
    action: 'view',
    displayName: 'View Insights',
    description: 'Ability to view the insights and analytics page',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'safeBalance.canView',
    module: 'safeBalance',
    action: 'view',
    displayName: 'View Safe Balance',
    description: 'Ability to view safe balance information',
    isCritical: false,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'safeBalance.canManage',
    module: 'safeBalance',
    action: 'manage',
    displayName: 'Manage Safe Balance',
    description: 'Ability to manage safe balance transactions',
    isCritical: true,
    defaultRoles: ['Admin', 'Manager', 'Owner']
  },
  {
    key: 'configuration.canView',
    module: 'configuration',
    action: 'view',
    displayName: 'View Configuration',
    description: 'Ability to view the configuration page',
    isCritical: true,
    defaultRoles: ['Admin', 'Owner']
  },
  {
    key: 'configuration.canEdit',
    module: 'configuration',
    action: 'edit',
    displayName: 'Edit Configuration',
    description: 'Ability to modify system configuration settings',
    isCritical: true,
    defaultRoles: ['Admin', 'Owner']
  }
];

export function getPermissionsByModule(): Record<string, PermissionMetadata[]> {
  const grouped: Record<string, PermissionMetadata[]> = {};

  permissionMetadata.forEach(perm => {
    if (!grouped[perm.module]) {
      grouped[perm.module] = [];
    }
    grouped[perm.module].push(perm);
  });

  return grouped;
}

export function getDefaultPermissionsForRole(role: Role): string[] {
  return permissionMetadata
    .filter(perm => perm.defaultRoles.includes(role))
    .map(perm => perm.key);
}

export const moduleDisplayNames: Record<string, string> = {
  tickets: 'Tickets',
  endOfDay: 'End of Day',
  tipReport: 'Tip Reports',
  employees: 'Employees',
  services: 'Services',
  profile: 'Profile',
  attendance: 'Attendance',
  inventory: 'Inventory',
  suppliers: 'Suppliers',
  queue: 'Queue',
  insights: 'Insights',
  safeBalance: 'Safe Balance',
  configuration: 'Configuration'
};
