export const APP_NAME = 'MedSync AI';

export const AI_CONFIG = {
  baseUrl: (process.env.EXPO_PUBLIC_AI_BASE_URL ?? 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
  apiKey: process.env.EXPO_PUBLIC_AI_API_KEY ?? '',
  model: process.env.EXPO_PUBLIC_AI_MODEL ?? 'qwen/qwen3.8-27b',
  visionModel:
    process.env.EXPO_PUBLIC_AI_VISION_MODEL ?? 'qwen/qwen3.8-27b',
} as const;

export const isAIConfigured = AI_CONFIG.apiKey.trim().length > 0;

export const DISCLAIMER =
  'Medi es un asistente informativo y puede equivocarse. No sustituye el diagnóstico ni las indicaciones de tu médico.';

export const EMERGENCY_HINT =
  'Si tienes dolor de pecho, dificultad para respirar, desmayo, sangrado fuerte o una reacción alérgica, llama al 911 o acude a urgencias ahora.';

export const DOSE_COLORS = [
  '#0B6B57',
  '#1F5C8B',
  '#6B4AA0',
  '#8A4F00',
  '#B3261E',
] as const;

export const CARE_GRACE_MINUTES = 30;
