export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_versions: {
        Row: {
          build_hash: string
          created_at: string | null
          deployed_at: string | null
          id: string
          is_active: boolean | null
          release_notes: string | null
          updated_at: string | null
          version_number: string
        }
        Insert: {
          build_hash: string
          created_at?: string | null
          deployed_at?: string | null
          id?: string
          is_active?: boolean | null
          release_notes?: string | null
          updated_at?: string | null
          version_number: string
        }
        Update: {
          build_hash?: string
          created_at?: string | null
          deployed_at?: string | null
          id?: string
          is_active?: boolean | null
          release_notes?: string | null
          updated_at?: string | null
          version_number?: string
        }
        Relationships: []
      }
      approval_status_correction_audit: {
        Row: {
          approval_deadline: string | null
          approved_at: string | null
          approved_by: string | null
          closed_at: string | null
          correction_reason: string | null
          correction_timestamp: string | null
          hours_after_deadline: number | null
          id: string
          new_approval_status: string
          original_approval_status: string
          ticket_id: string
          ticket_no: string
        }
        Insert: {
          approval_deadline?: string | null
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          correction_reason?: string | null
          correction_timestamp?: string | null
          hours_after_deadline?: number | null
          id?: string
          new_approval_status: string
          original_approval_status: string
          ticket_id: string
          ticket_no: string
        }
        Update: {
          approval_deadline?: string | null
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          correction_reason?: string | null
          correction_timestamp?: string | null
          hours_after_deadline?: number | null
          id?: string
          new_approval_status?: string
          original_approval_status?: string
          ticket_id?: string
          ticket_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_status_correction_audit_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_status_correction_audit_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "pending_approval_debug"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_status_correction_audit_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "sale_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_change_proposals: {
        Row: {
          attendance_record_id: string
          created_at: string
          current_check_in_time: string
          current_check_out_time: string | null
          employee_id: string
          id: string
          proposed_check_in_time: string | null
          proposed_check_out_time: string | null
          reason_comment: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by_employee_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attendance_record_id: string
          created_at?: string
          current_check_in_time: string
          current_check_out_time?: string | null
          employee_id: string
          id?: string
          proposed_check_in_time?: string | null
          proposed_check_out_time?: string | null
          reason_comment: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by_employee_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attendance_record_id?: string
          created_at?: string
          current_check_in_time?: string
          current_check_out_time?: string | null
          employee_id?: string
          id?: string
          proposed_check_in_time?: string | null
          proposed_check_out_time?: string | null
          reason_comment?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by_employee_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_change_proposals_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_change_proposals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_change_proposals_reviewed_by_employee_id_fkey"
            columns: ["reviewed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_comments: {
        Row: {
          attendance_record_id: string
          comment: string
          created_at: string | null
          employee_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          attendance_record_id: string
          comment: string
          created_at?: string | null
          employee_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          attendance_record_id?: string
          comment?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_comments_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_comments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          created_at: string | null
          employee_id: string
          id: string
          last_activity_time: string | null
          notes: string | null
          pay_type: string
          status: string
          store_id: string
          total_hours: number | null
          updated_at: string | null
          work_date: string
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          last_activity_time?: string | null
          notes?: string | null
          pay_type: string
          status?: string
          store_id: string
          total_hours?: number | null
          updated_at?: string | null
          work_date?: string
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          last_activity_time?: string | null
          notes?: string | null
          pay_type?: string
          status?: string
          store_id?: string
          total_hours?: number | null
          updated_at?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_approval_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          executed_at: string
          id: string
          result: Json | null
          source: string
          stores_processed: string[] | null
          tickets_approved: number
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string
          id?: string
          result?: Json | null
          source?: string
          stores_processed?: string[] | null
          tickets_approved?: number
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string
          id?: string
          result?: Json | null
          source?: string
          stores_processed?: string[] | null
          tickets_approved?: number
        }
        Relationships: []
      }
      cash_transaction_change_proposals: {
        Row: {
          cash_transaction_id: string
          created_at: string
          created_by_employee_id: string
          current_amount: number
          current_category: string | null
          current_date: string
          current_description: string
          id: string
          is_deletion_request: boolean
          proposed_amount: number | null
          proposed_category: string | null
          proposed_date: string | null
          proposed_description: string | null
          reason_comment: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by_employee_id: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          cash_transaction_id: string
          created_at?: string
          created_by_employee_id: string
          current_amount: number
          current_category?: string | null
          current_date: string
          current_description: string
          id?: string
          is_deletion_request?: boolean
          proposed_amount?: number | null
          proposed_category?: string | null
          proposed_date?: string | null
          proposed_description?: string | null
          reason_comment: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by_employee_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          cash_transaction_id?: string
          created_at?: string
          created_by_employee_id?: string
          current_amount?: number
          current_category?: string | null
          current_date?: string
          current_description?: string
          id?: string
          is_deletion_request?: boolean
          proposed_amount?: number | null
          proposed_category?: string | null
          proposed_date?: string | null
          proposed_description?: string | null
          reason_comment?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by_employee_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transaction_change_proposals_cash_transaction_id_fkey"
            columns: ["cash_transaction_id"]
            isOneToOne: false
            referencedRelation: "cash_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transaction_change_proposals_created_by_employee_id_fkey"
            columns: ["created_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transaction_change_proposals_reviewed_by_employee_id_fkey"
            columns: ["reviewed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transaction_change_proposals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transaction_edit_history: {
        Row: {
          created_at: string | null
          edit_reason: string | null
          edited_at: string
          edited_by_id: string
          id: string
          new_amount: number | null
          new_category: string | null
          new_description: string | null
          old_amount: number | null
          old_category: string | null
          old_description: string | null
          transaction_id: string
        }
        Insert: {
          created_at?: string | null
          edit_reason?: string | null
          edited_at?: string
          edited_by_id: string
          id?: string
          new_amount?: number | null
          new_category?: string | null
          new_description?: string | null
          old_amount?: number | null
          old_category?: string | null
          old_description?: string | null
          transaction_id: string
        }
        Update: {
          created_at?: string | null
          edit_reason?: string | null
          edited_at?: string
          edited_by_id?: string
          id?: string
          new_amount?: number | null
          new_category?: string | null
          new_description?: string | null
          old_amount?: number | null
          old_category?: string | null
          old_description?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transaction_edit_history_edited_by_id_fkey"
            columns: ["edited_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transaction_edit_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "cash_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          amount: number
          bill_1: number
          bill_10: number
          bill_100: number
          bill_2: number
          bill_20: number
          bill_5: number
          bill_50: number
          category: string | null
          coin_10: number
          coin_25: number
          coin_5: number
          created_at: string
          created_by_id: string
          date: string
          description: string
          id: string
          last_edited_at: string | null
          last_edited_by_id: string | null
          manager_approved: boolean
          manager_approved_at: string | null
          manager_approved_by_id: string | null
          rejection_reason: string | null
          requires_manager_approval: boolean
          status: string
          store_id: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          bill_1?: number
          bill_10?: number
          bill_100?: number
          bill_2?: number
          bill_20?: number
          bill_5?: number
          bill_50?: number
          category?: string | null
          coin_10?: number
          coin_25?: number
          coin_5?: number
          created_at?: string
          created_by_id: string
          date?: string
          description: string
          id?: string
          last_edited_at?: string | null
          last_edited_by_id?: string | null
          manager_approved?: boolean
          manager_approved_at?: string | null
          manager_approved_by_id?: string | null
          rejection_reason?: string | null
          requires_manager_approval?: boolean
          status?: string
          store_id: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bill_1?: number
          bill_10?: number
          bill_100?: number
          bill_2?: number
          bill_20?: number
          bill_5?: number
          bill_50?: number
          category?: string | null
          coin_10?: number
          coin_25?: number
          coin_5?: number
          created_at?: string
          created_by_id?: string
          date?: string
          description?: string
          id?: string
          last_edited_at?: string | null
          last_edited_by_id?: string | null
          manager_approved?: boolean
          manager_approved_at?: string | null
          manager_approved_by_id?: string | null
          rejection_reason?: string | null
          requires_manager_approval?: boolean
          status?: string
          store_id?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_last_edited_by_id_fkey"
            columns: ["last_edited_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_manager_approved_by_id_fkey"
            columns: ["manager_approved_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_inventory: {
        Row: {
          created_at: string | null
          employee_id: string
          id: string
          last_audit_date: string | null
          last_audit_variance: number | null
          master_item_id: string
          notes: string | null
          quantity_on_hand: number
          store_id: string
          total_value: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          id?: string
          last_audit_date?: string | null
          last_audit_variance?: number | null
          master_item_id: string
          notes?: string | null
          quantity_on_hand?: number
          store_id: string
          total_value?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          id?: string
          last_audit_date?: string | null
          last_audit_variance?: number | null
          master_item_id?: string
          notes?: string | null
          quantity_on_hand?: number
          store_id?: string
          total_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_inventory_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_inventory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_inventory_lots: {
        Row: {
          created_at: string | null
          distributed_date: string
          employee_id: string
          expected_depletion_date: string | null
          id: string
          lot_id: string
          master_item_id: string
          quantity: number
          store_id: string
          unit_cost: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          distributed_date?: string
          employee_id: string
          expected_depletion_date?: string | null
          id?: string
          lot_id: string
          master_item_id: string
          quantity: number
          store_id: string
          unit_cost: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          distributed_date?: string
          employee_id?: string
          expected_depletion_date?: string | null
          id?: string
          lot_id?: string
          master_item_id?: string
          quantity?: number
          store_id?: string
          unit_cost?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_inventory_lots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_inventory_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_purchase_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_inventory_lots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_services: {
        Row: {
          created_at: string | null
          employee_id: string
          id: string
          service_id: string
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          id?: string
          service_id: string
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_services_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_stores: {
        Row: {
          created_at: string | null
          employee_id: string
          store_id: string
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          store_id: string
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_stores_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          attendance_display: boolean | null
          can_reset_pin: boolean | null
          created_at: string | null
          display_name: string
          id: string
          last_pin_change: string | null
          legal_name: string
          notes: string | null
          pay_type: string | null
          payout_commission_pct: number | null
          payout_flat_per_service: number | null
          payout_hourly_rate: number | null
          payout_rule_type: string | null
          pin_code_hash: string | null
          pin_temp: string | null
          role: string[] | null
          role_permission: Database["public"]["Enums"]["role_permission_type"]
          status: string
          store_id: string | null
          tip_paired_enabled: boolean | null
          tip_report_show_details: boolean | null
          updated_at: string | null
          weekly_schedule: Json | null
        }
        Insert: {
          attendance_display?: boolean | null
          can_reset_pin?: boolean | null
          created_at?: string | null
          display_name: string
          id?: string
          last_pin_change?: string | null
          legal_name: string
          notes?: string | null
          pay_type?: string | null
          payout_commission_pct?: number | null
          payout_flat_per_service?: number | null
          payout_hourly_rate?: number | null
          payout_rule_type?: string | null
          pin_code_hash?: string | null
          pin_temp?: string | null
          role?: string[] | null
          role_permission: Database["public"]["Enums"]["role_permission_type"]
          status?: string
          store_id?: string | null
          tip_paired_enabled?: boolean | null
          tip_report_show_details?: boolean | null
          updated_at?: string | null
          weekly_schedule?: Json | null
        }
        Update: {
          attendance_display?: boolean | null
          can_reset_pin?: boolean | null
          created_at?: string | null
          display_name?: string
          id?: string
          last_pin_change?: string | null
          legal_name?: string
          notes?: string | null
          pay_type?: string | null
          payout_commission_pct?: number | null
          payout_flat_per_service?: number | null
          payout_hourly_rate?: number | null
          payout_rule_type?: string | null
          pin_code_hash?: string | null
          pin_temp?: string | null
          role?: string[] | null
          role_permission?: Database["public"]["Enums"]["role_permission_type"]
          status?: string
          store_id?: string | null
          tip_paired_enabled?: boolean | null
          tip_report_show_details?: boolean | null
          updated_at?: string | null
          weekly_schedule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      function_error_logs: {
        Row: {
          context: string | null
          error_detail: string | null
          error_hint: string | null
          error_message: string
          function_name: string
          id: string
          occurred_at: string
          parameters: Json | null
          store_id: string | null
        }
        Insert: {
          context?: string | null
          error_detail?: string | null
          error_hint?: string | null
          error_message: string
          function_name: string
          id?: string
          occurred_at?: string
          parameters?: Json | null
          store_id?: string | null
        }
        Update: {
          context?: string | null
          error_detail?: string | null
          error_hint?: string | null
          error_message?: string
          function_name?: string
          id?: string
          occurred_at?: string
          parameters?: Json | null
          store_id?: string | null
        }
        Relationships: []
      }
      inventory_approval_audit_log: {
        Row: {
          action_attempted: string
          blocked_reason: string
          created_at: string | null
          employee_id: string
          id: string
          store_id: string
          transaction_id: string
          transaction_number: string
          transaction_type: string
        }
        Insert: {
          action_attempted: string
          blocked_reason?: string
          created_at?: string | null
          employee_id: string
          id?: string
          store_id: string
          transaction_id: string
          transaction_number: string
          transaction_type: string
        }
        Update: {
          action_attempted?: string
          blocked_reason?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          store_id?: string
          transaction_id?: string
          transaction_number?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_approval_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_approval_audit_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_approval_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "inventory_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_audit_items: {
        Row: {
          actual_quantity: number
          audit_id: string
          created_at: string | null
          expected_quantity: number
          id: string
          master_item_id: string
          notes: string | null
          unit_cost: number
          updated_at: string | null
          variance: number | null
          variance_value: number
        }
        Insert: {
          actual_quantity?: number
          audit_id: string
          created_at?: string | null
          expected_quantity?: number
          id?: string
          master_item_id: string
          notes?: string | null
          unit_cost?: number
          updated_at?: string | null
          variance?: number | null
          variance_value?: number
        }
        Update: {
          actual_quantity?: number
          audit_id?: string
          created_at?: string | null
          expected_quantity?: number
          id?: string
          master_item_id?: string
          notes?: string | null
          unit_cost?: number
          updated_at?: string | null
          variance?: number | null
          variance_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_audit_items_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "inventory_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_audits: {
        Row: {
          approved_at: string | null
          approved_by_id: string | null
          audit_date: string
          audit_number: string
          audit_type: string
          audited_by_id: string
          created_at: string | null
          employee_id: string | null
          id: string
          notes: string | null
          status: string
          store_id: string
          total_variance_value: number | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_id?: string | null
          audit_date?: string
          audit_number: string
          audit_type: string
          audited_by_id: string
          created_at?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          store_id: string
          total_variance_value?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_id?: string | null
          audit_date?: string
          audit_number?: string
          audit_type?: string
          audited_by_id?: string
          created_at?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          store_id?: string
          total_variance_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_audits_approved_by_id_fkey"
            columns: ["approved_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audits_audited_by_id_fkey"
            columns: ["audited_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_distributions: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by_signature: string | null
          actual_return_date: string | null
          condition_notes: string | null
          created_at: string | null
          distributed_by_id: string
          distribution_date: string
          distribution_number: string
          expected_return_date: string | null
          from_employee_id: string | null
          from_type: string
          id: string
          lot_id: string
          master_item_id: string
          quantity: number
          status: string
          store_id: string
          to_employee_id: string
          unit_cost: number
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_signature?: string | null
          actual_return_date?: string | null
          condition_notes?: string | null
          created_at?: string | null
          distributed_by_id: string
          distribution_date?: string
          distribution_number: string
          expected_return_date?: string | null
          from_employee_id?: string | null
          from_type: string
          id?: string
          lot_id: string
          master_item_id: string
          quantity: number
          status?: string
          store_id: string
          to_employee_id: string
          unit_cost: number
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_signature?: string | null
          actual_return_date?: string | null
          condition_notes?: string | null
          created_at?: string | null
          distributed_by_id?: string
          distribution_date?: string
          distribution_number?: string
          expected_return_date?: string | null
          from_employee_id?: string | null
          from_type?: string
          id?: string
          lot_id?: string
          master_item_id?: string
          quantity?: number
          status?: string
          store_id?: string
          to_employee_id?: string
          unit_cost?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_distributions_distributed_by_id_fkey"
            columns: ["distributed_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_distributions_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_distributions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_purchase_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_distributions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_distributions_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          brand: string | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          quantity_on_hand: number
          reorder_level: number
          store_id: string
          supplier: string | null
          unit: string
          unit_cost: number
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          quantity_on_hand?: number
          reorder_level?: number
          store_id: string
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          quantity_on_hand?: number
          reorder_level?: number
          store_id?: string
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_store_id_fkey1"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_purchase_lots: {
        Row: {
          batch_number: string | null
          created_at: string | null
          created_by_id: string | null
          expiration_date: string | null
          id: string
          invoice_reference: string | null
          lot_number: string
          master_item_id: string
          notes: string | null
          purchase_date: string
          quantity_received: number
          quantity_remaining: number
          status: string
          store_id: string
          supplier_id: string | null
          unit_cost: number
          updated_at: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string | null
          created_by_id?: string | null
          expiration_date?: string | null
          id?: string
          invoice_reference?: string | null
          lot_number: string
          master_item_id: string
          notes?: string | null
          purchase_date?: string
          quantity_received: number
          quantity_remaining: number
          status?: string
          store_id: string
          supplier_id?: string | null
          unit_cost?: number
          updated_at?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string | null
          created_by_id?: string | null
          expiration_date?: string | null
          id?: string
          invoice_reference?: string | null
          lot_number?: string
          master_item_id?: string
          notes?: string | null
          purchase_date?: string
          quantity_received?: number
          quantity_remaining?: number
          status?: string
          store_id?: string
          supplier_id?: string | null
          unit_cost?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchase_lots_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchase_lots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transaction_items: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          lot_id: string | null
          master_item_id: string | null
          notes: string | null
          purchase_quantity: number | null
          purchase_unit_id: string | null
          purchase_unit_multiplier: number | null
          purchase_unit_price: number | null
          quantity: number
          transaction_id: string
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          lot_id?: string | null
          master_item_id?: string | null
          notes?: string | null
          purchase_quantity?: number | null
          purchase_unit_id?: string | null
          purchase_unit_multiplier?: number | null
          purchase_unit_price?: number | null
          quantity: number
          transaction_id: string
          unit_cost: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          lot_id?: string | null
          master_item_id?: string | null
          notes?: string | null
          purchase_quantity?: number | null
          purchase_unit_id?: string | null
          purchase_unit_multiplier?: number | null
          purchase_unit_price?: number | null
          quantity?: number
          transaction_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transaction_items_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_purchase_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transaction_items_purchase_unit_id_fkey"
            columns: ["purchase_unit_id"]
            isOneToOne: false
            referencedRelation: "store_product_purchase_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "inventory_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string | null
          id: string
          invoice_reference: string | null
          manager_approved: boolean | null
          manager_approved_at: string | null
          manager_approved_by_id: string | null
          notes: string | null
          recipient_approved: boolean | null
          recipient_approved_at: string | null
          recipient_approved_by_id: string | null
          recipient_id: string | null
          rejection_reason: string | null
          requested_by_id: string
          requires_manager_approval: boolean | null
          requires_recipient_approval: boolean | null
          status: string
          store_id: string
          supplier_id: string | null
          transaction_number: string
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_reference?: string | null
          manager_approved?: boolean | null
          manager_approved_at?: string | null
          manager_approved_by_id?: string | null
          notes?: string | null
          recipient_approved?: boolean | null
          recipient_approved_at?: string | null
          recipient_approved_by_id?: string | null
          recipient_id?: string | null
          rejection_reason?: string | null
          requested_by_id: string
          requires_manager_approval?: boolean | null
          requires_recipient_approval?: boolean | null
          status?: string
          store_id: string
          supplier_id?: string | null
          transaction_number: string
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_reference?: string | null
          manager_approved?: boolean | null
          manager_approved_at?: string | null
          manager_approved_by_id?: string | null
          notes?: string | null
          recipient_approved?: boolean | null
          recipient_approved_at?: string | null
          recipient_approved_by_id?: string | null
          recipient_id?: string | null
          rejection_reason?: string | null
          requested_by_id?: string
          requires_manager_approval?: boolean | null
          requires_recipient_approval?: boolean | null
          status?: string
          store_id?: string
          supplier_id?: string | null
          transaction_number?: string
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_manager_approved_by_id_fkey"
            columns: ["manager_approved_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_recipient_approved_by_id_fkey"
            columns: ["recipient_approved_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_requested_by_id_fkey"
            columns: ["requested_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_definitions: {
        Row: {
          action_name: string
          created_at: string | null
          description: string
          display_name: string
          display_order: number | null
          id: string
          is_critical: boolean | null
          module_name: string
          permission_key: string
        }
        Insert: {
          action_name: string
          created_at?: string | null
          description?: string
          display_name: string
          display_order?: number | null
          id?: string
          is_critical?: boolean | null
          module_name: string
          permission_key: string
        }
        Update: {
          action_name?: string
          created_at?: string | null
          description?: string
          display_name?: string
          display_order?: number | null
          id?: string
          is_critical?: boolean | null
          module_name?: string
          permission_key?: string
        }
        Relationships: []
      }
      queue_removals_log: {
        Row: {
          cooldown_expires_at: string
          created_at: string | null
          employee_id: string
          id: string
          notes: string | null
          reason: string
          removed_at: string
          removed_by_employee_id: string
          store_id: string
        }
        Insert: {
          cooldown_expires_at: string
          created_at?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          reason: string
          removed_at?: string
          removed_by_employee_id: string
          store_id: string
        }
        Update: {
          cooldown_expires_at?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          reason?: string
          removed_at?: string
          removed_by_employee_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_removals_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_removals_log_removed_by_employee_id_fkey"
            columns: ["removed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_removals_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_violation_actions: {
        Row: {
          action_details: string | null
          action_type: string
          created_at: string
          created_by_employee_id: string
          id: string
          violation_report_id: string
        }
        Insert: {
          action_details?: string | null
          action_type: string
          created_at?: string
          created_by_employee_id: string
          id?: string
          violation_report_id: string
        }
        Update: {
          action_details?: string | null
          action_type?: string
          created_at?: string
          created_by_employee_id?: string
          id?: string
          violation_report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_violation_actions_created_by_employee_id_fkey"
            columns: ["created_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_violation_actions_violation_report_id_fkey"
            columns: ["violation_report_id"]
            isOneToOne: false
            referencedRelation: "queue_violation_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_violation_reports: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          manager_decision: string | null
          manager_notes: string | null
          queue_position_claimed: number | null
          reported_employee_id: string
          reporter_employee_id: string
          required_responder_ids: string[] | null
          reviewed_at: string | null
          reviewed_by_employee_id: string | null
          status: string
          store_id: string
          total_responses_received: number
          total_responses_required: number
          violation_date: string
          violation_description: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          manager_decision?: string | null
          manager_notes?: string | null
          queue_position_claimed?: number | null
          reported_employee_id: string
          reporter_employee_id: string
          required_responder_ids?: string[] | null
          reviewed_at?: string | null
          reviewed_by_employee_id?: string | null
          status?: string
          store_id: string
          total_responses_received?: number
          total_responses_required?: number
          violation_date: string
          violation_description: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          manager_decision?: string | null
          manager_notes?: string | null
          queue_position_claimed?: number | null
          reported_employee_id?: string
          reporter_employee_id?: string
          required_responder_ids?: string[] | null
          reviewed_at?: string | null
          reviewed_by_employee_id?: string | null
          status?: string
          store_id?: string
          total_responses_received?: number
          total_responses_required?: number
          violation_date?: string
          violation_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_violation_reports_reported_employee_id_fkey"
            columns: ["reported_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_violation_reports_reporter_employee_id_fkey"
            columns: ["reporter_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_violation_reports_reviewed_by_employee_id_fkey"
            columns: ["reviewed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_violation_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_violation_responses: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          responded_at: string
          response: boolean
          response_notes: string | null
          violation_report_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          responded_at?: string
          response: boolean
          response_notes?: string | null
          violation_report_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          responded_at?: string
          response?: boolean
          response_notes?: string | null
          violation_report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_violation_responses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_violation_responses_violation_report_id_fkey"
            columns: ["violation_report_id"]
            isOneToOne: false
            referencedRelation: "queue_violation_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_enabled: boolean | null
          permission_key: string
          role_name: string
          store_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_enabled?: boolean | null
          permission_key: string
          role_name: string
          store_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_enabled?: boolean | null
          permission_key?: string
          role_name?: string
          store_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission_definitions"
            referencedColumns: ["permission_key"]
          },
          {
            foreignKeyName: "role_permissions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions_audit: {
        Row: {
          change_reason: string | null
          changed_at: string | null
          changed_by: string | null
          id: string
          new_value: boolean | null
          old_value: boolean | null
          permission_key: string
          role_name: string
          store_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_value?: boolean | null
          old_value?: boolean | null
          permission_key: string
          role_name: string
          store_id: string
        }
        Update: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_value?: boolean | null
          old_value?: boolean | null
          permission_key?: string
          role_name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_audit_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      safe_balance_history: {
        Row: {
          closing_balance: number
          created_at: string
          created_by_id: string
          date: string
          id: string
          opening_balance: number
          store_id: string
          total_deposits: number
          total_withdrawals: number
          updated_at: string
          updated_by_id: string | null
        }
        Insert: {
          closing_balance?: number
          created_at?: string
          created_by_id: string
          date?: string
          id?: string
          opening_balance?: number
          store_id: string
          total_deposits?: number
          total_withdrawals?: number
          updated_at?: string
          updated_by_id?: string | null
        }
        Update: {
          closing_balance?: number
          created_at?: string
          created_by_id?: string
          date?: string
          id?: string
          opening_balance?: number
          store_id?: string
          total_deposits?: number
          total_withdrawals?: number
          updated_at?: string
          updated_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safe_balance_history_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safe_balance_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safe_balance_history_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_tickets: {
        Row: {
          approval_deadline: string | null
          approval_performer_id: string | null
          approval_reason: string | null
          approval_required_level: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          closed_at: string | null
          closed_by: string | null
          closed_by_roles: Json | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_type: string | null
          discount: number | null
          id: string
          location: string | null
          notes: string | null
          opened_at: string | null
          opened_by_role: string | null
          payment_method: string | null
          performed_and_closed_by_same_person: boolean | null
          rejection_reason: string | null
          requires_admin_review: boolean | null
          requires_higher_approval: boolean | null
          reviewed_by_receptionist: boolean | null
          saved_by: string | null
          store_id: string | null
          ticket_date: string
          ticket_no: string
          total: number | null
          updated_at: string | null
        }
        Insert: {
          approval_deadline?: string | null
          approval_performer_id?: string | null
          approval_reason?: string | null
          approval_required_level?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_roles?: Json | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_type?: string | null
          discount?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          opened_at?: string | null
          opened_by_role?: string | null
          payment_method?: string | null
          performed_and_closed_by_same_person?: boolean | null
          rejection_reason?: string | null
          requires_admin_review?: boolean | null
          requires_higher_approval?: boolean | null
          reviewed_by_receptionist?: boolean | null
          saved_by?: string | null
          store_id?: string | null
          ticket_date?: string
          ticket_no: string
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          approval_deadline?: string | null
          approval_performer_id?: string | null
          approval_reason?: string | null
          approval_required_level?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_roles?: Json | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_type?: string | null
          discount?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          opened_at?: string | null
          opened_by_role?: string | null
          payment_method?: string | null
          performed_and_closed_by_same_person?: boolean | null
          rejection_reason?: string | null
          requires_admin_review?: boolean | null
          requires_higher_approval?: boolean | null
          reviewed_by_receptionist?: boolean | null
          saved_by?: string | null
          store_id?: string | null
          ticket_date?: string
          ticket_no?: string
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_tickets_approval_performer_id_fkey"
            columns: ["approval_performer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_tickets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_tickets_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_tickets_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_tickets_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean | null
          archived: boolean
          base_price: number
          category: string | null
          code: string
          created_at: string | null
          duration_min: number | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          archived?: boolean
          base_price?: number
          category?: string | null
          code: string
          created_at?: string | null
          duration_min?: number | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          archived?: boolean
          base_price?: number
          category?: string | null
          code?: string
          created_at?: string | null
          duration_min?: number | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      store_product_preferences: {
        Row: {
          created_at: string | null
          id: string
          last_purchase_cost: number | null
          last_used_at: string | null
          last_used_purchase_unit_id: string | null
          master_item_id: string
          store_id: string
          updated_at: string | null
          updated_by_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_purchase_cost?: number | null
          last_used_at?: string | null
          last_used_purchase_unit_id?: string | null
          master_item_id: string
          store_id: string
          updated_at?: string | null
          updated_by_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_purchase_cost?: number | null
          last_used_at?: string | null
          last_used_purchase_unit_id?: string | null
          master_item_id?: string
          store_id?: string
          updated_at?: string | null
          updated_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_preferences_last_used_purchase_unit_id_fkey"
            columns: ["last_used_purchase_unit_id"]
            isOneToOne: false
            referencedRelation: "store_product_purchase_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_preferences_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_preferences_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      store_product_purchase_units: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_default: boolean
          master_item_id: string
          multiplier: number
          store_id: string
          unit_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_default?: boolean
          master_item_id: string
          multiplier: number
          store_id: string
          unit_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_default?: boolean
          master_item_id?: string
          multiplier?: number
          store_id?: string
          unit_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_purchase_units_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_service_categories: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_service_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_services: {
        Row: {
          active: boolean
          archived: boolean
          base_price: number
          category: string
          code: string
          created_at: string
          duration_min: number
          id: string
          name: string
          price: number
          service_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived?: boolean
          base_price?: number
          category?: string
          code: string
          created_at?: string
          duration_min?: number
          id?: string
          name: string
          price?: number
          service_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived?: boolean
          base_price?: number
          category?: string
          code?: string
          created_at?: string
          duration_min?: number
          id?: string
          name?: string
          price?: number
          service_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_services_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean
          closing_hours: Json | null
          code: string
          created_at: string
          id: string
          is_headquarters: boolean
          name: string
          opening_hours: Json | null
          opening_time: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          closing_hours?: Json | null
          code: string
          created_at?: string
          id?: string
          is_headquarters?: boolean
          name: string
          opening_hours?: Json | null
          opening_time?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          closing_hours?: Json | null
          code?: string
          created_at?: string
          id?: string
          is_headquarters?: boolean
          name?: string
          opening_hours?: Json | null
          opening_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      technician_ready_queue: {
        Row: {
          created_at: string | null
          current_open_ticket_id: string | null
          employee_id: string
          id: string
          ready_at: string
          status: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_open_ticket_id?: string | null
          employee_id: string
          id?: string
          ready_at?: string
          status?: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_open_ticket_id?: string | null
          employee_id?: string
          id?: string
          ready_at?: string
          status?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_ready_queue_current_open_ticket_id_fkey"
            columns: ["current_open_ticket_id"]
            isOneToOne: false
            referencedRelation: "pending_approval_debug"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_ready_queue_current_open_ticket_id_fkey"
            columns: ["current_open_ticket_id"]
            isOneToOne: false
            referencedRelation: "sale_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_ready_queue_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_ready_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_activity_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          description: string
          employee_id: string | null
          id: string
          ticket_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          description: string
          employee_id?: string | null
          id?: string
          ticket_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          description?: string
          employee_id?: string | null
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activity_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_activity_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "pending_approval_debug"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_activity_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sale_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_items: {
        Row: {
          addon_details: string | null
          addon_price: number | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          custom_service_name: string | null
          discount_amount: number | null
          discount_amount_cash: number | null
          discount_percentage: number | null
          discount_percentage_cash: number | null
          employee_id: string
          id: string
          notes: string | null
          payment_card: number
          payment_cash: number
          payment_gift_card: number
          price_each: number
          qty: number | null
          sale_ticket_id: string
          service_id: string | null
          started_at: string | null
          store_service_id: string
          tip_customer_card: number | null
          tip_customer_cash: number | null
          tip_receptionist: number | null
          updated_at: string | null
        }
        Insert: {
          addon_details?: string | null
          addon_price?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          custom_service_name?: string | null
          discount_amount?: number | null
          discount_amount_cash?: number | null
          discount_percentage?: number | null
          discount_percentage_cash?: number | null
          employee_id: string
          id?: string
          notes?: string | null
          payment_card?: number
          payment_cash?: number
          payment_gift_card?: number
          price_each?: number
          qty?: number | null
          sale_ticket_id: string
          service_id?: string | null
          started_at?: string | null
          store_service_id: string
          tip_customer_card?: number | null
          tip_customer_cash?: number | null
          tip_receptionist?: number | null
          updated_at?: string | null
        }
        Update: {
          addon_details?: string | null
          addon_price?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          custom_service_name?: string | null
          discount_amount?: number | null
          discount_amount_cash?: number | null
          discount_percentage?: number | null
          discount_percentage_cash?: number | null
          employee_id?: string
          id?: string
          notes?: string | null
          payment_card?: number
          payment_cash?: number
          payment_gift_card?: number
          price_each?: number
          qty?: number | null
          sale_ticket_id?: string
          service_id?: string | null
          started_at?: string | null
          store_service_id?: string
          tip_customer_card?: number | null
          tip_customer_cash?: number | null
          tip_receptionist?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_items_sale_ticket_id_fkey"
            columns: ["sale_ticket_id"]
            isOneToOne: false
            referencedRelation: "pending_approval_debug"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_items_sale_ticket_id_fkey"
            columns: ["sale_ticket_id"]
            isOneToOne: false
            referencedRelation: "sale_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_items_store_service_id_fkey"
            columns: ["store_service_id"]
            isOneToOne: false
            referencedRelation: "store_services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pending_approval_debug: {
        Row: {
          approval_reason: string | null
          approval_required_level: string | null
          closed_by_roles: Json | null
          closer_is_performer: boolean | null
          closer_name: string | null
          closer_roles_from_db: string[] | null
          id: string | null
          performed_and_closed_by_same_person: boolean | null
          performer_count: number | null
          performer_names: string | null
          ticket_no: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_store_stock: {
        Args: {
          p_allow_negative?: boolean
          p_item_id: string
          p_quantity_change: number
          p_store_id: string
        }
        Returns: boolean
      }
      approve_cash_transaction_change_proposal: {
        Args: {
          p_proposal_id: string
          p_review_comment?: string
          p_reviewer_employee_id: string
        }
        Returns: Json
      }
      approve_ticket: {
        Args: { p_employee_id: string; p_ticket_id: string }
        Returns: Json
      }
      approve_violation_report: {
        Args: {
          p_action_details?: string
          p_action_type?: string
          p_decision: string
          p_manager_notes?: string
          p_reviewer_employee_id: string
          p_violation_report_id: string
        }
        Returns: Json
      }
      auto_approve_and_log: { Args: never; Returns: undefined }
      auto_approve_expired_tickets: { Args: never; Returns: Json }
      auto_approve_with_monitoring: {
        Args: { p_source?: string }
        Returns: Json
      }
      auto_checkout_employees_by_context: { Args: never; Returns: undefined }
      auto_release_queue_at_closing: { Args: never; Returns: undefined }
      backfill_historical_auto_checkout:
        | {
            Args: never
            Returns: {
              affected_dates: string[]
              records_updated: number
              store_id: string
              store_name: string
            }[]
          }
        | {
            Args: { p_end_date?: string; p_start_date?: string }
            Returns: {
              earliest_date: string
              latest_date: string
              records_processed: number
              records_skipped: number
              records_updated: number
            }[]
          }
      backfill_safe_balance_snapshots: {
        Args: {
          p_employee_id: string
          p_end_date: string
          p_start_date: string
          p_store_id: string
        }
        Returns: {
          date: string
          message: string
          success: boolean
        }[]
      }
      bulk_update_role_permissions: {
        Args: {
          p_employee_id: string
          p_permissions: Json
          p_role_name: string
          p_store_id: string
        }
        Returns: number
      }
      calculate_service_average_duration: {
        Args: { p_store_service_id: string }
        Returns: Json
      }
      calculate_weighted_average_cost: {
        Args: { p_master_item_id: string; p_store_id: string }
        Returns: number
      }
      can_checkin_now: { Args: { p_store_id: string }; Returns: boolean }
      change_employee_pin: {
        Args: { emp_id: string; new_pin: string; old_pin: string }
        Returns: Json
      }
      check_approval_routing: {
        Args: never
        Returns: {
          example_ticket_ids: string[]
          issue_type: string
          ticket_count: number
        }[]
      }
      check_employee_store_access: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: boolean
      }
      check_in_employee: {
        Args: { p_employee_id: string; p_pay_type?: string; p_store_id: string }
        Returns: Json
      }
      check_opening_cash_recorded: {
        Args: { p_date: string; p_store_id: string }
        Returns: boolean
      }
      check_out_employee: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: boolean
      }
      check_previous_unclosed_tickets: {
        Args: { p_store_id: string; p_ticket_date: string }
        Returns: boolean
      }
      check_queue_status: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: Json
      }
      check_ticket_all_services_completed: {
        Args: { p_ticket_id: string }
        Returns: boolean
      }
      clear_store_ready_queue: {
        Args: { p_store_id: string }
        Returns: undefined
      }
      consume_employee_inventory: {
        Args: {
          p_employee_id: string
          p_master_item_id: string
          p_notes?: string
          p_quantity: number
        }
        Returns: Json
      }
      copy_role_permissions: {
        Args: {
          p_employee_id: string
          p_from_role: string
          p_store_id: string
          p_to_role: string
        }
        Returns: number
      }
      create_cash_transaction_change_proposal: {
        Args: {
          p_cash_transaction_id: string
          p_created_by_employee_id?: string
          p_is_deletion_request?: boolean
          p_proposed_amount?: number
          p_proposed_category?: string
          p_proposed_date?: string
          p_proposed_description?: string
          p_reason_comment?: string
        }
        Returns: Json
      }
      create_cash_transaction_with_validation: {
        Args: {
          p_amount: number
          p_bill_1?: number
          p_bill_10?: number
          p_bill_100?: number
          p_bill_2?: number
          p_bill_20?: number
          p_bill_5?: number
          p_bill_50?: number
          p_category: string
          p_coin_10?: number
          p_coin_25?: number
          p_coin_5?: number
          p_created_by_id: string
          p_date: string
          p_description: string
          p_store_id: string
          p_transaction_type: string
        }
        Returns: Json
      }
      create_default_purchase_unit_for_store_item: {
        Args: { p_master_item_id: string; p_store_id: string }
        Returns: string
      }
      create_inventory_transaction_atomic: {
        Args: {
          p_invoice_reference?: string
          p_notes?: string
          p_recipient_id?: string
          p_requested_by_id: string
          p_requires_manager_approval?: boolean
          p_requires_recipient_approval?: boolean
          p_store_id: string
          p_supplier_id?: string
          p_transaction_type: string
        }
        Returns: {
          created_at: string
          id: string
          invoice_reference: string
          manager_approved: boolean
          notes: string
          recipient_approved: boolean
          recipient_id: string
          requested_by_id: string
          requires_manager_approval: boolean
          requires_recipient_approval: boolean
          status: string
          store_id: string
          supplier_id: string
          transaction_number: string
          transaction_type: string
          updated_at: string
        }[]
      }
      create_queue_violation_report:
        | {
            Args: {
              p_queue_position_claimed?: number
              p_reported_employee_id: string
              p_reporter_employee_id: string
              p_store_id: string
              p_violation_description: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_description: string
              p_employee_id: string
              p_reporter_id: string
              p_store_id: string
              p_violation_type: string
            }
            Returns: Json
          }
      distribute_to_employee: {
        Args: {
          p_distributed_by_id: string
          p_item_id: string
          p_notes?: string
          p_quantity: number
          p_store_id: string
          p_to_employee_id: string
        }
        Returns: Json
      }
      expire_old_violation_reports: { Args: never; Returns: undefined }
      expire_violation_reports: { Args: never; Returns: Json }
      find_or_create_global_service: {
        Args: {
          p_base_price: number
          p_category: string
          p_code: string
          p_duration_min: number
          p_name: string
        }
        Returns: string
      }
      generate_audit_number: { Args: { p_store_id: string }; Returns: string }
      generate_distribution_number: {
        Args: { p_store_id: string }
        Returns: string
      }
      generate_lot_number: {
        Args: { p_store_id: string; p_supplier_code?: string }
        Returns: string
      }
      get_all_roles_permissions: { Args: { p_store_id: string }; Returns: Json }
      get_all_violation_reports_for_management: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_search_employee?: string
          p_status?: string
          p_store_id: string
        }
        Returns: {
          action_details: string
          action_type: string
          created_at: string
          decision: string
          expires_at: string
          manager_notes: string
          queue_position: number
          report_id: string
          reported_employee_id: string
          reported_employee_name: string
          reporter_employee_id: string
          reporter_employee_name: string
          responses: Json
          reviewed_at: string
          reviewed_by_id: string
          reviewed_by_name: string
          status: string
          total_required_responders: number
          total_responses: number
          violation_date: string
          violation_description: string
          votes_no_violation: number
          votes_violation: number
        }[]
      }
      get_approval_correction_diagnostics: {
        Args: never
        Returns: {
          auto_approved_correctly: number
          manually_approved_incorrectly: number
          needs_correction: number
          total_tickets: number
        }[]
      }
      get_approval_correction_summary: {
        Args: never
        Returns: {
          corrected_count: number
          correction_timestamp: string
        }[]
      }
      get_approval_statistics: {
        Args: {
          p_end_date?: string
          p_start_date?: string
          p_store_id?: string
        }
        Returns: {
          approved: number
          auto_approved: number
          pending_approval: number
          rejected: number
          requires_review: number
          total_closed: number
        }[]
      }
      get_available_lots_fifo: {
        Args: { p_master_item_id: string; p_store_id: string }
        Returns: {
          expiration_date: string
          lot_id: string
          lot_number: string
          purchase_date: string
          quantity_remaining: number
          unit_cost: number
        }[]
      }
      get_employee_attendance_summary: {
        Args: {
          p_employee_id: string
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          check_in_time: string
          check_out_time: string
          status: string
          store_name: string
          total_hours: number
          work_date: string
        }[]
      }
      get_employee_inventory: {
        Args: { p_employee_id: string }
        Returns: {
          average_cost: number
          category: string
          item_code: string
          item_id: string
          item_name: string
          last_audit_date: string
          last_audit_variance: number
          lot_count: number
          quantity_on_hand: number
          total_value: number
          unit: string
        }[]
      }
      get_employee_inventory_value: {
        Args: { p_employee_id: string }
        Returns: number
      }
      get_employees_working_today: {
        Args: { p_date: string; p_store_id: string }
        Returns: {
          display_name: string
          employee_id: string
          is_checked_in: boolean
          legal_name: string
          queue_position: number
          queue_status: string
        }[]
      }
      get_historical_approvals_for_manager: {
        Args: { p_store_id: string }
        Returns: {
          approval_status: string
          approved_at: string
          approved_by_id: string
          approved_by_name: string
          completed_at: string
          completed_by_id: string
          completed_by_name: string
          created_at: string
          customer_name: string
          customer_phone: string
          requires_supervisor_approval: boolean
          service_names: string
          ticket_id: string
          ticket_number: number
          total_amount: number
        }[]
      }
      get_historical_approvals_for_supervisor: {
        Args: { p_store_id: string }
        Returns: {
          approval_status: string
          approved_at: string
          approved_by_id: string
          approved_by_name: string
          completed_at: string
          completed_by_id: string
          completed_by_name: string
          created_at: string
          customer_name: string
          customer_phone: string
          requires_supervisor_approval: boolean
          service_names: string
          ticket_id: string
          ticket_number: number
          total_amount: number
        }[]
      }
      get_latest_app_version: {
        Args: never
        Returns: {
          build_hash: string
          deployed_at: string
          id: string
          release_notes: string
          version_number: string
        }[]
      }
      get_low_stock_items: {
        Args: { p_store_id: string }
        Returns: {
          category: string
          item_code: string
          item_id: string
          item_name: string
          quantity_needed: number
          quantity_on_hand: number
          reorder_level: number
          unit: string
        }[]
      }
      get_pending_approvals_for_management: {
        Args: { p_store_id: string }
        Returns: {
          approval_deadline: string
          closed_at: string
          closed_by_name: string
          closed_by_roles: Json
          completed_by_name: string
          customer_name: string
          customer_phone: string
          hours_remaining: number
          payment_method: string
          reason: string
          requires_higher_approval: boolean
          service_name: string
          technician_names: string
          ticket_date: string
          ticket_id: string
          ticket_no: string
          tip_customer: number
          tip_receptionist: number
          total: number
        }[]
      }
      get_pending_approvals_for_supervisor: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: {
          approval_deadline: string
          approval_reason: string
          closed_at: string
          closed_by_name: string
          completed_by_name: string
          customer_name: string
          customer_phone: string
          hours_remaining: number
          payment_method: string
          requires_higher_approval: boolean
          service_name: string
          ticket_date: string
          ticket_id: string
          ticket_no: string
          tip_customer: number
          tip_receptionist: number
          total: number
        }[]
      }
      get_pending_approvals_for_technician: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: {
          approval_deadline: string
          approval_reason: string
          closed_at: string
          closed_by_name: string
          completed_by_name: string
          customer_name: string
          customer_phone: string
          hours_remaining: number
          payment_method: string
          requires_higher_approval: boolean
          service_name: string
          ticket_date: string
          ticket_id: string
          ticket_no: string
          tip_customer: number
          tip_receptionist: number
          total: number
        }[]
      }
      get_pending_cash_transaction_approvals: {
        Args: { p_store_id: string }
        Returns: {
          amount: number
          category: string
          created_at: string
          created_by_id: string
          created_by_name: string
          created_by_role: string
          date: string
          description: string
          requires_manager_approval: boolean
          transaction_id: string
          transaction_type: string
        }[]
      }
      get_pending_cash_transaction_change_proposals: {
        Args: { p_store_id: string }
        Returns: {
          cash_transaction_id: string
          created_at: string
          created_by_id: string
          created_by_name: string
          current_amount: number
          current_category: string
          current_date: string
          current_description: string
          is_deletion_request: boolean
          proposal_id: string
          proposed_amount: number
          proposed_category: string
          proposed_date: string
          proposed_description: string
          reason_comment: string
          transaction_type: string
        }[]
      }
      get_pending_cash_transaction_change_proposals_count: {
        Args: { p_store_id: string }
        Returns: number
      }
      get_pending_inventory_approvals: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: {
          created_at: string
          id: string
          item_count: number
          manager_approved: boolean
          notes: string
          recipient_approved: boolean
          recipient_id: string
          recipient_name: string
          requested_by_id: string
          requested_by_name: string
          requires_manager_approval: boolean
          requires_recipient_approval: boolean
          status: string
          total_value: number
          transaction_number: string
          transaction_type: string
        }[]
      }
      get_pending_proposals_count: {
        Args: { p_store_id: string }
        Returns: number
      }
      get_pending_violation_responses: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: {
          created_at: string
          expires_at: string
          min_votes_required: number
          queue_position_claimed: number
          report_id: string
          reported_employee_id: string
          reported_employee_name: string
          reporter_employee_id: string
          reporter_employee_name: string
          total_responses_received: number
          total_responses_required: number
          violation_date: string
          violation_description: string
          votes_violation_confirmed: number
        }[]
      }
      get_permission_audit_log: {
        Args: { p_limit?: number; p_store_id: string }
        Returns: {
          change_reason: string
          changed_at: string
          changed_by_name: string
          id: string
          new_value: boolean
          old_value: boolean
          permission_key: string
          role_name: string
        }[]
      }
      get_previous_safe_balance: {
        Args: { p_date: string; p_store_id: string }
        Returns: number
      }
      get_product_preference: {
        Args: { p_master_item_id: string; p_store_id: string }
        Returns: {
          last_used: string
          purchase_cost: number
          purchase_unit_id: string
        }[]
      }
      get_queue_removal_history: {
        Args: { p_end_date?: string; p_start_date?: string; p_store_id: string }
        Returns: {
          cooldown_expires_at: string
          employee_code: string
          employee_id: string
          employee_name: string
          id: string
          is_active: boolean
          minutes_remaining: number
          notes: string
          reason: string
          removed_at: string
          removed_by_employee_id: string
          removed_by_name: string
        }[]
      }
      get_recent_function_errors: {
        Args: { p_limit?: number }
        Returns: {
          context: string
          error_message: string
          function_name: string
          id: string
          occurred_at: string
          parameters: Json
          store_id: string
        }[]
      }
      get_role_permissions: {
        Args: { p_role_name: string; p_store_id: string }
        Returns: {
          action_name: string
          description: string
          display_name: string
          is_critical: boolean
          is_enabled: boolean
          module_name: string
          permission_key: string
          updated_at: string
        }[]
      }
      get_safe_balance_for_date: {
        Args: { p_date: string; p_store_id: string }
        Returns: {
          closing_balance: number
          opening_balance: number
          total_deposits: number
          total_withdrawals: number
        }[]
      }
      get_safe_balance_history: {
        Args: {
          p_end_date?: string
          p_limit?: number
          p_start_date?: string
          p_store_id: string
        }
        Returns: {
          balance_change: number
          closing_balance: number
          created_at: string
          created_by_name: string
          date: string
          id: string
          opening_balance: number
          total_deposits: number
          total_withdrawals: number
          updated_at: string
          updated_by_name: string
        }[]
      }
      get_services_by_popularity: {
        Args: { p_store_id: string }
        Returns: {
          active: boolean
          archived: boolean
          category: string
          code: string
          created_at: string
          duration_min: number
          id: string
          name: string
          price: number
          service_id: string
          store_service_id: string
          updated_at: string
          usage_count: number
        }[]
      }
      get_sorted_technicians_for_store: {
        Args: { p_date?: string; p_store_id: string }
        Returns: {
          current_open_ticket_id: string
          display_name: string
          employee_id: string
          estimated_completion_time: string
          estimated_duration_min: number
          legal_name: string
          open_ticket_count: number
          queue_position: number
          queue_status: string
          ready_at: string
          ticket_start_time: string
        }[]
      }
      get_store_attendance: {
        Args: {
          p_employee_id?: string
          p_end_date: string
          p_start_date: string
          p_store_id: string
        }
        Returns: {
          attendance_record_id: string
          check_in_time: string
          check_out_time: string
          employee_id: string
          employee_name: string
          pay_type: string
          status: string
          store_code: string
          total_hours: number
          work_date: string
        }[]
      }
      get_store_inventory_with_details: {
        Args: { p_store_id: string }
        Returns: {
          category: string
          code: string
          created_at: string
          description: string
          is_active: boolean
          is_low_stock: boolean
          item_id: string
          last_counted_at: string
          name: string
          quantity_on_hand: number
          reorder_level: number
          stock_id: string
          unit: string
          unit_cost: number
          updated_at: string
        }[]
      }
      get_store_timezone: { Args: { p_store_id: string }; Returns: string }
      get_supplier_for_transaction: {
        Args: { p_transaction_id: string }
        Returns: string
      }
      get_technician_queue_position: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: number
      }
      get_violation_reports_for_approval: {
        Args: { p_end_date?: string; p_start_date?: string; p_store_id: string }
        Returns: {
          created_at: string
          expires_at: string
          insufficient_responders: boolean
          min_votes_required: number
          queue_position_claimed: number
          report_id: string
          reported_employee_id: string
          reported_employee_name: string
          reporter_employee_id: string
          reporter_employee_name: string
          response_details: Json
          status: string
          threshold_met: boolean
          total_responses: number
          violation_date: string
          violation_description: string
          votes_against_violation: number
          votes_for_violation: number
          votes_violation_confirmed: number
        }[]
      }
      has_pending_cash_transaction_change_proposal: {
        Args: { p_cash_transaction_id: string }
        Returns: boolean
      }
      has_pending_proposal: {
        Args: { p_attendance_record_id: string }
        Returns: boolean
      }
      insert_transaction_items_batch: {
        Args: { p_items: Json; p_transaction_id: string }
        Returns: {
          items_inserted: number
          message: string
          success: boolean
        }[]
      }
      is_pin_in_use: {
        Args: { exclude_employee_id?: string; pin_input: string }
        Returns: boolean
      }
      is_technician_checked_in_any_store_today: {
        Args: { p_employee_id: string }
        Returns: boolean
      }
      is_technician_checked_in_today: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: boolean
      }
      join_ready_queue: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: undefined
      }
      join_ready_queue_with_checkin: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: Json
      }
      leave_ready_queue: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: undefined
      }
      log_auto_approval_activity: { Args: never; Returns: undefined }
      mark_technician_available: {
        Args: { p_employee_id: string }
        Returns: undefined
      }
      mark_technician_busy: {
        Args: { p_employee_id: string; p_ticket_id: string }
        Returns: undefined
      }
      mark_ticket_completed: {
        Args: { p_employee_id: string; p_ticket_id: string }
        Returns: Json
      }
      preview_historical_auto_checkout:
        | {
            Args: never
            Returns: {
              affected_dates: string[]
              records_to_update: number
              store_id: string
              store_name: string
            }[]
          }
        | {
            Args: { p_end_date?: string; p_start_date?: string }
            Returns: {
              attendance_id: string
              check_in_time: string
              checkout_source: string
              current_status: string
              employee_id: string
              employee_name: string
              proposed_checkout_time: string
              proposed_hours: number
              store_code: string
              work_date: string
            }[]
          }
      refresh_employee_inventory_summary: {
        Args: { p_employee_id: string; p_master_item_id: string }
        Returns: undefined
      }
      reject_cash_transaction_change_proposal: {
        Args: {
          p_proposal_id: string
          p_review_comment: string
          p_reviewer_employee_id: string
        }
        Returns: Json
      }
      reject_ticket: {
        Args: {
          p_employee_id: string
          p_rejection_reason: string
          p_ticket_id: string
        }
        Returns: Json
      }
      remove_from_ready_queue: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: undefined
      }
      remove_technician_from_queue_admin: {
        Args: {
          p_employee_id: string
          p_notes?: string
          p_reason: string
          p_store_id: string
        }
        Returns: Json
      }
      reset_employee_pin: { Args: { emp_id: string }; Returns: Json }
      reset_role_permissions_to_default: {
        Args: { p_employee_id: string; p_role_name: string; p_store_id: string }
        Returns: number
      }
      return_from_employee: {
        Args: {
          p_employee_id: string
          p_master_item_id: string
          p_notes?: string
          p_quantity: number
          p_returned_by_id: string
        }
        Returns: Json
      }
      save_safe_balance_snapshot: {
        Args: { p_date: string; p_employee_id: string; p_store_id: string }
        Returns: {
          closing_balance: number
          created_at: string
          date: string
          id: string
          opening_balance: number
          store_id: string
          total_deposits: number
          total_withdrawals: number
          updated_at: string
        }[]
      }
      seed_store_permissions: { Args: { p_store_id: string }; Returns: number }
      set_employee_pin: {
        Args: { emp_id: string; new_pin: string }
        Returns: Json
      }
      submit_violation_response: {
        Args: {
          p_employee_id: string
          p_response: boolean
          p_response_notes?: string
          p_violation_report_id: string
        }
        Returns: Json
      }
      sync_store_service_to_global: {
        Args: { p_store_service_id: string }
        Returns: undefined
      }
      update_last_activity: {
        Args: { p_employee_id: string; p_store_id: string }
        Returns: undefined
      }
      update_pending_ticket_deadlines: {
        Args: { p_store_id: string }
        Returns: Json
      }
      update_product_preference: {
        Args: {
          p_item_id: string
          p_purchase_cost: number
          p_purchase_unit_id: string
          p_store_id: string
          p_updated_by_id: string
        }
        Returns: undefined
      }
      update_role_permission: {
        Args: {
          p_employee_id: string
          p_is_enabled: boolean
          p_permission_key: string
          p_role_name: string
          p_store_id: string
        }
        Returns: boolean
      }
      upsert_store_stock: {
        Args: {
          p_cost_override?: number
          p_item_id: string
          p_quantity?: number
          p_reorder_override?: number
          p_store_id: string
        }
        Returns: string
      }
      validate_weekly_schedule: { Args: { schedule: Json }; Returns: boolean }
      verify_approval_corrections: {
        Args: never
        Returns: {
          approval_status: string
          is_consistent: boolean
          requires_higher_approval: boolean
          ticket_id: string
        }[]
      }
      verify_employee_pin:
        | { Args: { emp_id: string; pin_code: string }; Returns: Json }
        | {
            Args: { pin_input: string }
            Returns: {
              can_reset_pin: boolean
              display_name: string
              employee_id: string
              role: string[]
              role_permission: string
              store_id: string
            }[]
          }
      verify_employee_pin_by_id: {
        Args: { emp_id: string; pin_code: string }
        Returns: Json
      }
    }
    Enums: {
      role_permission_type:
        | "Admin"
        | "Receptionist"
        | "Technician"
        | "Supervisor"
        | "Owner"
        | "Cashier"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      role_permission_type: [
        "Admin",
        "Receptionist",
        "Technician",
        "Supervisor",
        "Owner",
        "Cashier",
      ],
    },
  },
} as const
