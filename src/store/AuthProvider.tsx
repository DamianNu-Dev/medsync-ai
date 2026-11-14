import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState as RNAppState } from 'react-native';

import { createGreetingMessage, createSeedState } from '@/data/seed';
import {
  apiGetCaregiverPatient,
  apiGetPatientState,
  apiLinkCaregiver,
  apiLogin,
  apiLogout,
  apiPutPatientState,
  apiRegister,
  apiSession,
  apiUnlinkCaregiver,
  ApiError,
  ApiPatient,
  ApiUser,
  AuthPayload,
  checkApiHealth,
  loadApiBaseUrl,
  saveApiBaseUrl,
  SessionPayload,
} from '@/lib/api';
import {
  clearSessionToken,
  loadSessionToken,
  saveSessionToken,
} from '@/lib/authStorage';
import { useApp } from '@/store/AppProvider';
import { AppRole, AppState } from '@/types';

export type AuthMode = 'account' | 'local' | null;
export type SyncState = 'idle' | 'saving' | 'saved' | 'error';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: AppRole;
  linkCode?: string;
}

interface AuthContextValue {
  ready: boolean;
  mode: AuthMode;
  token: string | null;
  user: ApiUser | null;
  patient: ApiPatient | null;
  apiBaseUrl: string;
  busy: boolean;
  error: string | null;
  syncState: SyncState;
  lastSyncedAt: string | null;
  login: (email: string, password: string) => Promise<AppRole>;
  register: (input: RegisterInput) => Promise<AppRole>;
  logout: () => Promise<void>;
  enterLocalMode: () => void;
  linkPatient: (code: string) => Promise<void>;
  unlinkPatient: () => Promise<void>;
  refreshPatient: () => Promise<boolean>;
  updateApiBaseUrl: (url: string) => Promise<string>;
  testServer: (url?: string) => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Paciente';
}

function patientState(patient: ApiPatient): AppState {
  return {
    ...patient.state,
    version: 1,
    role: 'patient',
    roleChosen: true,
    linkedPatientCode: null,
    profile: {
      ...patient.state.profile,
      name: patient.name,
      firstName: firstNameOf(patient.name),
      caregiverCode: patient.code,
    },
    messages: Array.isArray(patient.state.messages) ? patient.state.messages : [],
    scanDraft:
      patient.state.scanDraft && Array.isArray(patient.state.scanDraft.medications)
        ? patient.state.scanDraft
        : null,
    toast: null,
  };
}

function caregiverPatientState(patient: ApiPatient, caregiverName: string): AppState {
  return {
    ...patientState(patient),
    role: 'caregiver',
    linkedPatientCode: patient.code,
    profile: {
      ...patientState(patient).profile,
      caregiverName,
    },
  };
}

function emptyCaregiverState(caregiverName: string): AppState {
  const base = createSeedState();
  return {
    ...base,
    role: 'caregiver',
    roleChosen: true,
    linkedPatientCode: null,
    alarmEnabled: false,
    profile: {
      ...base.profile,
      name: 'Paciente sin vincular',
      firstName: 'Paciente',
      caregiverName,
      caregiverCode: '',
      phone: '',
    },
    treatments: [],
    doses: [],
    messages: [createGreetingMessage()],
    scanDraft: null,
    toast: null,
  };
}

/**
 * Ignora campos efímeros o que el servidor normaliza para no reenviar el
 * mismo estado en cada toast.
 */
function snapshotForServer(state: AppState): string {
  return JSON.stringify({
    ...state,
    toast: null,
    lastSyncAt: '',
  });
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { state, actions } = useApp();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<AuthMode>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [patient, setPatient] = useState<ApiPatient | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:4000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const lastPushedRef = useRef('');
  const skipSyncRef = useRef(false);
  const refreshRef = useRef<() => Promise<boolean>>(async () => false);

  const applySession = useCallback(
    (payload: SessionPayload) => {
      let nextState: AppState;
      if (payload.user.role === 'caregiver') {
        nextState = payload.patient
          ? caregiverPatientState(payload.patient, payload.user.name)
          : emptyCaregiverState(payload.user.name);
      } else if (payload.patient) {
        nextState = patientState(payload.patient);
      } else {
        nextState = {
          ...createSeedState(),
          roleChosen: true,
          role: 'patient',
        };
      }

      skipSyncRef.current = true;
      lastPushedRef.current = snapshotForServer(nextState);
      actions.hydrateState(nextState);
      setPatient(payload.patient);
      setLastSyncedAt(payload.patient?.updatedAt ?? null);
      setSyncState(payload.patient ? 'saved' : 'idle');
    },
    [actions],
  );

  useEffect(() => {
    let alive = true;
    const restore = async () => {
      const baseUrl = await loadApiBaseUrl();
      if (!alive) return;
      setApiBaseUrl(baseUrl);

      try {
        const storedToken = await loadSessionToken();
        if (!alive || !storedToken) return;
        const session = await apiSession(storedToken);
        if (!alive) return;
        setToken(storedToken);
        setUser(session.user);
        applySession(session);
        setMode('account');
      } catch {
        await clearSessionToken();
      } finally {
        if (alive) setReady(true);
      }
    };
    void restore();
    return () => {
      alive = false;
    };
  }, [applySession]);

  const finishAuth = useCallback(
    async (payload: AuthPayload) => {
      await saveSessionToken(payload.token);
      setToken(payload.token);
      setUser(payload.user);
      applySession(payload);
      setMode('account');
      setError(null);
      return payload.user.role;
    },
    [applySession],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      setBusy(true);
      setError(null);
      try {
        const payload = await apiLogin(email.trim(), password);
        return await finishAuth(payload);
      } catch (caught) {
        setError(messageOf(caught));
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [finishAuth],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      setBusy(true);
      setError(null);
      try {
        const payload = await apiRegister({
          ...input,
          name: input.name.trim(),
          email: input.email.trim(),
        });
        return await finishAuth(payload);
      } catch (caught) {
        setError(messageOf(caught));
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [finishAuth],
  );

  const logout = useCallback(async () => {
    const currentToken = token;
    setBusy(true);
    try {
      if (currentToken) await apiLogout(currentToken).catch(() => undefined);
    } finally {
      await clearSessionToken();
      setToken(null);
      setUser(null);
      setPatient(null);
      setMode(null);
      setSyncState('idle');
      setLastSyncedAt(null);
      lastPushedRef.current = '';
      actions.hydrateState({ ...createSeedState(), roleChosen: false });
      setBusy(false);
    }
  }, [actions, token]);

  const enterLocalMode = useCallback(() => {
    setError(null);
    setMode('local');
    setUser(null);
    setPatient(null);
    setToken(null);
    setSyncState('idle');
    lastPushedRef.current = '';
    actions.hydrateState({ ...createSeedState(), roleChosen: false });
  }, [actions]);

  const linkPatient = useCallback(
    async (code: string) => {
      if (!token) throw new ApiError('Inicia sesión para vincular un paciente.');
      setBusy(true);
      setError(null);
      try {
        const result = await apiLinkCaregiver(token, code);
        setPatient(result.patient);
        skipSyncRef.current = true;
        actions.hydrateState(
          caregiverPatientState(result.patient, user?.name ?? 'Cuidador'),
        );
        setLastSyncedAt(result.patient.updatedAt);
        setSyncState('saved');
        actions.showToast(`Vinculado con ${result.patient.name}`, 'success');
      } catch (caught) {
        setError(messageOf(caught));
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [actions, token, user],
  );

  const unlinkPatient = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await apiUnlinkCaregiver(token);
      setPatient(null);
      skipSyncRef.current = true;
      actions.hydrateState(emptyCaregiverState(user?.name ?? 'Cuidador'));
      actions.showToast('Vínculo con el paciente eliminado', 'info');
    } catch (caught) {
      setError(messageOf(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [actions, token, user]);

  const refreshPatient = useCallback(async () => {
    if (!token || mode !== 'account') return false;

    // No pisar cambios locales que todavía no se han subido.
    if (lastPushedRef.current && snapshotForServer(state) !== lastPushedRef.current) {
      return false;
    }

    try {
      if (user?.role === 'caregiver') {
        if (!patient) return false;
        const result = await apiGetCaregiverPatient(token);
        if (result.patient.updatedAt === patient.updatedAt) return false;
        const next = caregiverPatientState(result.patient, user.name);
        setPatient(result.patient);
        skipSyncRef.current = true;
        lastPushedRef.current = snapshotForServer(next);
        actions.hydrateState(next);
        setLastSyncedAt(result.patient.updatedAt);
        setSyncState('saved');
        return true;
      }

      if (user?.role === 'patient') {
        const result = await apiGetPatientState(token);
        if (!result.state) return false;
        if (result.updatedAt === lastSyncedAt) return false;
        const apiPatient: ApiPatient = {
          id: user.id,
          name: user.name,
          code: user.patientCode ?? '',
          state: result.state,
          updatedAt: result.updatedAt,
        };
        const next = patientState(apiPatient);
        skipSyncRef.current = true;
        lastPushedRef.current = snapshotForServer(next);
        actions.hydrateState(next);
        setPatient(apiPatient);
        setLastSyncedAt(result.updatedAt);
        setSyncState('saved');
        return true;
      }

      return false;
    } catch {
      setSyncState('error');
      return false;
    }
  }, [actions, lastSyncedAt, mode, patient, state, token, user]);

  useEffect(() => {
    refreshRef.current = refreshPatient;
  }, [refreshPatient]);

  const updateApiBaseUrl = useCallback(async (url: string) => {
    const normalized = await saveApiBaseUrl(url);
    setApiBaseUrl(normalized);
    return normalized;
  }, []);

  const testServer = useCallback(async (url?: string) => {
    if (url) await updateApiBaseUrl(url);
    return checkApiHealth();
  }, [updateApiBaseUrl]);

  const clearError = useCallback(() => setError(null), []);

  // Paciente y cuidador vinculado: suben los cambios al backend con un
  // pequeño debounce para que ambos roles vean el mismo tratamiento.
  const canSync =
    mode === 'account' &&
    Boolean(token) &&
    (user?.role === 'patient' ||
      (user?.role === 'caregiver' && Boolean(patient)));

  useEffect(() => {
    if (!canSync || !token) return;
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    const snapshot = snapshotForServer(state);
    if (snapshot === lastPushedRef.current) return;

    const timeout = setTimeout(() => {
      setSyncState('saving');
      apiPutPatientState(token, state)
        .then((result) => {
          lastPushedRef.current = snapshot;
          setLastSyncedAt(result.updatedAt);
          setSyncState('saved');
        })
        .catch((caught) => {
          setSyncState('error');
          if (caught instanceof ApiError && caught.status === 401) {
            setError(caught.message);
          }
        });
    }, 900);

    return () => clearTimeout(timeout);
  }, [canSync, state, token]);

  // Paciente y cuidador: revisan cambios remotos cada 15 s.
  useEffect(() => {
    if (mode !== 'account' || !token) return;
    if (user?.role !== 'caregiver' && user?.role !== 'patient') return;
    if (user?.role === 'caregiver' && !patient) return;
    const interval = setInterval(() => {
      void refreshRef.current();
    }, 15_000);
    return () => clearInterval(interval);
  }, [mode, patient, token, user?.role]);

  // Al volver a la app, refrescar de inmediato si la pantalla estuvo inactiva.
  useEffect(() => {
    if (mode !== 'account' || !token) return;
    const subscription = RNAppState.addEventListener('change', (status) => {
      if (status === 'active') void refreshRef.current();
    });
    return () => subscription.remove();
  }, [mode, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      mode,
      token,
      user,
      patient,
      apiBaseUrl,
      busy,
      error,
      syncState,
      lastSyncedAt,
      login,
      register,
      logout,
      enterLocalMode,
      linkPatient,
      unlinkPatient,
      refreshPatient,
      updateApiBaseUrl,
      testServer,
      clearError,
    }),
    [
      ready,
      mode,
      token,
      user,
      patient,
      apiBaseUrl,
      busy,
      error,
      syncState,
      lastSyncedAt,
      login,
      register,
      logout,
      enterLocalMode,
      linkPatient,
      unlinkPatient,
      refreshPatient,
      updateApiBaseUrl,
      testServer,
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}
