/**
 * Phone number utilities for Canadian phone numbers
 * Format: (514) 123-4567
 */

/**
 * Normalize phone number to digits only for storage and comparison
 * @param phone - The phone number in any format
 * @returns The phone number with only digits
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Format phone number for display
 * @param phone - The phone number (can be normalized or formatted)
 * @returns Formatted phone number: (514) 123-4567
 */
export function formatPhoneNumber(phone: string): string {
  const digits = normalizePhoneNumber(phone);

  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // For numbers longer than 10 digits, format first 10 and append rest
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}${digits.slice(10)}`;
}

/**
 * Format phone number as user types (for input onChange)
 * @param phone - Current input value
 * @param previousPhone - Previous input value (to detect backspace)
 * @returns Formatted phone number for display in input
 */
export function formatPhoneOnInput(phone: string, previousPhone: string = ''): string {
  const digits = normalizePhoneNumber(phone);
  const prevDigits = normalizePhoneNumber(previousPhone);

  // If user is deleting, don't auto-format
  if (digits.length < prevDigits.length) {
    return phone;
  }

  return formatPhoneNumber(digits);
}

/**
 * Validate Canadian phone number (10 digits)
 * @param phone - The phone number to validate
 * @returns True if valid Canadian phone number
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = normalizePhoneNumber(phone);
  // Canadian phone numbers are 10 digits
  // Optionally can start with 1 (country code) making it 11 digits
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

/**
 * Check if phone has minimum digits for lookup (at least 7 digits)
 * @param phone - The phone number
 * @returns True if phone has enough digits for lookup
 */
export function hasEnoughDigitsForLookup(phone: string): boolean {
  const digits = normalizePhoneNumber(phone);
  return digits.length >= 7;
}

/**
 * Get display text for phone number validation state
 * @param phone - The phone number
 * @returns Object with isValid and message
 */
export function getPhoneValidationStatus(phone: string): { isValid: boolean; message: string } {
  const digits = normalizePhoneNumber(phone);

  if (digits.length === 0) {
    return { isValid: true, message: '' };
  }

  if (digits.length < 10) {
    return { isValid: false, message: `${10 - digits.length} more digits needed` };
  }

  if (digits.length === 10) {
    return { isValid: true, message: '' };
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return { isValid: true, message: '' };
  }

  return { isValid: false, message: 'Too many digits' };
}
