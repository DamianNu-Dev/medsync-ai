import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppState } from '@/types';

const STORAGE_KEY = '@medsync-ai/state/v1';

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppState>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.treatments) &&
    Array.isArray(candidate.doses) &&
    Array.isArray(candidate.messages) &&
    Boolean(candidate.profile) &&
    typeof candidate.profile?.name === 'string'
  );
}

export async function loadPersistedState(): Promise<AppState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isAppState(parsed)) return null;
    return {
      ...parsed,
      role: parsed.role === 'caregiver' ? 'caregiver' : 'patient',
      roleChosen: typeof parsed.roleChosen === 'boolean' ? parsed.roleChosen : true,
      linkedPatientCode: parsed.linkedPatientCode ?? null,
      alarmEnabled: parsed.alarmEnabled !== false,
      scanDraft:
        parsed.scanDraft && Array.isArray(parsed.scanDraft.medications)
          ? parsed.scanDraft
          : null,
      toast: null,
    };
  } catch {
    return null;
  }
}

export async function persistState(state: AppState): Promise<void> {
  const snapshot = {
    version: state.version,
    role: state.role,
    roleChosen: state.roleChosen,
    linkedPatientCode: state.linkedPatientCode,
    alarmEnabled: state.alarmEnabled,
    profile: state.profile,
    treatments: state.treatments,
    doses: state.doses,
    messages: state.messages.slice(-80),
    scanDraft: state.scanDraft,
    lastSyncAt: state.lastSyncAt,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export async function clearPersistedState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
