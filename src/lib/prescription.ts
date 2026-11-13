import { AISettings, hasAIConfig } from '@/lib/aiSettings';
import { MedicationForm, PrescriptionExtraction } from '@/types';

const VALID_FORMS: MedicationForm[] = [
  'tablet',
  'capsule',
  'syrup',
  'drops',
  'injection',
  'patch',
];

export const SAMPLE_PRESCRIPTION: PrescriptionExtraction = {
  patientName: 'Rosa Martínez',
  medicationName: 'Enalapril',
  strength: '10 mg',
  form: 'tablet',
  unitsPerDose: 1,
  frequencyHours: 12,
  startTime: '08:00',
  durationDays: 30,
  totalPills: 60,
  notes: 'Tomar con alimentos. No suspender sin indicación médica.',
  confidence: 0.94,
  warnings: [
    'Dosis de ejemplo: confirma con tu médico antes de guardar.',
    'La imagen se procesó en modo demostración.',
  ],
  source: 'demo',
};

const VISION_PROMPT = `Eres un asistente farmacéutico que transcribe recetas médicas.
Analiza la imagen y devuelve SOLO un objeto JSON válido, sin markdown, con esta forma exacta:
{
  "patientName": string | null,
  "medicationName": string,
  "strength": string,
  "form": "tablet" | "capsule" | "syrup" | "drops" | "injection" | "patch",
  "unitsPerDose": number,
  "frequencyHours": number,
  "startTime": "HH:mm" en formato 24 h,
  "durationDays": number,
  "totalPills": number,
  "notes": string,
  "confidence": number entre 0 y 1,
  "warnings": string[]
}
Reglas:
- No inventes datos que no aparezcan. Si faltan, usa valores seguros y agrega una advertencia.
- "cada 8 horas" => frequencyHours 8; "cada 12 horas" => 12; "una vez al día" => 24.
- Si solo hay indicación de días, calcula totalPills = unidades por toma * (duración en días * 24 / frecuencia).
- Escribe los warnings en español, claros y breves.
- La confianza debe reflejar la legibilidad real de la imagen.`;

function extractJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('La IA no devolvió un JSON válido.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function normalizeForm(value: unknown): MedicationForm {
  const text = String(value ?? '').toLowerCase();
  if (VALID_FORMS.includes(text as MedicationForm)) return text as MedicationForm;
  if (text.includes('caps') || text.includes('cap')) return 'capsule';
  if (text.includes('jarabe') || text.includes('susp')) return 'syrup';
  if (text.includes('gota')) return 'drops';
  if (text.includes('inyec') || text.includes('jering')) return 'injection';
  if (text.includes('parche')) return 'patch';
  return 'tablet';
}

function normalizeTime(value: unknown): string {
  const text = String(value ?? '').trim();
  const match = text.match(/(\d{1,2})[:.]?(\d{2})?/);
  if (!match) return '08:00';
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2] ?? 0)));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeExtraction(value: unknown): PrescriptionExtraction {
  if (!value || typeof value !== 'object') {
    throw new Error('La respuesta no tiene el formato esperado.');
  }
  const raw = value as Record<string, unknown>;
  const medicationName = String(raw.medicationName ?? '').trim();
  if (!medicationName) throw new Error('No se pudo identificar el medicamento.');

  const form = normalizeForm(raw.form);
  const unitsPerDose = clampNumber(raw.unitsPerDose, 1, 1, 20);
  const frequencyHours = clampNumber(raw.frequencyHours, 24, 1, 72);
  const durationDays = clampNumber(raw.durationDays, 30, 1, 365);
  const suggestedPills =
    unitsPerDose * Math.max(1, Math.ceil((durationDays * 24) / frequencyHours));
  const totalPills = clampNumber(raw.totalPills, suggestedPills, 1, 5000);
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map((item) => String(item)).filter(Boolean).slice(0, 5)
    : [];

  return {
    patientName: raw.patientName ? String(raw.patientName) : undefined,
    medicationName,
    strength: String(raw.strength ?? 'Consultar').trim(),
    form,
    unitsPerDose,
    frequencyHours,
    startTime: normalizeTime(raw.startTime),
    durationDays,
    totalPills,
    notes: raw.notes ? String(raw.notes) : undefined,
    confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0.6)),
    warnings:
      warnings.length > 0
        ? warnings
        : ['Revisa los datos con tu receta original antes de guardar.'],
    source: 'ai',
  };
}

interface AnalyzeOptions {
  base64?: string;
  mimeType?: string;
  useSample?: boolean;
}

export async function analyzePrescription(
  { base64, mimeType = 'image/jpeg', useSample }: AnalyzeOptions,
  settings: AISettings,
): Promise<PrescriptionExtraction> {
  if (useSample) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return {
      ...SAMPLE_PRESCRIPTION,
      warnings: [...SAMPLE_PRESCRIPTION.warnings],
      source: 'demo',
    };
  }

  if (!base64) {
    throw new Error('Falta la imagen de la receta.');
  }

  if (!hasAIConfig(settings)) {
    throw new Error(
      'La lectura real necesita una clave de IA. Configúrala en Ajustes → Inteligencia artificial.',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40_000);

  try {
    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.visionModel,
        temperature: 0.1,
        max_tokens: 700,
        messages: [
          { role: 'system', content: VISION_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extrae los datos de esta receta médica y devuelve solo el JSON solicitado.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    });

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Error ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('La IA no devolvió contenido.');
    return normalizeExtraction(extractJson(content));
  } finally {
    clearTimeout(timeout);
  }
}
