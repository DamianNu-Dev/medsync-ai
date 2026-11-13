# MedSync AI

Aplicación móvil de adherencia a tratamientos construida con **Expo + React Native + TypeScript**. Reúne en un solo lugar el calendario de tomas, el inventario, el panel del cuidador, un asistente de salud con IA, un escáner de recetas y una alarma que solo se apaga con verificación visual.

La interfaz está en español y está pensada para personas mayores y cuidadores: tipografía grande, contraste alto, botones amplios y confirmaciones visuales claras.

> **Versión actual:** la app tiene dos roles vinculados en el mismo dispositivo (paciente y cuidador), alarma con verificación por cámara y configuración de IA desde la propia app. La sincronización entre teléfonos distintos requiere un backend (ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)).

---

## Funcionalidades

### Roles y vinculación
- **Paciente** (Rosa Martínez): dashboard con tomas, inventario, escáner, asistente y alarma.
- **Cuidador** (Diego Martínez): panel con alertas, seguimiento y accesos al tratamiento.
- Onboarding inicial para elegir rol. El cuidador se vincula con el código **`MED-4821`**.
- Cambio de rol desde el perfil, la hoja *Roles y vinculación* y el panel del cuidador.
- La barra de pestañas se adapta al rol: el cuidador no ve el inicio del paciente.

> La vinculación es **local al dispositivo** (AsyncStorage). No hay cuentas ni servidor: el código sirve para demostrar el flujo paciente ↔ cuidador.

### Alarma de toma con verificación visual
- Se activa para el rol paciente mientras haya una dosis accionable de las últimas **2 horas**.
- Aparece como overlay a pantalla completa con sonido (`assets/alarm.wav`), vibración y pasos claros.
- Solo se apaga con la verificación visual: el paciente toma la pastilla y muestra la boca abierta a la **cámara frontal**.
- Con IA configurada, un modelo multimodal responde si la pastilla está visible en la boca.
- Sin clave de IA, la app pide la foto y ofrece **confirmación manual** marcada como limitación.
- Si se deniega el permiso de cámara, se puede reintentar o abrir los ajustes del teléfono. La alarma sigue sonando hasta verificar.
- Se puede desactivar por completo desde *Roles y vinculación* (paciente). Nunca se muestra al cuidador ni antes de elegir rol.

### Inicio (paciente)
- Resumen del día con tomas registradas, adherencia y próxima toma.
- Tarjeta de la toma actual con acciones **Tomar ahora**, **Posponer** (10/15/30/60 min) y **Omitir** con motivo.
- Confirmación animada al registrar una toma, con opción de deshacer.
- Inventario con barra de progreso y alerta cuando quedan menos de 5 dosis.
- Tomas próximas y ya registradas.
- Acceso al escáner de recetas y al asistente Medi.

### Tratamientos
- Lista de tratamientos activos y en pausa.
- Alta paso a paso en 3 pantallas: medicamento, frecuencia/horario/duración y confirmación de inventario.
- Autocompletado desde una receta escaneada.
- Detalle con inventario, cobertura estimada, tomas del día, pendientes, adherencia semanal, pausa/reanudación y eliminación.
- Reposición de inventario sin salir del detalle.

### Modo cuidador
- Estado del día en tiempo real (en este dispositivo): **verde** si todo está al día, **ámbar** si hay stock bajo y **rojo** si hay una dosis omitida o un retraso mayor a 30 minutos.
- Alertas accionables con recordatorio compartible o acceso al tratamiento.
- Código de vinculación, llamada directa y hoja de compartir.
- Progreso del día y barras de adherencia de los últimos 7 días.

> El panel del cuidador es una **vista previa local**. Comparte el estado dentro del mismo dispositivo mediante AsyncStorage. Para monitoreo remoto real hace falta un backend y autenticación (ver `docs/ARQUITECTURA.md`).

### Asistente Medi (IA)
- Chat con contexto del paciente: tratamientos activos, tomas de hoy, adherencia y próxima toma.
- Compatible con cualquier API OpenAI-compatible: **Groq**, **OpenAI**, **OpenRouter**, Together, etc.
- Si no hay clave, responde con un motor local y lo indica en la interfaz.
- Detecta frases de alarma y prioriza el aviso de acudir a urgencias.
- No diagnostica, no receta y no cambia dosis.

### Configuración de IA desde la app
- Pantalla **Inteligencia artificial** (`/ai-settings`) accesible desde el perfil, el escáner y el chat.
- Presets para Groq, OpenAI y OpenRouter; URL, clave, modelo de texto y modelo de visión editables.
- Validación de URL/modelos, **probar conexión** real y guardado en el dispositivo.
- La configuración se guarda en AsyncStorage (`@medsync-ai/ai-settings/v1`). Las variables `EXPO_PUBLIC_AI_*` siguen funcionando como valores iniciales.
- La clave nunca se envía a ningún servidor propio: las peticiones van directas al proveedor elegido.

### Escáner de recetas
- Cámara o galería con `expo-image-picker`.
- Envía la imagen a un modelo multimodal y extrae un **JSON estructurado**: medicamento, concentración, forma, unidades por toma, frecuencia, hora, duración, inventario, notas, confianza y advertencias.
- Normaliza y valida la respuesta antes de usarla.
- Sin IA configurada **no finge leer**: muestra un aviso y ofrece configurar el proveedor; la receta de ejemplo queda como opción explícita.
- Permite revisar el JSON y continuar al wizard con los campos precargados.

---

## Inicio rápido

Requisitos: **Node.js 22+**, **pnpm** y la app **Expo Go** o un emulador.

```bash
pnpm install
pnpm start
```

Atajos:

```bash
pnpm web        # Expo Web
pnpm android    # Emulador o dispositivo Android
pnpm ios        # Simulador iOS (macOS)
pnpm typecheck  # TypeScript sin emitir
pnpm export:web # Bundle de producción para web
pnpm doctor     # Diagnóstico de Expo
```

> El proyecto usa `pnpm` con `node-linker=hoisted` (ver `.npmrc`) para que Metro resuelva las dependencias igual que con npm.

---

## Variables de entorno

La IA también se puede configurar desde la app (**Perfil → Configurar inteligencia artificial** o `/ai-settings`). Las variables de entorno son opcionales y solo definen los valores iniciales.

Copia `.env.example` a `.env` y completa los valores. Solo las variables con prefijo `EXPO_PUBLIC_` llegan al cliente.

```env
EXPO_PUBLIC_AI_BASE_URL=https://api.groq.com/openai/v1
EXPO_PUBLIC_AI_API_KEY=
EXPO_PUBLIC_AI_MODEL=llama-3.3-70b-versatile
EXPO_PUBLIC_AI_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

Ejemplos de proveedor:

| Proveedor | `EXPO_PUBLIC_AI_BASE_URL` | Modelo de chat sugerido |
| --- | --- | --- |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |

Sin clave (ni en `.env` ni en la pantalla de configuración), el chat responde localmente y el escáner no lee fotos reales: ofrece configurar la IA o usar la receta de ejemplo.

> **Producción:** no expongas la API key en el bundle del cliente. Proxyfica las llamadas desde tu backend y aplica autenticación, límites de uso y registro de auditoría.

---

## Estructura del proyecto

```text
app/
  _layout.tsx              Stack raíz, fuentes, proveedores, alarma y toasts
  ai-settings.tsx          Configuración del proveedor de IA
  (tabs)/
    _layout.tsx            Onboarding de rol + tabs (JS tabs)
    index.tsx              Dashboard del paciente
    treatments.tsx         Lista de tratamientos
    caregiver.tsx          Panel del cuidador
    assistant.tsx          Chat con Medi
  scan.tsx                 Escáner de recetas
  treatment/
    new.tsx                Wizard de alta en 3 pasos
    [id].tsx               Detalle, inventario y ajustes del tratamiento

src/
  components/
    ui/                    Design system reutilizable
    medication/            Tarjetas, filas y estados de dosis
    dashboard/             Cabecera, resumen, stock y perfil
    treatments/            Tarjeta de tratamiento
    caregiver/             Barras de adherencia
    assistant/             Burbujas, composer y sugerencias
    navigation/            Tab bar personalizada (filtrada por rol)
    onboarding/            Elección de rol y vinculación inicial
    roles/                 Hoja de roles, vínculo y alarma
    alarm/                 Overlay de alarma y verificación con cámara
  constants/               Tokens visuales, medicación y configuración
  data/seed.ts             Datos demo relativos a la hora actual
  hooks/useNow.ts          Reloj compartido y refresco al volver del background
  lib/
    date.ts                Fechas y horas en español
    schedule.ts            Generación de dosis, estados y stock
    ai.ts                  Prompt de seguridad, chat y prueba de conexión
    aiSettings.ts          Carga y persistencia de la configuración de IA
    prescription.ts        Extracción y normalización del JSON de recetas
    verification.ts        Verificación visual de la pastilla en la boca
    notifications.ts       Alarmas locales con expo-notifications
    storage.ts             Persistencia con AsyncStorage
    haptics.ts             Feedback háptico seguro en web
  store/
    AppProvider.tsx        Context + useReducer + hidratación
    AIProvider.tsx         Context de configuración de IA
    reducer.ts             Acciones de tomas, stock, tratamientos y rol
    selectors.ts           Datos derivados para dashboard y cuidador
    factory.ts             Creación de tratamientos e IDs
  types/index.ts           Modelo de dominio
```

---

## Reglas de negocio

- **Dosis al día:** hasta 30 minutos después de la hora programada.
- **Atrasada (rojo):** entre 30 y 120 minutos de retraso.
- **Sin registrar (rojo):** más de 120 minutos.
- **Omitida (rojo):** el paciente la marcó como omitida; se guarda el motivo.
- **Stock bajo:** quedan menos dosis que `lowStockThreshold` (5 por defecto).
- **Sin stock:** quedan 0 unidades.
- **Adherencia del día:** tomas registradas / tomas ya resueltas (tomadas + omitidas), sin contar las futuras.

Los datos demo se generan relativos a la hora de apertura para que siempre haya una toma atrasada, una de ahora, una próxima, una tomada y una alerta de inventario.

### Roles y alarma

- **Sin rol elegido** no se muestra la alarma ni la barra de pestañas: primero se completa el onboarding.
- **Paciente** ve la alarma si `alarmEnabled` está activo y hay una dosis accionable de las últimas 2 horas.
- **Cuidador** nunca ve la alarma; ve el panel y las alertas de la misma persona.
- Apagar la alarma registra la toma como **tomada** y muestra la confirmación "Toma verificada".
- La alarma no se puede posponer ni omitir desde el overlay: solo verificar, llamar al cuidador o pedir ayuda.

---

## Notificaciones y permisos

- `expo-notifications` agenda recordatorios locales (máximo 60, próximos 7 días) para las tomas pendientes del rol paciente.
- Las notificaciones solo abren la app; la alarma interna es la que exige la verificación visual.
- En Expo Go las notificaciones locales funcionan, pero el push remoto no está soportado.
- La cámara frontal se usa para verificar la pastilla; el permiso se solicita dentro del modal de verificación.
- La app necesita un **development build** (`npx expo run:ios|android` o `eas build`) porque `expo-camera`, `expo-notifications` y `expo-audio` incluyen código nativo.

---

## Validación

```bash
pnpm typecheck
pnpm export:web
pnpm doctor
```

Estado actual del proyecto:

- `tsc --noEmit`: sin errores.
- `expo export --platform web`: bundle generado correctamente.
- `expo-doctor`: 20/20 comprobaciones.

> Para que la navegación web no muestre pantallas en blanco, `app.json` desactiva las rutas asíncronas en web (`asyncRoutes: { web: false }`). En nativo ya están desactivadas por defecto.

---

## REA (Reverse Engineer Anything)

Este proyecto documenta el uso de **REA** (`rea-agents`, v6.9.0) como herramienta de análisis de ingeniería inversa y de patrones de producto. REA **no es una dependencia de ejecución** de MedSync AI y no se incluye en el bundle.

- Repositorio oficial: <https://github.com/morluto/rea>
- Paquete npm: <https://www.npmjs.com/package/rea-agents>
- Documentación del análisis: [`docs/REA-ANALISIS.md`](docs/REA-ANALISIS.md)

En este entorno REA requiere **Node.js 22.23.4+** (o 24.22.1+ / 26.12.1+). El proyecto se validó con Node 22.22.1 para Expo y REA se ejecutó con Node 24.22.1 mediante `npx node@24.22.1`.

---

## Arquitectura

La capa de dominio está separada de la UI y de la persistencia. El estado global usa Context + `useReducer`; los selectores derivan dashboard, cuidador y detalle sin duplicar lógica.

Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) para el flujo de datos, el algoritmo de programación y las rutas de extensión.

---

## Aviso médico

MedSync AI es una demostración técnica. No sustituye el diagnóstico, la receta ni el seguimiento de un profesional de la salud. Ante una urgencia, llama al 911 o acude a urgencias.

Las decisiones de diseño se inspiraron en patrones de UX observables de apps de adherencia como Medisafe y MyTherapy (tarjeta de dosis única, acciones grandes, inventario visible, estado del cuidador y adherencia semanal). No se descompilaron ni se copiaron activos, marcas o código propietario.
