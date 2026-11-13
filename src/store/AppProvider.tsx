import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { createSeedState } from '@/data/seed';
import { clearPersistedState, loadPersistedState, persistState } from '@/lib/storage';
import { generateDoses } from '@/lib/schedule';
import {
  AppRole,
  AppState,
  ChatMessage,
  NewTreatmentInput,
  PrescriptionExtraction,
  ToastTone,
  Treatment,
} from '@/types';
import { buildTreatment, createId } from './factory';
import { AppAction, appReducer } from './reducer';

export interface AppActions {
  hydrateState: (state: AppState) => void;
  takeDose: (id: string) => void;
  undoTake: (id: string) => void;
  postponeDose: (id: string, minutes: number) => void;
  skipDose: (id: string, reason?: string) => void;
  addTreatment: (input: NewTreatmentInput) => Treatment;
  addStock: (id: string, amount: number) => void;
  toggleTreatment: (id: string) => void;
  deleteTreatment: (id: string) => void;
  addMessage: (role: ChatMessage['role'], content: string, source?: ChatMessage['source']) => void;
  clearChat: () => void;
  setScanDraft: (draft: PrescriptionExtraction | null) => void;
  showToast: (message: string, tone?: ToastTone) => void;
  hideToast: (id: string) => void;
  resetDemo: () => void;
  setRole: (role: AppRole) => void;
  completeOnboarding: (role: AppRole, patientCode?: string) => boolean;
  linkCaregiver: (code: string) => boolean;
  unlinkCaregiver: () => void;
  setAlarmEnabled: (enabled: boolean) => void;
}

interface AppContextValue {
  state: AppState;
  ready: boolean;
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, () => createSeedState());
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;

    const hydrate = async () => {
      try {
        const stored = await loadPersistedState();
        if (!alive) return;
        dispatch({ type: 'hydrate', state: stored ?? createSeedState() });
      } catch {
        if (alive) {
          dispatch({ type: 'hydrate', state: createSeedState() });
        }
      } finally {
        if (alive) setReady(true);
      }
    };

    void hydrate();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timeout = setTimeout(() => {
      void persistState(state).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timeout);
  }, [state, ready]);

  const actions = useMemo<AppActions>(
    () => ({
      hydrateState: (next) => dispatch({ type: 'hydrate', state: next }),
      takeDose: (id) =>
        dispatch({ type: 'take_dose', id, at: new Date().toISOString() }),
      undoTake: (id) => dispatch({ type: 'undo_take', id }),
      postponeDose: (id, minutes) =>
        dispatch({
          type: 'postpone_dose',
          id,
          minutes,
          at: new Date().toISOString(),
        }),
      skipDose: (id, reason) =>
        dispatch({
          type: 'skip_dose',
          id,
          reason,
          at: new Date().toISOString(),
        }),
      addTreatment: (input) => {
        const treatment = buildTreatment(input);
        dispatch({
          type: 'add_treatment',
          treatment,
          doses: generateDoses(treatment),
        });
        return treatment;
      },
      addStock: (id, amount) => dispatch({ type: 'add_stock', id, amount }),
      toggleTreatment: (id) => dispatch({ type: 'toggle_treatment', id }),
      deleteTreatment: (id) => dispatch({ type: 'delete_treatment', id }),
      addMessage: (role, content, source) =>
        dispatch({
          type: 'append_message',
          message: {
            id: createId('msg'),
            role,
            content,
            createdAt: new Date().toISOString(),
            source,
          },
        }),
      clearChat: () =>
        dispatch({ type: 'clear_chat', at: new Date().toISOString() }),
      setScanDraft: (draft) => dispatch({ type: 'set_scan_draft', draft }),
      showToast: (message, tone = 'info') =>
        dispatch({
          type: 'show_toast',
          toast: { id: createId('toast'), message, tone },
        }),
      hideToast: (id) => dispatch({ type: 'hide_toast', id }),
      resetDemo: () => {
        void clearPersistedState().catch(() => undefined);
        dispatch({ type: 'hydrate', state: createSeedState() });
      },
      setRole: (role) => dispatch({ type: 'set_role', role }),
      completeOnboarding: (role, patientCode) => {
        const code = patientCode?.trim().toUpperCase() ?? '';
        const linked =
          role === 'caregiver' &&
          code === stateRef.current.profile.caregiverCode.toUpperCase();
        dispatch({ type: 'complete_onboarding', role, patientCode });
        return linked;
      },
      linkCaregiver: (code) => {
        const normalized = code.trim().toUpperCase();
        if (normalized !== stateRef.current.profile.caregiverCode.toUpperCase()) return false;
        dispatch({ type: 'link_caregiver', code: normalized });
        return true;
      },
      unlinkCaregiver: () => dispatch({ type: 'unlink_caregiver' }),
      setAlarmEnabled: (enabled) =>
        dispatch({ type: 'set_alarm_enabled', enabled }),
    }),
    [],
  );

  const value = useMemo<AppContextValue>(
    () => ({ state, ready, actions }),
    [state, ready, actions],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe usarse dentro de <AppProvider>');
  }
  return context;
}

export type { AppState, PrescriptionExtraction };
