#!/usr/bin/env python3
"""Comprueba las claves de Groq configuradas y muestra la cuota disponible.

Groq no expone un endpoint de "créditos" por API: la información disponible son
los límites de velocidad (RPM/RPD/TPM/TPD) que llegan en las cabeceras de cada
respuesta. Este script imprime la clave enmascarada y esos valores para cada
una de las claves (principal y de respaldo).

Las claves se leen de variables de entorno; NUNCA se imprimen completas.
"""

import json
import os
import time
import urllib.error
import urllib.request

BASE = os.environ.get("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
MODEL = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")
KEYS = [
    ("principal", os.environ.get("GROQ_PRIMARY_KEY", "")),
    ("respaldo", os.environ.get("GROQ_FALLBACK_KEY", "")),
]

# Consumo aproximado de MedSync AI por petición (tokens de entrada + salida).
TOKENS_POR_CHAT = 900
TOKENS_POR_VISION = 2000

INTERESTING_HEADERS = (
    "x-ratelimit-limit-requests",
    "x-ratelimit-remaining-requests",
    "x-ratelimit-reset-requests",
    "x-ratelimit-limit-tokens",
    "x-ratelimit-remaining-tokens",
    "x-ratelimit-reset-tokens",
    "retry-after",
)


def masked(key: str) -> str:
    if len(key) < 14:
        return "(vacía)"
    return f"{key[:8]}…{key[-4:]}"


def call(path: str, key: str, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": "medsync-ai-key-check/1.0",
        },
    )
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.headers, response.read().decode("utf-8"), time.monotonic() - started
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read().decode("utf-8"), time.monotonic() - started
    except Exception as error:  # noqa: BLE001 - diagnóstico
        return 0, {}, str(error), time.monotonic() - started


def main() -> int:
    print(f"Groq · modelo configurado: {MODEL}")
    print("Nota: Groq no ofrece saldo de créditos por API; se muestran límites/cuota diarios.\n")

    failures = 0

    for label, key in KEYS:
        print(f"===== CLAVE {label.upper()} ({masked(key)}) =====")
        if not key:
            print("  Sin configurar\n")
            failures += 1
            continue

        status, headers, body, elapsed = call("/models", key)
        models = []
        if status == 200:
            try:
                models = [item.get("id", "") for item in json.loads(body).get("data", [])]
            except Exception:  # noqa: BLE001
                pass
        print(f"  GET /models    -> HTTP {status} ({elapsed:.2f}s), {len(models)} modelos")
        if models:
            print(f"  MODELOS: {', '.join(models[:14])}")
            print(f"  ¿{MODEL} disponible?: {'sí' if MODEL in models else 'NO'}")

        payload = {
            "model": MODEL,
            "temperature": 0,
            "max_tokens": 24,
            "messages": [{"role": "user", "content": 'Responde solo: "ok"'}],
        }
        status, headers, body, elapsed = call("/chat/completions", key, payload)
        print(f"  POST /chat     -> HTTP {status} ({elapsed:.2f}s)")
        if status != 200:
            print(f"  ERROR: {body[:300]}")
            failures += 1
        else:
            try:
                parsed = json.loads(body)
                content = parsed.get("choices", [{}])[0].get("message", {}).get("content", "")
                usage = parsed.get("usage", {})
                print(f"  RESPUESTA: {content!r} · tokens: {usage}")
            except Exception:  # noqa: BLE001
                print(f"  RESPUESTA (texto): {body[:200]}")

        print("  CUOTA / LÍMITES:")
        for name in INTERESTING_HEADERS:
            value = headers.get(name)
            if value:
                print(f"    {name}: {value}")
        if "x-ratelimit-remaining-requests" in headers and "x-ratelimit-remaining-tokens" in headers:
            try:
                requests_left = int(headers["x-ratelimit-remaining-requests"])
                tokens_left = int(headers["x-ratelimit-remaining-tokens"])
                print(
                    "  ESTIMACIÓN (plan gratuito, 200K tokens/día por organización): "
                    f"~{requests_left} chats/día o ~{tokens_left // TOKENS_POR_VISION} verificaciones/día"
                )
            except ValueError:
                pass
        print()

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
