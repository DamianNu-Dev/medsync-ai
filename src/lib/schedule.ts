import { Dose, Treatment } from '@/types';
import {
  DAY_MS,
  HOUR_MS,
  combineDateTime,
  isSameDay,
  minutesBetween,
} from './date';

export const LATE_AFTER_MINUTES = 30;
export const MISSED_AFTER_MINUTES = 120;

export type DoseDisplayStatus =
  | 'taken'
  | 'skipped'
  | 'upcoming'
  | 'due'
  | 'late'
  | 'missed';

export type StockLevel = 'ok' | 'low' | 'empty';

export interface DoseEvaluation {
  status: DoseDisplayStatus;
  minutesLate: number;
  isActionable: boolean;
  isRed: boolean;
}

export function evaluateDose(dose: Dose, now: Date): DoseEvaluation {
  if (dose.status === 'taken') {
    return { status: 'taken', minutesLate: 0, isActionable: false, isRed: false };
  }
  if (dose.status === 'skipped') {
    return { status: 'skipped', minutesLate: 0, isActionable: false, isRed: true };
  }

  const late = minutesBetween(dose.scheduledAt, now);
  if (late < 0) {
    return { status: 'upcoming', minutesLate: 0, isActionable: false, isRed: false };
  }
  if (late <= LATE_AFTER_MINUTES) {
    return { status: 'due', minutesLate: late, isActionable: true, isRed: false };
  }
  if (late <= MISSED_AFTER_MINUTES) {
    return { status: 'late', minutesLate: late, isActionable: true, isRed: true };
  }
  return { status: 'missed', minutesLate: late, isActionable: true, isRed: true };
}

/** Dosis que corresponde a una franja de 30 min antes / 2 h después. */
export function isDoseInCurrentWindow(dose: Dose, now: Date): boolean {
  const offset = minutesBetween(dose.scheduledAt, now);
  return offset >= -30 && offset <= MISSED_AFTER_MINUTES;
}

export function generateDoses(treatment: Treatment): Dose[] {
  const start = combineDateTime(treatment.startDate, treatment.startTime);
  const interval = Math.max(1, treatment.frequencyHours) * HOUR_MS;
  const end = start.getTime() + treatment.durationDays * DAY_MS;
  const doses: Dose[] = [];

  let index = 0;
  for (let time = start.getTime(); time < end && index < 2000; time += interval) {
    doses.push({
      id: `${treatment.id}_d${index}`,
      treatmentId: treatment.id,
      scheduledAt: new Date(time).toISOString(),
      status: 'pending',
    });
    index += 1;
  }

  return doses;
}

export function dosesForDay(doses: Dose[], day: Date): Dose[] {
  return doses.filter((dose) => isSameDay(dose.scheduledAt, day));
}

export function getDosesCount(treatment: Treatment): number {
  return Math.max(1, Math.ceil((treatment.durationDays * 24) / treatment.frequencyHours));
}

export function getStockLevel(treatment: Treatment): StockLevel {
  if (treatment.pillsRemaining <= 0) return 'empty';
  if (treatment.pillsRemaining < treatment.lowStockThreshold) return 'low';
  return 'ok';
}

export function getStockPercent(treatment: Treatment): number {
  if (treatment.totalPills <= 0) return 0;
  return Math.max(0, Math.min(1, treatment.pillsRemaining / treatment.totalPills));
}

export function getTreatmentTimesPerDay(frequencyHours: number): number {
  return Math.max(1, Math.round(24 / Math.max(1, frequencyHours)));
}

export function formatFrequency(frequencyHours: number): string {
  const times = getTreatmentTimesPerDay(frequencyHours);
  const perDay = times === 1 ? '1 vez al día' : `${times} veces al día`;
  return `Cada ${frequencyHours} h · ${perDay}`;
}

export function getDoseTone(
  status: DoseDisplayStatus,
): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'taken':
      return 'success';
    case 'skipped':
    case 'late':
    case 'missed':
      return 'danger';
    case 'due':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function getDoseLabel(status: DoseDisplayStatus): string {
  switch (status) {
    case 'taken':
      return 'Tomada';
    case 'skipped':
      return 'Omitida';
    case 'due':
      return 'Es hora';
    case 'late':
      return 'Atrasada';
    case 'missed':
      return 'Sin registrar';
    default:
      return 'Programada';
  }
}
