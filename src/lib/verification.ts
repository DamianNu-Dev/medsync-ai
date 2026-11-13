import { AISettings } from '@/lib/aiSettings';

export interface VisualVerificationResult {
  verified: boolean;
  confidence: number;
  reason: string;
}

const VERIFY_PROMPT = `Eres un verificador visual de toma de medicamentos.
Analiza la selfie y responde SOLO un JSON válido, sin markdown:
{
  "verified": boolean,
  "confidence": number entre 0 y 1,
  "reason": string breve en español
}

Criterios:
- verified = true solo si se ve con claridad a una persona con la boca abierta y una pastilla, cápsula o tableta visible dentro de la boca.
- Si no se ve la boca, no se ve ninguna pastilla, la imagen es borrosa, es una foto de otra cosa o hay dudas, verified = false.
- No evalúes si la persona realmente ingirió la pastilla; solo si la pastilla es visible en la boca.
- Sé estricto: ante la duda, verified = false.
- El motivo debe ser claro y corto, por ejemplo: "Se ve la pastilla en la boca" o "No se distingue la pastilla".`;

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

export async function verifyPillInMouth(
  base64: string,
  mimeType: string,
  settings: AISettings,
): Promise<VisualVerificationResult> {
  if (!settings.apiKey || settings.apiKey.trim().length === 0) {
    throw new Error('No se pudo conectar con el servicio de verificación.');
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
        temperature: 0,
        max_tokens: 250,
        messages: [
          { role: 'system', content: VERIFY_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Verifica si la persona tiene una pastilla visible en la boca.',
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
    if (!content) throw new Error('La verificación llegó vacía.');

    const parsed = extractJson(content) as Record<string, unknown>;
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
    return {
      verified: parsed.verified === true && confidence >= 0.5,
      confidence,
      reason:
        typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
          ? parsed.reason.trim()
          : parsed.verified
            ? 'La pastilla se ve en la boca.'
            : 'No se pudo confirmar que la pastilla esté en la boca.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
