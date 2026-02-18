import {
  FileText,
  BookOpen,
  GraduationCap,
  Shield,
  ScrollText,
  Clipboard,
  Video,
  Lightbulb,
  Award,
  Heart,
  type LucideIcon,
} from 'lucide-react';

export const RESOURCE_ICON_OPTIONS: { name: string; icon: LucideIcon; label: string }[] = [
  { name: 'FileText', icon: FileText, label: 'Document' },
  { name: 'BookOpen', icon: BookOpen, label: 'Book' },
  { name: 'GraduationCap', icon: GraduationCap, label: 'Training' },
  { name: 'Shield', icon: Shield, label: 'Policy' },
  { name: 'ScrollText', icon: ScrollText, label: 'Rules' },
  { name: 'Clipboard', icon: Clipboard, label: 'Checklist' },
  { name: 'Video', icon: Video, label: 'Video' },
  { name: 'Lightbulb', icon: Lightbulb, label: 'Tips' },
  { name: 'Award', icon: Award, label: 'Award' },
  { name: 'Heart', icon: Heart, label: 'Wellness' },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  RESOURCE_ICON_OPTIONS.map(({ name, icon }) => [name, icon])
);

export function getResourceIcon(name: string): LucideIcon {
  return ICON_MAP[name] || FileText;
}
