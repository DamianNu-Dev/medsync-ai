import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  visionModel: string;
}

const STORAGE_KEY = '@medsync-ai/ai-settings/v1';

export function defaultAISettings(): AISettings {
  return {
    baseUrl: (process.env.EXPO_PUBLIC_AI_BASE_URL ?? 'https://api.groq.com/openai/v1').replace(
      /\/$/,
      '',
    ),
    apiKey: process.env.EXPO_PUBLIC_AI_API_KEY ?? '',
    model: process.env.EXPO_PUBLIC_AI_MODEL ?? 'qwen/qwen3.8-27b',
    visionModel:
      process.env.EXPO_PUBLIC_AI_VISION_MODEL ?? 'qwen/qwen-vl',
  };
}

export function hasAIConfig(settings: AISettings): boolean {
  return settings.apiKey.trim().length > 0;
}

function normalize(settings: AISettings): AISettings {
  return {
    baseUrl: settings.baseUrl.trim().replace(/\/$/, ''),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    visionModel: settings.visionModel.trim(),
  };
}

export async function loadAISettings(): Promise<AISettings | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    if (!parsed || typeof parsed !== 'object') return null;
    return normalize({ ...defaultAISettings(), ...parsed });
  } catch {
    return null;
  }
}

export async function persistAISettings(settings: AISettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(settings)));
}

export async function clearAISettings(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
