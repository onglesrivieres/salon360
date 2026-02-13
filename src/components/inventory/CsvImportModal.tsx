import React, { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, ArrowRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CATEGORIES } from '../../lib/inventory-constants';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type RowAction = 'new' | 'update' | 'error';

interface ParsedRow {
  name: string;
  brand: string;
  category: string;
  size: string;
  item_type: string;
  parent_name: string;
  quantity: number;
  unit_cost: number;
  reorder_level: number;
  action: RowAction;
  error?: string;
  matchedId?: string;
}

interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
}

const HEADER_ALIASES: Record<string, string> = {
  'item name': 'name',
  'item_name': 'name',
  'qty': 'quantity',
  'cost': 'unit_cost',
  'price': 'unit_cost',
  'type': 'item_type',
  'item type': 'item_type',
  'parent': 'parent_name',
  'parent name': 'parent_name',
  'parent item': 'parent_name',
  'reorder': 'reorder_level',
  'reorder level': 'reorder_level',
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
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
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(h: string): string {
  const lower = h.toLowerCase().trim();
  return HEADER_ALIASES[lower] || lower;
}

export function CsvImportModal({ isOpen, onClose, onSuccess }: CsvImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { selectedStoreId } = useAuth();
  const { showToast } = useToast();

  function resetState() {
    setStep(1);
    setFileName('');
    setRawText('');
    setParsedRows([]);
    setImporting(false);
    setResult(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawText(ev.target?.result as string);
    };
    reader.readAsText(file);

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleParse() {
    if (!rawText.trim()) {
      showToast('No CSV content to parse', 'error');
      return;
    }

    // Fetch existing items for matching
    const { data: existingItems, error } = await supabase
      .from('inventory_items')
      .select('id, name, is_master_item, parent_id');

    if (error) {
      showToast('Failed to load existing items', 'error');
      return;
    }

    const itemsByName = new Map<string, { id: string; is_master_item: boolean; parent_id: string | null }>();
    for (const item of existingItems || []) {
      itemsByName.set(item.name.toLowerCase(), {
        id: item.id,
        is_master_item: item.is_master_item,
        parent_id: item.parent_id,
      });
    }

    const categoriesLower = new Set(CATEGORIES.map(c => c.toLowerCase()));

    const lines = rawText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      showToast('CSV must have a header row and at least one data row', 'error');
      return;
    }

    const headerFields = parseCsvLine(lines[0]).map(normalizeHeader);
    const nameIdx = headerFields.indexOf('name');
    const brandIdx = headerFields.indexOf('brand');
    const categoryIdx = headerFields.indexOf('category');
    const sizeIdx = headerFields.indexOf('size');
    const typeIdx = headerFields.indexOf('item_type');
    const parentIdx = headerFields.indexOf('parent_name');
    const qtyIdx = headerFields.indexOf('quantity');
    const costIdx = headerFields.indexOf('unit_cost');
    const reorderIdx = headerFields.indexOf('reorder_level');

    if (nameIdx === -1) {
      showToast('CSV must have a "name" column', 'error');
      return;
    }

    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      const name = fields[nameIdx] || '';
      const brand = brandIdx >= 0 ? (fields[brandIdx] || '') : '';
      const category = categoryIdx >= 0 ? (fields[categoryIdx] || '') : '';
      const size = sizeIdx >= 0 ? (fields[sizeIdx] || '') : '';
      const itemType = typeIdx >= 0 ? (fields[typeIdx] || '').toLowerCase() : 'standalone';
      const parentName = parentIdx >= 0 ? (fields[parentIdx] || '') : '';
      const qtyRaw = qtyIdx >= 0 ? (fields[qtyIdx] || '0') : '0';
      const costRaw = costIdx >= 0 ? (fields[costIdx] || '0') : '0';
      const reorderRaw = reorderIdx >= 0 ? (fields[reorderIdx] || '0') : '0';

      const quantity = parseFloat(qtyRaw);
      const unitCost = parseFloat(costRaw);
      const reorderLevel = parseFloat(reorderRaw);

      const row: ParsedRow = {
        name,
        brand,
        category,
        size,
        item_type: itemType || 'standalone',
        parent_name: parentName,
        quantity: isNaN(quantity) ? 0 : quantity,
        unit_cost: isNaN(unitCost) ? 0 : unitCost,
        reorder_level: isNaN(reorderLevel) ? 0 : reorderLevel,
        action: 'new',
      };

      // Validation
      if (!name.trim()) {
        row.action = 'error';
        row.error = 'Missing item name';
        rows.push(row);
        continue;
      }

      if (isNaN(quantity)) {
        row.action = 'error';
        row.error = `Invalid quantity: "${qtyRaw}"`;
        rows.push(row);
        continue;
      }

      if (isNaN(unitCost)) {
        row.action = 'error';
        row.error = `Invalid unit cost: "${costRaw}"`;
        rows.push(row);
        continue;
      }

      const existing = itemsByName.get(name.toLowerCase());
      if (existing) {
        row.action = 'update';
        row.matchedId = existing.id;
      } else {
        // New item validation
        if (!category.trim()) {
          row.action = 'error';
          row.error = 'Category required for new items';
          rows.push(row);
          continue;
        }
        if (!categoriesLower.has(category.toLowerCase())) {
          row.action = 'error';
          row.error = `Invalid category: "${category}"`;
          rows.push(row);
          continue;
        }

        if (itemType === 'sub') {
          if (!parentName.trim()) {
            row.action = 'error';
            row.error = 'parent_name required for sub-items';
            rows.push(row);
            continue;
          }
          const parent = itemsByName.get(parentName.toLowerCase());
          if (!parent) {
            row.action = 'error';
            row.error = `Parent item not found: "${parentName}"`;
            rows.push(row);
            continue;
          }
        }

        row.action = 'new';
      }

      rows.push(row);
    }

    setParsedRows(rows);
    setStep(2);
  }

  async function handleImport() {
    if (!selectedStoreId) return;
    setImporting(true);

    const errors: string[] = [];

    // Fetch fresh item lookup for parent resolution
    const { data: allItems } = await supabase
      .from('inventory_items')
      .select('id, name, is_master_item');
    const itemsByName = new Map<string, string>();
    for (const item of allItems || []) {
      itemsByName.set(item.name.toLowerCase(), item.id);
    }

    // Find the correct category casing
    const categoryMap = new Map(CATEGORIES.map(c => [c.toLowerCase(), c]));

    // Sort: process master items first, then standalone, then sub-items
    const typeOrder: Record<string, number> = { master: 0, standalone: 1, sub: 2 };
    const sortedRows = [...parsedRows]
      .filter(r => r.action !== 'error')
      .sort((a, b) => (typeOrder[a.item_type] || 1) - (typeOrder[b.item_type] || 1));

    let createdCount = 0;
    let updatedCount = 0;

    for (const row of sortedRows) {
      try {
        if (row.action === 'update' && row.matchedId) {
          const isSub = row.item_type === 'sub';

          // Update catalog fields on inventory_items
          const catalogUpdate: Record<string, unknown> = {};
          if (row.brand) catalogUpdate.brand = row.brand;
          if (row.category) {
            const correctCategory = categoryMap.get(row.category.toLowerCase()) || row.category;
            catalogUpdate.category = correctCategory;
          }
          if (row.size) catalogUpdate.size = row.size;
          if (Object.keys(catalogUpdate).length > 0) {
            await supabase
              .from('inventory_items')
              .update(catalogUpdate)
              .eq('id', row.matchedId);
          }

          // Update store_inventory_levels (skip stock update for sub-items)
          if (!isSub) {
            const { error } = await supabase
              .from('store_inventory_levels')
              .update({
                quantity_on_hand: row.quantity,
                unit_cost: row.unit_cost,
                reorder_level: row.reorder_level,
              })
              .eq('store_id', selectedStoreId)
              .eq('item_id', row.matchedId);

            if (error) throw error;
          }
          updatedCount++;
        } else if (row.action === 'new') {
          const isMaster = row.item_type === 'master';
          const isSub = row.item_type === 'sub';
          const correctCategory = categoryMap.get(row.category.toLowerCase()) || row.category;

          let parentId: string | null = null;
          if (isSub && row.parent_name) {
            parentId = itemsByName.get(row.parent_name.toLowerCase()) || null;
            if (!parentId) {
              errors.push(`${row.name}: parent "${row.parent_name}" not found`);
              continue;
            }
          }

          // Insert item
          const { data: newItem, error: insertError } = await supabase
            .from('inventory_items')
            .insert({
              name: row.name,
              brand: isMaster ? null : (row.brand || null),
              category: correctCategory,
              size: row.size || null,
              unit: 'piece',
              is_master_item: isMaster,
              parent_id: parentId,
              description: '',
              supplier: '',
            })
            .select('id')
            .single();

          if (insertError) {
            // 23505 = unique_violation, item already exists — fall back to update
            if (insertError.code === '23505') {
              const existing = itemsByName.get(row.name.toLowerCase());
              if (existing && !isSub) {
                // Update catalog fields on existing item
                const catalogUpdate: Record<string, unknown> = {};
                if (row.brand) catalogUpdate.brand = row.brand;
                if (row.size) catalogUpdate.size = row.size;
                const correctCat = categoryMap.get(row.category.toLowerCase()) || row.category;
                if (correctCat) catalogUpdate.category = correctCat;
                if (Object.keys(catalogUpdate).length > 0) {
                  await supabase
                    .from('inventory_items')
                    .update(catalogUpdate)
                    .eq('id', existing);
                }

                await supabase
                  .from('store_inventory_levels')
                  .update({
                    quantity_on_hand: row.quantity,
                    unit_cost: row.unit_cost,
                    reorder_level: row.reorder_level,
                  })
                  .eq('store_id', selectedStoreId)
                  .eq('item_id', existing);
                updatedCount++;
              }
              continue;
            }
            throw insertError;
          }

          // Add to lookup so sub-items can find newly-created masters
          if (newItem) {
            itemsByName.set(row.name.toLowerCase(), newItem.id);

            // Set stock levels for standalone/master (not sub-items)
            if (!isSub) {
              // DB trigger auto-creates store_inventory_levels row; update it
              const { error: levelError } = await supabase
                .from('store_inventory_levels')
                .upsert({
                  store_id: selectedStoreId,
                  item_id: newItem.id,
                  quantity_on_hand: row.quantity,
                  unit_cost: row.unit_cost,
                  reorder_level: row.reorder_level,
                  is_active: true,
                }, { onConflict: 'store_id,item_id' });

              if (levelError) {
                errors.push(`${row.name}: failed to set stock levels — ${levelError.message}`);
              }
            }
          }

          createdCount++;
        }
      } catch (err: any) {
        errors.push(`${row.name}: ${err.message || 'Unknown error'}`);
      }
    }

    setResult({ created: createdCount, updated: updatedCount, errors });
    setImporting(false);
    setStep(3);
  }

  const actionCounts = parsedRows.reduce(
    (acc, r) => {
      acc[r.action] = (acc[r.action] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const hasValidRows = (actionCounts.new || 0) + (actionCounts.update || 0) > 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Inventory CSV" size="xl">
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload a CSV file to create new items or update existing ones. Use "Download CSV" to get the current inventory as a template.
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            {fileName ? (
              <div className="space-y-2">
                <FileText className="w-10 h-10 text-blue-500 mx-auto" />
                <p className="text-sm font-medium">{fileName}</p>
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Choose Different File
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Select CSV File
                </Button>
                <p className="text-xs text-gray-400">CSV format with headers</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleParse} disabled={!rawText}>
              Next
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex gap-3 text-sm">
            {actionCounts.new ? (
              <Badge variant="success">{actionCounts.new} New</Badge>
            ) : null}
            {actionCounts.update ? (
              <Badge variant="info">{actionCounts.update} Update</Badge>
            ) : null}
            {actionCounts.error ? (
              <Badge variant="danger">{actionCounts.error} Error{actionCounts.error > 1 ? 's' : ''}</Badge>
            ) : null}
          </div>

          <div className="max-h-96 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-right px-3 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium">Cost</th>
                  <th className="text-left px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className={row.action === 'error' ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2">
                      {row.action === 'new' && <Badge variant="success">New</Badge>}
                      {row.action === 'update' && <Badge variant="info">Update</Badge>}
                      {row.action === 'error' && <Badge variant="danger">Error</Badge>}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.name || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{row.item_type}</td>
                    <td className="px-3 py-2 text-gray-500">{row.category || '—'}</td>
                    <td className="px-3 py-2 text-right">{row.quantity}</td>
                    <td className="px-3 py-2 text-right">${row.unit_cost.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{row.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleImport} disabled={!hasValidRows || importing}>
                {importing ? 'Importing...' : `Import ${(actionCounts.new || 0) + (actionCounts.update || 0)} Items`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-4">
          <div className="text-center py-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold">Import Complete</h3>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700">{result.created}</div>
              <div className="text-xs text-green-600">Created</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-700">{result.updated}</div>
              <div className="text-xs text-blue-600">Updated</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-700">{result.errors.length}</div>
              <div className="text-xs text-red-600">Errors</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-auto">
              <div className="flex items-center gap-1 text-sm font-medium text-red-800 mb-2">
                <AlertCircle className="w-4 h-4" />
                Errors
              </div>
              <ul className="text-xs text-red-700 space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={() => { onSuccess(); handleClose(); }}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
