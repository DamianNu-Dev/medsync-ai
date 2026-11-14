import { AdherenceDay } from '@/types';

const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toDateKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function combineDateTime(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, 0, 0);
}

export function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * MINUTE_MS);
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return toDateKey(a) === toDateKey(b);
}

export function isToday(value: Date | string, now: Date = new Date()): boolean {
  return isSameDay(value, now);
}

export function minutesBetween(from: Date | string, to: Date | string): number {
  const a = typeof from === 'string' ? new Date(from) : from;
  const b = typeof to === 'string' ? new Date(to) : to;
  return Math.round((b.getTime() - a.getTime()) / MINUTE_MS);
}

export function minutesOfDay(value: Date): number {
  return value.getHours() * 60 + value.getMinutes();
}

export function hhmmToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function minutesToHHMM(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}

export function roundToMinutes(value: Date, step = 5): Date {
  const rounded = new Date(value);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.round(rounded.getMinutes() / step) * step);
  return rounded;
}

export function formatTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const hours = date.getHours();
  const suffix = hours < 12 ? 'a. m.' : 'p. m.';
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${pad2(date.getMinutes())} ${suffix}`;
}

export function formatTimeShort(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getHours() % 12 === 0 ? 12 : date.getHours() % 12}:${pad2(date.getMinutes())}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDateLong(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return capitalize(`${WEEKDAYS[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()]}`);
}

export function formatDateShort(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

export function formatWeekdayShort(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return capitalize(WEEKDAYS[date.getDay()].slice(0, 3));
}

export function formatDayLabel(value: Date | string, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isSameDay(date, now)) return 'Hoy';
  if (isSameDay(date, addDays(now, 1))) return 'Mañana';
  if (isSameDay(date, addDays(now, -1))) return 'Ayer';
  return capitalize(WEEKDAYS[date.getDay()]);
}

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function formatMinutesDuration(total: number): string {
  const minutes = Math.max(0, Math.round(total));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function relativeFromNow(value: Date | string, now: Date = new Date()): string {
  const minutes = minutesBetween(now, value);
  const absolute = Math.abs(minutes);
  if (absolute < 1) return 'ahora';
  const text =
    absolute < 60
      ? `${absolute} min`
      : formatMinutesDuration(absolute);
  return minutes >= 0 ? `en ${text}` : `hace ${text}`;
}

export function nextDateForTime(time: string, now: Date = new Date()): Date {
  const candidate = combineDateTime(toDateKey(now), time);
  // Si la hora elegida acaba de pasar (por ejemplo, se guardó a las 5:27 y
  // la toma es a las 5:28), se agenda para hoy, no para mañana. Solo se pasa
  // al día siguiente cuando la hora quedó claramente en el pasado.
  const grace = 2 * MINUTE_MS;
  if (candidate.getTime() < now.getTime() - grace) {
    return addDays(candidate, 1);
  }
  return candidate;
}

export function lastNDays(now: Date, count = 7): Date[] {
  return Array.from({ length: count }, (_, index) => startOfDay(addDays(now, index - count + 1)));
}

export function buildAdherenceDays(
  resolver: (day: Date) => { taken: number; total: number },
  now: Date,
  count = 7,
): AdherenceDay[] {
  return lastNDays(now, count).map((day) => {
    const { taken, total } = resolver(day);
    return {
      date: toDateKey(day),
      label: formatWeekdayShort(day).slice(0, 1),
      taken,
      total,
      percent: total === 0 ? 0 : Math.round((taken / total) * 100),
      isToday: isSameDay(day, now),
    };
  });
}
