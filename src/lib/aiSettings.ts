import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  visionModel: string;
}

const STORAGE_KEY = '@medsync-ai/ai-settings/v1';

// Modelos válidos disponibles en Groq (verificado en la API)
const VALID_GROQ_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'allam-2-7b',
];

function isValidGroqModel(model: string): boolean {
  return VALID_GROQ_MODELS.includes(model) || model.startsWith('meta-llama/');
}

function fixInvalidModel(model: string): string {
  if (isValidGroqModel(model)) return model;
  // Si el modelo no es válido, usar el por defecto
  return 'qwen/qwen3.8-27b';
}

export function defaultAISettings(): AISettings {
  return {
    baseUrl: (process.env.EXPO_PUBLIC_AI_BASE_URL ?? 'https://api.groq.com/openai/v1').replace(
      /\/$/,
      '',
    ),
    apiKey: process.env.EXPO_PUBLIC_AI_API_KEY ?? '',
    model: process.env.EXPO_PUBLIC_AI_MODEL ?? 'qwen/qwen3.8-27b',
    visionModel:
      process.env.EXPO_PUBLIC_AI_VISION_MODEL ?? 'qwen/qwen3.8-27b',
  };
}

export function hasAIConfig(settings: AISettings): boolean {
  return settings.apiKey.trim().length > 0;
}

function normalize(settings: AISettings): AISettings {
  return {
    baseUrl: settings.baseUrl.trim().replace(/\/$/, ''),
    apiKey: settings.apiKey.trim(),
    model: fixInvalidModel(settings.model.trim()),
    visionModel: fixInvalidModel(settings.visionModel.trim()),
  };
}

export async function loadAISettings(): Promise<AISettings | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    if (!parsed || typeof parsed !== 'object') return null;
    // Los valores guardados sobrescriben los defaults, pero se validan
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
