import { supabase } from './supabase';

export function generateItemCode(supplierPrefix: string, itemName: string): string {
  const cleanPrefix = supplierPrefix.trim().toUpperCase();

  const cleanName = itemName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  let namePart = cleanName.slice(0, 4);

  if (namePart.length < 4) {
    namePart = namePart.padEnd(4, '_');
  }

  return `${cleanPrefix}${namePart}`;
}

export async function ensureUniqueCode(baseCode: string): Promise<string> {
  let code = baseCode;
  let suffix = 2;

  while (true) {
    const { data, error } = await supabase
      .from('master_inventory_items')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (error) {
      console.error('Error checking code uniqueness:', error);
      throw error;
    }

    if (!data) {
      return code;
    }

    code = `${baseCode}_${suffix}`;
    suffix++;
  }
}

export function previewItemCode(supplierPrefix: string, itemName: string): string {
  if (!supplierPrefix || !itemName) {
    return '';
  }
  return generateItemCode(supplierPrefix, itemName);
}
