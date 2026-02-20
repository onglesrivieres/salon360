import { useState, useEffect, useMemo, useRef, ChangeEvent } from "react";
import {
  X,
  Plus,
  Trash2,
  Check,
  Upload,
  Camera,
  Paperclip,
  FileText,
} from "lucide-react";
import { Drawer } from "./ui/Drawer";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { NumericInput } from "./ui/NumericInput";
import {
  SearchableSelect,
  SearchableSelectOption,
} from "./ui/SearchableSelect";
import { useToast } from "./ui/Toast";
import {
  supabase,
  InventoryItem,
  PurchaseUnit,
  Supplier,
  Store,
  InventoryTransactionInvoicePhoto,
} from "../lib/supabase";
import { compressImage } from "../lib/image-utils";
import { getStorageService, type StorageService } from "../lib/storage";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { InventoryItemModal } from "./InventoryItemModal";
import { SupplierModal } from "./SupplierModal";
import { UNITS } from "../lib/inventory-constants";
import { Permissions } from "../lib/permissions";
import { useInventoryItemPhotos } from "../hooks/useInventoryItemPhotos";
import { PhotoThumbnail } from "./photos";

interface DraftTransaction {
  id: string;
  transaction_type: "in" | "out" | "transfer";
  supplier_id?: string;
  recipient_id?: string;
  destination_store_id?: string;
  invoice_reference?: string;
  notes: string;
  items: Array<{
    item_id: string;
    purchase_unit_id?: string;
    purchase_quantity?: number;
    purchase_unit_price?: number;
    quantity: number;
    unit_cost: number;
    notes: string;
  }>;
}

interface InventoryTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialTransactionType?: "in" | "out" | "transfer";
  draftTransaction?: DraftTransaction;
  pendingTransaction?: DraftTransaction;
}

interface TransactionItemForm {
  item_id: string;
  brand: string;
  isAddingNewBrand: boolean;
  purchase_unit_id: string;
  purchase_quantity: string;
  purchase_unit_price: string;
  quantity: string;
  total_cost: string;
  unit_cost: string;
  notes: string;
  // Per-item purchase unit form state
  isAddingPurchaseUnit: boolean;
  newPurchaseUnitName: string;
  newPurchaseUnitMultiplier: string;
  isCustomPurchaseUnit: boolean;
  customPurchaseUnitName: string;
  previousPurchaseUnitId: string;
}

interface EmployeeListItem {
  id: string;
  display_name: string;
  role: string[];
  status: string;
}

// CSV parsing utilities (duplicated from CsvImportModal for self-contained use)
const CSV_HEADER_ALIASES: Record<string, string> = {
  "item name": "item_name",
  item_name: "item_name",
  name: "item_name",
  qty: "quantity",
  cost: "unit_cost",
  price: "unit_cost",
  note: "notes",
  parent: "parent_name",
  "parent name": "parent_name",
  parent_name: "parent_name",
  "parent item": "parent_name",
  "purchase unit": "purchase_unit",
  purchase_unit: "purchase_unit",
  brand: "brand",
  unit: "purchase_unit",
  "purchase qty": "purchase_qty",
  purchase_qty: "purchase_qty",
  "purchase quantity": "purchase_qty",
  "purchase unit price": "purchase_unit_price",
  purchase_unit_price: "purchase_unit_price",
  "unit price": "purchase_unit_price",
  multiplier: "multiplier",
  purchase_unit_multiplier: "multiplier",
  "purchase unit multiplier": "multiplier",
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeCsvHeader(h: string): string {
  const lower = h.toLowerCase().trim();
  return CSV_HEADER_ALIASES[lower] || lower;
}

export function InventoryTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  initialTransactionType,
  draftTransaction,
  pendingTransaction,
}: InventoryTransactionModalProps) {
  const { showToast } = useToast();
  const { selectedStoreId, session } = useAuth();
  const { isR2Configured, getStorageConfig } = useSettings();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isEditingPending, setIsEditingPending] = useState(false);
  const [transactionType, setTransactionType] = useState<
    "in" | "out" | "transfer"
  >(initialTransactionType || "in");
  const [supplierId, setSupplierId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [destinationStoreId, setDestinationStoreId] = useState("");
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [invoiceReference, setInvoiceReference] = useState("");
  const invoicePhotoInputRef = useRef<HTMLInputElement>(null);
  const [pendingInvoicePhotos, setPendingInvoicePhotos] = useState<
    Array<{
      id: string;
      file: File;
      compressedBlob: Blob;
      previewUrl: string;
      filename: string;
    }>
  >([]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransactionItemForm[]>([
    {
      item_id: "",
      brand: "",
      isAddingNewBrand: false,
      purchase_unit_id: "",
      purchase_quantity: "",
      purchase_unit_price: "",
      quantity: "",
      total_cost: "",
      unit_cost: "",
      notes: "",
      isAddingPurchaseUnit: false,
      newPurchaseUnitName: "",
      newPurchaseUnitMultiplier: "",
      isCustomPurchaseUnit: false,
      customPurchaseUnitName: "",
      previousPurchaseUnitId: "",
    },
  ]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseUnits, setPurchaseUnits] = useState<
    Record<string, PurchaseUnit[]>
  >({});
  const [savingPurchaseUnitIndex, setSavingPurchaseUnitIndex] = useState<
    number | null
  >(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [existingBrands, setExistingBrands] = useState<string[]>([]);

  const itemPhotos = useInventoryItemPhotos({
    storeId: selectedStoreId || "",
    uploadedBy: session?.employee_id || "",
    storageConfig: getStorageConfig(),
  });

  // Create a map of master items for grouping sub-items
  const masterItemsMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventoryItems.forEach((item) => {
      if (item.is_master_item) {
        map.set(item.id, item);
      }
    });
    return map;
  }, [inventoryItems]);

  // Clean up pending photos when drawer closes
  useEffect(() => {
    if (!isOpen) {
      itemPhotos.clearAll();
      pendingInvoicePhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPendingInvoicePhotos([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedStoreId) {
      fetchInventoryItems();
      fetchEmployees();
      fetchSuppliers();
      fetchAvailableStores();
      fetchBrands();
    }
  }, [isOpen, selectedStoreId]);

  useEffect(() => {
    const sourceTransaction = draftTransaction || pendingTransaction;
    if (sourceTransaction) {
      // Populate form from draft or pending transaction
      setDraftId(sourceTransaction.id);
      setIsEditingPending(!!pendingTransaction);
      setTransactionType(sourceTransaction.transaction_type);
      setSupplierId(sourceTransaction.supplier_id || "");
      setRecipientId(sourceTransaction.recipient_id || "");
      setDestinationStoreId(sourceTransaction.destination_store_id || "");
      setInvoiceReference(sourceTransaction.invoice_reference || "");
      setNotes(sourceTransaction.notes || "");

      if (sourceTransaction.items.length > 0) {
        setItems(
          sourceTransaction.items.map((item) => ({
            item_id: item.item_id,
            brand: "",
            isAddingNewBrand: false,
            purchase_unit_id: item.purchase_unit_id || "",
            purchase_quantity: item.purchase_quantity?.toString() || "",
            purchase_unit_price: item.purchase_unit_price?.toString() || "",
            quantity: item.quantity.toString(),
            total_cost: "",
            unit_cost: item.unit_cost.toString(),
            notes: item.notes || "",
            isAddingPurchaseUnit: false,
            newPurchaseUnitName: "",
            newPurchaseUnitMultiplier: "",
            isCustomPurchaseUnit: false,
            customPurchaseUnitName: "",
            previousPurchaseUnitId: "",
          })),
        );
      } else {
        setItems([
          {
            item_id: "",
            brand: "",
            isAddingNewBrand: false,
            purchase_unit_id: "",
            purchase_quantity: "",
            purchase_unit_price: "",
            quantity: "",
            total_cost: "",
            unit_cost: "",
            notes: "",
            isAddingPurchaseUnit: false,
            newPurchaseUnitName: "",
            newPurchaseUnitMultiplier: "",
            isCustomPurchaseUnit: false,
            customPurchaseUnitName: "",
            previousPurchaseUnitId: "",
          },
        ]);
      }
    } else {
      // Reset form
      setDraftId(null);
      setIsEditingPending(false);
      setItems([
        {
          item_id: "",
          brand: "",
          isAddingNewBrand: false,
          purchase_unit_id: "",
          purchase_quantity: "",
          purchase_unit_price: "",
          quantity: "",
          total_cost: "",
          unit_cost: "",
          notes: "",
          isAddingPurchaseUnit: false,
          newPurchaseUnitName: "",
          newPurchaseUnitMultiplier: "",
          isCustomPurchaseUnit: false,
          customPurchaseUnitName: "",
          previousPurchaseUnitId: "",
        },
      ]);
      setRecipientId("");
      setDestinationStoreId("");
      setSupplierId("");
      setInvoiceReference("");
      pendingInvoicePhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPendingInvoicePhotos([]);
      setNotes("");
      setTransactionType(initialTransactionType || "in");
    }
  }, [isOpen, initialTransactionType, draftTransaction, pendingTransaction]);

  // Fetch purchase units and populate brands for draft/pending items when inventory items are loaded
  useEffect(() => {
    const sourceTransaction = draftTransaction || pendingTransaction;
    if (sourceTransaction && inventoryItems.length > 0) {
      const itemIds = new Set(
        sourceTransaction.items.map((i) => i.item_id).filter(Boolean),
      );
      itemIds.forEach(async (itemId) => {
        const invItem = inventoryItems.find((i) => i.id === itemId);
        if (invItem?.id) {
          const units = await fetchPurchaseUnitsForItem(invItem.id);
          setPurchaseUnits((prev) => ({ ...prev, [invItem.id!]: units }));
        }
      });

      // Populate brand from inventory items for draft/pending items
      setItems((prev) =>
        prev.map((item) => {
          if (item.item_id && !item.brand) {
            const invItem = inventoryItems.find((i) => i.id === item.item_id);
            if (invItem?.brand) {
              return { ...item, brand: invItem.brand };
            }
          }
          return item;
        }),
      );
    }
  }, [draftTransaction, pendingTransaction, inventoryItems]);

  async function fetchInventoryItems() {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .from("store_inventory_levels")
        .select("*, item:inventory_items!inner(*)")
        .eq("store_id", selectedStoreId)
        .eq("is_active", true)
        .order("created_at", { referencedTable: "inventory_items" });

      if (error) throw error;

      // Flatten to InventoryItem shape
      const flatItems = (data || []).map((level: any) => ({
        ...level.item,
        store_id: level.store_id,
        quantity_on_hand: level.quantity_on_hand,
        unit_cost: level.unit_cost,
        reorder_level: level.reorder_level,
        is_active: level.is_active,
      }));
      setInventoryItems(flatItems);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
    }
  }

  async function fetchEmployees() {
    if (!selectedStoreId) return;

    try {
      const { data: employeesData, error: employeesError } = await supabase
        .from("employees")
        .select("id, display_name, role, status")
        .eq("status", "Active")
        .order("display_name");

      if (employeesError) throw employeesError;

      const { data: employeeStoresData, error: storesError } = await supabase
        .from("employee_stores")
        .select("employee_id, store_id")
        .eq("store_id", selectedStoreId);

      if (storesError) throw storesError;

      const employeeIdsInStore = new Set(
        employeeStoresData?.map((es) => es.employee_id) || [],
      );

      const filteredEmployees = (employeesData || []).filter(
        (emp: EmployeeListItem) => employeeIdsInStore.has(emp.id),
      );

      setEmployees(filteredEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }

  async function fetchSuppliers() {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  }

  async function fetchAvailableStores() {
    if (!selectedStoreId || !session?.employee_id) return;

    try {
      // All roles can see all active stores as transfer destinations
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;

      // Exclude current store
      setAvailableStores((data || []).filter((s) => s.id !== selectedStoreId));
    } catch (error) {
      console.error("Error fetching stores:", error);
    }
  }

  async function fetchBrands() {
    try {
      const { data } = await supabase
        .from("inventory_items")
        .select("brand")
        .not("brand", "is", null);
      const unique = Array.from(
        new Set((data || []).map((d: any) => d.brand).filter(Boolean)),
      ).sort() as string[];
      setExistingBrands(unique);
    } catch (error) {
      console.error("Error fetching brands:", error);
    }
  }

  async function fetchPurchaseUnitsForItem(masterItemId: string) {
    if (!selectedStoreId || !masterItemId) return [];

    try {
      const { data, error } = await supabase
        .from("store_product_purchase_units")
        .select("*")
        .eq("store_id", selectedStoreId)
        .eq("item_id", masterItemId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching purchase units:", error);
      return [];
    }
  }

  async function getLastUsedPurchaseUnit(masterItemId: string) {
    if (!selectedStoreId || !masterItemId) return null;

    try {
      const { data, error } = await supabase
        .from("store_product_preferences")
        .select("last_used_purchase_unit_id, last_purchase_cost")
        .eq("store_id", selectedStoreId)
        .eq("item_id", masterItemId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching last used purchase unit:", error);
      return null;
    }
  }

  function handleSupplierDropdownChange(value: string) {
    if (value === "__add_new__") {
      setShowSupplierModal(true);
    } else {
      setSupplierId(value);
    }
  }

  function handleSupplierAdded() {
    fetchSuppliers();
    setShowSupplierModal(false);
  }

  function handleItemDropdownChange(index: number, value: string) {
    if (value === "__add_new__") {
      setShowAddItemModal(true);
    } else {
      handleItemChange(index, "item_id", value);
    }
  }

  function handleItemAdded() {
    fetchInventoryItems();
    setShowAddItemModal(false);
  }

  function handlePurchaseUnitDropdownChange(index: number, value: string) {
    if (value === "__add_new__") {
      const newItems = [...items];
      newItems[index].previousPurchaseUnitId = newItems[index].purchase_unit_id;
      newItems[index].isAddingPurchaseUnit = true;
      newItems[index].newPurchaseUnitName = "";
      newItems[index].newPurchaseUnitMultiplier = "";
      newItems[index].isCustomPurchaseUnit = false;
      newItems[index].customPurchaseUnitName = "";
      setItems(newItems);
    } else {
      handleItemChange(index, "purchase_unit_id", value);
    }
  }

  async function handleAddPurchaseUnit(index: number) {
    const item = items[index];
    if (!item.item_id || !selectedStoreId) {
      showToast("Please select an item first", "error");
      return;
    }

    const unitName = item.isCustomPurchaseUnit
      ? item.customPurchaseUnitName.trim()
      : item.newPurchaseUnitName.trim();

    if (!unitName || !item.newPurchaseUnitMultiplier) {
      showToast("Please fill in all fields", "error");
      return;
    }

    const multiplier = parseFloat(item.newPurchaseUnitMultiplier);
    if (multiplier <= 0) {
      showToast("Multiplier must be greater than zero", "error");
      return;
    }

    const invItem = inventoryItems.find((i) => i.id === item.item_id);
    if (!invItem?.id) {
      showToast("Item does not have a master item ID", "error");
      return;
    }

    const existingUnits = purchaseUnits[invItem.id] || [];

    // Check for duplicate unit name + multiplier (case-insensitive) in existing units
    const duplicateUnit = existingUnits.find(
      (u) =>
        u.unit_name.toLowerCase() === unitName.toLowerCase() &&
        u.multiplier === multiplier,
    );

    if (duplicateUnit) {
      // Unit already exists with same name and multiplier - use it instead of creating duplicate
      showToast(
        `Using existing purchase unit: ${duplicateUnit.unit_name}`,
        "success",
      );

      const newItems = [...items];
      newItems[index].purchase_unit_id = duplicateUnit.id;
      newItems[index].isAddingPurchaseUnit = false;
      newItems[index].newPurchaseUnitName = "";
      newItems[index].newPurchaseUnitMultiplier = "";
      newItems[index].isCustomPurchaseUnit = false;
      newItems[index].customPurchaseUnitName = "";

      // Recalculate with existing unit's multiplier
      const purchaseQty = parseFloat(newItems[index].purchase_quantity) || 0;
      const purchasePrice =
        parseFloat(newItems[index].purchase_unit_price) || 0;
      const stockUnits = purchaseQty * duplicateUnit.multiplier;

      newItems[index].quantity = stockUnits.toString();

      if (purchaseQty > 0 && purchasePrice >= 0) {
        const totalCost = purchasePrice * purchaseQty;
        newItems[index].total_cost = totalCost.toFixed(2);

        if (stockUnits > 0) {
          newItems[index].unit_cost = (totalCost / stockUnits).toFixed(2);
        }
      }

      setItems(newItems);
      return;
    }

    // Save to database immediately
    setSavingPurchaseUnitIndex(index);
    try {
      const isFirstUnit = existingUnits.length === 0;

      const { data, error } = await supabase
        .from("store_product_purchase_units")
        .insert({
          store_id: selectedStoreId,
          item_id: invItem.id,
          unit_name: unitName,
          multiplier,
          is_default: isFirstUnit,
          display_order: existingUnits.length,
        })
        .select()
        .single();

      let realId: string;

      if (error) {
        if (error.code === "23505") {
          // Duplicate constraint - fetch existing unit
          const { data: existingUnit } = await supabase
            .from("store_product_purchase_units")
            .select("*")
            .eq("store_id", selectedStoreId)
            .eq("item_id", invItem.id)
            .ilike("unit_name", unitName)
            .eq("multiplier", multiplier)
            .maybeSingle();

          if (existingUnit) {
            realId = existingUnit.id;
            showToast(`Using existing purchase unit: ${unitName}`, "success");
          } else {
            showToast(`Failed to create purchase unit: ${unitName}`, "error");
            return;
          }
        } else {
          console.error("Error creating purchase unit:", error);
          showToast(`Failed to create purchase unit: ${unitName}`, "error");
          return;
        }
      } else {
        realId = data.id;
        showToast(`Purchase unit "${unitName}" saved`, "success");
      }

      // Refresh purchase units cache
      const updatedUnits = await fetchPurchaseUnitsForItem(invItem.id);
      setPurchaseUnits((prev) => ({ ...prev, [invItem.id!]: updatedUnits }));

      const newItems = [...items];
      newItems[index].purchase_unit_id = realId;
      newItems[index].isAddingPurchaseUnit = false;
      newItems[index].newPurchaseUnitName = "";
      newItems[index].newPurchaseUnitMultiplier = "";
      newItems[index].isCustomPurchaseUnit = false;
      newItems[index].customPurchaseUnitName = "";

      // Recalculate quantity, total_cost, and unit_cost
      const purchaseQty = parseFloat(newItems[index].purchase_quantity) || 0;
      const purchasePrice =
        parseFloat(newItems[index].purchase_unit_price) || 0;
      const stockUnits = purchaseQty * multiplier;

      newItems[index].quantity = stockUnits.toString();

      if (purchaseQty > 0 && purchasePrice >= 0) {
        const totalCost = purchasePrice * purchaseQty;
        newItems[index].total_cost = totalCost.toFixed(2);

        if (stockUnits > 0) {
          newItems[index].unit_cost = (totalCost / stockUnits).toFixed(2);
        }
      }

      setItems(newItems);
    } catch (error: any) {
      console.error("Error creating purchase unit:", error);
      showToast(`Failed to create purchase unit: ${error.message}`, "error");
    } finally {
      setSavingPurchaseUnitIndex(null);
    }
  }

  function cancelAddPurchaseUnit(index: number) {
    const newItems = [...items];
    newItems[index].isAddingPurchaseUnit = false;
    newItems[index].purchase_unit_id =
      newItems[index].previousPurchaseUnitId || "";
    newItems[index].newPurchaseUnitName = "";
    newItems[index].newPurchaseUnitMultiplier = "";
    newItems[index].isCustomPurchaseUnit = false;
    newItems[index].customPurchaseUnitName = "";
    newItems[index].previousPurchaseUnitId = "";
    setItems(newItems);
  }

  function handleAddItem() {
    setItems([
      ...items,
      {
        item_id: "",
        brand: "",
        isAddingNewBrand: false,
        purchase_unit_id: "",
        purchase_quantity: "",
        purchase_unit_price: "",
        quantity: "",
        total_cost: "",
        unit_cost: "",
        notes: "",
        isAddingPurchaseUnit: false,
        newPurchaseUnitName: "",
        newPurchaseUnitMultiplier: "",
        isCustomPurchaseUnit: false,
        customPurchaseUnitName: "",
        previousPurchaseUnitId: "",
      },
    ]);
  }

  function handleRemoveItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
      itemPhotos.removeItemPhotos(index);
    }
  }

  async function handleCsvImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    if (csvInputRef.current) csvInputRef.current.value = "";

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());

      if (lines.length < 2) {
        showToast(
          "CSV must have a header row and at least one data row",
          "error",
        );
        return;
      }

      const headerFields = parseCsvLine(lines[0]).map(normalizeCsvHeader);
      const nameIdx = headerFields.indexOf("item_name");
      const brandIdx = headerFields.indexOf("brand");
      const qtyIdx = headerFields.indexOf("quantity");
      const costIdx = headerFields.indexOf("unit_cost");
      const notesIdx = headerFields.indexOf("notes");
      const parentNameIdx = headerFields.indexOf("parent_name");
      const purchaseUnitIdx = headerFields.indexOf("purchase_unit");
      const purchaseQtyIdx = headerFields.indexOf("purchase_qty");
      const purchaseUnitPriceIdx = headerFields.indexOf("purchase_unit_price");
      const multiplierIdx = headerFields.indexOf("multiplier");

      if (nameIdx === -1) {
        showToast('CSV must have an "item_name" (or "name") column', "error");
        return;
      }

      // ── Phase 1: Parse & classify rows ──
      // Build lookups: sub-items only for "in" transactions, and master items by name
      const itemLookup = new Map<string, InventoryItem>();
      const masterLookup = new Map<string, InventoryItem>();
      for (const inv of inventoryItems) {
        const isSubItem = !inv.is_master_item && inv.parent_id;
        if (isSubItem) {
          itemLookup.set(inv.name.toLowerCase(), inv);
        }
        if (inv.is_master_item) {
          masterLookup.set(inv.name.toLowerCase(), inv);
        }
      }

      interface CsvRow {
        itemName: string;
        brand: string;
        parentName: string;
        quantity: number;
        unitCost: number;
        notes: string;
        purchaseUnitName: string;
        purchaseQty: number;
        purchaseUnitPrice: number;
        multiplier: number;
        status: "matched" | "needs_creation" | "skipped";
        resolvedItem?: InventoryItem;
        resolvedParent?: InventoryItem;
        skipReason?: string;
      }

      const parsedRows: CsvRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const fields = parseCsvLine(lines[i]);
        const itemName = (fields[nameIdx] || "").trim();
        if (!itemName) continue;

        const brand = brandIdx >= 0 ? (fields[brandIdx] || "").trim() : "";
        const quantity = qtyIdx >= 0 ? parseFloat(fields[qtyIdx] || "0") : 0;
        const unitCost = costIdx >= 0 ? parseFloat(fields[costIdx] || "0") : 0;
        const notes = notesIdx >= 0 ? (fields[notesIdx] || "").trim() : "";
        const parentName =
          parentNameIdx >= 0 ? (fields[parentNameIdx] || "").trim() : "";
        const purchaseUnitName =
          purchaseUnitIdx >= 0 ? (fields[purchaseUnitIdx] || "").trim() : "";
        const purchaseQty =
          purchaseQtyIdx >= 0 ? parseFloat(fields[purchaseQtyIdx] || "0") : 0;
        const purchaseUnitPrice =
          purchaseUnitPriceIdx >= 0
            ? parseFloat(fields[purchaseUnitPriceIdx] || "0")
            : 0;
        const multiplier =
          multiplierIdx >= 0 ? parseFloat(fields[multiplierIdx] || "0") : 0;

        // Require either purchase_qty > 0 or quantity > 0 (backward compat)
        const hasPurchaseQty = !isNaN(purchaseQty) && purchaseQty > 0;
        const hasQuantity = !isNaN(quantity) && quantity > 0;

        if (!hasPurchaseQty && !hasQuantity) {
          parsedRows.push({
            itemName,
            brand,
            parentName,
            quantity,
            unitCost,
            notes,
            purchaseUnitName,
            purchaseQty,
            purchaseUnitPrice,
            multiplier,
            status: "skipped",
            skipReason: "invalid quantity",
          });
          continue;
        }

        const matched = itemLookup.get(itemName.toLowerCase());
        if (matched) {
          parsedRows.push({
            itemName,
            brand,
            parentName,
            quantity,
            unitCost,
            notes,
            purchaseUnitName,
            purchaseQty,
            purchaseUnitPrice,
            multiplier,
            status: "matched",
            resolvedItem: matched,
          });
        } else if (parentName) {
          const parent = masterLookup.get(parentName.toLowerCase());
          if (parent) {
            parsedRows.push({
              itemName,
              brand,
              parentName,
              quantity,
              unitCost,
              notes,
              purchaseUnitName,
              purchaseQty,
              purchaseUnitPrice,
              multiplier,
              status: "needs_creation",
              resolvedParent: parent,
            });
          } else {
            parsedRows.push({
              itemName,
              brand,
              parentName,
              quantity,
              unitCost,
              notes,
              purchaseUnitName,
              purchaseQty,
              purchaseUnitPrice,
              multiplier,
              status: "skipped",
              skipReason: `parent "${parentName}" not found`,
            });
          }
        } else {
          parsedRows.push({
            itemName,
            brand,
            parentName,
            quantity,
            unitCost,
            notes,
            purchaseUnitName,
            purchaseQty,
            purchaseUnitPrice,
            multiplier,
            status: "skipped",
            skipReason: "not found",
          });
        }
      }

      // ── Phase 2: Create new sub-items ──
      let createdCount = 0;
      for (const row of parsedRows) {
        if (row.status !== "needs_creation" || !row.resolvedParent) continue;

        // Check if a previous row in this batch already created this item
        const alreadyCreated = itemLookup.get(row.itemName.toLowerCase());
        if (alreadyCreated) {
          row.status = "matched";
          row.resolvedItem = alreadyCreated;
          continue;
        }

        const parent = row.resolvedParent;
        const itemData = {
          name: row.itemName.trim(),
          description: "",
          category: parent.category,
          unit: "piece",
          brand: row.brand || parent.brand || null,
          size: null,
          is_master_item: false,
          parent_id: parent.id,
        };

        const { data: insertedItem, error: insertError } = await supabase
          .from("inventory_items")
          .insert(itemData)
          .select("id, name, category, brand, unit, is_master_item, parent_id")
          .single();

        let newItemId: string;

        if (insertError) {
          if (insertError.code === "23505") {
            // Item name already exists — find by name + parent scope
            const { data: existingItem } = await supabase
              .from("inventory_items")
              .select(
                "id, name, category, brand, unit, is_master_item, parent_id",
              )
              .eq("name", row.itemName.trim())
              .eq("parent_id", parent.id)
              .single();

            if (!existingItem) {
              row.status = "skipped";
              row.skipReason = "duplicate name conflict";
              continue;
            }
            newItemId = existingItem.id;

            // Update catalog fields only — never overwrite hierarchy
            await supabase
              .from("inventory_items")
              .update({
                category: parent.category,
                brand: row.brand || parent.brand || null,
              })
              .eq("id", newItemId);

            // Ensure store_inventory_levels row exists
            await supabase.from("store_inventory_levels").upsert(
              {
                store_id: selectedStoreId!,
                item_id: newItemId,
                quantity_on_hand: 0,
                unit_cost: 0,
                reorder_level: 0,
                is_active: true,
              },
              { onConflict: "store_id,item_id" },
            );
          } else {
            row.status = "skipped";
            row.skipReason = insertError.message;
            continue;
          }
        } else {
          newItemId = insertedItem.id;
        }

        // Build a minimal InventoryItem to add to lookup
        const newItem = {
          id: newItemId,
          name: row.itemName.trim(),
          category: parent.category,
          brand: row.brand || parent.brand || null,
          unit: "piece",
          is_master_item: false,
          parent_id: parent.id,
          description: "",
          size: undefined,
          store_id: selectedStoreId!,
          quantity_on_hand: 0,
          unit_cost: 0,
          reorder_level: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          supplier: "",
          updated_at: new Date().toISOString(),
        } as InventoryItem;

        itemLookup.set(row.itemName.toLowerCase(), newItem);
        row.status = "matched";
        row.resolvedItem = newItem;
        createdCount++;
      }

      // Refresh inventory items dropdown if we created any new items
      if (createdCount > 0) {
        await fetchInventoryItems();
      }

      // ── Phase 3: Build TransactionItemForm objects ──
      const importedItems: TransactionItemForm[] = [];
      const itemIdsToFetchUnits: string[] = [];
      // Parallel metadata: purchase unit name and multiplier per imported item index
      const purchaseUnitNames: string[] = [];
      const purchaseUnitMultipliers: number[] = [];
      let skipped = 0;

      for (const row of parsedRows) {
        if (row.status === "skipped") {
          skipped++;
          continue;
        }
        if (!row.resolvedItem) {
          skipped++;
          continue;
        }

        const item = row.resolvedItem;
        const hasPurchaseQty = !isNaN(row.purchaseQty) && row.purchaseQty > 0;

        importedItems.push({
          item_id: item.id,
          brand: row.brand || item.brand || "",
          isAddingNewBrand: false,
          purchase_unit_id: "",
          purchase_quantity: hasPurchaseQty ? row.purchaseQty.toString() : "",
          purchase_unit_price:
            hasPurchaseQty &&
            !isNaN(row.purchaseUnitPrice) &&
            row.purchaseUnitPrice > 0
              ? row.purchaseUnitPrice.toString()
              : "",
          quantity:
            !isNaN(row.quantity) && row.quantity > 0
              ? row.quantity.toString()
              : "",
          total_cost: "",
          unit_cost:
            !isNaN(row.unitCost) && row.unitCost > 0
              ? row.unitCost.toString()
              : "",
          notes: row.notes,
          isAddingPurchaseUnit: false,
          newPurchaseUnitName: "",
          newPurchaseUnitMultiplier: "",
          isCustomPurchaseUnit: false,
          customPurchaseUnitName: "",
          previousPurchaseUnitId: "",
        });

        purchaseUnitNames.push(row.purchaseUnitName);
        purchaseUnitMultipliers.push(
          !isNaN(row.multiplier) ? row.multiplier : 0,
        );

        if (item.id) {
          itemIdsToFetchUnits.push(item.id);
        }
      }

      if (importedItems.length === 0) {
        showToast(
          skipped > 0
            ? `No items imported — ${skipped} item${skipped > 1 ? "s" : ""} skipped (not found or invalid quantity)`
            : "No valid items found in CSV",
          "error",
        );
        return;
      }

      // ── Phase 4: Fetch purchase units & resolve ──
      const uniqueIds = [...new Set(itemIdsToFetchUnits)];
      const unitResults = await Promise.all(
        uniqueIds.map(async (id) => {
          const units = await fetchPurchaseUnitsForItem(id);
          return { id, units };
        }),
      );
      const newPurchaseUnits: Record<string, PurchaseUnit[]> = {};
      for (const { id, units } of unitResults) {
        newPurchaseUnits[id] = units;
      }

      // Resolve purchase unit names, auto-create when missing, and calculate quantities
      let purchaseUnitsCreated = 0;
      for (let i = 0; i < importedItems.length; i++) {
        const formItem = importedItems[i];
        const unitName = purchaseUnitNames[i];
        const csvMultiplier = purchaseUnitMultipliers[i];
        if (!unitName) continue;

        let itemUnits = newPurchaseUnits[formItem.item_id] || [];
        // Match by name + multiplier if CSV provides multiplier, otherwise name-only
        let matchedUnit =
          csvMultiplier > 0
            ? itemUnits.find(
                (u) =>
                  u.unit_name.toLowerCase() === unitName.toLowerCase() &&
                  u.multiplier === csvMultiplier,
              )
            : itemUnits.find(
                (u) => u.unit_name.toLowerCase() === unitName.toLowerCase(),
              );

        // Auto-create purchase unit if no match and multiplier provided
        if (!matchedUnit && csvMultiplier > 0 && selectedStoreId) {
          const isFirstUnit = itemUnits.length === 0;
          const { data, error } = await supabase
            .from("store_product_purchase_units")
            .insert({
              store_id: selectedStoreId,
              item_id: formItem.item_id,
              unit_name: unitName,
              multiplier: csvMultiplier,
              is_default: isFirstUnit,
              display_order: itemUnits.length,
            })
            .select()
            .single();

          if (error) {
            if (error.code === "23505") {
              // Duplicate — fetch existing unit with same name and multiplier
              const { data: existingUnit } = await supabase
                .from("store_product_purchase_units")
                .select("*")
                .eq("store_id", selectedStoreId)
                .eq("item_id", formItem.item_id)
                .ilike("unit_name", unitName)
                .eq("multiplier", csvMultiplier)
                .maybeSingle();
              if (existingUnit) {
                matchedUnit = existingUnit as PurchaseUnit;
              }
            }
            // Other errors: leave unmatched, user selects manually
          } else {
            matchedUnit = data as PurchaseUnit;
            purchaseUnitsCreated++;
          }

          // Update local cache so duplicate CSV rows for the same item match
          if (matchedUnit) {
            if (!newPurchaseUnits[formItem.item_id]) {
              newPurchaseUnits[formItem.item_id] = [];
            }
            newPurchaseUnits[formItem.item_id].push(matchedUnit);
          }
        }

        if (matchedUnit) {
          formItem.purchase_unit_id = matchedUnit.id;

          // Calculate stock units and costs from purchase unit
          const pQty = parseFloat(formItem.purchase_quantity) || 0;
          const pPrice = parseFloat(formItem.purchase_unit_price) || 0;
          const stockUnits = pQty * matchedUnit.multiplier;

          if (stockUnits > 0) {
            formItem.quantity = stockUnits.toString();
          }
          if (pQty > 0 && pPrice >= 0) {
            const totalCost = pPrice * pQty;
            formItem.total_cost = totalCost.toFixed(2);
            if (stockUnits > 0) {
              formItem.unit_cost = (totalCost / stockUnits).toFixed(2);
            }
          }
        }
        // If not matched and no multiplier, leave purchase_unit_id empty — user selects manually.
        // purchase_quantity and purchase_unit_price are still populated.
      }

      // Auto-select purchase unit for items without explicit CSV unit name
      // that have exactly 1 purchase unit available
      for (let i = 0; i < importedItems.length; i++) {
        const formItem = importedItems[i];
        if (formItem.purchase_unit_id) continue; // Already resolved

        const itemUnits = newPurchaseUnits[formItem.item_id] || [];
        if (itemUnits.length === 1) {
          const unit = itemUnits[0];
          formItem.purchase_unit_id = unit.id;

          // Recalculate stock units and costs if purchase_quantity is set
          const pQty = parseFloat(formItem.purchase_quantity) || 0;
          const pPrice = parseFloat(formItem.purchase_unit_price) || 0;
          const stockUnits = pQty * unit.multiplier;

          if (stockUnits > 0) {
            formItem.quantity = stockUnits.toString();
          }
          if (pQty > 0 && pPrice >= 0) {
            const totalCost = pPrice * pQty;
            formItem.total_cost = totalCost.toFixed(2);
            if (stockUnits > 0) {
              formItem.unit_cost = (totalCost / stockUnits).toFixed(2);
            }
          }
        }
      }

      // Determine whether to replace or append
      const hasFilledItems = items.some((item) => item.item_id !== "");
      if (hasFilledItems) {
        setItems((prev) => [...prev, ...importedItems]);
      } else {
        setItems(importedItems);
      }

      setPurchaseUnits((prev) => ({ ...prev, ...newPurchaseUnits }));

      // Show result toast
      let msg = `Imported ${importedItems.length} item${importedItems.length > 1 ? "s" : ""}`;
      if (createdCount > 0) {
        msg += ` (${createdCount} new sub-item${createdCount > 1 ? "s" : ""} created)`;
      }
      if (purchaseUnitsCreated > 0) {
        msg += ` (${purchaseUnitsCreated} purchase unit${purchaseUnitsCreated > 1 ? "s" : ""} created)`;
      }
      if (skipped > 0) {
        msg += ` (${skipped} skipped)`;
      }
      showToast(msg, "success");
    } catch (err: any) {
      console.error("CSV import error:", err);
      showToast(
        `Failed to import CSV: ${err.message || "Unknown error"}`,
        "error",
      );
    }
  }

  async function handleItemChange(
    index: number,
    field: keyof TransactionItemForm,
    value: string,
  ) {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;

    if (field === "item_id" && value) {
      const item = inventoryItems.find((i) => i.id === value);
      if (item && item.id) {
        newItems[index].brand = item.brand || "";
        newItems[index].isAddingNewBrand = false;

        const units = await fetchPurchaseUnitsForItem(item.id);
        setPurchaseUnits((prev) => ({ ...prev, [item.id!]: units }));

        if (transactionType === "in") {
          newItems[index].unit_cost = item.unit_cost.toString();

          // Smart purchase unit selection logic
          if (units.length === 0) {
            // No purchase units exist - auto-open "add new" mode
            newItems[index].purchase_unit_id = "__add_new__";
            newItems[index].isAddingPurchaseUnit = true;
            newItems[index].newPurchaseUnitName = "";
            newItems[index].newPurchaseUnitMultiplier = "";
            newItems[index].isCustomPurchaseUnit = false;
            newItems[index].customPurchaseUnitName = "";
          } else {
            // Purchase units exist - try to select the last used one
            const preference = await getLastUsedPurchaseUnit(item.id);

            if (preference?.last_used_purchase_unit_id) {
              // Check if the preferred unit still exists
              const preferredUnit = units.find(
                (u) => u.id === preference.last_used_purchase_unit_id,
              );
              if (preferredUnit) {
                newItems[index].purchase_unit_id = preferredUnit.id;
              } else {
                // Fallback to default unit
                const defaultUnit = units.find((u) => u.is_default);
                newItems[index].purchase_unit_id =
                  defaultUnit?.id || units[0].id;
              }
            } else {
              // No preference - select default or first unit
              const defaultUnit = units.find((u) => u.is_default);
              newItems[index].purchase_unit_id = defaultUnit?.id || units[0].id;
            }

            // Reset add purchase unit state
            newItems[index].isAddingPurchaseUnit = false;
            newItems[index].newPurchaseUnitName = "";
            newItems[index].newPurchaseUnitMultiplier = "";
            newItems[index].isCustomPurchaseUnit = false;
            newItems[index].customPurchaseUnitName = "";
          }
        } else {
          newItems[index].unit_cost = item.unit_cost.toString();
        }
      }
    }

    if (transactionType === "in") {
      const item = newItems[index];

      // Check if we're in "adding purchase unit" mode with temporary values
      let multiplier: number | null = null;

      if (item.isAddingPurchaseUnit && item.newPurchaseUnitMultiplier) {
        // Use temporary multiplier from the form
        multiplier = parseFloat(item.newPurchaseUnitMultiplier);
      } else if (
        item.purchase_unit_id &&
        item.purchase_unit_id !== "__add_new__"
      ) {
        // Use saved purchase unit multiplier
        const purchaseUnit = Object.values(purchaseUnits)
          .flat()
          .find((u) => u.id === item.purchase_unit_id);
        if (purchaseUnit) {
          multiplier = purchaseUnit.multiplier;
        }
      }

      // Calculate quantity, total_cost, and unit_cost if we have a valid multiplier
      if (multiplier && multiplier > 0) {
        const purchaseQty = parseFloat(item.purchase_quantity) || 0;
        const purchasePrice = parseFloat(item.purchase_unit_price) || 0;
        const stockUnits = purchaseQty * multiplier;

        newItems[index].quantity = stockUnits.toString();

        if (purchaseQty > 0 && purchasePrice >= 0) {
          const totalCost = purchasePrice * purchaseQty;
          newItems[index].total_cost = totalCost.toFixed(2);

          if (stockUnits > 0) {
            newItems[index].unit_cost = (totalCost / stockUnits).toFixed(2);
          }
        }
      }
    }

    setItems(newItems);
  }

  function calculateTotalValue(): number {
    return items.reduce((total, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.unit_cost) || 0;
      return total + qty * cost;
    }, 0);
  }

  async function uploadItemPhotos(
    transactionId: string,
    validItems: TransactionItemForm[],
  ): Promise<void> {
    if (!itemPhotos.hasPendingPhotos) return;

    // Query the created transaction items to get their IDs
    const { data: createdItems, error: fetchError } = await supabase
      .from("inventory_transaction_items")
      .select("id, item_id")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: true });

    if (fetchError || !createdItems) {
      console.error(
        "Failed to fetch created transaction items for photo upload:",
        fetchError,
      );
      return;
    }

    // Build index-to-itemId map: match validItems order to createdItems order
    const indexToItemIdMap = new Map<number, string>();
    for (let vi = 0; vi < validItems.length; vi++) {
      const originalIndex = items.findIndex((i) => i === validItems[vi]);
      const createdItem = createdItems.find(
        (ci) => ci.item_id === validItems[vi].item_id,
      );
      if (createdItem && originalIndex >= 0) {
        indexToItemIdMap.set(originalIndex, createdItem.id);
      }
    }

    const uploadSuccess = await itemPhotos.uploadAllPhotos(
      transactionId,
      indexToItemIdMap,
    );
    if (!uploadSuccess) {
      console.error("Some photos failed to upload");
    }
  }

  async function addInvoicePhoto(file: File) {
    if (pendingInvoicePhotos.length >= 3) {
      showToast("Maximum 3 invoice photos", "error");
      return;
    }
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      showToast("Invalid file type. Please use JPG, PNG, or WebP", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("File too large. Maximum 5MB allowed", "error");
      return;
    }
    try {
      const compressedBlob = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressedBlob);
      setPendingInvoicePhotos((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          file,
          compressedBlob,
          previewUrl,
          filename: file.name,
        },
      ]);
    } catch (err) {
      console.error("Error preparing invoice photo:", err);
      showToast("Failed to process photo", "error");
    }
  }

  function removeInvoicePhoto(id: string) {
    setPendingInvoicePhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function uploadInvoicePhotos(transactionId: string) {
    if (pendingInvoicePhotos.length === 0) return;
    if (!selectedStoreId || !session?.employee_id) return;

    const storageConfig = getStorageConfig();
    if (!storageConfig?.r2Config?.publicUrl) return;

    let storage: StorageService;
    try {
      storage = getStorageService(storageConfig);
    } catch {
      return;
    }

    for (let i = 0; i < pendingInvoicePhotos.length; i++) {
      const pending = pendingInvoicePhotos[i];
      const timestamp = Date.now();
      const uuid = crypto.randomUUID();
      const filename = `${timestamp}_${uuid}.jpg`;
      const storagePath = `invoices/${selectedStoreId}/${transactionId}/${filename}`;

      const uploadResult = await storage.upload(
        storagePath,
        pending.compressedBlob,
        {
          contentType: "image/jpeg",
          cacheControl: "3600",
        },
      );

      if (!uploadResult.success) {
        console.error("Failed to upload invoice photo:", uploadResult.error);
        continue;
      }

      const photoData: Omit<
        InventoryTransactionInvoicePhoto,
        "id" | "created_at"
      > = {
        store_id: selectedStoreId,
        transaction_id: transactionId,
        storage_path: storagePath,
        filename: pending.filename,
        file_size: pending.compressedBlob.size,
        mime_type: "image/jpeg",
        display_order: i,
        uploaded_by: session.employee_id,
        caption: "",
      };

      const { error: insertError } = await supabase
        .from("inventory_transaction_invoice_photos")
        .insert(photoData);

      if (insertError) {
        console.error("Failed to save invoice photo record:", insertError);
      }

      URL.revokeObjectURL(pending.previewUrl);
    }

    setPendingInvoicePhotos([]);
  }

  async function createTransaction(): Promise<void> {
    if (!selectedStoreId || !session?.employee_id) {
      throw new Error("Missing required data");
    }

    const savedPurchaseUnitsRef = new Map<
      number,
      { id: string; multiplier: number }
    >();

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (item.isAddingPurchaseUnit && item.item_id) {
        const unitName = item.isCustomPurchaseUnit
          ? item.customPurchaseUnitName.trim()
          : item.newPurchaseUnitName.trim();

        if (!unitName || !item.newPurchaseUnitMultiplier) {
          continue;
        }

        const multiplier = parseFloat(item.newPurchaseUnitMultiplier);
        if (multiplier <= 0) {
          continue;
        }

        const invItem = inventoryItems.find((i) => i.id === item.item_id);
        if (!invItem?.id) {
          continue;
        }

        const existingUnits = purchaseUnits[invItem.id] || [];
        const duplicateUnit = existingUnits.find(
          (u) =>
            u.unit_name.toLowerCase() === unitName.toLowerCase() &&
            u.multiplier === multiplier,
        );

        if (duplicateUnit) {
          savedPurchaseUnitsRef.set(index, {
            id: duplicateUnit.id,
            multiplier: duplicateUnit.multiplier,
          });
        }
      }
    }

    // Admin can self-approve - skip manager approval requirement
    const canSelfApprove =
      session.role && Permissions.inventory.canSelfApprove(session.role);

    const { data: transactionResult, error: transactionError } =
      await supabase.rpc("create_inventory_transaction_atomic", {
        p_store_id: selectedStoreId,
        p_transaction_type: transactionType,
        p_requested_by_id: session.employee_id,
        p_recipient_id: transactionType === "out" ? recipientId : null,
        p_supplier_id:
          transactionType === "in" && supplierId ? supplierId : null,
        p_invoice_reference:
          transactionType === "in" && invoiceReference
            ? invoiceReference.trim()
            : null,
        p_notes: notes.trim(),
        p_requires_manager_approval: !canSelfApprove, // Admin doesn't require approval
        p_requires_recipient_approval: transactionType === "out",
        p_destination_store_id:
          transactionType === "transfer" ? destinationStoreId : null,
      });

    if (transactionError) throw transactionError;
    if (!transactionResult || transactionResult.length === 0) {
      throw new Error("Failed to create transaction");
    }

    const transaction = transactionResult[0];

    const validItems = items.filter(
      (item) => item.item_id && parseFloat(item.quantity) > 0,
    );

    const itemsData = validItems.map((item) => {
      const originalIndex = items.findIndex((i) => i === item);

      let purchaseUnit = null;
      if (item.purchase_unit_id) {
        const savedUnit = savedPurchaseUnitsRef.get(originalIndex);
        if (savedUnit && savedUnit.id === item.purchase_unit_id) {
          purchaseUnit = savedUnit;
        } else {
          purchaseUnit = Object.values(purchaseUnits)
            .flat()
            .find((u) => u.id === item.purchase_unit_id);
        }
      }

      return {
        item_id: item.item_id,
        quantity: parseFloat(item.quantity),
        unit_cost: parseFloat(item.unit_cost) || 0,
        purchase_unit_id:
          transactionType === "in" ? item.purchase_unit_id || null : null,
        purchase_quantity:
          transactionType === "in" && item.purchase_quantity
            ? parseFloat(item.purchase_quantity)
            : null,
        purchase_unit_price:
          transactionType === "in" && item.purchase_unit_price
            ? parseFloat(item.purchase_unit_price)
            : null,
        purchase_unit_multiplier:
          transactionType === "in" && purchaseUnit
            ? purchaseUnit.multiplier
            : null,
        notes: item.notes.trim(),
      };
    });

    const { data: itemsResult, error: itemsError } = await supabase.rpc(
      "insert_transaction_items_batch",
      {
        p_transaction_id: transaction.id,
        p_items: itemsData,
      },
    );

    if (itemsError) throw itemsError;
    if (!itemsResult || itemsResult.length === 0 || !itemsResult[0].success) {
      throw new Error(
        itemsResult?.[0]?.message || "Failed to insert transaction items",
      );
    }

    if (transactionType === "transfer") {
      // Skip purchase unit preference updates for transfers
    } else if (transactionType === "in" && session?.employee_id) {
      for (const item of validItems) {
        const inventoryItem = inventoryItems.find((i) => i.id === item.item_id);
        if (item.purchase_unit_id && inventoryItem?.id) {
          await supabase.rpc("update_product_preference", {
            p_store_id: selectedStoreId,
            p_item_id: inventoryItem.id,
            p_purchase_unit_id: item.purchase_unit_id,
            p_purchase_cost: parseFloat(item.unit_cost) || 0,
            p_updated_by_id: session.employee_id,
          });
        }
      }
    }

    // Upload pending item photos and invoice photos
    if (transactionType === "in") {
      await uploadItemPhotos(transaction.id, validItems);
      await uploadInvoicePhotos(transaction.id);
    }

    showToast(
      `Transaction ${transaction.transaction_number} created and sent for approval`,
      "success",
    );
  }

  async function handleSaveDraft() {
    if (!selectedStoreId || !session?.employee_id) {
      showToast("Missing required data", "error");
      return;
    }

    setSavingDraft(true);

    try {
      let updatedItems = [...items];

      // Auto-save in-progress purchase units (form open, fields filled, checkmark not clicked)
      if (transactionType === "in") {
        for (let index = 0; index < updatedItems.length; index++) {
          const item = updatedItems[index];
          if (item.isAddingPurchaseUnit && item.item_id) {
            const unitName = item.isCustomPurchaseUnit
              ? item.customPurchaseUnitName.trim()
              : item.newPurchaseUnitName.trim();

            if (!unitName) {
              showToast(
                `Item ${index + 1}: Please enter a purchase unit name or cancel the purchase unit form`,
                "error",
              );
              setSavingDraft(false);
              return;
            }

            if (!item.newPurchaseUnitMultiplier) {
              showToast(
                `Item ${index + 1}: Please enter the purchase unit multiplier (quantity)`,
                "error",
              );
              setSavingDraft(false);
              return;
            }

            const multiplier = parseFloat(item.newPurchaseUnitMultiplier);
            if (multiplier <= 0) {
              showToast(
                `Item ${index + 1}: Multiplier must be greater than zero`,
                "error",
              );
              setSavingDraft(false);
              return;
            }

            try {
              const invItem = inventoryItems.find((i) => i.id === item.item_id);
              if (!invItem?.id) {
                showToast(
                  `Item ${index + 1}: Item does not have a master item ID`,
                  "error",
                );
                setSavingDraft(false);
                return;
              }

              const existingUnits = purchaseUnits[invItem.id] || [];

              const duplicateUnit = existingUnits.find(
                (u) =>
                  u.unit_name.toLowerCase() === unitName.toLowerCase() &&
                  u.multiplier === multiplier,
              );

              let purchaseUnitData;

              if (duplicateUnit) {
                purchaseUnitData = {
                  id: duplicateUnit.id,
                  multiplier: duplicateUnit.multiplier,
                };
              } else {
                const isFirstUnit = existingUnits.length === 0;

                const { data, error } = await supabase
                  .from("store_product_purchase_units")
                  .insert({
                    store_id: selectedStoreId,
                    item_id: invItem.id,
                    unit_name: unitName,
                    multiplier,
                    is_default: isFirstUnit,
                    display_order: existingUnits.length,
                  })
                  .select()
                  .single();

                if (error) {
                  if (error.code === "23505") {
                    const { data: existingUnit } = await supabase
                      .from("store_product_purchase_units")
                      .select("*")
                      .eq("store_id", selectedStoreId)
                      .eq("item_id", invItem.id)
                      .ilike("unit_name", unitName)
                      .eq("multiplier", multiplier)
                      .maybeSingle();

                    if (existingUnit) {
                      purchaseUnitData = {
                        id: existingUnit.id,
                        multiplier: existingUnit.multiplier,
                      };
                    } else {
                      showToast(
                        `Item ${index + 1}: A purchase unit with this name already exists`,
                        "error",
                      );
                      setSavingDraft(false);
                      return;
                    }
                  } else {
                    console.error(
                      `Error saving purchase unit for item ${index + 1}:`,
                      error,
                    );
                    showToast(
                      `Item ${index + 1}: Failed to save purchase unit - ${error.message}`,
                      "error",
                    );
                    setSavingDraft(false);
                    return;
                  }
                } else {
                  purchaseUnitData = {
                    id: data.id,
                    multiplier: data.multiplier,
                  };
                }
              }

              // Update the item with the saved purchase unit
              updatedItems[index] = {
                ...updatedItems[index],
                purchase_unit_id: purchaseUnitData.id,
                isAddingPurchaseUnit: false,
              };

              // Recalculate quantity/costs if purchase_quantity is set
              if (updatedItems[index].purchase_quantity) {
                const purchaseQty = parseFloat(
                  updatedItems[index].purchase_quantity,
                );
                const stockQty = purchaseQty * purchaseUnitData.multiplier;
                updatedItems[index] = {
                  ...updatedItems[index],
                  quantity: stockQty.toString(),
                };
                if (updatedItems[index].purchase_unit_price) {
                  const purchaseUnitPrice = parseFloat(
                    updatedItems[index].purchase_unit_price,
                  );
                  const totalCost = purchaseQty * purchaseUnitPrice;
                  const unitCost = stockQty > 0 ? totalCost / stockQty : 0;
                  updatedItems[index] = {
                    ...updatedItems[index],
                    total_cost: totalCost.toFixed(2),
                    unit_cost: unitCost.toFixed(2),
                  };
                }
              }

              // Update purchase units cache
              const updatedUnits = await fetchPurchaseUnitsForItem(invItem.id);
              setPurchaseUnits((prev) => ({
                ...prev,
                [invItem.id!]: updatedUnits,
              }));
            } catch (error: any) {
              console.error("Error auto-saving purchase unit:", error);
              showToast(
                `Item ${index + 1}: Failed to save purchase unit - ${error.message || "Unknown error"}`,
                "error",
              );
              setSavingDraft(false);
              return;
            }
          }
        }

        setItems(updatedItems);
      }

      const validItems = updatedItems.filter((item) => item.item_id);

      const canSelfApprove =
        session.role && Permissions.inventory.canSelfApprove(session.role);

      if (isEditingPending && draftId) {
        // Update existing pending transaction
        const { error: updateError } = await supabase.rpc(
          "update_pending_transaction",
          {
            p_transaction_id: draftId,
            p_transaction_type: transactionType,
            p_recipient_id:
              transactionType === "out" ? recipientId || null : null,
            p_supplier_id:
              transactionType === "in" && supplierId ? supplierId : null,
            p_invoice_reference:
              transactionType === "in" && invoiceReference
                ? invoiceReference.trim()
                : null,
            p_notes: notes.trim(),
            p_destination_store_id:
              transactionType === "transfer"
                ? destinationStoreId || null
                : null,
          },
        );

        if (updateError) throw updateError;

        // Delete existing items and re-insert
        const { error: deleteItemsError } = await supabase
          .from("inventory_transaction_items")
          .delete()
          .eq("transaction_id", draftId);

        if (deleteItemsError) throw deleteItemsError;

        if (validItems.length > 0) {
          const itemsData = validItems.map((item) => ({
            item_id: item.item_id,
            quantity: parseFloat(item.quantity) || 0,
            unit_cost: parseFloat(item.unit_cost) || 0,
            purchase_unit_id:
              transactionType === "in" ? item.purchase_unit_id || null : null,
            purchase_quantity:
              transactionType === "in" && item.purchase_quantity
                ? parseFloat(item.purchase_quantity)
                : null,
            purchase_unit_price:
              transactionType === "in" && item.purchase_unit_price
                ? parseFloat(item.purchase_unit_price)
                : null,
            purchase_unit_multiplier: null,
            notes: item.notes.trim(),
          }));

          const { error: insertError } = await supabase.rpc(
            "insert_transaction_items_batch",
            {
              p_transaction_id: draftId,
              p_items: itemsData,
            },
          );

          if (insertError) throw insertError;
        }

        showToast("Transaction updated", "success");
        onSuccess();
        onClose();
        return;
      } else if (draftId) {
        // Update existing draft
        const { error: updateError } = await supabase.rpc(
          "update_draft_transaction",
          {
            p_transaction_id: draftId,
            p_transaction_type: transactionType,
            p_recipient_id:
              transactionType === "out" ? recipientId || null : null,
            p_supplier_id:
              transactionType === "in" && supplierId ? supplierId : null,
            p_invoice_reference:
              transactionType === "in" && invoiceReference
                ? invoiceReference.trim()
                : null,
            p_notes: notes.trim(),
            p_destination_store_id:
              transactionType === "transfer"
                ? destinationStoreId || null
                : null,
          },
        );

        if (updateError) throw updateError;

        // Delete existing items and re-insert
        const { error: deleteItemsError } = await supabase
          .from("inventory_transaction_items")
          .delete()
          .eq("transaction_id", draftId);

        if (deleteItemsError) throw deleteItemsError;

        if (validItems.length > 0) {
          const itemsData = validItems.map((item) => ({
            item_id: item.item_id,
            quantity: parseFloat(item.quantity) || 0,
            unit_cost: parseFloat(item.unit_cost) || 0,
            purchase_unit_id:
              transactionType === "in" ? item.purchase_unit_id || null : null,
            purchase_quantity:
              transactionType === "in" && item.purchase_quantity
                ? parseFloat(item.purchase_quantity)
                : null,
            purchase_unit_price:
              transactionType === "in" && item.purchase_unit_price
                ? parseFloat(item.purchase_unit_price)
                : null,
            purchase_unit_multiplier: null,
            notes: item.notes.trim(),
          }));

          const { error: insertError } = await supabase.rpc(
            "insert_transaction_items_batch",
            {
              p_transaction_id: draftId,
              p_items: itemsData,
            },
          );

          if (insertError) throw insertError;
        }

        showToast("Draft updated", "success");
      } else {
        // Create new draft
        const { data: transactionResult, error: transactionError } =
          await supabase.rpc("create_inventory_transaction_atomic", {
            p_store_id: selectedStoreId,
            p_transaction_type: transactionType,
            p_requested_by_id: session.employee_id,
            p_recipient_id:
              transactionType === "out" ? recipientId || null : null,
            p_supplier_id:
              transactionType === "in" && supplierId ? supplierId : null,
            p_invoice_reference:
              transactionType === "in" && invoiceReference
                ? invoiceReference.trim()
                : null,
            p_notes: notes.trim(),
            p_requires_manager_approval: !canSelfApprove,
            p_requires_recipient_approval: transactionType === "out",
            p_destination_store_id:
              transactionType === "transfer"
                ? destinationStoreId || null
                : null,
            p_status: "draft",
          });

        if (transactionError) throw transactionError;
        if (!transactionResult || transactionResult.length === 0) {
          throw new Error("Failed to create draft transaction");
        }

        const newDraftId = transactionResult[0].id;
        setDraftId(newDraftId);

        if (validItems.length > 0) {
          const itemsData = validItems.map((item) => ({
            item_id: item.item_id,
            quantity: parseFloat(item.quantity) || 0,
            unit_cost: parseFloat(item.unit_cost) || 0,
            purchase_unit_id:
              transactionType === "in" ? item.purchase_unit_id || null : null,
            purchase_quantity:
              transactionType === "in" && item.purchase_quantity
                ? parseFloat(item.purchase_quantity)
                : null,
            purchase_unit_price:
              transactionType === "in" && item.purchase_unit_price
                ? parseFloat(item.purchase_unit_price)
                : null,
            purchase_unit_multiplier: null,
            notes: item.notes.trim(),
          }));

          const { error: insertError } = await supabase.rpc(
            "insert_transaction_items_batch",
            {
              p_transaction_id: newDraftId,
              p_items: itemsData,
            },
          );

          if (insertError) throw insertError;
        }

        showToast("Draft saved", "success");
      }

      // Update item brands if changed
      if (transactionType === "in") {
        for (const item of validItems) {
          const invItem = inventoryItems.find((i) => i.id === item.item_id);
          if (invItem && item.brand !== (invItem.brand || "")) {
            await supabase
              .from("inventory_items")
              .update({ brand: item.brand.trim() || null })
              .eq("id", item.item_id);
          }
        }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error saving draft:", error);
      showToast(
        `Failed to save draft: ${error.message || "Unknown error"}`,
        "error",
      );
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleDeleteDraft() {
    if (!draftId || !session?.employee_id) return;
    if (!confirm("Delete this draft?")) return;
    setDeletingDraft(true);
    try {
      const { error } = await supabase.rpc("delete_draft_transaction", {
        p_transaction_id: draftId,
        p_employee_id: session.employee_id,
      });
      if (error) throw error;
      showToast("Draft deleted", "success");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error deleting draft:", error);
      showToast(
        `Failed to delete draft: ${error.message || "Unknown error"}`,
        "error",
      );
    } finally {
      setDeletingDraft(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedStoreId || !session?.employee_id) {
      showToast("Missing required data", "error");
      return;
    }

    if (transactionType === "out" && !recipientId) {
      showToast("Please select a recipient for OUT transaction", "error");
      return;
    }

    if (transactionType === "transfer" && !destinationStoreId) {
      showToast("Please select a destination store", "error");
      return;
    }

    // Track newly saved purchase units locally to avoid state sync issues
    const savedPurchaseUnits = new Map<
      number,
      { id: string; multiplier: number }
    >();
    let updatedItems = [...items];

    // Auto-save in-progress purchase units for IN transactions (handles isAddingPurchaseUnit still being true)
    if (transactionType === "in") {
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (item.isAddingPurchaseUnit && item.item_id) {
          const unitName = item.isCustomPurchaseUnit
            ? item.customPurchaseUnitName.trim()
            : item.newPurchaseUnitName.trim();

          if (!unitName) {
            showToast(
              `Item ${index + 1}: Please enter a purchase unit name or cancel the purchase unit form`,
              "error",
            );
            return;
          }

          if (!item.newPurchaseUnitMultiplier) {
            showToast(
              `Item ${index + 1}: Please enter the purchase unit multiplier (quantity)`,
              "error",
            );
            return;
          }

          const multiplier = parseFloat(item.newPurchaseUnitMultiplier);
          if (multiplier <= 0) {
            showToast(
              `Item ${index + 1}: Multiplier must be greater than zero`,
              "error",
            );
            return;
          }

          try {
            const invItem = inventoryItems.find((i) => i.id === item.item_id);
            if (!invItem?.id) {
              showToast(
                `Item ${index + 1}: Item does not have a master item ID`,
                "error",
              );
              return;
            }

            const existingUnits = purchaseUnits[invItem.id] || [];

            // Check for duplicate unit name + multiplier (case-insensitive)
            const duplicateUnit = existingUnits.find(
              (u) =>
                u.unit_name.toLowerCase() === unitName.toLowerCase() &&
                u.multiplier === multiplier,
            );

            let purchaseUnitData;

            if (duplicateUnit) {
              // Unit already exists with same name and multiplier - reuse it
              purchaseUnitData = {
                id: duplicateUnit.id,
                multiplier: duplicateUnit.multiplier,
              };
            } else {
              // Create new unit
              const isFirstUnit = existingUnits.length === 0;

              const { data, error } = await supabase
                .from("store_product_purchase_units")
                .insert({
                  store_id: selectedStoreId,
                  item_id: invItem.id,
                  unit_name: unitName,
                  multiplier,
                  is_default: isFirstUnit,
                  display_order: existingUnits.length,
                })
                .select()
                .single();

              if (error) {
                if (error.code === "23505") {
                  // Duplicate error - fetch the existing unit instead
                  const { data: existingUnit } = await supabase
                    .from("store_product_purchase_units")
                    .select("*")
                    .eq("store_id", selectedStoreId)
                    .eq("item_id", invItem.id)
                    .ilike("unit_name", unitName)
                    .eq("multiplier", multiplier)
                    .maybeSingle();

                  if (existingUnit) {
                    purchaseUnitData = {
                      id: existingUnit.id,
                      multiplier: existingUnit.multiplier,
                    };
                  } else {
                    showToast(
                      `Item ${index + 1}: A purchase unit with this name already exists`,
                      "error",
                    );
                    return;
                  }
                } else {
                  console.error(
                    `Error saving purchase unit for item ${index + 1}:`,
                    error,
                  );
                  showToast(
                    `Item ${index + 1}: Failed to save purchase unit - ${error.message}`,
                    "error",
                  );
                  return;
                }
              } else {
                purchaseUnitData = { id: data.id, multiplier: data.multiplier };
              }
            }

            // Store locally for immediate use
            savedPurchaseUnits.set(index, {
              id: purchaseUnitData.id,
              multiplier: purchaseUnitData.multiplier,
            });

            // Update the item in the local array
            updatedItems[index] = {
              ...updatedItems[index],
              purchase_unit_id: purchaseUnitData.id,
              isAddingPurchaseUnit: false,
            };

            // Update purchase units cache
            const updatedUnits = await fetchPurchaseUnitsForItem(invItem.id);
            setPurchaseUnits((prev) => ({
              ...prev,
              [invItem.id!]: updatedUnits,
            }));
          } catch (error: any) {
            console.error("Error auto-saving purchase unit:", error);
            showToast(
              `Item ${index + 1}: Failed to save purchase unit - ${error.message || "Unknown error"}`,
              "error",
            );
            return;
          }
        }
      }

      // Update state with all saved purchase units at once
      setItems(updatedItems);
    }

    // Use updatedItems instead of items to ensure we have the latest purchase_unit_id values
    const validItems = updatedItems.filter(
      (item) => item.item_id && parseFloat(item.quantity) > 0,
    );
    if (validItems.length === 0) {
      showToast("Please add at least one item with quantity", "error");
      return;
    }

    if (transactionType === "out" || transactionType === "transfer") {
      for (const item of validItems) {
        const inventoryItem = inventoryItems.find((i) => i.id === item.item_id);
        if (
          inventoryItem &&
          parseFloat(item.quantity) > inventoryItem.quantity_on_hand
        ) {
          showToast(
            `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity_on_hand}`,
            "error",
          );
          return;
        }
      }
    }

    try {
      setSaving(true);

      if (draftId) {
        // Draft-to-pending flow: update header, re-insert items, then submit
        const canSelfApprove =
          session.role && Permissions.inventory.canSelfApprove(session.role);

        // 1. Update header fields
        const { error: updateError } = await supabase.rpc(
          "update_draft_transaction",
          {
            p_transaction_id: draftId,
            p_transaction_type: transactionType,
            p_recipient_id:
              transactionType === "out" ? recipientId || null : null,
            p_supplier_id:
              transactionType === "in" && supplierId ? supplierId : null,
            p_invoice_reference:
              transactionType === "in" && invoiceReference
                ? invoiceReference.trim()
                : null,
            p_notes: notes.trim(),
            p_destination_store_id:
              transactionType === "transfer"
                ? destinationStoreId || null
                : null,
          },
        );
        if (updateError) throw updateError;

        // 2. Delete existing items and re-insert
        const { error: deleteItemsError } = await supabase
          .from("inventory_transaction_items")
          .delete()
          .eq("transaction_id", draftId);
        if (deleteItemsError) throw deleteItemsError;

        const itemsData = validItems.map((item) => {
          const originalIndex = updatedItems.findIndex((i) => i === item);
          let purchaseUnit = null;
          if (item.purchase_unit_id) {
            const savedUnit = savedPurchaseUnits.get(originalIndex);
            if (savedUnit && savedUnit.id === item.purchase_unit_id) {
              purchaseUnit = savedUnit;
            } else {
              purchaseUnit = Object.values(purchaseUnits)
                .flat()
                .find((u) => u.id === item.purchase_unit_id);
            }
          }
          return {
            item_id: item.item_id,
            quantity: parseFloat(item.quantity),
            unit_cost: parseFloat(item.unit_cost) || 0,
            purchase_unit_id:
              transactionType === "in" ? item.purchase_unit_id || null : null,
            purchase_quantity:
              transactionType === "in" && item.purchase_quantity
                ? parseFloat(item.purchase_quantity)
                : null,
            purchase_unit_price:
              transactionType === "in" && item.purchase_unit_price
                ? parseFloat(item.purchase_unit_price)
                : null,
            purchase_unit_multiplier:
              transactionType === "in" && purchaseUnit
                ? purchaseUnit.multiplier
                : null,
            notes: item.notes.trim(),
          };
        });

        const { error: insertError } = await supabase.rpc(
          "insert_transaction_items_batch",
          {
            p_transaction_id: draftId,
            p_items: itemsData,
          },
        );
        if (insertError) throw insertError;

        // 3. Submit the draft (transitions to pending with real transaction number)
        const { data: submitResult, error: submitError } = await supabase.rpc(
          "submit_draft_transaction",
          {
            p_transaction_id: draftId,
            p_requires_manager_approval: !canSelfApprove,
            p_requires_recipient_approval: transactionType === "out",
          },
        );
        if (submitError) throw submitError;

        const realTxnNumber =
          submitResult?.[0]?.transaction_number || "Unknown";

        // Update purchase unit preferences for IN transactions
        if (transactionType === "in" && session?.employee_id) {
          for (const item of validItems) {
            const inventoryItem = inventoryItems.find(
              (i) => i.id === item.item_id,
            );
            if (item.purchase_unit_id && inventoryItem?.id) {
              await supabase.rpc("update_product_preference", {
                p_store_id: selectedStoreId,
                p_item_id: inventoryItem.id,
                p_purchase_unit_id: item.purchase_unit_id,
                p_purchase_cost: parseFloat(item.unit_cost) || 0,
                p_updated_by_id: session.employee_id,
              });
            }
          }
        }

        // Upload pending item photos and invoice photos
        if (transactionType === "in") {
          await uploadItemPhotos(draftId, validItems);
          await uploadInvoicePhotos(draftId);
        }

        showToast(
          `Transaction ${realTxnNumber} submitted for approval`,
          "success",
        );
      } else {
        await createTransaction();
      }

      // Update item brands if changed
      if (transactionType === "in") {
        for (const item of validItems) {
          const invItem = inventoryItems.find((i) => i.id === item.item_id);
          if (invItem && item.brand !== (invItem.brand || "")) {
            await supabase
              .from("inventory_items")
              .update({ brand: item.brand.trim() || null })
              .eq("id", item.item_id);
          }
        }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error creating transaction:", error);

      let errorMessage = "Failed to create transaction";
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }

      if (error.details) {
        console.error("Error details:", error.details);
      }
      if (error.hint) {
        console.error("Error hint:", error.hint);
      }

      showToast(errorMessage, "error");
    } finally {
      setSaving(false);
    }
  }

  function getAvailableStock(itemId: string): number {
    const item = inventoryItems.find((i) => i.id === itemId);
    return item?.quantity_on_hand || 0;
  }

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={
          isEditingPending
            ? "Edit Pending Transaction"
            : draftId
              ? "Edit Draft Transaction"
              : "New Inventory Transaction"
        }
        size="xl"
        footer={
          <>
            <div className="flex justify-between items-center text-sm font-semibold mb-3">
              <span>Total Transaction Value:</span>
              <span className="text-lg text-blue-600">
                ${calculateTotalValue().toFixed(2)}
              </span>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional transaction notes"
                rows={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              {draftId && !isEditingPending && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDeleteDraft}
                  disabled={saving || savingDraft || deletingDraft}
                >
                  {deletingDraft ? "Deleting..." : "Delete Draft"}
                </Button>
              )}
              <div className="flex-1" />
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={saving || savingDraft || deletingDraft}
              >
                Cancel
              </Button>
              {isEditingPending ? (
                <Button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                >
                  {savingDraft ? "Saving..." : "Save Changes"}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSaveDraft}
                    disabled={saving || savingDraft || deletingDraft}
                  >
                    {savingDraft ? "Saving..." : "Save Draft"}
                  </Button>
                  <Button
                    type="submit"
                    form="inventory-transaction-form"
                    disabled={saving || savingDraft || deletingDraft}
                  >
                    {saving
                      ? "Submitting..."
                      : draftId
                        ? "Submit for Approval"
                        : "Create Transaction"}
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              {isEditingPending ? (
                "This transaction will remain pending after saving changes."
              ) : transactionType === "transfer" ? (
                "This transfer will require approval from the destination store manager"
              ) : (
                <>
                  This transaction will require manager approval
                  {transactionType === "out" && " and recipient approval"}{" "}
                  before inventory is updated.
                </>
              )}
            </p>
          </>
        }
      >
        <form
          id="inventory-transaction-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            {!initialTransactionType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Type <span className="text-red-500">*</span>
                </label>
                <Select
                  value={transactionType}
                  onChange={(e) =>
                    setTransactionType(
                      e.target.value as "in" | "out" | "transfer",
                    )
                  }
                  disabled={isEditingPending}
                >
                  <option value="in">IN - Receiving Items</option>
                  <option value="out">OUT - Giving to Employee</option>
                  <option value="transfer">TRANSFER - Store-to-Store</option>
                </Select>
              </div>
            )}

            {transactionType === "in" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier
                </label>
                <Select
                  value={supplierId}
                  onChange={(e) => handleSupplierDropdownChange(e.target.value)}
                >
                  <option value="">Select Supplier (Optional)</option>
                  <option
                    value="__add_new__"
                    className="text-blue-600 font-medium"
                  >
                    + Add New Supplier
                  </option>
                  {suppliers.length > 0 && <option disabled>──────────</option>}
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {transactionType === "out" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient <span className="text-red-500">*</span>
                </label>
                <Select
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.display_name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {transactionType === "transfer" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destination Store <span className="text-red-500">*</span>
                </label>
                <Select
                  value={destinationStoreId}
                  onChange={(e) => setDestinationStoreId(e.target.value)}
                  required
                >
                  <option value="">Select Store</option>
                  {availableStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {transactionType === "in" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice/PO Reference
                </label>
                <Input
                  value={invoiceReference}
                  onChange={(e) => setInvoiceReference(e.target.value)}
                  placeholder="e.g., INV-2024-001 or PO-1234"
                />
              </div>
            )}

            {transactionType === "in" && isR2Configured() && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Photo
                </label>
                <div className="flex gap-2 flex-wrap items-center">
                  {pendingInvoicePhotos.map((photo) => (
                    <PhotoThumbnail
                      key={photo.id}
                      photo={photo}
                      isPending
                      canDelete
                      onDelete={() => removeInvoicePhoto(photo.id)}
                      size="sm"
                    />
                  ))}
                  {pendingInvoicePhotos.length < 3 && (
                    <button
                      type="button"
                      onClick={() => invoicePhotoInputRef.current?.click()}
                      className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                    >
                      <FileText className="w-5 h-5" />
                      <span className="text-[10px] mt-0.5">Invoice</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-gray-900">Items</h4>
              <div className="flex gap-2">
                {transactionType === "in" && (
                  <>
                    <input
                      type="file"
                      accept=".csv"
                      ref={csvInputRef}
                      onChange={handleCsvImport}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      onClick={() => csvInputRef.current?.click()}
                      size="sm"
                      variant="secondary"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Import CSV
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  onClick={handleAddItem}
                  size="sm"
                  variant="secondary"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const invItem = inventoryItems.find(
                  (i) => i.id === item.item_id,
                );
                const itemPurchaseUnits = invItem?.id
                  ? purchaseUnits[invItem.id] || []
                  : [];
                const selectedPurchaseUnit = itemPurchaseUnits.find(
                  (u) => u.id === item.purchase_unit_id,
                );

                // "In": sub-items only (masters are group headers); "Out"/"Transfer": master items only (hold stock)
                const filteredInventoryItems = inventoryItems.filter(
                  (invItem) => {
                    if (transactionType === "in") {
                      return !!invItem.parent_id && !invItem.is_master_item; // Sub-items only
                    } else {
                      return invItem.is_master_item;
                    }
                  },
                );

                return (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 rounded-lg space-y-3"
                  >
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div
                        className={
                          transactionType === "in" ? "col-span-4" : "col-span-5"
                        }
                      >
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Item{" "}
                          {index === 0 && (
                            <span className="text-red-500">*</span>
                          )}
                        </label>
                        <SearchableSelect
                          value={item.item_id}
                          onChange={(value) =>
                            handleItemDropdownChange(index, value)
                          }
                          placeholder="Search items..."
                          required={index === 0}
                          className="text-sm"
                          allowAddNew={true}
                          onAddNew={() => setShowAddItemModal(true)}
                          addNewLabel="+ Add New Item"
                          options={filteredInventoryItems.map(
                            (invItem): SearchableSelectOption => ({
                              value: invItem.id,
                              label: invItem.name,
                              description: invItem.brand || undefined,
                              groupLabel: invItem.parent_id
                                ? masterItemsMap.get(invItem.parent_id)?.name
                                : undefined,
                            }),
                          )}
                        />
                        {item.item_id &&
                          (transactionType === "out" ||
                            transactionType === "transfer") && (
                            <p className="text-xs text-gray-500 mt-1">
                              Available: {getAvailableStock(item.item_id)}
                            </p>
                          )}
                      </div>

                      {transactionType === "in" && item.item_id && (
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Brand
                          </label>
                          {item.isAddingNewBrand ? (
                            <div className="space-y-1">
                              <Input
                                value={item.brand}
                                onChange={(e) => {
                                  const n = [...items];
                                  n[index].brand = e.target.value;
                                  setItems(n);
                                }}
                                placeholder="New brand"
                                className="text-sm"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const n = [...items];
                                  n[index].isAddingNewBrand = false;
                                  n[index].brand = "";
                                  setItems(n);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                ← Back
                              </button>
                            </div>
                          ) : (
                            <SearchableSelect
                              options={existingBrands.map((b) => ({
                                value: b,
                                label: b,
                              }))}
                              value={item.brand}
                              onChange={(val) => {
                                const n = [...items];
                                n[index].brand = val;
                                setItems(n);
                              }}
                              placeholder="Brand..."
                              className="text-sm"
                              allowAddNew
                              onAddNew={() => {
                                const n = [...items];
                                n[index].isAddingNewBrand = true;
                                n[index].brand = "";
                                setItems(n);
                              }}
                              addNewLabel="+ Add New Brand"
                            />
                          )}
                        </div>
                      )}

                      {transactionType === "in" && item.item_id && (
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Purchase Unit{" "}
                            {index === 0 && (
                              <span className="text-red-500">*</span>
                            )}
                            {itemPurchaseUnits.length > 0 && (
                              <span className="ml-1 text-gray-500 font-normal">
                                ({itemPurchaseUnits.length} available)
                              </span>
                            )}
                          </label>
                          {item.isAddingPurchaseUnit ? (
                            <div className="space-y-1">
                              {itemPurchaseUnits.length > 0 && (
                                <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  Existing:{" "}
                                  {itemPurchaseUnits
                                    .map(
                                      (u) =>
                                        `${u.unit_name} (x${u.multiplier})`,
                                    )
                                    .join(", ")}
                                </div>
                              )}
                              <div className="flex gap-1">
                                <Select
                                  value={
                                    item.isCustomPurchaseUnit
                                      ? "__custom__"
                                      : item.newPurchaseUnitName
                                  }
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    const newItems = [...items];
                                    if (value === "__custom__") {
                                      newItems[index].isCustomPurchaseUnit =
                                        true;
                                      newItems[index].newPurchaseUnitName = "";
                                    } else {
                                      newItems[index].isCustomPurchaseUnit =
                                        false;
                                      newItems[index].customPurchaseUnitName =
                                        "";
                                      newItems[index].newPurchaseUnitName =
                                        value;
                                    }
                                    setItems(newItems);
                                  }}
                                  className="text-sm flex-1"
                                  autoFocus
                                >
                                  <option value="">Select Unit Type</option>
                                  {UNITS.map((unit) => (
                                    <option key={unit} value={unit}>
                                      {unit}
                                    </option>
                                  ))}
                                  <option disabled>──────────</option>
                                  <option
                                    value="__custom__"
                                    className="text-blue-600 font-medium"
                                  >
                                    Custom
                                  </option>
                                </Select>
                                <NumericInput
                                  step="0.01"
                                  min="0.01"
                                  value={item.newPurchaseUnitMultiplier}
                                  onChange={(e) => {
                                    const newItems = [...items];
                                    newItems[index].newPurchaseUnitMultiplier =
                                      e.target.value;
                                    setItems(newItems);
                                  }}
                                  placeholder="Qty"
                                  className="text-sm w-20"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddPurchaseUnit(index)}
                                  disabled={savingPurchaseUnitIndex === index}
                                  className="text-green-600 hover:text-green-700 p-1 disabled:opacity-50"
                                  title="Save"
                                >
                                  <Check
                                    className={`w-4 h-4 ${savingPurchaseUnitIndex === index ? "animate-pulse" : ""}`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelAddPurchaseUnit(index)}
                                  disabled={savingPurchaseUnitIndex === index}
                                  className="text-gray-600 hover:text-gray-700 p-1 disabled:opacity-50"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              {item.isCustomPurchaseUnit && (
                                <div className="space-y-1">
                                  <Input
                                    type="text"
                                    value={item.customPurchaseUnitName}
                                    onChange={(e) => {
                                      const newItems = [...items];
                                      newItems[index].customPurchaseUnitName =
                                        e.target.value;
                                      setItems(newItems);
                                    }}
                                    placeholder="Enter custom unit name (e.g., Pack of 6)"
                                    className="text-sm"
                                  />
                                  <p className="text-xs text-gray-500">
                                    Tip: If name matches existing unit, it will
                                    be reused
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <Select
                              value={item.purchase_unit_id}
                              onChange={(e) =>
                                handlePurchaseUnitDropdownChange(
                                  index,
                                  e.target.value,
                                )
                              }
                              required={index === 0}
                              className="text-sm"
                            >
                              {itemPurchaseUnits.length !== 1 && (
                                <option value="">Select Unit</option>
                              )}
                              <option
                                value="__add_new__"
                                className="text-blue-600 font-medium"
                              >
                                + Add New Purchase Unit
                              </option>
                              {itemPurchaseUnits.length > 0 && (
                                <option disabled>──────────</option>
                              )}
                              {itemPurchaseUnits.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.unit_name} (x{unit.multiplier})
                                </option>
                              ))}
                            </Select>
                          )}
                        </div>
                      )}

                      {transactionType === "in" && item.item_id && (
                        <div className="col-span-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Qty{" "}
                            {index === 0 && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <NumericInput
                            step="0.01"
                            min="0"
                            value={item.purchase_quantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "purchase_quantity",
                                e.target.value,
                              )
                            }
                            placeholder="0"
                            required={index === 0}
                            className="text-sm"
                          />
                        </div>
                      )}

                      {transactionType === "in" && item.item_id && (
                        <div className="col-span-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Price ($)
                          </label>
                          <NumericInput
                            step="0.01"
                            min="0"
                            value={item.purchase_unit_price}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "purchase_unit_price",
                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                            className="text-sm"
                          />
                        </div>
                      )}

                      {(transactionType === "out" ||
                        transactionType === "transfer") && (
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Quantity{" "}
                            {index === 0 && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <NumericInput
                            step="0.01"
                            min="0"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "quantity",
                                e.target.value,
                              )
                            }
                            placeholder="0"
                            required={index === 0}
                            className="text-sm"
                          />
                        </div>
                      )}

                      <div className="col-span-1 pt-6 flex items-center gap-1">
                        {transactionType === "in" &&
                          item.item_id &&
                          isR2Configured() && (
                            <div className="relative flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePhotoIndex(index);
                                  photoInputRef.current?.click();
                                }}
                                className="text-blue-600 hover:text-blue-700"
                                title="Take photo"
                              >
                                <Camera className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePhotoIndex(index);
                                  photoFileInputRef.current?.click();
                                }}
                                className="text-blue-600 hover:text-blue-700"
                                title="Attach photo"
                              >
                                <Paperclip className="w-4 h-4" />
                              </button>
                              {itemPhotos.getPhotoCount(index) > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none">
                                  {itemPhotos.getPhotoCount(index)}
                                </span>
                              )}
                            </div>
                          )}
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Photo thumbnails row */}
                    {transactionType === "in" &&
                      item.item_id &&
                      itemPhotos.getPhotoCount(index) > 0 && (
                        <div className="flex gap-2 flex-wrap items-center">
                          {itemPhotos.getPhotosForIndex(index).map((photo) => (
                            <PhotoThumbnail
                              key={photo.id}
                              photo={photo}
                              onDelete={() =>
                                itemPhotos.removePendingPhoto(index, photo.id)
                              }
                              canDelete
                              size="sm"
                              isPending
                            />
                          ))}
                          {itemPhotos.getRemainingSlots(index) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setActivePhotoIndex(index);
                                photoInputRef.current?.click();
                              }}
                              className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500"
                              title="Add another photo"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}

                    {transactionType === "in" &&
                      item.item_id &&
                      item.purchase_quantity &&
                      (selectedPurchaseUnit ||
                        (item.isAddingPurchaseUnit &&
                          item.newPurchaseUnitMultiplier)) && (
                        <div className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                          <span className="font-medium">Conversion:</span>{" "}
                          {item.purchase_quantity}{" "}
                          {selectedPurchaseUnit
                            ? selectedPurchaseUnit.unit_name
                            : item.isCustomPurchaseUnit
                              ? item.customPurchaseUnitName || "unit"
                              : item.newPurchaseUnitName || "unit"}
                          {item.purchase_unit_price &&
                            ` × $${item.purchase_unit_price}`}
                          {item.total_cost && ` = $${item.total_cost} total`}
                          {item.quantity && ` (${item.quantity} stock units`}
                          {item.unit_cost && ` @ $${item.unit_cost} each)`}
                        </div>
                      )}

                    {transactionType === "out" && (
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Unit Cost
                          </label>
                          <NumericInput
                            step="0.01"
                            min="0"
                            value={item.unit_cost}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "unit_cost",
                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                            className="text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hidden file input for camera capture */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file && activePhotoIndex !== null) {
                const success = await itemPhotos.addPendingPhoto(
                  activePhotoIndex,
                  file,
                );
                if (!success && itemPhotos.error) {
                  showToast(itemPhotos.error, "error");
                }
              }
              // Reset so the same file can be re-selected
              if (photoInputRef.current) photoInputRef.current.value = "";
              setActivePhotoIndex(null);
            }}
          />
          {/* Hidden file input for gallery/file picker (no capture attribute) */}
          <input
            ref={photoFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file && activePhotoIndex !== null) {
                const success = await itemPhotos.addPendingPhoto(
                  activePhotoIndex,
                  file,
                );
                if (!success && itemPhotos.error) {
                  showToast(itemPhotos.error, "error");
                }
              }
              if (photoFileInputRef.current)
                photoFileInputRef.current.value = "";
              setActivePhotoIndex(null);
            }}
          />
          {/* Hidden file input for invoice photos */}
          <input
            ref={invoicePhotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                await addInvoicePhoto(file);
              }
              if (invoicePhotoInputRef.current)
                invoicePhotoInputRef.current.value = "";
            }}
          />
        </form>
      </Drawer>

      <InventoryItemModal
        isOpen={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        onSuccess={handleItemAdded}
        defaultItemType="sub"
      />

      <SupplierModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSuccess={handleSupplierAdded}
      />
    </>
  );
}
