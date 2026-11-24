import { AI_FALLBACK_KEYS, AISettings } from '@/lib/aiSettings';

type CompletionPayload = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

export type CompletionResult = {
  content: string;
  /** true cuando la respuesta la dio una clave de respaldo. */
  usedFallback: boolean;
  status: number;
};

export class AIRequestError extends Error {
  readonly status?: number;
  readonly source: 'primary' | 'fallback';

  constructor(message: string, status: number | undefined, source: 'primary' | 'fallback') {
    super(message);
    this.name = 'AIRequestError';
    this.status = status;
    this.source = source;
  }
}

/**
 * Llama a un endpoint compatible con OpenAI probando la clave principal y, si
 * falla, las de respaldo. Así un error 401/403/429/5xx o un corte de red de un
 * proveedor no deja al asistente (ni a la verificación con cámara) sin servicio.
 */
export async function chatCompletion(
  settings: AISettings,
  body: Record<string, unknown>,
  timeoutMs = 40_000,
): Promise<CompletionResult> {
  const primary = settings.apiKey.trim();
  const keys = [primary, ...AI_FALLBACK_KEYS.filter((key: string) => key !== primary)].filter(
    Boolean,
  );

  let lastError: AIRequestError | null = null;

  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const source = index === 0 ? 'primary' : 'fallback';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as CompletionPayload;

      if (!response.ok) {
        throw new AIRequestError(
          payload.error?.message ?? `Error ${response.status}`,
          response.status,
          source,
        );
      }

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new AIRequestError('La respuesta llegó vacía.', response.status, source);
      }

      return { content, usedFallback: source === 'fallback', status: response.status };
    } catch (error) {
      lastError =
        error instanceof AIRequestError
          ? error
          : new AIRequestError(
              error instanceof Error ? error.message : 'Error de red',
              undefined,
              source,
            );

      // Un modelo o cuerpo inválido dará el mismo error con cualquier clave:
      // no merece la pena gastar peticiones de respaldo.
      if (lastError.status === 400) break;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw (
    lastError ?? new AIRequestError('No hay claves de IA configuradas.', undefined, 'primary')
  );
}
