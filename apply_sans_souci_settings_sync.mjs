import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kycnryuiramusmdedqnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y25yeXVpcmFtdXNtZGVkcW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDM5NDAsImV4cCI6MjA3NjUxOTk0MH0.0BP8iH92fWWxDjLsGxVIbtIDHlL6Ip16d0E31s5AO6E'
);

async function applySansSouciSettings() {
  console.log('=== SYNCHRONIZING SANS SOUCI SETTINGS ===\n');

  // Get Sans Souci store ID
  const { data: stores, error: storeError } = await supabase
    .from('stores')
    .select('id, name')
    .eq('name', 'Sans Souci')
    .limit(1);

  if (storeError || !stores || stores.length === 0) {
    console.error('Error finding Sans Souci store:', storeError);
    return;
  }

  const sansSouciId = stores[0].id;
  console.log(`Sans Souci Store ID: ${sansSouciId}\n`);

  // Get existing settings to avoid duplicates
  const { data: existing, error: existingError } = await supabase
    .from('app_settings')
    .select('setting_key')
    .eq('store_id', sansSouciId);

  if (existingError) {
    console.error('Error fetching existing settings:', existingError);
    return;
  }

  const existingKeys = new Set(existing.map(s => s.setting_key));
  console.log(`Sans Souci currently has ${existingKeys.size} settings\n`);

  // Define all 52 missing settings
  const settingsToAdd = [
    // APPROVAL WORKFLOW (6)
    {
      store_id: sansSouciId,
      setting_key: 'auto_approve_after_deadline',
      category: 'Approval Workflow',
      display_name: 'Auto-Approve After 48 Hours',
      description: 'Automatically approve tickets after approval deadline',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_cash_approvals',
      category: 'Approval Workflow',
      display_name: 'Cash Transaction Approvals',
      description: 'Require approval for cash transactions',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_inventory_approvals',
      category: 'Approval Workflow',
      display_name: 'Inventory Transaction Approvals',
      description: 'Require approval for inventory transactions',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_ticket_approvals',
      category: 'Approval Workflow',
      display_name: 'Enable Ticket Approval System',
      description: 'Require technician approval for closed tickets',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'require_admin_review_rejected',
      category: 'Approval Workflow',
      display_name: 'Admin Review for Rejected Tickets',
      description: 'Require admin review for rejected tickets',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'show_approval_notifications',
      category: 'Approval Workflow',
      display_name: 'Approval Notifications',
      description: 'Show pending approval count in menu',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },

    // EMPLOYEE SETTINGS (4)
    {
      store_id: sansSouciId,
      setting_key: 'enable_employee_inventory',
      category: 'Employee Settings',
      display_name: 'Employee Inventory Tracking',
      description: 'Track inventory per employee',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_tip_pairing',
      category: 'Employee Settings',
      display_name: 'Enable Tip Pairing',
      description: 'Allow tip pairing between employees',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'show_attendance_in_profiles',
      category: 'Employee Settings',
      display_name: 'Show Attendance in Profiles',
      description: 'Display attendance information in employee profiles',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'show_tip_details',
      category: 'Employee Settings',
      display_name: 'Show Tip Details in Reports',
      description: 'Display detailed tip breakdowns for employees',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },

    // EMPLOYEE (3)
    {
      store_id: sansSouciId,
      setting_key: 'show_tip_details_to_technicians',
      category: 'Employee',
      display_name: 'Show Tip Details to Technicians',
      description: 'Allow technicians to see detailed tip breakdowns',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 10,
      help_text: 'When enabled, technicians can view detailed tip information including customer tips and receptionist tips. Disabling shows only total tips.'
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_tip_pairing_mode',
      category: 'Employee',
      display_name: 'Enable Tip Pairing',
      description: 'Allow technicians to work in pairs and share tips',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 20,
      help_text: 'When enabled, two technicians can be assigned to the same service and split tips. Useful for training or complex services.'
    },
    {
      store_id: sansSouciId,
      setting_key: 'show_attendance_on_home_page',
      category: 'Employee',
      display_name: 'Show Attendance on Home',
      description: 'Display quick attendance check-in/out on home page',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 30,
      help_text: 'When enabled, employees can quickly check in and out from the home page without navigating to the attendance page.'
    },

    // INVENTORY MANAGEMENT (4)
    {
      store_id: sansSouciId,
      setting_key: 'enable_employee_distribution',
      category: 'Inventory Management',
      display_name: 'Employee Distribution',
      description: 'Enable distribution of inventory to employees',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_product_preferences',
      category: 'Inventory Management',
      display_name: 'Product Preferences',
      description: 'Enable product preferences per store',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'track_purchase_lots',
      category: 'Inventory Management',
      display_name: 'Track Purchase Lots',
      description: 'Track inventory by purchase lots with expiry dates',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_inventory_module',
      category: 'Inventory Management',
      display_name: 'Enable Inventory Module',
      description: 'Show inventory management features',
      default_value: true,
      setting_value: true,
      is_critical: true,
      requires_restart: true,
      dependencies: [],
      display_order: 20,
      help_text: 'Enables the full inventory management module including stock tracking, distributions, and audits. Disabling will hide all inventory features but data remains intact.'
    },

    // NOTIFICATIONS AND ALERTS (4)
    {
      store_id: sansSouciId,
      setting_key: 'show_google_ratings',
      category: 'Notifications and Alerts',
      display_name: 'Show Google Ratings',
      description: 'Display Google ratings in header',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'show_opening_cash_banner',
      category: 'Notifications and Alerts',
      display_name: 'Opening Cash Missing Banner',
      description: 'Show banner when opening cash not counted',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'show_version_notifications',
      category: 'Notifications and Alerts',
      display_name: 'Version Update Notifications',
      description: 'Show notification when new version is available',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_realtime_refresh',
      category: 'Notifications and Alerts',
      display_name: 'Real-time Data Refresh',
      description: 'Enable automatic data refresh',
      default_value: true,
      setting_value: true,
      is_critical: true,
      requires_restart: true,
      dependencies: [],
      display_order: 10,
      help_text: 'Enables automatic real-time updates for data changes across all devices. Disabling requires manual page refresh to see updates. May affect performance on slower connections.'
    },

    // NOTIFICATIONS (1)
    {
      store_id: sansSouciId,
      setting_key: 'show_pending_approval_badge',
      category: 'Notifications',
      display_name: 'Show Approval Badge',
      description: 'Display count of pending approvals in navigation',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 20,
      help_text: 'When enabled, shows a badge with the number of items pending approval in the navigation menu. Disabling hides the count but approvals still need to be processed.'
    },

    // PAYMENT OPTIONS (6)
    {
      store_id: sansSouciId,
      setting_key: 'allow_discounts',
      category: 'Payment Options',
      display_name: 'Allow Discounts',
      description: 'Enable discounts on tickets',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_addons',
      category: 'Payment Options',
      display_name: 'Enable Add-ons',
      description: 'Allow add-ons with separate pricing',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_card_payments',
      category: 'Payment Options',
      display_name: 'Enable Card Payments',
      description: 'Allow credit/debit card as payment method',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_cash_payments',
      category: 'Payment Options',
      display_name: 'Enable Cash Payments',
      description: 'Allow cash as payment method',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_gift_card_payments',
      category: 'Payment Options',
      display_name: 'Enable Gift Card Payments',
      description: 'Allow gift cards as payment method',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_mixed_payments',
      category: 'Payment Options',
      display_name: 'Enable Mixed Payment Methods',
      description: 'Allow multiple payment methods on one ticket',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },

    // PAYMENT (2)
    {
      store_id: sansSouciId,
      setting_key: 'enable_mixed_payment_methods',
      category: 'Payment',
      display_name: 'Enable Mixed Payments',
      description: 'Allow customers to split payment across multiple methods',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [
        {"key":"enable_cash_payments","type":"requires","label":"Enable cash payments"},
        {"key":"enable_card_payments","type":"requires","label":"Enable card payments"},
        {"key":"enable_gift_card_payments","type":"requires","label":"Enable gift card payments"}
      ],
      display_order: 40,
      help_text: 'When enabled, customers can split their payment between cash, card, and gift card. Disabling requires a single payment method per ticket.'
    },
    {
      store_id: sansSouciId,
      setting_key: 'allow_ticket_discounts',
      category: 'Payment',
      display_name: 'Allow Ticket Discounts',
      description: 'Enable discount functionality on tickets',
      default_value: false,
      setting_value: false,
      is_critical: true,
      requires_restart: false,
      dependencies: [],
      display_order: 50,
      help_text: 'When enabled, authorized staff can apply discounts to tickets. This is a sensitive setting that affects revenue tracking.'
    },

    // QUEUE AND ATTENDANCE (4)
    {
      store_id: sansSouciId,
      setting_key: 'auto_checkout_at_closing',
      category: 'Queue and Attendance',
      display_name: 'Auto-Checkout at Closing',
      description: 'Automatically check out employees at closing time',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_realtime_queue',
      category: 'Queue and Attendance',
      display_name: 'Real-time Queue Updates',
      description: 'Enable real-time queue status updates',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'filter_by_weekly_schedule',
      category: 'Queue and Attendance',
      display_name: 'Filter by Weekly Schedule',
      description: 'Only show technicians scheduled to work today',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'show_queue_in_header',
      category: 'Queue and Attendance',
      display_name: 'Show Queue Button in Header',
      description: 'Display queue status button in header',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },

    // REPORTING AND ANALYTICS (5)
    {
      store_id: sansSouciId,
      setting_key: 'enable_attendance_export',
      category: 'Reporting and Analytics',
      display_name: 'Attendance Export',
      description: 'Enable attendance report export functionality',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_insights_dashboard',
      category: 'Reporting and Analytics',
      display_name: 'Insights Dashboard',
      description: 'Enable insights and analytics dashboard',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'show_completion_time_analysis',
      category: 'Reporting and Analytics',
      display_name: 'Service Completion Analysis',
      description: 'Display service completion time analysis',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'show_detailed_tip_breakdown',
      category: 'Reporting and Analytics',
      display_name: 'Detailed Tip Breakdowns',
      description: 'Show detailed tip information in reports',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'track_service_popularity',
      category: 'Reporting and Analytics',
      display_name: 'Track Service Popularity',
      description: 'Track and display service popularity metrics',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },

    // SYSTEM (1)
    {
      store_id: sansSouciId,
      setting_key: 'enable_audit_logging',
      category: 'System',
      display_name: 'Enable Audit Logging',
      description: 'Track all configuration changes and critical actions',
      default_value: true,
      setting_value: true,
      is_critical: true,
      requires_restart: false,
      dependencies: [],
      display_order: 30,
      help_text: 'When enabled, all changes to settings and critical business actions are logged for compliance and troubleshooting. Disabling may affect compliance requirements.'
    },

    // TICKET MANAGEMENT (7)
    {
      store_id: sansSouciId,
      setting_key: 'allow_self_service_tickets',
      category: 'Ticket Management',
      display_name: 'Allow Self-Service Tickets',
      description: 'Enable technicians to create their own tickets',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_completion_tracking',
      category: 'Ticket Management',
      display_name: 'Track Service Completion',
      description: 'Track when services are started and completed with duration',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'require_checkin_for_tickets',
      category: 'Ticket Management',
      display_name: 'Require Check-in Before Ticket Creation',
      description: 'Employees must be checked in before creating tickets',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'require_customer_name',
      category: 'Ticket Management',
      display_name: 'Require Customer Name',
      description: 'Make customer name mandatory on all tickets',
      default_value: false,
      setting_value: false,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'require_customer_phone',
      category: 'Ticket Management',
      display_name: 'Require Customer Phone',
      description: 'Make customer phone mandatory on all tickets',
      default_value: false,
      setting_value: false,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'require_opening_cash',
      category: 'Ticket Management',
      display_name: 'Require Opening Cash Count',
      description: 'Prevent ticket creation until opening cash is counted for the day',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },
    {
      store_id: sansSouciId,
      setting_key: 'show_ticket_activity_log',
      category: 'Ticket Management',
      display_name: 'Show Activity Log',
      description: 'Display activity log for ticket changes',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 0,
      help_text: ''
    },

    // TICKETS (5)
    {
      store_id: sansSouciId,
      setting_key: 'require_customer_name_on_tickets',
      category: 'Tickets',
      display_name: 'Require Customer Name',
      description: 'Forces entry of customer name on all tickets',
      default_value: false,
      setting_value: false,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 60,
      help_text: 'When enabled, tickets cannot be created or closed without a customer name. Useful for tracking returning customers and personalizing service.'
    },
    {
      store_id: sansSouciId,
      setting_key: 'require_customer_phone_on_tickets',
      category: 'Tickets',
      display_name: 'Require Customer Phone',
      description: 'Forces entry of customer phone number on all tickets',
      default_value: false,
      setting_value: false,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 70,
      help_text: 'When enabled, tickets cannot be created or closed without a customer phone number. Useful for follow-up communications and appointment reminders.'
    },
    {
      store_id: sansSouciId,
      setting_key: 'require_employee_checkin_before_tickets',
      category: 'Tickets',
      display_name: 'Require Employee Check-In',
      description: 'Employees must be checked in to be assigned tickets',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 80,
      help_text: 'When enabled, only employees who have checked in for their shift can be assigned to tickets. Ensures accurate time tracking and prevents assignment to absent staff.'
    },
    {
      store_id: sansSouciId,
      setting_key: 'enable_ticket_notes',
      category: 'Tickets',
      display_name: 'Enable Ticket Notes',
      description: 'Allow adding notes and comments to tickets',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 90,
      help_text: 'When enabled, staff can add internal notes to tickets for communication and tracking purposes.'
    },
    {
      store_id: sansSouciId,
      setting_key: 'show_ticket_timer_warnings',
      category: 'Tickets',
      display_name: 'Show Timer Warnings',
      description: 'Display warnings when service time exceeds expected duration',
      default_value: true,
      setting_value: true,
      is_critical: false,
      requires_restart: false,
      dependencies: [],
      display_order: 100,
      help_text: 'When enabled, tickets that exceed their expected service time by 30% will show a visual warning indicator.'
    }
  ];

  // Filter out any settings that already exist
  const newSettings = settingsToAdd.filter(s => !existingKeys.has(s.setting_key));

  console.log(`Adding ${newSettings.length} new settings to Sans Souci...\n`);

  if (newSettings.length === 0) {
    console.log('No new settings to add. Sans Souci is already up to date!');
    return;
  }

  // Insert settings in batches
  const batchSize = 10;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < newSettings.length; i += batchSize) {
    const batch = newSettings.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('app_settings')
      .insert(batch)
      .select('setting_key');

    if (error) {
      console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
      errorCount += batch.length;
    } else {
      successCount += data.length;
      console.log(`✓ Batch ${Math.floor(i / batchSize) + 1}: Added ${data.length} settings`);
    }
  }

  console.log('\n=== RESULT ===');
  console.log(`Successfully added: ${successCount} settings`);
  if (errorCount > 0) {
    console.log(`Failed to add: ${errorCount} settings`);
  }

  // Verify final count
  const { count: finalCount, error: countError } = await supabase
    .from('app_settings')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', sansSouciId);

  if (countError) {
    console.error('Error counting final settings:', countError);
  } else {
    console.log(`\nSans Souci now has ${finalCount} settings (expected: 56)`);
  }

  // Show settings count for all stores
  console.log('\n=== ALL STORES ===');
  const { data: allStores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('active', true)
    .order('name');

  for (const store of allStores) {
    const { count } = await supabase
      .from('app_settings')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', store.id);

    console.log(`${store.name}: ${count} settings`);
  }
}

applySansSouciSettings().catch(console.error);
