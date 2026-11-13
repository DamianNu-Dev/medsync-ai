import { EMERGENCY_HINT } from '@/constants/config';
import { AISettings, hasAIConfig } from '@/lib/aiSettings';
import { stockNoun } from '@/constants/medication';
import { ChatMessage, MedicationForm } from '@/types';

export interface AssistantTreatment {
  name: string;
  strength: string;
  frequencyHours: number;
  pillsRemaining: number;
  unitsPerDose: number;
  form: MedicationForm;
}

export interface AssistantDose {
  treatmentName: string;
  time: string;
  status: string;
}

export interface AssistantContext {
  profileName: string;
  treatments: AssistantTreatment[];
  todayDoses: AssistantDose[];
  adherence: number;
  nextDose?: string;
}

const EMERGENCY_TERMS = [
  'dolor de pecho',
  'no puedo respirar',
  'dificultad para respirar',
  'me falta el aire',
  'desmay',
  'sangrado',
  'sangre',
  'convulsion',
  'reaccion alergica',
  'hinchazon en la cara',
  'labios hinchados',
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function buildSystemPrompt(context: AssistantContext): string {
  const treatments =
    context.treatments.length === 0
      ? 'Sin tratamientos registrados.'
      : context.treatments
          .map(
            (item) =>
              `- ${item.name} ${item.strength}, ${item.frequencyHours} h, ${item.unitsPerDose} por toma, quedan ${item.pillsRemaining} ${stockNoun(item.form, item.pillsRemaining)}.`,
          )
          .join('\n');

  const doses =
    context.todayDoses.length === 0
      ? 'Sin tomas programadas hoy.'
      : context.todayDoses
          .map((item) => `- ${item.time}: ${item.treatmentName} (${item.status}).`)
          .join('\n');

  return [
    'Eres Medi, el asistente de salud de MedSync AI. Hablas español claro, cálido y breve (máximo 120 palabras).',
    'Tu función es ayudar a entender el tratamiento, la adherencia y el inventario. No diagnosticas, no recetas, no cambias dosis ni suspender medicamentos.',
    'Si detectas signos de alarma (dolor de pecho, dificultad para respirar, desmayo, sangrado fuerte, reacción alérgica), indica llamar al 911 o acudir a urgencias de inmediato.',
    'Cuando no tengas certeza, dilo y recomienda consultar al médico o farmacéutico. Nunca inventes indicaciones.',
    'Usa frases cortas, viñetas simples y un tono empático. Evita tecnicismos.',
    '',
    `Paciente: ${context.profileName}. Adherencia de hoy: ${context.adherence}%.`,
    `Tratamientos:\n${treatments}`,
    `Tomas de hoy:\n${doses}`,
    context.nextDose ? `Próxima toma: ${context.nextDose}.` : 'Sin próxima toma pendiente hoy.',
  ].join('\n');
}

function apiMessages(
  history: ChatMessage[],
  context: AssistantContext,
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  return [
    { role: 'system', content: buildSystemPrompt(context) },
    ...history
      .filter((message) => message.content.trim().length > 0)
      .slice(-12)
      .map((message) => ({ role: message.role, content: message.content })),
  ];
}

export async function sendChatMessage(
  history: ChatMessage[],
  context: AssistantContext,
  settings: AISettings,
): Promise<string> {
  if (!hasAIConfig(settings)) {
    throw new Error('IA_NO_CONFIGURADA');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.35,
        max_tokens: 420,
        messages: apiMessages(history, context),
      }),
    });

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Error ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('La respuesta llegó vacía.');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Prueba rápida contra el endpoint de chat para validar URL, clave y modelo
 * antes de usarlos en una receta real.
 */
export async function testAIConnection(settings: AISettings): Promise<string> {
  if (!hasAIConfig(settings)) {
    throw new Error('La clave de API no está configurada.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.model,
        temperature: 0,
        max_tokens: 20,
        messages: [
          {
            role: 'user',
            content: 'Responde únicamente con estas dos palabras: conexión exitosa.',
          },
        ],
      }),
    });

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('La clave de API no es válida (error 401).');
      }
      if (response.status === 404) {
        throw new Error('La URL o el modelo no existen (error 404). Revisa ambos campos.');
      }
      throw new Error(payload.error?.message ?? `El proveedor respondió ${response.status}.`);
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('La prueba llegó vacía. Revisa el modelo de texto.');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export function getLocalAssistantReply(text: string, context: AssistantContext): string {
  const normalized = normalize(text);

  if (EMERGENCY_TERMS.some((term) => normalized.includes(term))) {
    return `Esto puede ser una urgencia. ${EMERGENCY_HINT}\n\nNo esperes a la próxima toma ni tomes medicamentos extra por tu cuenta. Si estás con alguien, pídele que se quede contigo.`;
  }

  if (normalized.includes('olvid') || normalized.includes('se me paso')) {
    return `Si te acuerdas poco después de la hora, puedes tomarla. Si ya casi toca la siguiente dosis, no dupliques: omite la olvidada y continúa con tu horario.\n\nPara ${context.profileName}, la próxima toma es: ${
      context.nextDose ?? 'revisa la pestaña Inicio'
    }. Si tienes dudas, llama a tu médico o farmacéutico.`;
  }

  if (normalized.includes('doble') || normalized.includes('dos pastillas') || normalized.includes('otra pastilla')) {
    return 'No tomes una dosis doble para compensar. Registra solo la toma indicada y, si ya la duplicaste, contacta a tu médico o a un centro de toxicología. Lo importante es no repetirlo.';
  }

  if (normalized.includes('comida') || normalized.includes('desayuno') || normalized.includes('estomago')) {
    return 'Depende del medicamento: algunos se toman con alimentos para cuidar el estómago y otros con el estómago vacío. Revisa la etiqueta o la indicación de tu receta. Si no la tienes a mano, pregunta a tu farmacéutico antes de cambiar la forma de tomarlo.';
  }

  if (normalized.includes('stock') || normalized.includes('pastilla') || normalized.includes('acab')) {
    if (context.treatments.length === 0) {
      return 'Todavía no tienes tratamientos registrados. Agrega uno desde la pestaña Tratamientos o escanea tu receta.';
    }
    const lowest = [...context.treatments].sort(
      (a, b) => a.pillsRemaining - b.pillsRemaining,
    )[0];
    const unit = stockNoun(lowest.form, lowest.pillsRemaining);
    return `Revisé tu inventario. ${lowest.name} es el que está más bajo: te quedan ${lowest.pillsRemaining} ${unit}. Cuando queden menos de 5, conviene pedir reposición para no interrumpir el tratamiento.\n\nPuedes actualizar el stock desde el detalle del tratamiento.`;
  }

  if (normalized.includes('mareo') || normalized.includes('nausea') || normalized.includes('sintoma')) {
    return 'Si el mareo o la náusea son leves, siéntate, hidrátate y descansa un momento. Anota cuándo empezó y si coincide con una toma. Si es intenso, no mejora, hay desmayo o dificultad para respirar, busca atención médica ahora. No suspendas el medicamento sin consultar.';
  }

  if (normalized.includes('proxim') || normalized.includes('horario') || normalized.includes('cuando')) {
    return `Tu próxima toma es: ${context.nextDose ?? 'no hay tomas pendientes hoy'}.\n\nHoy tienes ${context.todayDoses.length} tomas programadas y tu adherencia va en ${context.adherence}%.`;
  }

  if (normalized.includes('alcohol')) {
    return 'El alcohol puede interactuar con varios medicamentos, especialmente los que afectan la presión, el azúcar o el sistema nervioso. Consulta con tu médico antes de beber alcohol. Si te sientes mal, busca atención.';
  }

  if (normalized.includes('cuidador') || normalized.includes('compartir')) {
    return 'En la pestaña Cuidador puedes compartir tu código de vinculación y el estado del día. Así tu cuidador ve si una toma está atrasada o si queda poco inventario.';
  }

  if (normalized.includes('hola') || normalized.includes('buen')) {
    return `Hola, ${context.profileName}. Puedo ayudarte con horarios, dosis olvidadas, inventario o dudas generales sobre tus tomas. ¿Qué te gustaría revisar?`;
  }

  return `Puedo ayudarte a revisar tus tomas de hoy, tu inventario o qué hacer si olvidaste una dosis. Según lo registrado, tu próxima toma es: ${
    context.nextDose ?? 'no hay una pendiente hoy'
  }.\n\nCuéntame un poco más de tu duda. Si es sobre un síntoma nuevo o intenso, lo mejor es consultar a tu médico.`;
}
