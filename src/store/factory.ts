import { DOSE_COLORS } from '@/constants/config';
import { NewTreatmentInput, Treatment } from '@/types';
import { nextDateForTime, toDateKey } from '@/lib/date';

let sequence = 0;

export function createId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${sequence.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

export function buildTreatment(input: NewTreatmentInput, now: Date = new Date()): Treatment {
  const firstDose = nextDateForTime(input.startTime, now);
  const color =
    input.color ?? DOSE_COLORS[Math.floor(Math.random() * DOSE_COLORS.length)];

  return {
    id: createId('trt'),
    name: input.name.trim(),
    strength: input.strength.trim(),
    form: input.form,
    unitsPerDose: Math.max(1, input.unitsPerDose),
    frequencyHours: Math.max(1, input.frequencyHours),
    startDate: toDateKey(firstDose),
    startTime: input.startTime,
    durationDays: Math.max(1, input.durationDays),
    totalPills: Math.max(1, input.totalPills),
    pillsRemaining: Math.max(0, input.totalPills),
    lowStockThreshold: Math.max(1, input.lowStockThreshold),
    notes: input.notes?.trim() || undefined,
    color,
    active: true,
    createdAt: now.toISOString(),
  };
}
