import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import { MedicationForm } from '@/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const FORM_OPTIONS: { value: MedicationForm; label: string; icon: IconName }[] = [
  { value: 'tablet', label: 'Tableta', icon: 'medical' },
  { value: 'capsule', label: 'Cápsula', icon: 'medkit' },
  { value: 'syrup', label: 'Jarabe', icon: 'flask' },
  { value: 'drops', label: 'Gotas', icon: 'water' },
  { value: 'injection', label: 'Inyección', icon: 'bandage' },
  { value: 'patch', label: 'Parche', icon: 'stop-circle' },
];

export const FREQUENCY_OPTIONS = [
  { value: 6, label: 'Cada 6 h', hint: '4 tomas al día' },
  { value: 8, label: 'Cada 8 h', hint: '3 tomas al día' },
  { value: 12, label: 'Cada 12 h', hint: '2 tomas al día' },
  { value: 24, label: 'Cada 24 h', hint: '1 toma al día' },
] as const;

export const TIME_PRESETS = ['08:00', '12:00', '16:00', '20:00', '22:00'] as const;

export const DURATION_PRESETS = [7, 14, 30, 90] as const;

export function formLabel(form: MedicationForm): string {
  return FORM_OPTIONS.find((option) => option.value === form)?.label ?? 'Tableta';
}

export function formIcon(form: MedicationForm): IconName {
  return FORM_OPTIONS.find((option) => option.value === form)?.icon ?? 'medical';
}

export function unitNoun(form: MedicationForm, count: number): string {
  const plural = count !== 1;
  switch (form) {
    case 'capsule':
      return plural ? 'cápsulas' : 'cápsula';
    case 'syrup':
    case 'drops':
      return 'ml';
    case 'injection':
      return plural ? 'inyecciones' : 'inyección';
    case 'patch':
      return plural ? 'parches' : 'parche';
    default:
      return plural ? 'tabletas' : 'tableta';
  }
}

export function doseAmountLabel(form: MedicationForm, units: number): string {
  if (form === 'syrup' || form === 'drops') return `${units} ml`;
  return `${units} ${unitNoun(form, units)}`;
}

export function stockNoun(form: MedicationForm, count: number): string {
  if (form === 'syrup' || form === 'drops') return 'ml';
  return count === 1 ? unitNoun(form, 1) : unitNoun(form, plural(count));
}

function plural(count: number): number {
  return count === 1 ? 1 : 2;
}
