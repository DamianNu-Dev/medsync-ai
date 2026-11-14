import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { AppRole, AppState } from '@/types';

const API_URL_KEY = '@medsync-ai/api-url/v1';
const REQUEST_TIMEOUT_MS = 15_000;

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  patientCode: string | null;
  linkedPatientId: string | null;
  createdAt: string;
}

export interface ApiPatient {
  id: string;
  name: string;
  code: string;
  state: AppState;
  updatedAt: string;
}

export interface SessionPayload {
  user: ApiUser;
  patient: ApiPatient | null;
}

export interface AuthPayload extends SessionPayload {
  token: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

/**
 * En desarrollo, Expo conoce la IP de la computadora que sirve el bundle.
 * La usamos para que el teléfono encuentre el backend en la misma red sin
 * tener que escribir la IP a mano.
 */
export function detectApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return normalizeApiBaseUrl(configured);

  if (Platform.OS !== 'web') {
    const hostUri =
      Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? null;
    const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:4000`;
    }
    if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  }

  return 'http://localhost:4000';
}

let cachedBaseUrl: string | null = null;

export async function loadApiBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;

  // Priorizar la URL configurada en .env (EXPO_PUBLIC_API_URL) para que
  // el splash y el login usen exactamente la misma dirección.
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) {
    cachedBaseUrl = normalizeApiBaseUrl(configured);
    return cachedBaseUrl;
  }

  try {
    const stored = await AsyncStorage.getItem(API_URL_KEY);
    cachedBaseUrl = stored ? normalizeApiBaseUrl(stored) : detectApiBaseUrl();
  } catch {
    cachedBaseUrl = detectApiBaseUrl();
  }
  return cachedBaseUrl;
}

export async function saveApiBaseUrl(value: string): Promise<string> {
  const normalized = normalizeApiBaseUrl(value) || detectApiBaseUrl();
  cachedBaseUrl = normalized;
  await AsyncStorage.setItem(API_URL_KEY, normalized);
  return normalized;
}

export async function resetApiBaseUrl(): Promise<string> {
  cachedBaseUrl = null;
  await AsyncStorage.removeItem(API_URL_KEY);
  cachedBaseUrl = detectApiBaseUrl();
  return cachedBaseUrl;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  token?: string | null;
  body?: unknown;
  retries?: number;
}

const SLEEP = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = await loadApiBaseUrl();
  const maxRetries = options.retries ?? 3;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let payload: unknown = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = null;
        }
      }

      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : `El servidor respondió ${response.status}.`;
        throw new ApiError(message, response.status);
      }

      return payload as T;
    } catch (error) {
      lastError = error;

      // No reintentar errores de API (4xx/5xx) ni aborts intencionales
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        // Reintentar si es timeout de red (servidor despertando)
        if (attempt < maxRetries) {
          await SLEEP(3000);
          continue;
        }
        throw new ApiError(
          'El servidor tardó demasiado en responder. Puede estar despertando (servidor gratuito). Intenta de nuevo.',
        );
      }

      // Errores de red: reintentar
      if (attempt < maxRetries) {
        await SLEEP(3000);
        continue;
      }
      throw new ApiError(
        'No pudimos conectar con el servidor. Revisa la dirección y que el backend esté encendido.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError as Error;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const payload = await request<{ ok: boolean }>('/api/health');
    return payload.ok === true;
  } catch {
    return false;
  }
}

export function apiRegister(input: {
  name: string;
  email: string;
  password: string;
  role: AppRole;
  linkCode?: string;
}): Promise<AuthPayload> {
  return request<AuthPayload>('/api/auth/register', {
    method: 'POST',
    body: input,
  });
}

export function apiLogin(email: string, password: string): Promise<AuthPayload> {
  return request<AuthPayload>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function apiLogout(token: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
    token,
  });
}

export function apiSession(token: string): Promise<SessionPayload> {
  return request<SessionPayload>('/api/session', { token });
}

export function apiGetPatientState(
  token: string,
): Promise<{ state: AppState; updatedAt: string }> {
  return request<{ state: AppState; updatedAt: string }>('/api/patient/state', {
    token,
  });
}

export function apiPutPatientState(
  token: string,
  state: AppState,
): Promise<{ ok: boolean; updatedAt: string }> {
  return request<{ ok: boolean; updatedAt: string }>('/api/patient/state', {
    method: 'PUT',
    token,
    body: { state },
  });
}

export function apiGetCaregiverPatient(token: string): Promise<{ patient: ApiPatient }> {
  return request<{ patient: ApiPatient }>('/api/caregiver/patient', { token });
}

export function apiLinkCaregiver(
  token: string,
  code: string,
): Promise<{ patient: ApiPatient }> {
  return request<{ patient: ApiPatient }>('/api/caregiver/link', {
    method: 'POST',
    token,
    body: { code },
  });
}

export function apiUnlinkCaregiver(token: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/caregiver/unlink', {
    method: 'POST',
    token,
  });
}
