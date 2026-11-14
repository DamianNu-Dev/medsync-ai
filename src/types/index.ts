export type AppRole = 'patient' | 'caregiver';

export type MedicationForm =
  | 'tablet'
  | 'capsule'
  | 'syrup'
  | 'drops'
  | 'injection'
  | 'patch';

export type DoseStatus = 'pending' | 'taken' | 'skipped';

export type ToastTone = 'success' | 'error' | 'info';

export interface Treatment {
  id: string;
  name: string;
  strength: string;
  form: MedicationForm;
  unitsPerDose: number;
  frequencyHours: number;
  /** Fecha local de inicio, formato YYYY-MM-DD */
  startDate: string;
  /** Hora local de la primera toma, formato HH:mm (24 h) */
  startTime: string;
  durationDays: number;
  totalPills: number;
  pillsRemaining: number;
  lowStockThreshold: number;
  notes?: string;
  color: string;
  active: boolean;
  createdAt: string;
}

export interface Dose {
  id: string;
  treatmentId: string;
  /** ISO 8601 */
  scheduledAt: string;
  status: DoseStatus;
  takenAt?: string;
  postponedTo?: string;
  skipReason?: string;
  /** Marca de tiempo del último cambio de estado */
  resolvedAt?: string;
}

export interface NewTreatmentInput {
  name: string;
  strength: string;
  form: MedicationForm;
  unitsPerDose: number;
  frequencyHours: number;
  startTime: string;
  durationDays: number;
  totalPills: number;
  lowStockThreshold: number;
  notes?: string;
  color?: string;
}

export interface Profile {
  name: string;
  firstName: string;
  caregiverName: string;
  caregiverCode: string;
  phone: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  source?: 'demo' | 'ai';
}

export interface ExtractedMedication {
  medicationName: string;
  strength: string;
  form: MedicationForm;
  unitsPerDose: number;
  frequencyHours: number;
  startTime: string;
  durationDays: number;
  totalPills: number;
  notes?: string;
}

export interface PrescriptionExtraction {
  patientName?: string;
  /** Todos los medicamentos que aparecen en la receta. */
  medications: ExtractedMedication[];
  confidence: number;
  warnings: string[];
  source: 'demo' | 'ai';
}

export interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface AppState {
  version: number;
  role: AppRole;
  /** false hasta que la persona elige paciente o cuidador. */
  roleChosen: boolean;
  /** Código del paciente que el cuidador vinculó en este dispositivo. */
  linkedPatientCode: string | null;
  alarmEnabled: boolean;
  profile: Profile;
  treatments: Treatment[];
  doses: Dose[];
  messages: ChatMessage[];
  scanDraft: PrescriptionExtraction | null;
  lastSyncAt: string;
  toast: ToastMessage | null;
}

export interface DoseView {
  dose: Dose;
  treatment: Treatment;
}

export interface AdherenceDay {
  date: string;
  label: string;
  taken: number;
  total: number;
  percent: number;
  isToday: boolean;
}

export interface CaregiverAlert {
  id: string;
  severity: 'danger' | 'warning';
  title: string;
  detail: string;
  treatmentId?: string;
  doseId?: string;
}
