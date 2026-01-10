// Centralized color definitions for service categories
// Used in both ServicesPage and TicketEditor for consistent category colors

export type CategoryColorKey = 'pink' | 'blue' | 'purple' | 'green' | 'yellow';

export interface CategoryColor {
  key: CategoryColorKey;
  label: string;
  bgClass: string;
  textClass: string;
  hoverClass: string;
  borderClass: string;
}

export const CATEGORY_COLORS: CategoryColor[] = [
  {
    key: 'pink',
    label: 'Light Pink',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-800',
    hoverClass: 'hover:bg-pink-200',
    borderClass: 'border-pink-300',
  },
  {
    key: 'blue',
    label: 'Light Blue',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    hoverClass: 'hover:bg-blue-200',
    borderClass: 'border-blue-300',
  },
  {
    key: 'purple',
    label: 'Light Purple',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-800',
    hoverClass: 'hover:bg-purple-200',
    borderClass: 'border-purple-300',
  },
  {
    key: 'green',
    label: 'Light Green',
    bgClass: 'bg-green-100',
    textClass: 'text-green-800',
    hoverClass: 'hover:bg-green-200',
    borderClass: 'border-green-300',
  },
  {
    key: 'yellow',
    label: 'Light Yellow',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-800',
    hoverClass: 'hover:bg-yellow-200',
    borderClass: 'border-yellow-300',
  },
];

/**
 * Get Tailwind classes for a category color (for interactive elements like buttons)
 * Includes background, text, hover, and border classes
 */
export function getCategoryColorClasses(colorKey: string): string {
  const color = CATEGORY_COLORS.find((c) => c.key === colorKey);
  if (!color) {
    // Default to gray for unknown colors
    return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300';
  }
  return `${color.bgClass} ${color.textClass} ${color.hoverClass} ${color.borderClass}`;
}

/**
 * Get Tailwind classes for a category badge (non-interactive display)
 * No hover state, suitable for table cells and labels
 */
export function getCategoryBadgeClasses(colorKey: string): string {
  const color = CATEGORY_COLORS.find((c) => c.key === colorKey);
  if (!color) {
    return 'bg-gray-100 text-gray-700';
  }
  return `${color.bgClass} ${color.textClass}`;
}

/**
 * Get a CategoryColor object by its key
 */
export function getCategoryColorByKey(colorKey: string): CategoryColor | undefined {
  return CATEGORY_COLORS.find((c) => c.key === colorKey);
}
