import { getStockLevel, getStockPercent, StockLevel } from '@/lib/schedule';
import { stockNoun } from '@/constants/medication';
import {
  AdherenceDay,
  AppState,
  CaregiverAlert,
  Dose,
  DoseView,
  Treatment,
} from '@/types';
import {
  buildAdherenceDays,
  formatMinutesDuration,
  formatTime,
  isSameDay,
  isToday,
  relativeFromNow,
  toDateKey,
} from '@/lib/date';
import { evaluateDose, DoseDisplayStatus } from '@/lib/schedule';

export interface JoinedDose extends DoseView {
  status: DoseDisplayStatus;
  minutesLate: number;
  isActionable: boolean;
  isRed: boolean;
}

export interface TodaySummary {
  total: number;
  taken: number;
  skipped: number;
  resolved: number;
  actionable: number;
  adherence: number;
}

export interface DashboardData {
  today: JoinedDose[];
  actionable: JoinedDose[];
  upcoming: JoinedDose[];
  completed: JoinedDose[];
  nextDose?: JoinedDose;
  lowStock: Treatment[];
  summary: TodaySummary;
}

export interface CaregiverData {
  severity: 'success' | 'warning' | 'danger';
  title: string;
  detail: string;
  alerts: CaregiverAlert[];
  takenToday: number;
  totalToday: number;
  adherence: number;
  nextDose?: JoinedDose;
  lastTaken?: JoinedDose;
  weekly: AdherenceDay[];
}

export interface TreatmentDetailData {
  treatment: Treatment;
  today: JoinedDose[];
  nextDoses: JoinedDose[];
  nextDose?: JoinedDose;
  takenTotal: number;
  totalResolved: number;
  adherence7: AdherenceDay[];
  stockLevel: StockLevel;
  stockPercent: number;
}

export function joinDoses(
  doses: Dose[],
  treatments: Treatment[],
  now: Date,
): JoinedDose[] {
  const map = new Map(treatments.map((treatment) => [treatment.id, treatment]));
  return doses.flatMap((dose) => {
    const treatment = map.get(dose.treatmentId);
    if (!treatment) return [];
    const evaluation = evaluateDose(dose, now);
    return [{ dose, treatment, ...evaluation }];
  });
}

export function sortDoses(list: JoinedDose[]): JoinedDose[] {
  return [...list].sort(
    (a, b) => new Date(a.dose.scheduledAt).getTime() - new Date(b.dose.scheduledAt).getTime(),
  );
}

export function getTodayDoses(state: AppState, now: Date): JoinedDose[] {
  return sortDoses(
    joinDoses(
      state.doses.filter((dose) => isToday(dose.scheduledAt, now)),
      state.treatments,
      now,
    ).filter((item) => item.treatment.active),
  );
}

export function summarize(day: JoinedDose[]): TodaySummary {
  const resolvedDoses = day.filter((item) => item.status !== 'upcoming');
  const taken = day.filter((item) => item.status === 'taken').length;
  const skipped = day.filter((item) => item.status === 'skipped').length;
  const actionable = day.filter((item) => item.isActionable).length;

  return {
    total: day.length,
    taken,
    skipped,
    resolved: resolvedDoses.length,
    actionable,
    adherence:
      resolvedDoses.length === 0 ? 0 : Math.round((taken / resolvedDoses.length) * 100),
  };
}

export function getNextDose(state: AppState, now: Date): JoinedDose | undefined {
  return joinDoses(state.doses, state.treatments, now)
    .filter((item) => item.treatment.active && item.status === 'upcoming')
    .sort(
      (a, b) =>
        new Date(a.dose.scheduledAt).getTime() - new Date(b.dose.scheduledAt).getTime(),
    )[0];
}

export function getNextDosesByTreatment(
  state: AppState,
  now: Date,
): Map<string, JoinedDose> {
  const map = new Map<string, JoinedDose>();
  const pending = joinDoses(state.doses, state.treatments, now)
    .filter(
      (item) =>
        item.treatment.active &&
        item.status !== 'taken' &&
        item.status !== 'skipped',
    )
    .sort(
      (a, b) =>
        new Date(a.dose.scheduledAt).getTime() - new Date(b.dose.scheduledAt).getTime(),
    );

  for (const item of pending) {
    if (!map.has(item.treatment.id)) {
      map.set(item.treatment.id, item);
    }
  }
  return map;
}

export function getDashboardData(state: AppState, now: Date): DashboardData {
  const today = getTodayDoses(state, now);
  const actionable = today.filter((item) => item.isActionable);
  const upcoming = today.filter((item) => item.status === 'upcoming');
  const completed = today.filter(
    (item) => item.status === 'taken' || item.status === 'skipped',
  );
  const lowStock = state.treatments.filter(
    (treatment) => treatment.active && getStockLevel(treatment) !== 'ok',
  );

  return {
    today,
    actionable,
    upcoming,
    completed,
    nextDose: getNextDose(state, now),
    lowStock,
    summary: summarize(today),
  };
}

export function getWeeklyAdherence(state: AppState, now: Date): AdherenceDay[] {
  return buildAdherenceDays((day) => {
    const dayDoses = joinDoses(
      state.doses.filter((dose) => isSameDay(dose.scheduledAt, day)),
      state.treatments,
      now,
    );
    const resolved = dayDoses.filter((item) => item.status !== 'upcoming');
    return {
      taken: resolved.filter((item) => item.status === 'taken').length,
      total: resolved.length,
    };
  }, now);
}

export function getCaregiverData(state: AppState, now: Date): CaregiverData {
  const today = getTodayDoses(state, now);
  const summary = summarize(today);
  const alerts: CaregiverAlert[] = [];

  for (const item of today) {
    if (item.status === 'late') {
      alerts.push({
        id: `late_${item.dose.id}`,
        severity: 'danger',
        title: `${item.treatment.name}: toma atrasada`,
        detail: `Programada a las ${formatTime(item.dose.scheduledAt)}. Lleva ${formatMinutesDuration(
          item.minutesLate,
        )} de retraso.`,
        treatmentId: item.treatment.id,
        doseId: item.dose.id,
      });
    } else if (item.status === 'missed') {
      alerts.push({
        id: `missed_${item.dose.id}`,
        severity: 'danger',
        title: `${item.treatment.name}: dosis sin registrar`,
        detail: `La toma de las ${formatTime(item.dose.scheduledAt)} no se registró.`,
        treatmentId: item.treatment.id,
        doseId: item.dose.id,
      });
    } else if (item.status === 'skipped') {
      alerts.push({
        id: `skip_${item.dose.id}`,
        severity: 'danger',
        title: `${item.treatment.name}: dosis omitida`,
        detail: `${formatTime(item.dose.scheduledAt)} · ${
          item.dose.skipReason ?? 'Sin motivo indicado'
        }`,
        treatmentId: item.treatment.id,
        doseId: item.dose.id,
      });
    }
  }

  for (const treatment of state.treatments) {
    if (!treatment.active) continue;
    const level = getStockLevel(treatment);
    if (level === 'ok') continue;
    alerts.push({
      id: `stock_${treatment.id}`,
      severity: 'warning',
      title:
        level === 'empty'
          ? `Sin existencias: ${treatment.name}`
          : `Stock bajo: ${treatment.name}`,
      detail:
        level === 'empty'
          ? 'No quedan dosis. Contacta a la farmacia o al médico.'
          : `Quedan ${treatment.pillsRemaining} ${stockNoun(
              treatment.form,
              treatment.pillsRemaining,
            )} disponibles. Conviene reponer.`,
      treatmentId: treatment.id,
    });
  }

  alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));

  const lastTaken = today
    .filter((item) => item.status === 'taken')
    .sort(
      (a, b) =>
        new Date(b.dose.takenAt ?? b.dose.scheduledAt).getTime() -
        new Date(a.dose.takenAt ?? a.dose.scheduledAt).getTime(),
    )[0];

  const severity: CaregiverData['severity'] = alerts.some(
    (alert) => alert.severity === 'danger',
  )
    ? 'danger'
    : alerts.length > 0
      ? 'warning'
      : 'success';

  const nextDose = getNextDose(state, now);

  const title =
    severity === 'danger'
      ? 'Necesita atención'
      : severity === 'warning'
        ? 'Inventario bajo'
        : 'Todo al día';

  const detail =
    severity === 'danger'
      ? `${summary.actionable} toma${summary.actionable === 1 ? '' : 's'} requiere${summary.actionable === 1 ? '' : 'n'} seguimiento.`
      : severity === 'warning'
        ? 'Las tomas avanzan bien, pero queda poco stock.'
        : lastTaken
          ? `Última toma ${relativeFromNow(
              lastTaken.dose.takenAt ?? lastTaken.dose.scheduledAt,
              now,
            )}.`
          : 'No hay tomas pendientes por ahora.';

  return {
    severity,
    title,
    detail,
    alerts,
    takenToday: summary.taken,
    totalToday: summary.total,
    adherence: summary.adherence,
    nextDose,
    lastTaken,
    weekly: getWeeklyAdherence(state, now),
  };
}

export function getTreatmentDetailData(
  state: AppState,
  treatmentId: string,
  now: Date,
): TreatmentDetailData | null {
  const treatment = state.treatments.find((item) => item.id === treatmentId);
  if (!treatment) return null;

  const all = joinDoses(
    state.doses.filter((dose) => dose.treatmentId === treatmentId),
    [treatment],
    now,
  );
  const today = sortDoses(all.filter((item) => isToday(item.dose.scheduledAt, now)));
  const future = sortDoses(
    all.filter((item) => item.status !== 'taken' && item.status !== 'skipped'),
  );
  const resolved = all.filter((item) => item.status !== 'upcoming');
  const weekly = buildAdherenceDays((day) => {
    const dayDoses = joinDoses(
      state.doses.filter(
        (dose) => dose.treatmentId === treatmentId && isSameDay(dose.scheduledAt, day),
      ),
      [treatment],
      now,
    ).filter((item) => item.status !== 'upcoming');
    return {
      taken: dayDoses.filter((item) => item.status === 'taken').length,
      total: dayDoses.length,
    };
  }, now);

  return {
    treatment,
    today,
    nextDoses: future.slice(0, 5),
    nextDose: future[0],
    takenTotal: resolved.filter((item) => item.status === 'taken').length,
    totalResolved: resolved.length,
    adherence7: weekly,
    stockLevel: getStockLevel(treatment),
    stockPercent: getStockPercent(treatment),
  };
}

export function getAdherenceForDate(state: AppState, date: Date, now: Date): number {
  const joined = joinDoses(
    state.doses.filter((dose) => isSameDay(dose.scheduledAt, date)),
    state.treatments,
    now,
  ).filter((item) => item.status !== 'upcoming');
  if (joined.length === 0) return 0;
  return Math.round(
    (joined.filter((item) => item.status === 'taken').length / joined.length) * 100,
  );
}

export function getLowStockTreatments(state: AppState): Treatment[] {
  return state.treatments.filter(
    (treatment) => treatment.active && getStockLevel(treatment) !== 'ok',
  );
}

export function getSyncLabel(lastSyncAt: string, now: Date): string {
  return `Sincronizado ${relativeFromNow(lastSyncAt, now)}`;
}

export function getDateKeyLabel(date: Date): string {
  return toDateKey(date);
}
