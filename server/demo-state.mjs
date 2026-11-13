import { createId } from './auth.mjs';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

function pad(value) {
  return String(value).padStart(2, '0');
}

function roundToMinutes(date, step = 5) {
  const copy = new Date(date);
  copy.setSeconds(0, 0);
  copy.setMinutes(Math.round(copy.getMinutes() / step) * step);
  return copy;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * MINUTE);
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeKey(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function combine(dateString, timeString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = timeString.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function minutesBetween(from, to) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / MINUTE);
}

function generateDoses(treatment) {
  const start = combine(treatment.startDate, treatment.startTime);
  const interval = Math.max(1, treatment.frequencyHours) * 60 * MINUTE;
  const end = start.getTime() + treatment.durationDays * DAY;
  const doses = [];
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

function treatment(input, createdAt) {
  return {
    id: createId('trt'),
    active: true,
    createdAt: createdAt.toISOString(),
    ...input,
  };
}

export function createGreeting(now = new Date()) {
  return {
    id: createId('msg'),
    role: 'assistant',
    createdAt: now.toISOString(),
    source: 'demo',
    content:
      'Hola 👋 Soy Medi, tu asistente de MedSync AI. Puedo ayudarte a entender tus tomas, tu inventario y qué hacer si olvidaste una dosis. ¿En qué te ayudo hoy?',
  };
}

function baseProfile(name, code, caregiverName) {
  const firstName = String(name).trim().split(/\s+/)[0] || 'Paciente';
  return {
    name: String(name).trim(),
    firstName,
    caregiverName,
    caregiverCode: code,
    phone: '+52 55 1234 5678',
  };
}

export function createEmptyPatientState(name, code, caregiverName = 'Tu cuidador') {
  const now = new Date();
  return {
    version: 1,
    role: 'patient',
    roleChosen: true,
    linkedPatientCode: null,
    alarmEnabled: true,
    profile: baseProfile(name, code, caregiverName),
    treatments: [],
    doses: [],
    messages: [createGreeting(now)],
    scanDraft: null,
    lastSyncAt: now.toISOString(),
    toast: null,
  };
}

/**
 * Estado de ejemplo para las cuentas demo. Genera una toma atrasada,
 * una toma de ahora, una próxima y una alerta de inventario.
 */
export function createDemoPatientState(name, code, caregiverName = 'Diego Martínez') {
  const now = new Date();
  const anchor = roundToMinutes(now, 5);
  const created = addMinutes(anchor, -60 * 24 * 20);

  const metforminStart = addMinutes(anchor, -42);
  const metformin = treatment(
    {
      name: 'Metformina',
      strength: '850 mg',
      form: 'tablet',
      unitsPerDose: 1,
      frequencyHours: 12,
      startDate: dateKey(addMinutes(metforminStart, -60 * 24 * 3)),
      startTime: timeKey(metforminStart),
      durationDays: 30,
      totalPills: 60,
      pillsRemaining: 4,
      lowStockThreshold: 5,
      color: '#0B6B57',
      notes: 'Tomar con el desayuno y la cena. Puede causar molestia estomacal al inicio.',
    },
    created,
  );

  const enalapril = treatment(
    {
      name: 'Enalapril',
      strength: '10 mg',
      form: 'tablet',
      unitsPerDose: 1,
      frequencyHours: 24,
      startDate: dateKey(anchor),
      startTime: timeKey(anchor),
      durationDays: 30,
      totalPills: 30,
      pillsRemaining: 22,
      lowStockThreshold: 5,
      color: '#1F5C8B',
      notes: 'Controlar la presión arterial cada semana.',
    },
    created,
  );

  const atorvastatin = treatment(
    {
      name: 'Atorvastatina',
      strength: '20 mg',
      form: 'tablet',
      unitsPerDose: 1,
      frequencyHours: 24,
      startDate: dateKey(addMinutes(anchor, 180)),
      startTime: timeKey(addMinutes(anchor, 180)),
      durationDays: 30,
      totalPills: 30,
      pillsRemaining: 18,
      lowStockThreshold: 5,
      color: '#6B4AA0',
      notes: 'Tomar por la noche.',
    },
    created,
  );

  const vitaminStart = addMinutes(anchor, -120);
  const vitaminD = treatment(
    {
      name: 'Vitamina D',
      strength: '2000 UI',
      form: 'capsule',
      unitsPerDose: 1,
      frequencyHours: 24,
      startDate: dateKey(addMinutes(vitaminStart, -60 * 24 * 2)),
      startTime: timeKey(vitaminStart),
      durationDays: 30,
      totalPills: 30,
      pillsRemaining: 9,
      lowStockThreshold: 5,
      color: '#8A4F00',
      notes: 'Tomar después del almuerzo.',
    },
    created,
  );

  const treatments = [metformin, enalapril, atorvastatin, vitaminD];
  const nowMs = now.getTime();
  const doses = treatments
    .flatMap((item) => generateDoses(item))
    .map((dose) => {
      const scheduled = new Date(dose.scheduledAt);
      if (scheduled.getTime() >= nowMs) return dose;

      const isMetformin = dose.treatmentId === metformin.id;
      const isEnalapril = dose.treatmentId === enalapril.id;
      const yesterday = sameDay(scheduled, addMinutes(anchor, -60 * 24));

      if (
        isMetformin &&
        sameDay(scheduled, anchor) &&
        Math.abs(minutesBetween(scheduled, anchor)) <= 90
      ) {
        return dose;
      }
      if (isEnalapril && sameDay(scheduled, anchor)) return dose;

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
    roleChosen: true,
    linkedPatientCode: null,
    alarmEnabled: true,
    profile: baseProfile(name, code, caregiverName),
    treatments,
    doses,
    messages: [createGreeting(now)],
    scanDraft: null,
    lastSyncAt: now.toISOString(),
    toast: null,
  };
}
