-- Seed Permission Definitions
-- This populates all available permissions in the system

-- Tickets Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('tickets.canView', 'tickets', 'view', 'View Tickets', 'Ability to view the tickets page and see ticket information', false, 1),
('tickets.canCreate', 'tickets', 'create', 'Create Tickets', 'Ability to create new service tickets', false, 2),
('tickets.isSelfServiceRole', 'tickets', 'self_service', 'Self-Service Tickets', 'Ability to create self-service tickets (technician creating their own)', false, 3),
('tickets.canViewAllTechniciansInEditor', 'tickets', 'view_all_techs', 'View All Technicians in Editor', 'Ability to see and assign all technicians when editing tickets', false, 4),
('tickets.canReviewSelfServiceTicket', 'tickets', 'review_self_service', 'Review Self-Service Tickets', 'Ability to review and edit self-service tickets created by technicians', false, 5),
('tickets.canEdit', 'tickets', 'edit', 'Edit Tickets', 'Ability to edit ticket details (subject to approval status)', false, 6),
('tickets.canEditNotes', 'tickets', 'edit_notes', 'Edit Ticket Notes', 'Ability to edit notes on tickets', false, 7),
('tickets.canDelete', 'tickets', 'delete', 'Delete Tickets', 'Ability to delete tickets from the system', true, 8),
('tickets.canViewAll', 'tickets', 'view_all', 'View All Tickets', 'Ability to view all tickets regardless of who created them', false, 9),
('tickets.canClose', 'tickets', 'close', 'Close Tickets', 'Ability to mark tickets as closed', false, 10),
('tickets.canMarkCompleted', 'tickets', 'mark_completed', 'Mark Tickets Completed', 'Ability to mark ticket items as completed', false, 11),
('tickets.canReopen', 'tickets', 'reopen', 'Reopen Tickets', 'Ability to reopen closed tickets', true, 12),
('tickets.canApprove', 'tickets', 'approve', 'Approve Tickets', 'Ability to approve pending tickets', false, 13),
('tickets.canViewPendingApprovals', 'tickets', 'view_approvals', 'View Pending Approvals', 'Ability to see tickets awaiting approval', false, 14),
('tickets.canReviewRejected', 'tickets', 'review_rejected', 'Review Rejected Tickets', 'Ability to review and handle rejected tickets', true, 15)
ON CONFLICT (permission_key) DO NOTHING;

-- End of Day Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('endOfDay.canView', 'endOfDay', 'view', 'View End of Day', 'Ability to view the end of day page and reports', false, 1),
('endOfDay.canViewAll', 'endOfDay', 'view_all', 'View All EOD Records', 'Ability to view all end of day records', false, 2),
('endOfDay.canExport', 'endOfDay', 'export', 'Export EOD Data', 'Ability to export end of day data', false, 3)
ON CONFLICT (permission_key) DO NOTHING;

-- Tip Report Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('tipReport.canView', 'tipReport', 'view', 'View Tip Reports', 'Ability to view tip reports', false, 1),
('tipReport.canViewAll', 'tipReport', 'view_all', 'View All Tip Data', 'Ability to view tip data for all employees', false, 2),
('tipReport.canExport', 'tipReport', 'export', 'Export Tip Data', 'Ability to export tip report data', false, 3),
('tipReport.canViewUnlimitedHistory', 'tipReport', 'unlimited_history', 'View Unlimited History', 'Ability to view tip history beyond the standard time limit', false, 4)
ON CONFLICT (permission_key) DO NOTHING;

-- Employees Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('employees.canView', 'employees', 'view', 'View Employees', 'Ability to view the employees page and employee list', false, 1),
('employees.canCreate', 'employees', 'create', 'Create Employees', 'Ability to add new employees to the system', true, 2),
('employees.canEdit', 'employees', 'edit', 'Edit Employees', 'Ability to modify employee information', true, 3),
('employees.canDelete', 'employees', 'delete', 'Delete Employees', 'Ability to remove employees from the system', true, 4),
('employees.canResetPIN', 'employees', 'reset_pin', 'Reset Employee PIN', 'Ability to reset employee PIN codes', true, 5),
('employees.canAssignRoles', 'employees', 'assign_roles', 'Assign Employee Roles', 'Ability to assign and change employee roles', true, 6)
ON CONFLICT (permission_key) DO NOTHING;

-- Services Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('services.canView', 'services', 'view', 'View Services', 'Ability to view the services page and service list', false, 1),
('services.canCreate', 'services', 'create', 'Create Services', 'Ability to add new services', false, 2),
('services.canEdit', 'services', 'edit', 'Edit Services', 'Ability to modify service information and pricing', false, 3),
('services.canArchive', 'services', 'archive', 'Archive Services', 'Ability to archive services', false, 4),
('services.canDelete', 'services', 'delete', 'Delete Services', 'Ability to permanently delete services', true, 5)
ON CONFLICT (permission_key) DO NOTHING;

-- Profile Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('profile.canChangePIN', 'profile', 'change_pin', 'Change Own PIN', 'Ability to change your own PIN code', false, 1)
ON CONFLICT (permission_key) DO NOTHING;

-- Attendance Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('attendance.canView', 'attendance', 'view', 'View Attendance', 'Ability to view the attendance page and records', false, 1),
('attendance.canComment', 'attendance', 'comment', 'Comment on Attendance', 'Ability to add comments to attendance records', false, 2),
('attendance.canExport', 'attendance', 'export', 'Export Attendance Data', 'Ability to export attendance data', false, 3)
ON CONFLICT (permission_key) DO NOTHING;

-- Inventory Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('inventory.canView', 'inventory', 'view', 'View Inventory', 'Ability to view the inventory page', false, 1),
('inventory.canCreateItems', 'inventory', 'create_items', 'Create Inventory Items', 'Ability to create new inventory items', false, 2),
('inventory.canEditItems', 'inventory', 'edit_items', 'Edit Inventory Items', 'Ability to modify inventory item information', false, 3),
('inventory.canCreateTransactions', 'inventory', 'create_transactions', 'Create Transactions', 'Ability to create inventory transactions', false, 4),
('inventory.canApprove', 'inventory', 'approve', 'Approve Transactions', 'Ability to approve inventory transactions', false, 5),
('inventory.canViewLots', 'inventory', 'view_lots', 'View Purchase Lots', 'Ability to view purchase lot information', false, 6),
('inventory.canCreateLots', 'inventory', 'create_lots', 'Create Purchase Lots', 'Ability to create new purchase lots', false, 7),
('inventory.canDistribute', 'inventory', 'distribute', 'Distribute Inventory', 'Ability to distribute inventory to employees', false, 8),
('inventory.canViewEmployeeInventory', 'inventory', 'view_employee_inv', 'View Employee Inventory', 'Ability to view other employees inventory', false, 9),
('inventory.canViewOwnInventory', 'inventory', 'view_own_inv', 'View Own Inventory', 'Ability to view your own inventory', false, 10),
('inventory.canCreateAudit', 'inventory', 'create_audit', 'Create Audits', 'Ability to create inventory audits', false, 11),
('inventory.canApproveAudit', 'inventory', 'approve_audit', 'Approve Audits', 'Ability to approve inventory audits', true, 12)
ON CONFLICT (permission_key) DO NOTHING;

-- Suppliers Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('suppliers.canView', 'suppliers', 'view', 'View Suppliers', 'Ability to view supplier information', false, 1),
('suppliers.canCreate', 'suppliers', 'create', 'Create Suppliers', 'Ability to add new suppliers', false, 2),
('suppliers.canEdit', 'suppliers', 'edit', 'Edit Suppliers', 'Ability to modify supplier information', false, 3),
('suppliers.canDelete', 'suppliers', 'delete', 'Delete Suppliers', 'Ability to delete suppliers', true, 4)
ON CONFLICT (permission_key) DO NOTHING;

-- Queue Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('queue.canViewAllQueueStatuses', 'queue', 'view_all_statuses', 'View All Queue Statuses', 'Ability to see queue status for all technicians', false, 1)
ON CONFLICT (permission_key) DO NOTHING;

-- Insights Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('insights.canView', 'insights', 'view', 'View Insights', 'Ability to view the insights and analytics page', false, 1)
ON CONFLICT (permission_key) DO NOTHING;

-- Safe Balance Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('safeBalance.canView', 'safeBalance', 'view', 'View Safe Balance', 'Ability to view safe balance information', false, 1),
('safeBalance.canManage', 'safeBalance', 'manage', 'Manage Safe Balance', 'Ability to manage safe balance transactions', true, 2)
ON CONFLICT (permission_key) DO NOTHING;

-- Configuration Module Permissions
INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order) VALUES
('configuration.canView', 'configuration', 'view', 'View Configuration', 'Ability to view the configuration page', true, 1),
('configuration.canEdit', 'configuration', 'edit', 'Edit Configuration', 'Ability to modify system configuration settings', true, 2)
ON CONFLICT (permission_key) DO NOTHING;

-- Show summary
SELECT
  module_name,
  COUNT(*) as permission_count
FROM public.permission_definitions
GROUP BY module_name
ORDER BY module_name;
