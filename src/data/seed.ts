import { colors } from '@/constants/theme';
import { AppState, ChatMessage, Dose, Treatment } from '@/types';
import {
  addMinutes,
  isSameDay,
  minutesBetween,
  minutesOfDay,
  minutesToHHMM,
  roundToMinutes,
  toDateKey,
} from '@/lib/date';
import { generateDoses } from '@/lib/schedule';
import { createId } from '@/store/factory';

function baseTreatment(
  partial: Pick<
    Treatment,
    | 'name'
    | 'strength'
    | 'form'
    | 'unitsPerDose'
    | 'frequencyHours'
    | 'startDate'
    | 'startTime'
    | 'durationDays'
    | 'totalPills'
    | 'pillsRemaining'
    | 'lowStockThreshold'
    | 'color'
    | 'notes'
  >,
  createdAt: Date,
): Treatment {
  return {
    id: createId('trt'),
    active: true,
    createdAt: createdAt.toISOString(),
    ...partial,
  };
}

export function createGreetingMessage(now: Date = new Date()): ChatMessage {
  return {
    id: createId('msg'),
    role: 'assistant',
    createdAt: now.toISOString(),
    source: 'demo',
    content:
      'Hola 👋 Soy Medi, tu asistente de MedSync AI. Puedo ayudarte a entender tus tomas, tu inventario y qué hacer si olvidaste una dosis. ¿En qué te ayudo hoy?',
  };
}

/**
 * Datos de demostración relativos al momento de apertura, para que la app
 * siempre muestre estados interesantes: una toma atrasada, una dosis de ahora,
 * una próxima, una tomada y una alerta de stock bajo.
 */
export function createSeedState(now: Date = new Date()): AppState {
  const anchor = roundToMinutes(now, 5);
  const created = addMinutes(anchor, -60 * 24 * 20);

  const metforminStart = addMinutes(anchor, -42);
  const metformin = baseTreatment(
    {
      name: 'Metformina',
      strength: '850 mg',
      form: 'tablet',
      unitsPerDose: 1,
      frequencyHours: 12,
      startDate: toDateKey(addMinutes(metforminStart, -60 * 24 * 3)),
      startTime: minutesToHHMM(minutesOfDay(metforminStart)),
      durationDays: 30,
      totalPills: 60,
      pillsRemaining: 4,
      lowStockThreshold: 5,
      color: colors.primary,
      notes: 'Tomar con el desayuno y la cena. Puede causar molestia estomacal al inicio.',
    },
    created,
  );

  const enalapril = baseTreatment(
    {
      name: 'Enalapril',
      strength: '10 mg',
      form: 'tablet',
      unitsPerDose: 1,
      frequencyHours: 24,
      startDate: toDateKey(anchor),
      startTime: minutesToHHMM(minutesOfDay(anchor)),
      durationDays: 30,
      totalPills: 30,
      pillsRemaining: 22,
      lowStockThreshold: 5,
      color: colors.info,
      notes: 'Controlar la presión arterial cada semana.',
    },
    created,
  );

  const atorvastatin = baseTreatment(
    {
      name: 'Atorvastatina',
      strength: '20 mg',
      form: 'tablet',
      unitsPerDose: 1,
      frequencyHours: 24,
      startDate: toDateKey(addMinutes(anchor, 180)),
      startTime: minutesToHHMM(minutesOfDay(addMinutes(anchor, 180))),
      durationDays: 30,
      totalPills: 30,
      pillsRemaining: 18,
      lowStockThreshold: 5,
      color: colors.violet,
      notes: 'Tomar por la noche.',
    },
    created,
  );

  const vitaminStart = addMinutes(anchor, -120);
  const vitaminD = baseTreatment(
    {
      name: 'Vitamina D',
      strength: '2000 UI',
      form: 'capsule',
      unitsPerDose: 1,
      frequencyHours: 24,
      startDate: toDateKey(addMinutes(vitaminStart, -60 * 24 * 2)),
      startTime: minutesToHHMM(minutesOfDay(vitaminStart)),
      durationDays: 30,
      totalPills: 30,
      pillsRemaining: 9,
      lowStockThreshold: 5,
      color: colors.warning,
      notes: 'Tomar después del almuerzo.',
    },
    created,
  );

  const treatments = [metformin, enalapril, atorvastatin, vitaminD];
  const doses: Dose[] = treatments.flatMap((treatment) => generateDoses(treatment));

  const nowMs = now.getTime();
  const enriched = doses.map<Dose>((dose) => {
    const scheduled = new Date(dose.scheduledAt);
    if (scheduled.getTime() >= nowMs) return dose;

    const isMetformin = dose.treatmentId === metformin.id;
    const isEnalapril = dose.treatmentId === enalapril.id;
    const yesterday = isSameDay(scheduled, addMinutes(anchor, -60 * 24));

    // La toma de Metformina cercana a la hora actual queda atrasada a propósito
    // (demo cuidador). Las tomas anteriores del día se muestran como registradas.
    if (
      isMetformin &&
      isSameDay(scheduled, anchor) &&
      Math.abs(minutesBetween(scheduled, anchor)) <= 90
    ) {
      return dose;
    }
    if (isEnalapril && isSameDay(scheduled, anchor)) return dose;

    if (isMetformin && yesterday) {
      return {
        ...dose,
        status: 'skipped',
        skipReason: 'Me sentí mal',
        resolvedAt: addMinutes(scheduled, 8).toISOString(),
      };
    }

    return {
      ...dose,
      status: 'taken',
      takenAt: addMinutes(scheduled, 4).toISOString(),
      resolvedAt: addMinutes(scheduled, 4).toISOString(),
    };
  });

  return {
    version: 1,
    role: 'patient',
    roleChosen: false,
    linkedPatientCode: null,
    alarmEnabled: true,
    profile: {
      name: 'Rosa Martínez',
      firstName: 'Rosa',
      caregiverName: 'Diego Martínez',
      caregiverCode: 'MED-4821',
      phone: '+52 55 1234 5678',
    },
    treatments,
    doses: enriched,
    messages: [createGreetingMessage(now)],
    scanDraft: null,
    lastSyncAt: now.toISOString(),
    toast: null,
  };
}
