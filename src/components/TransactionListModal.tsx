import { useState, useEffect } from "react";
import {
  Eye,
  Plus,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Pencil,
  History,
} from "lucide-react";
import { Drawer } from "./ui/Drawer";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import {
  CashTransaction,
  CashTransactionType,
  supabase,
} from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTimeEST } from "../lib/timezone";
import { Permissions } from "../lib/permissions";
import { CashTransactionEditHistoryModal } from "./CashTransactionEditHistoryModal";

interface TransactionListModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: CashTransaction[];
  transactionType: CashTransactionType;
  onAddNew: () => void;
  onEdit?: (transaction: CashTransaction) => void;
}

type FilterStatus = "all" | "approved" | "pending_approval" | "rejected";

export function TransactionListModal({
  isOpen,
  onClose,
  transactions,
  transactionType,
  onAddNew,
  onEdit,
}: TransactionListModalProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>(
    {},
  );
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] =
    useState<string>("");
  const { selectedStoreId, session } = useAuth();

  const canEdit =
    session?.role && Permissions.cashTransactions.canEdit(session.role);
  const canViewHistory =
    session?.role &&
    Permissions.cashTransactions.canViewEditHistory(session.role);

  useEffect(() => {
    loadEmployeeNames();
  }, [transactions, selectedStoreId]);

  async function loadEmployeeNames() {
    if (!selectedStoreId) return;

    const employeeIds = [...new Set(transactions.map((t) => t.created_by_id))];

    if (employeeIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, display_name")
        .in("id", employeeIds);

      if (error) throw error;

      const nameMap: Record<string, string> = {};
      data?.forEach((emp) => {
        nameMap[emp.id] = emp.display_name;
      });
      setEmployeeNames(nameMap);
    } catch (error) {
      console.error("Failed to load employee names:", error);
    }
  }

  const filteredTransactions = transactions.filter((t) => {
    if (filterStatus === "all") return true;
    return t.status === filterStatus;
  });

  const totalApproved = transactions
    .filter((t) => t.status === "approved")
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const totalPending = transactions
    .filter((t) => t.status === "pending_approval")
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const totalRejected = transactions
    .filter((t) => t.status === "rejected")
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const title =
    transactionType === "cash_in"
      ? "Cash In Transactions"
      : "Cash Out Transactions";
  const colorClass =
    transactionType === "cash_in" ? "text-green-600" : "text-red-600";

  function getStatusBadgeVariant(
    status: string,
  ): "success" | "warning" | "danger" {
    switch (status) {
      case "approved":
        return "success";
      case "pending_approval":
        return "warning";
      case "rejected":
        return "danger";
      default:
        return "warning";
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-3 h-3" />;
      case "pending_approval":
        return <Clock className="w-3 h-3" />;
      case "rejected":
        return <XCircle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case "approved":
        return "Approved";
      case "pending_approval":
        return "Pending";
      case "rejected":
        return "Rejected";
      default:
        return status;
    }
  }

  const headerActions =
    canEdit && onEdit ? (
      <button
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        title="Edit mode enabled - Click any transaction to edit"
      >
        <Pencil className="w-4 h-4" />
        <span>Edit</span>
      </button>
    ) : null;

  const footerContent = (
    <>
      {transactions.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-xs text-gray-600 mb-1">Approved</p>
            <p className="text-lg font-bold text-green-600">
              ${totalApproved.toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600 mb-1">Pending</p>
            <p className="text-lg font-bold text-amber-600">
              ${totalPending.toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600 mb-1">Rejected</p>
            <p className="text-lg font-bold text-red-600">
              ${totalRejected.toFixed(2)}
            </p>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  );

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        size="lg"
        headerActions={headerActions}
        footer={footerContent}
      >
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filterStatus === "all"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All ({transactions.length})
              </button>
              <button
                onClick={() => setFilterStatus("approved")}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filterStatus === "approved"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Approved (
                {transactions.filter((t) => t.status === "approved").length})
              </button>
              <button
                onClick={() => setFilterStatus("pending_approval")}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filterStatus === "pending_approval"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Pending (
                {
                  transactions.filter((t) => t.status === "pending_approval")
                    .length
                }
                )
              </button>
              <button
                onClick={() => setFilterStatus("rejected")}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filterStatus === "rejected"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Rejected (
                {transactions.filter((t) => t.status === "rejected").length})
              </button>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onAddNew();
              onClose();
            }}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add New
          </Button>
        </div>

        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Eye className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-900 mb-1">
                No transactions found
              </p>
              <p className="text-xs text-gray-500 mb-4">
                {filterStatus === "all"
                  ? "There are no transactions for this date yet."
                  : `There are no ${getStatusLabel(filterStatus).toLowerCase()} transactions.`}
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onAddNew();
                  onClose();
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add First Transaction
              </Button>
            </div>
          ) : (
            filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xl font-bold ${colorClass}`}>
                      ${parseFloat(transaction.amount.toString()).toFixed(2)}
                    </span>
                    <Badge variant={getStatusBadgeVariant(transaction.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(transaction.status)}
                        {getStatusLabel(transaction.status)}
                      </span>
                    </Badge>
                    {(transaction as any).last_edited_at && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                        Edited
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && onEdit && (
                      <button
                        onClick={() => onEdit(transaction)}
                        className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-600 hover:text-blue-600"
                        title="Edit transaction"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canViewHistory && (transaction as any).last_edited_at && (
                      <button
                        onClick={() => {
                          setSelectedTransactionId(transaction.id);
                          setIsHistoryModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-600 hover:text-purple-600"
                        title="View edit history"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {transaction.description && (
                  <p className="text-sm text-gray-900 font-medium mb-2">
                    {transaction.description}
                  </p>
                )}
                {transaction.category && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-gray-500">Category:</span>
                    <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {transaction.category}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Created by:{" "}
                    {employeeNames[transaction.created_by_id] || "Unknown User"}
                  </span>
                  <span>{formatDateTimeEST(transaction.created_at)} EST</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>

      <CashTransactionEditHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        transactionId={selectedTransactionId}
      />
    </>
  );
}
