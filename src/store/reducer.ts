import { createGreetingMessage } from '@/data/seed';
import { AppRole, AppState, ChatMessage, Dose, PrescriptionExtraction, ToastMessage, Treatment } from '@/types';
import { createId } from './factory';

export type AppAction =
  | { type: 'hydrate'; state: AppState }
  | { type: 'take_dose'; id: string; at: string }
  | { type: 'undo_take'; id: string }
  | { type: 'postpone_dose'; id: string; minutes: number; at: string }
  | { type: 'skip_dose'; id: string; reason?: string; at: string }
  | { type: 'add_treatment'; treatment: Treatment; doses: Dose[] }
  | { type: 'add_stock'; id: string; amount: number }
  | { type: 'toggle_treatment'; id: string }
  | { type: 'delete_treatment'; id: string }
  | { type: 'append_message'; message: ChatMessage }
  | { type: 'clear_chat'; at: string }
  | { type: 'set_scan_draft'; draft: PrescriptionExtraction | null }
  | { type: 'show_toast'; toast: ToastMessage }
  | { type: 'hide_toast'; id: string }
  | { type: 'set_role'; role: AppRole }
  | { type: 'complete_onboarding'; role: AppRole; patientCode?: string | null }
  | { type: 'link_caregiver'; code: string }
  | { type: 'unlink_caregiver' }
  | { type: 'set_alarm_enabled'; enabled: boolean };

function withToast(state: AppState, message: string, tone: ToastMessage['tone']): AppState {
  return {
    ...state,
    toast: { id: createId('toast'), message, tone },
  };
}

function mapTreatment(
  state: AppState,
  id: string,
  update: (treatment: Treatment) => Treatment,
): Treatment[] {
  return state.treatments.map((treatment) => (treatment.id === id ? update(treatment) : treatment));
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;

    case 'take_dose': {
      const dose = state.doses.find((item) => item.id === action.id);
      if (!dose || dose.status === 'taken') return state;
      const treatment = state.treatments.find((item) => item.id === dose.treatmentId);
      if (!treatment) return state;

      return withToast(
        {
          ...state,
          lastSyncAt: action.at,
          treatments: mapTreatment(state, treatment.id, (item) => ({
            ...item,
            pillsRemaining: Math.max(0, item.pillsRemaining - item.unitsPerDose),
          })),
          doses: state.doses.map((item) =>
            item.id === action.id
              ? {
                  ...item,
                  status: 'taken',
                  takenAt: action.at,
                  resolvedAt: action.at,
                  postponedTo: undefined,
                  skipReason: undefined,
                }
              : item,
          ),
        },
        `Toma registrada · ${treatment.name}`,
        'success',
      );
    }

    case 'undo_take': {
      const dose = state.doses.find((item) => item.id === action.id);
      if (!dose || dose.status !== 'taken') return state;
      const treatment = state.treatments.find((item) => item.id === dose.treatmentId);
      if (!treatment) return state;

      return withToast(
        {
          ...state,
          lastSyncAt: new Date().toISOString(),
          treatments: mapTreatment(state, treatment.id, (item) => ({
            ...item,
            pillsRemaining: Math.min(
              item.totalPills,
              item.pillsRemaining + item.unitsPerDose,
            ),
          })),
          doses: state.doses.map((item) =>
            item.id === action.id
              ? { ...item, status: 'pending', takenAt: undefined, resolvedAt: undefined }
              : item,
          ),
        },
        'Registro deshecho',
        'info',
      );
    }

    case 'postpone_dose': {
      const dose = state.doses.find((item) => item.id === action.id);
      if (!dose) return state;
      const target = new Date(new Date(action.at).getTime() + action.minutes * 60 * 1000);

      return withToast(
        {
          ...state,
          lastSyncAt: action.at,
          doses: state.doses.map((item) =>
            item.id === action.id
              ? {
                  ...item,
                  status: 'pending',
                  scheduledAt: target.toISOString(),
                  postponedTo: target.toISOString(),
                  resolvedAt: undefined,
                }
              : item,
          ),
        },
        `Pospuesta ${action.minutes} minutos`,
        'info',
      );
    }

    case 'skip_dose': {
      const dose = state.doses.find((item) => item.id === action.id);
      if (!dose || dose.status === 'taken') return state;

      return withToast(
        {
          ...state,
          lastSyncAt: action.at,
          doses: state.doses.map((item) =>
            item.id === action.id
              ? {
                  ...item,
                  status: 'skipped',
                  skipReason: action.reason,
                  resolvedAt: action.at,
                  takenAt: undefined,
                }
              : item,
          ),
        },
        'Dosis omitida. Tu cuidador podrá verlo.',
        'info',
      );
    }

    case 'add_treatment':
      return withToast(
        {
          ...state,
          lastSyncAt: new Date().toISOString(),
          treatments: [action.treatment, ...state.treatments],
          doses: [...state.doses, ...action.doses],
          scanDraft: null,
        },
        `${action.treatment.name} se agregó a tu calendario`,
        'success',
      );

    case 'add_stock': {
      const treatment = state.treatments.find((item) => item.id === action.id);
      if (!treatment || action.amount <= 0) return state;

      return withToast(
        {
          ...state,
          lastSyncAt: new Date().toISOString(),
          treatments: mapTreatment(state, action.id, (item) => ({
            ...item,
            totalPills: item.totalPills + action.amount,
            pillsRemaining: item.pillsRemaining + action.amount,
          })),
        },
        `Agregamos ${action.amount} al inventario de ${treatment.name}`,
        'success',
      );
    }

    case 'toggle_treatment': {
      const treatment = state.treatments.find((item) => item.id === action.id);
      if (!treatment) return state;

      return withToast(
        {
          ...state,
          lastSyncAt: new Date().toISOString(),
          treatments: mapTreatment(state, action.id, (item) => ({
            ...item,
            active: !item.active,
          })),
        },
        treatment.active
          ? `${treatment.name} quedó en pausa`
          : `${treatment.name} se reanudó`,
        'info',
      );
    }

    case 'delete_treatment': {
      const treatment = state.treatments.find((item) => item.id === action.id);
      if (!treatment) return state;

      return withToast(
        {
          ...state,
          lastSyncAt: new Date().toISOString(),
          treatments: state.treatments.filter((item) => item.id !== action.id),
          doses: state.doses.filter((item) => item.treatmentId !== action.id),
        },
        `${treatment.name} se eliminó`,
        'info',
      );
    }

    case 'append_message':
      return {
        ...state,
        messages: [...state.messages, action.message].slice(-80),
      };

    case 'clear_chat':
      return {
        ...state,
        messages: [createGreetingMessage(new Date(action.at))],
      };

    case 'set_scan_draft':
      return { ...state, scanDraft: action.draft };

    case 'show_toast':
      return { ...state, toast: action.toast };

    case 'hide_toast':
      return state.toast?.id === action.id ? { ...state, toast: null } : state;

    case 'set_role':
      return { ...state, role: action.role, lastSyncAt: new Date().toISOString() };

    case 'complete_onboarding': {
      const code = action.patientCode?.trim().toUpperCase() ?? '';
      const linked =
        action.role === 'caregiver' && code === state.profile.caregiverCode.toUpperCase();
      return {
        ...state,
        role: action.role,
        roleChosen: true,
        linkedPatientCode: linked ? state.profile.caregiverCode : state.linkedPatientCode,
        lastSyncAt: new Date().toISOString(),
      };
    }

    case 'link_caregiver':
      return withToast(
        {
          ...state,
          role: 'caregiver',
          roleChosen: true,
          linkedPatientCode: action.code.trim().toUpperCase(),
          lastSyncAt: new Date().toISOString(),
        },
        `Vinculado con ${state.profile.name}`,
        'success',
      );

    case 'unlink_caregiver':
      return withToast(
        {
          ...state,
          linkedPatientCode: null,
          lastSyncAt: new Date().toISOString(),
        },
        'Vínculo con el paciente eliminado',
        'info',
      );

    case 'set_alarm_enabled':
      return {
        ...state,
        alarmEnabled: action.enabled,
        lastSyncAt: new Date().toISOString(),
      };

    default:
      return state;
  }
}
