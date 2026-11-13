# Análisis con REA

## 1. Qué es REA

**REA (Reverse Engineer Anything)** es un CLI y servidor MCP de ingeniería inversa. Permite inspeccionar binarios nativos, aplicaciones JavaScript/Electron, ensamblados .NET, APKs de Android, sitios web, capturas de red y artefactos de firmware, devolviendo hallazgos con **evidencia** y limitaciones explícitas.

- Repositorio oficial: <https://github.com/morluto/rea>
- Paquete npm: [`rea-agents`](https://www.npmjs.com/package/rea-agents)
- Versión analizada: **6.9.0**
- Licencia: MIT
- Web: <https://rea.tools/>

REA no es una dependencia de MedSync AI. Se usa como herramienta externa de análisis y como marco metodológico para estudiar patrones de producto. No se incluye en `package.json` ni en el bundle.

---

## 2. Requisitos y ejecución en este entorno

REA 6.9.0 exige:

- Node.js `^22.23.4`, `^24.22.1` o `>=26.12.1`
- npm
- Para análisis nativo: Hopper, Ghidra, IDA o Kuna (opcional según el objetivo)
- Para APKs: JADX y JDK
- En Linux: un `ps` compatible con procps

El entorno del proyecto usa Node **22.22.1**, que es válido para Expo pero **no** para REA. Para ejecutarlo se usó Node 24.22.1 mediante el paquete `node` de npm:

```bash
npx -y node@24.22.1 --version   # v24.22.1
```

Instalación de REA en un directorio de herramientas separado (nunca dentro de la app):

```bash
mkdir -p /tmp/opencode/rea-check && cd /tmp/opencode/rea-check
pnpm init
pnpm add rea-agents@6.9.0 --allow-build=frida
```

Comprobación de disponibilidad:

```bash
node_modules/rea-agents/scripts/rea.mjs doctor
```

Resultado relevante:

```text
node: 24.22.1 .................... healthy
host: ubuntu 26.04 ............... healthy
hopper / ghidra / ida / jadx ..... missing_analysis_engine
```

El análisis **estático de JavaScript no necesita un motor nativo**, así que fue posible ejecutarlo sin configurar Hopper/Ghidra/IDA/JADX.

### Comandos útiles de REA

```bash
npx rea-agents@latest setup
npx rea-agents@latest --help
npx rea-agents@latest analyze <ruta>
npx rea-agents@latest analyze-javascript-application <ruta> --json
npx rea-agents@latest audit-release-exposure <ruta>
npx rea-agents@latest doctor
```

Con el CLI instalado globalmente, el binario es `rea`:

```bash
npm install --global rea-agents
rea --help
rea doctor
```

---

## 3. Ejecución real sobre MedSync AI

Para validar que el bundle exportado es analizable y que la herramienta funciona en este entorno, se ejecutó REA sobre el build web del propio proyecto.

### 3.1 Bundle completo

```bash
rea analyze-javascript-application /root/medsync-ai/dist --json
```

Resultado: **timeout a los 300 s** procesando el `entry` de 1.1 MB. REA alcanzó a inventariar y parsear 14 archivos y emitió evidencia parcial con la limitación:

```text
Analysis operation timed out after 300000ms: analyze_javascript_application
```

Esto es esperable en bundles de Expo/Metro: el entry concentra el runtime, React Native Web y el router.

### 3.2 Chunk de una ruta

Para obtener un resultado completo se aisló el chunk de la ruta `/treatments`:

```bash
mkdir -p /tmp/opencode/rea-sample/_expo/static/js/web
cp /root/medsync-ai/dist/_expo/static/js/web/treatments-*.js \
   /tmp/opencode/rea-sample/_expo/static/js/web/
cp /root/medsync-ai/dist/index.html /tmp/opencode/rea-sample/

rea analyze-javascript-application /tmp/opencode/rea-sample --json
```

Resultado: **exit 0**.

| Campo | Valor |
| --- | --- |
| `evidence_id` | `ev_1b97956a6f06218c366f2fcf2b9eb76098ea2f88fbccb84e1292a4f58ccf6062` |
| Provider | `rea-javascript-application` v1 |
| Formato | Directorio |
| SHA-256 del sujeto | `6593c68542c94a19e05ef86e5d11d0f0924cfe4d51c163ee6fadb8111ce4320f` |
| Nodos del grafo | 5 |
| Aristas del grafo | 5 |
| Tipos de nodo | `javascript-module`, `electron-renderer`, `artifact`, `javascript-asset` |
| IPC / preload / bridge | 0 (la app no es Electron) |

El resumen reproducible está en [`rea-evidencia-resumen.json`](rea-evidencia-resumen.json).

### 3.3 Limitaciones del análisis

- Es **estático**: no ejecuta el bundle ni demuestra comportamiento en runtime.
- Las rutas dinámicas y los imports calculados pueden quedar sin resolver.
- El `entry` completo excede el tiempo límite; se analizó por chunks.
- No se analizaron APKs ni binarios nativos porque no hay motores configurados.
- No se descompiló ninguna app propietaria.

---

## 4. Cómo se usó REA para el diseño de producto

REA se empleó como marco para responder una pregunta de ingeniería inversa de producto:

> ¿Qué decisiones de UX hacen que una app de adherencia sea comprensible para una persona mayor y útil para su cuidador?

El análisis se centró en **patrones observables** de apps de referencia del sector (Medisafe, MyTherapy) y en la evidencia de nuestra propia implementación. No se copiaron activos, marcas, textos ni código propietario.

| Patrón observado | Decisión en MedSync AI | Implementación |
| --- | --- | --- |
| Una sola toma protagonista, no una lista densa | Tarjeta grande de la toma actual | `DoseCard.tsx` |
| Acciones primarias enormes y separadas | Tomar / Posponer / Omitir con jerarquía visual | `Button` + `DoseCard` |
| Confirmación inequívoca después de registrar | Modal con check animado, hora y stock restante | `TakeSuccessModal.tsx` |
| Inventario siempre visible | Barra de progreso y alerta de stock bajo | `ProgressBar`, `LowStockBanner` |
| Estado del cuidador por color | Verde / ámbar / rojo con título y detalle | `caregiver.tsx`, `getCaregiverData` |
| Retraso con umbral claro | 30 min para “atrasada”, 120 min para “sin registrar” | `schedule.ts` |
| Adherencia semanal escaneable | Barras de 7 días con etiqueta de hoy | `WeekBars.tsx` |
| Lenguaje empático, sin culpa | “Aún puedes registrarla”, “Tu cuidador podrá verlo” | Copys de la app |
| Accesibilidad para baja visión | Fuente 17–40 px, contraste alto, escala máxima 1.5 | `theme.ts`, `AppText` |
| Receta como entrada de datos | Escaneo con JSON revisable antes de guardar | `scan.tsx`, `prescription.ts` |

### Flujo de análisis aplicado

1. **Definir el objetivo:** entender el flujo “recordatorio → toma → confirmación → inventario → cuidador”.
2. **Recolectar evidencia observable:** capturas, flujos públicos y documentación de producto.
3. **Aislar los patrones:** no features aisladas, sino secuencias de interacción.
4. **Mapear a nuestro dominio:** dosis, stock, adherencia y alertas.
5. **Implementar y validar:** `tsc`, `expo export` y revisión de estados con datos demo.
6. **Registrar límites:** lo que no se puede afirmar sin ejecutar la app original.

REA aporta la disciplina de **evidencia + limitaciones**; no sustituye la investigación de usuarios ni las pruebas de usabilidad.

---

## 5. Uso responsable

- REA se usó sobre **nuestro propio bundle** y sobre patrones públicos de producto.
- No se descompilaron apps propietarias, no se extrajeron activos y no se eludieron licencias ni protecciones.
- REA no se distribuye con la app ni se ejecuta en producción.
- Cualquier análisis de un binario de terceros debe hacerse solo con autorización legal y respetando los términos de la herramienta y del software analizado.

Consulta el [DISCLAIMER de REA](https://github.com/morluto/rea/blob/main/DISCLAIMER.md) para más contexto.

---

## 6. Reproducir el análisis

```bash
# 1. Node compatible con REA
npx -y node@24.22.1 --version

# 2. Instalar REA fuera del proyecto
mkdir -p /tmp/opencode/rea-check && cd /tmp/opencode/rea-check
pnpm init
pnpm add rea-agents@6.9.0 --allow-build=frida

# 3. Exportar la app
cd /root/medsync-ai
pnpm export:web

# 4. Analizar un chunk
mkdir -p /tmp/opencode/rea-sample/_expo/static/js/web
cp dist/_expo/static/js/web/treatments-*.js /tmp/opencode/rea-sample/_expo/static/js/web/
cp dist/index.html /tmp/opencode/rea-sample/

cd /tmp/opencode/rea-check
/root/.npm/_npx/<hash>/node_modules/node/bin/node \
  node_modules/rea-agents/scripts/rea.mjs \
  analyze-javascript-application /tmp/opencode/rea-sample --json
```

Sustituye `<hash>` por la ruta real que imprime `npx -y node@24.22.1 -p "process.execPath"`.
