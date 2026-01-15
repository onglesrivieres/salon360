import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'x-application-name': 'salon360',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
});

export interface Store {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Technician {
  id: string;
  legal_name: string;
  display_name: string;
  role: ('Technician' | 'Receptionist' | 'Manager' | 'Owner' | 'Supervisor' | 'Cashier')[];
  status: 'Active' | 'Inactive';
  store_id?: string;
  pay_type?: 'hourly' | 'daily' | 'commission';
  payout_rule_type?: string;
  payout_commission_pct?: number;
  payout_hourly_rate?: number;
  payout_flat_per_service?: number;
  notes: string;
  pin_code_hash?: string;
  can_reset_pin?: boolean;
  pin_temp?: string;
  last_pin_change?: string;
  tip_report_show_details?: boolean;
  tip_paired_enabled?: boolean;
  attendance_display?: boolean;
  count_ot?: boolean;
  weekly_schedule?: WeeklySchedule;
  created_at: string;
  updated_at: string;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DaySchedule {
  is_working: boolean;
  start_time: string;
  end_time: string;
}

export interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export type Employee = Technician;

export interface Service {
  id: string;
  code: string;
  name: string;
  base_price: number;
  duration_min: number;
  category: string;
  active: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreService {
  id: string;
  store_id: string;
  service_id: string;
  price_override?: number;
  duration_override?: number;
  active: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreServiceWithDetails {
  id: string;
  store_service_id: string;
  service_id: string;
  code: string;
  name: string;
  price: number;
  duration_min: number;
  category: string;
  active: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

export interface StoreServiceCategory {
  id: string;
  store_id: string;
  name: string;
  color: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected' | 'auto_approved';

export interface SaleTicket {
  id: string;
  ticket_no: string;
  store_id: string;
  ticket_date: string;
  opened_at: string;
  closed_at: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_type?: string;
  payment_method: 'Cash' | 'Card' | 'Mixed' | 'Other';
  subtotal: number;
  total: number;
  location: string;
  notes: string;
  created_by?: string;
  saved_by?: string;
  closed_by?: string;
  approval_status?: ApprovalStatus | null;
  approved_at?: string | null;
  approved_by?: string | null;
  approval_deadline?: string | null;
  rejection_reason?: string | null;
  requires_admin_review?: boolean;
  opened_by_role?: string;
  reviewed_by_receptionist?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TicketItem {
  id: string;
  sale_ticket_id: string;
  service_id?: string | null;
  store_service_id?: string | null;
  custom_service_name?: string | null;
  employee_id: string;
  qty: number;
  price_each: number;
  addon_details?: string;
  addon_price?: number;
  payment_cash: number;
  payment_card: number;
  payment_gift_card: number;
  tip_customer_cash: number;
  tip_customer_card: number;
  tip_receptionist: number;
  discount_percentage?: number;
  discount_amount?: number;
  discount_percentage_cash?: number;
  discount_amount_cash?: number;
  notes: string;
  started_at?: string | null;
  timer_stopped_at?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketItemWithDetails extends TicketItem {
  service?: Service;
  employee?: Technician;
}

export interface SaleTicketWithItems extends SaleTicket {
  ticket_items?: TicketItemWithDetails[];
}

export interface TicketActivityLog {
  id: string;
  ticket_id: string;
  employee_id?: string;
  action: 'created' | 'updated' | 'closed' | 'reopened' | 'approved' | 'rejected';
  description: string;
  changes?: Record<string, any>;
  created_at: string;
  employee?: Technician;
}

export interface TechnicianReadyQueue {
  id: string;
  employee_id: string;
  store_id: string;
  ready_at: string;
  status: 'ready' | 'busy';
  current_open_ticket_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TechnicianWithQueue {
  employee_id: string;
  legal_name: string;
  display_name: string;
  queue_status: 'ready' | 'busy' | 'small_service' | 'neutral';
  queue_position: number;
  ready_at?: string;
  current_open_ticket_id?: string;
  open_ticket_count: number;
  ticket_start_time?: string;
  estimated_duration_min?: number;
  estimated_completion_time?: string;
}

export interface WorkingEmployee {
  employee_id: string;
  legal_name: string;
  display_name: string;
  queue_status: string | null;
  queue_position: number | null;
  is_checked_in: boolean;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  store_id: string;
  work_date: string;
  check_in_time: string;
  check_out_time?: string;
  last_activity_time?: string;
  pay_type: 'hourly' | 'daily' | 'commission';
  status: 'checked_in' | 'checked_out' | 'auto_checked_out';
  total_hours?: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecordWithEmployee extends AttendanceRecord {
  employee?: Technician;
}

export interface AttendanceSummary {
  work_date: string;
  check_in_time: string;
  check_out_time?: string;
  total_hours?: number;
  status: string;
  store_name: string;
}

export interface StoreAttendance {
  attendance_record_id: string;
  employee_id: string;
  employee_name: string;
  work_date: string;
  check_in_time: string;
  check_out_time?: string;
  total_hours?: number;
  status: string;
  pay_type: string;
  store_code: string;
  has_pending_proposal?: boolean;
}

export interface AttendanceComment {
  id: string;
  attendance_record_id: string;
  employee_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  employee?: Technician;
}

export type AttendanceProposalStatus = 'pending' | 'approved' | 'rejected';

export interface AttendanceChangeProposal {
  id: string;
  attendance_record_id: string;
  employee_id: string;
  proposed_check_in_time?: string;
  proposed_check_out_time?: string;
  current_check_in_time: string;
  current_check_out_time?: string;
  reason_comment: string;
  status: AttendanceProposalStatus;
  reviewed_by_employee_id?: string;
  reviewed_at?: string;
  review_comment?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceChangeProposalWithDetails extends AttendanceChangeProposal {
  employee?: Technician;
  reviewed_by?: Technician;
}

export interface PendingApprovalTicket {
  ticket_id: string;
  ticket_no: string;
  ticket_date: string;
  closed_at: string;
  approval_deadline: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  closed_by_name: string;
  completed_by_name?: string;
  hours_remaining: number;
  service_name: string;
  tip_customer: number;
  tip_receptionist: number;
  payment_method: string;
  reason?: string;
  closed_by_roles?: any;
  requires_higher_approval?: boolean;
  technician_names?: string;
}

export interface HistoricalApprovalTicket {
  ticket_id: string;
  ticket_number: number;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  created_at: string;
  completed_at: string;
  completed_by_id: string;
  completed_by_name: string;
  approval_status: string;
  approved_at: string;
  approved_by_id: string;
  approved_by_name: string;
  requires_supervisor_approval: boolean;
  service_names: string;
}

export interface ApprovalStatistics {
  total_closed: number;
  pending_approval: number;
  approved: number;
  auto_approved: number;
  rejected: number;
  requires_review: number;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseUnit {
  id: string;
  store_id: string;
  item_id: string;
  unit_name: string;
  multiplier: number;
  is_default: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductPreference {
  id: string;
  store_id: string;
  item_id: string;
  last_used_purchase_unit_id?: string;
  last_purchase_cost: number;
  last_used_at: string;
  updated_by_id?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  store_id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  quantity_on_hand: number;
  reorder_level: number;
  unit_cost: number;
  brand?: string;
  supplier: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  store_id: string;
  transaction_type: 'in' | 'out';
  transaction_number: string;
  requested_by_id: string;
  recipient_id?: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  requires_recipient_approval: boolean;
  requires_manager_approval: boolean;
  recipient_approved: boolean;
  recipient_approved_at?: string;
  recipient_approved_by_id?: string;
  manager_approved: boolean;
  manager_approved_at?: string;
  manager_approved_by_id?: string;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransactionItem {
  id: string;
  transaction_id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  notes: string;
  created_at: string;
}

export interface InventoryTransactionWithDetails extends InventoryTransaction {
  requested_by_name?: string;
  recipient_name?: string;
  items?: InventoryTransactionItemWithDetails[];
}

export interface InventoryTransactionItemWithDetails extends InventoryTransactionItem {
  item_name?: string;
  item_unit?: string;
  purchase_unit_name?: string;
  purchase_quantity?: number;
  purchase_unit_price?: number;
}

export interface ItemTransactionHistory {
  transaction_id: string;
  transaction_number: string;
  transaction_type: 'in' | 'out';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  purchase_unit_name: string;
  purchase_quantity: number;
  purchase_unit_price: number;
  quantity: number;
  unit_cost: number;
  notes: string;
}

export interface TransactionDetail {
  id: string;
  transaction_number: string;
  transaction_type: 'in' | 'out';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  requested_by_id: string;
  requested_by_name: string;
  recipient_id?: string;
  recipient_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  invoice_reference?: string;
  notes: string;
  requires_recipient_approval: boolean;
  requires_manager_approval: boolean;
  recipient_approved: boolean;
  recipient_approved_at?: string;
  recipient_approved_by_name?: string;
  manager_approved: boolean;
  manager_approved_at?: string;
  manager_approved_by_name?: string;
  rejection_reason?: string;
  items: TransactionDetailItem[];
}

export interface TransactionDetailItem {
  id: string;
  item_id: string;
  item_name: string;
  purchase_unit_name?: string;
  purchase_quantity?: number;
  purchase_unit_price?: number;
  quantity: number;
  unit_cost: number;
  notes: string;
}

export interface PendingInventoryApproval {
  id: string;
  transaction_number: string;
  transaction_type: 'in' | 'out';
  requested_by_id: string;
  requested_by_name: string;
  recipient_id: string | null;
  recipient_name: string;
  notes: string;
  status: string;
  requires_recipient_approval: boolean;
  requires_manager_approval: boolean;
  recipient_approved: boolean;
  manager_approved: boolean;
  created_at: string;
  item_count: number;
  total_value: number;
}

export interface InventoryPurchaseLot {
  id: string;
  lot_number: string;
  store_id: string;
  item_id: string;
  supplier_id?: string;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  purchase_date: string;
  expiration_date?: string;
  batch_number?: string;
  invoice_reference?: string;
  notes: string;
  status: 'active' | 'depleted' | 'expired' | 'archived';
  created_by_id?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryPurchaseLotWithDetails extends InventoryPurchaseLot {
  item?: InventoryItem;
  item_name?: string;
  supplier_name?: string;
  created_by_name?: string;
}

export interface EmployeeInventory {
  id: string;
  employee_id: string;
  store_id: string;
  item_id: string;
  quantity_on_hand: number;
  total_value: number;
  last_audit_date?: string;
  last_audit_variance?: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeInventoryLotDetail {
  id: string;
  lot_id: string;
  lot_number: string;
  quantity: number;
  unit_cost: number;
  distributed_date: string;
  purchase_date: string;
  invoice_reference?: string;
  supplier_name?: string;
  status: string;
  quantity_received: number;
}

export interface EmployeeInventoryWithDetails extends EmployeeInventory {
  item?: InventoryItem;
  item_name?: string;
  item_category?: string;
  item_unit?: string;
  employee_name?: string;
  average_cost?: number;
  lot_count?: number;
  lots?: EmployeeInventoryLotDetail[];
}

export interface EmployeeInventoryLot {
  id: string;
  employee_id: string;
  store_id: string;
  item_id: string;
  lot_id: string;
  quantity: number;
  unit_cost: number;
  distributed_date: string;
  expected_depletion_date?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryDistribution {
  id: string;
  distribution_number: string;
  store_id: string;
  item_id: string;
  lot_id: string;
  from_type: 'store' | 'employee';
  from_employee_id?: string;
  to_employee_id: string;
  quantity: number;
  unit_cost: number;
  distribution_date: string;
  expected_return_date?: string;
  actual_return_date?: string;
  status: 'pending' | 'acknowledged' | 'in_use' | 'returned' | 'consumed' | 'cancelled';
  condition_notes: string;
  distributed_by_id: string;
  acknowledged_by_signature?: string;
  acknowledged_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryDistributionWithDetails extends InventoryDistribution {
  item_name?: string;
  lot_number?: string;
  to_employee_name?: string;
  from_employee_name?: string;
  distributed_by_name?: string;
}

export interface InventoryAudit {
  id: string;
  audit_number: string;
  store_id: string;
  audit_type: 'full_store' | 'employee_specific' | 'spot_check' | 'cycle_count';
  employee_id?: string;
  audit_date: string;
  audited_by_id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'approved';
  total_variance_value: number;
  notes: string;
  approved_by_id?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryAuditWithDetails extends InventoryAudit {
  employee_name?: string;
  audited_by_name?: string;
  approved_by_name?: string;
  item_count?: number;
}

export interface InventoryAuditItem {
  id: string;
  audit_id: string;
  item_id: string;
  expected_quantity: number;
  actual_quantity: number;
  variance_value: number;
  unit_cost: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryAuditItemWithDetails extends InventoryAuditItem {
  item_name?: string;
  variance?: number;
}

export interface EndOfDayRecord {
  id: string;
  store_id: string;
  date: string;
  opening_cash_amount: number;
  bill_100: number;
  bill_50: number;
  bill_20: number;
  bill_10: number;
  bill_5: number;
  bill_2: number;
  bill_1: number;
  coin_25: number;
  coin_10: number;
  coin_5: number;
  closing_cash_amount: number;
  closing_bill_100: number;
  closing_bill_50: number;
  closing_bill_20: number;
  closing_bill_10: number;
  closing_bill_5: number;
  closing_bill_2: number;
  closing_bill_1: number;
  closing_coin_25: number;
  closing_coin_10: number;
  closing_coin_5: number;
  notes: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export type CashTransactionType = 'cash_in' | 'cash_out' | 'cash_payout';
export type CashTransactionStatus = 'pending_approval' | 'approved' | 'rejected';

export interface CashTransaction {
  id: string;
  store_id: string;
  date: string;
  transaction_type: CashTransactionType;
  amount: number;
  description: string;
  category?: string;
  created_by_id: string;
  status: CashTransactionStatus;
  requires_manager_approval: boolean;
  manager_approved: boolean;
  manager_approved_by_id?: string;
  manager_approved_at?: string;
  rejection_reason?: string;
  last_edited_by_id?: string;
  last_edited_at?: string;
  created_at: string;
  updated_at: string;
  // Denomination fields for cash count
  bill_100?: number;
  bill_50?: number;
  bill_20?: number;
  bill_10?: number;
  bill_5?: number;
  bill_2?: number;
  bill_1?: number;
  coin_25?: number;
  coin_10?: number;
  coin_5?: number;
}

export interface CashTransactionWithDetails extends CashTransaction {
  created_by_name?: string;
  manager_approved_by_name?: string;
}

export interface PendingCashTransactionApproval {
  transaction_id: string;
  transaction_type: CashTransactionType;
  amount: number;
  description: string;
  category?: string;
  date: string;
  created_by_name: string;
  created_by_id: string;
  created_by_role: string;
  created_at: string;
  requires_manager_approval: boolean;
}

export interface SafeBalanceHistory {
  id: string;
  store_id: string;
  date: string;
  opening_balance: number;
  closing_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  created_by_id: string;
  updated_by_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SafeBalanceSummary {
  opening_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  closing_balance: number;
}

export interface SafeTransaction {
  transaction_date: string;
  transaction_type: 'deposit' | 'withdrawal';
  amount: number;
  description: string;
  running_balance: number;
  created_by_name: string;
  created_at: string;
  status: string;
}

// Cash Transaction Change Proposals
export type CashTransactionChangeProposalStatus = 'pending' | 'approved' | 'rejected';

export interface CashTransactionChangeProposal {
  id: string;
  cash_transaction_id: string;
  store_id: string;
  current_amount: number;
  current_category: string | null;
  current_description: string;
  current_date: string;
  proposed_amount: number | null;
  proposed_category: string | null;
  proposed_description: string | null;
  proposed_date: string | null;
  is_deletion_request: boolean;
  reason_comment: string;
  status: CashTransactionChangeProposalStatus;
  created_by_employee_id: string;
  reviewed_by_employee_id: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingCashTransactionChangeProposal {
  proposal_id: string;
  cash_transaction_id: string;
  transaction_type: CashTransactionType;
  current_amount: number;
  current_category: string | null;
  current_description: string;
  current_date: string;
  proposed_amount: number | null;
  proposed_category: string | null;
  proposed_description: string | null;
  proposed_date: string | null;
  is_deletion_request: boolean;
  reason_comment: string;
  created_by_name: string;
  created_by_id: string;
  created_at: string;
}

export type ViolationReportStatus = 'collecting_responses' | 'pending_approval' | 'approved' | 'rejected' | 'expired';
export type ViolationDecision = 'violation_confirmed' | 'no_violation';
export type ViolationActionType = 'none' | 'warning' | 'written_warning' | 'queue_removal' | 'suspension';

export interface ViolationResponse {
  employee_id: string;
  employee_name: string;
  response: boolean;
  response_notes: string | null;
  responded_at: string;
}

export interface PendingViolationResponse {
  report_id: string;
  reported_employee_id: string;
  reported_employee_name: string;
  reporter_employee_id: string;
  reporter_employee_name: string;
  violation_description: string;
  violation_date: string;
  total_responses_required: number;
  total_responses_received: number;
  expires_at: string;
  created_at: string;
  min_votes_required: number;
  votes_violation_confirmed: number;
}

export interface ViolationReportForApproval {
  report_id: string;
  reported_employee_id: string;
  reported_employee_name: string;
  reporter_employee_id: string;
  reporter_employee_name: string;
  violation_description: string;
  violation_date: string;
  total_responses: number;
  votes_for_violation: number;
  votes_against_violation: number;
  response_details: ViolationResponse[];
  created_at: string;
  status: ViolationReportStatus;
  expires_at?: string;
  votes_violation_confirmed: number;
  min_votes_required: number;
  threshold_met: boolean;
  insufficient_responders: boolean;
}

// Client Management Types
export interface Client {
  id: string;
  store_id: string;
  name: string;
  phone_number: string;
  notes: string;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  blacklist_date: string | null;
  blacklisted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientColorHistory {
  id: string;
  client_id: string;
  ticket_id: string | null;
  color: string;
  service_type: string | null;
  applied_date: string;
  created_at: string;
}

export interface ClientColorHistoryWithDetails extends ClientColorHistory {
  ticket_date: string | null;
  services: Array<{
    name: string;
    employee_name: string;
  }>;
}

export interface ClientWithStats extends Client {
  last_visit?: string;
  total_visits?: number;
  last_color?: string;
  blacklisted_by_name?: string;
}

export interface ClientLookupResult {
  client: Client | null;
  lastColor: ClientColorHistory | null;
  totalVisits: number;
  lastVisit: string | null;
}
