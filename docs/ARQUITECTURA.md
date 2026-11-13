# Arquitectura de MedSync AI

## 1. Visión general

MedSync AI es una app Expo/React Native con **Expo Router** y TypeScript estricto. La arquitectura separa cuatro capas:

```text
┌──────────────────────────────────────────────────────────────┐
│  Presentación (app/ + src/components)                        │
│  Pantallas, design system, componentes de dominio            │
└──────────────────────────────┬───────────────────────────────┘
                               │ hooks + acciones
┌──────────────────────────────▼───────────────────────────────┐
│  Estado (src/store)                                          │
│  AppProvider · useReducer · selectores derivados             │
└──────────────────────────────┬───────────────────────────────┘
                               │ funciones puras
┌──────────────────────────────▼───────────────────────────────┐
│  Dominio (src/lib + src/types + src/data)                    │
│  Fechas · programación de dosis · stock · adherencia · IA    │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│  Infraestructura (AsyncStorage · fetch OpenAI-compatible)    │
└──────────────────────────────────────────────────────────────┘
```

Regla principal: **la UI no calcula reglas de negocio**. Los estados de dosis, la adherencia y el stock viven en `src/lib/schedule.ts` y `src/store/selectors.ts`.

---

## 2. Navegación

```text
Stack raíz (app/_layout.tsx)
├── (tabs)                     Tabs inferiores
│   ├── index        Inicio
│   ├── treatments   Tratamientos
│   ├── caregiver    Cuidador
│   └── assistant    Medi AI
├── scan             Modal · escáner de recetas
├── treatment/new    Modal · wizard de alta
├── treatment/[id]   Detalle del tratamiento
└── ai-settings      Modal · configuración de IA
```

- `expo-router/js-tabs` proporciona `Tabs` y `BottomTabBarProps` en Expo Router 58.
- La tab bar es propia (`src/components/navigation/TabBar.tsx`): altura táctil mínima de 54 px, etiqueta siempre visible y punto rojo cuando el cuidador tiene alertas.
- Las pestañas se filtran por rol: el cuidador ve `treatments`, `caregiver` y `assistant`; el paciente ve las cuatro.
- Si `roleChosen` es `false`, `(tabs)/_layout.tsx` renderiza `RoleOnboarding` en lugar del navegador de pestañas.
- La navegación usa `router.push`, `router.replace` y `router.back`; no hay estado de navegación manual.
- `app.json` fija `asyncRoutes: { web: false }` para que la exportación web sea un único bundle: con rutas asíncronas, la primera navegación a una ruta podía quedarse en blanco mientras cargaba el chunk.

---

## 3. Modelo de dominio

```ts
Treatment {
  id, name, strength, form, unitsPerDose,
  frequencyHours, startDate, startTime, durationDays,
  totalPills, pillsRemaining, lowStockThreshold,
  notes?, color, active, createdAt
}

Dose {
  id, treatmentId, scheduledAt,
  status: 'pending' | 'taken' | 'skipped',
  takenAt?, postponedTo?, skipReason?, resolvedAt?
}

AppState {
  version, profile, treatments, doses, messages, scanDraft,
  role: 'patient' | 'caregiver',
  roleChosen: boolean,
  linkedPatientCode: string | null,
  alarmEnabled: boolean,
  lastSyncAt
}
```

El rol y el vínculo viven en el mismo snapshot persistido. `linkedPatientCode` guarda el código del paciente (`MED-4821`) cuando el dispositivo está vinculado como cuidador; `alarmEnabled` solo aplica al rol paciente.

Un `Treatment` genera sus `Dose` al crearse con `generateDoses`. Las dosis se guardan materializadas en el estado, no se recalculan en cada render. Esto permite conservar cambios individuales (posponer, omitir, tomar) sin perder el histórico.

### Estados visuales de una dosis

`evaluateDose(dose, now)` devuelve:

| Estado | Condición | Color |
| --- | --- | --- |
| `taken` | `status === 'taken'` | Verde |
| `skipped` | `status === 'skipped'` | Rojo |
| `upcoming` | faltan más de 0 minutos | Neutro |
| `due` | 0–30 min de retraso | Ámbar |
| `late` | 31–120 min de retraso | Rojo |
| `missed` | más de 120 min | Rojo |

Constantes en `src/lib/schedule.ts`:

```ts
LATE_AFTER_MINUTES = 30;
MISSED_AFTER_MINUTES = 120;
```

### Stock

```ts
getStockLevel(treatment) // 'ok' | 'low' | 'empty'
getStockPercent(treatment) // 0..1 para la barra
```

- `low`: `pillsRemaining < lowStockThreshold`.
- `empty`: `pillsRemaining <= 0`.

Al registrar una toma se descuentan `unitsPerDose`. Al deshacer se devuelven, con tope en `totalPills`. Al reponer se incrementan `totalPills` y `pillsRemaining` por igual.

### Adherencia

```text
adherencia del día = tomadas / (tomadas + omitidas)
```

Las tomas futuras no cuentan. Para la semana se usan los últimos 7 días con `buildAdherenceDays`, que devuelve `taken`, `total`, `percent` y `isToday` para las barras.

---

## 4. Estado global

`AppProvider` combina:

- `useReducer(appReducer, createSeedState())`
- hidratación desde AsyncStorage al montar
- persistencia con debounce de 250 ms
- acciones estables en `useMemo`

### Acciones

| Acción | Efecto |
| --- | --- |
| `takeDose(id)` | Marca tomada, descuenta stock y muestra toast |
| `undoTake(id)` | Revierte toma y stock |
| `postponeDose(id, min)` | Mueve `scheduledAt` y limpia resolución |
| `skipDose(id, reason)` | Marca omitida con motivo |
| `addTreatment(input)` | Crea tratamiento y genera dosis |
| `addStock(id, amount)` | Repone inventario |
| `toggleTreatment(id)` | Pausa o reanuda recordatorios |
| `deleteTreatment(id)` | Borra tratamiento y sus dosis |
| `addMessage(...)` | Agrega mensaje al chat |
| `clearChat()` | Reinicia la conversación |
| `setScanDraft(draft)` | Guarda la extracción para el wizard |
| `setRole(role)` | Cambia entre paciente y cuidador |
| `linkCaregiver(code)` | Vincula el dispositivo si el código coincide y activa el rol cuidador |
| `unlinkCaregiver()` | Borra el vínculo y vuelve a paciente |
| `setAlarmEnabled(value)` | Activa o desactiva la alarma del paciente |
| `showToast/hideToast` | Notificaciones efímeras |
| `resetDemo()` | Borra persistencia y regenera datos demo |

`roleChosen` se marca como `true` al elegir rol en el onboarding (paciente) o al vincular con el código (cuidador).

### Selectores

- `getDashboardData(state, now)` → tomas de hoy, accionables, próximas, completadas, stock bajo, resumen y próxima toma.
- `getCaregiverData(state, now)` → severidad, alertas, métricas, última toma y semana.
- `getTreatmentDetailData(state, id, now)` → detalle, pendientes, adherencia y stock.
- `getNextDosesByTreatment(state, now)` → mapa tratamiento → siguiente toma.

Los selectores son funciones puras y se memorizan en las pantallas con `useMemo` dependiendo de `state` y `now`.

### Reloj compartido

`useNow(intervalMs)` actualiza un `Date` cada 30–60 s y también al volver del background (`AppState`). Así una toma pasa de “próxima” a “atrasada” sin recargar la app.

---

## 5. Persistencia

`src/lib/storage.ts` guarda un snapshot en la clave `@medsync-ai/state/v1`:

- versión del esquema
- perfil
- rol, vinculación y preferencia de alarma
- tratamientos
- dosis
- últimos 80 mensajes
- borrador de escaneo
- `lastSyncAt`

La configuración de IA se guarda aparte, en `@medsync-ai/ai-settings/v1`, para no mezclar credenciales con los datos clínicos.

`loadPersistedState` valida la forma mínima antes de hidratar. Si el JSON está corrupto o la versión no coincide, se descarta y se regeneran los datos demo. Los campos nuevos (`role`, `roleChosen`, `linkedPatientCode`, `alarmEnabled`) se completan con valores por defecto para snapshots antiguos. Los toasts nunca se persisten.

> Limitación conocida: el panel del cuidador comparte el mismo almacenamiento local. No hay sincronización entre dispositivos ni autenticación.

---

## 6. Wizard de tratamiento

`app/treatment/new.tsx` mantiene un `FormState` local y valida por paso:

1. **Medicamento** — nombre, concentración, forma, unidades por toma.
2. **Pauta** — frecuencia, hora de la primera toma, duración.
3. **Inventario** — total de unidades, umbral de aviso, notas.

Cálculos:

```ts
neededPills = unitsPerDose * ceil(durationDays * 24 / frequencyHours)
coverageDays = floor(totalPills / (unitsPerDose * timesPerDay))
```

`nextDateForTime` garantiza que la primera toma sea futura: si la hora ya pasó hoy, empieza mañana. Al guardar, `buildTreatment` normaliza los valores y `generateDoses` materializa el calendario.

Si existe `state.scanDraft`, el formulario se inicializa con los datos de la receta y muestra un aviso de revisión.

---

## 7. Asistente IA

`src/lib/ai.ts`:

- Construye un system prompt con contexto real del paciente.
- Limita la respuesta a 120 palabras y prohíbe diagnóstico, receta y cambios de dosis.
- Detecta términos de urgencia y responde con aviso de emergencia.
- Envía como máximo los últimos 12 mensajes.
- Usa `AbortController` con timeout de 25 s.
- Recibe `AISettings` desde `useAI()`; `testAIConnection` valida URL, clave y modelo antes de guardar.
- Si no hay clave, `getLocalAssistantReply` responde con reglas locales (olvido de dosis, dosis doble, comida, stock, síntomas, alcohol, cuidador).

El chat muestra `IA conectada` o `Demo` según `configured` del `AIProvider`.

---

## 8. Escáner de recetas

`src/lib/prescription.ts`:

1. Define un prompt que exige **solo JSON**.
2. Envía la imagen como `data:<mime>;base64,...` a un modelo multimodal.
3. Extrae el bloque JSON aunque venga con markdown.
4. Normaliza forma, hora, números y límites.
5. Calcula un `totalPills` sugerido si falta.
6. Devuelve advertencias en español y un nivel de confianza.

Estados de la pantalla: `idle → processing → result | error`. Las tres etapas visuales son informativas; el tiempo mínimo de 2.2 s evita parpadeos.

La pantalla recibe `configured` desde `useAI()`: sin clave no permite tomar foto ni elegir galería (abre la configuración de IA) y deja la receta de ejemplo como acción explícita. Con clave, avisa de que la imagen se envía al proveedor elegido.

---

## 9. Alarma y verificación visual

Componentes: `src/components/alarm/DoseAlarm.tsx` y `PillVerifyModal.tsx`, montados en el `Stack` raíz.

Condición de activación:

```ts
state.roleChosen &&
state.role === 'patient' &&
state.alarmEnabled &&
hay dosis accionable con retraso <= 120 min
```

- `useNow(5_000)` recalcula la dosis objetivo cada 5 s.
- Al activarse: audio en bucle (`assets/alarm.wav` vía `expo-audio`), vibración y bloqueo del botón atrás en Android.
- El overlay no ofrece posponer ni omitir: solo **Verificar con la cámara**, llamar al cuidador o compartir una petición de ayuda.
- `PillVerifyModal` abre la cámara frontal (`expo-camera`), toma la foto en base64 y la envía a `verifyPillInMouth`.
- Con IA configurada, el modelo de visión responde si la pastilla es visible en la boca.
- Sin IA, el modal pide la foto y habilita una **confirmación manual** marcada como limitación.
- Si se concede el permiso de cámara se puede reintentar; si el permiso quedó bloqueado, se ofrece abrir los ajustes del teléfono.
- Al verificar se llama a `takeDose` y se muestra la pantalla "Toma verificada" durante 2.4 s.

`src/lib/notifications.ts` reprograma recordatorios locales (`expo-notifications`) para las tomas pendientes de los próximos 7 días, con un máximo de 60. Las notificaciones solo abren la app: la alarma que exige verificación es la interna.

---

## 10. Configuración de IA

- `src/lib/aiSettings.ts` define `AISettings` (`baseUrl`, `apiKey`, `model`, `visionModel`), los valores por defecto desde `EXPO_PUBLIC_AI_*` y la persistencia en `@medsync-ai/ai-settings/v1`.
- `src/store/AIProvider.tsx` hidrata la configuración al arrancar y expone `settings`, `ready`, `configured`, `update()` y `reset()`.
- `app/ai-settings.tsx` permite elegir proveedor (Groq, OpenAI, OpenRouter), editar URL, clave y modelos, validar, **probar conexión** (`testAIConnection`) y guardar o restablecer.
- `src/lib/ai.ts` y `src/lib/prescription.ts` reciben `AISettings` explícitamente; ya no leen variables globales. Esto permite cambiar de proveedor sin recompilar.
- El chat usa `sendChatMessage` cuando hay clave y `getLocalAssistantReply` cuando no la hay; el escáner bloquea la lectura real sin clave y ofrece configurarla.

## 11. Design system

`src/constants/theme.ts` centraliza:

- Paleta HealthTech: verde teal `#0B6B57`, superficies claras, semánticos verde/ámbar/rojo/azul.
- Tipografía **Manrope** con escala de 13 a 40 px.
- Espaciado de 4 a 64 px, radios de 8 a 32 px y sombras suaves.
- `layout.maxFontScale = 1.5` para respetar el tamaño de fuente del sistema sin romper el layout.

Componentes base: `AppText`, `Screen`, `Card`, `Button`, `Badge`, `ProgressBar`, `Avatar`, `BrandMark`, `Sheet`, `Toast`, `TextField`, `Stepper`, `ChoiceChips`, `TimeField`, `SuccessCheck`, `PulseDot`, `FadeInView`, `EmptyState`, `SectionHeader`.

Accesibilidad:

- `accessibilityRole`, `accessibilityLabel`, `accessibilityState` en controles.
- Áreas táctiles de al menos 44–58 px.
- Contraste alto y texto que no depende solo del color (siempre hay etiqueta).
- Feedback háptico opcional y desactivado en web.

---

## 12. Rutas de extensión

| Necesidad | Punto de extensión |
| --- | --- |
| Backend real | Reemplazar `src/lib/storage.ts` por una capa API y mover las acciones a mutaciones |
| Sincronización cuidador | WebSocket/SSE + autenticación y código de vinculación de un solo uso |
| Notificaciones locales | `expo-notifications` + reprogramación al cambiar dosis |
| Verificación visual | Sustituir el proveedor de visión o mover la foto a un backend con revisión humana |
| Nuevos formatos | Ampliar `MedicationForm` y `FORM_OPTIONS` |
| Nuevos estados | Extender `DoseDisplayStatus`, `evaluateDose` y `DoseStatusBadge` |
| Nuevo proveedor de IA | Añadir un preset en `app/ai-settings.tsx` o cambiar la URL y el modelo |
| Tests | Los selectores y `schedule.ts` son funciones puras ideales para Vitest/Jest |

---

## 13. Decisiones y límites

- **Sin backend:** reduce fricción para la demo y mantiene el foco en UX. El coste es que el cuidador no es remoto.
- **Vinculación local:** el código `MED-4821` demuestra el flujo paciente ↔ cuidador, pero no autentica ni sincroniza entre teléfonos.
- **Dosis materializadas:** simplifica el histórico y las acciones, a costa de más datos en almacenamiento (se limitan a 2000 dosis por tratamiento).
- **API key en cliente:** válido solo para demo. En producción debe ir por backend; la configurable en la app se guarda en AsyncStorage y nunca pasa por un servidor propio.
- **Verificación visual:** con IA es real; sin clave exige foto y confirmación manual, y la UI lo indica. Denegar la cámara impide apagar la alarma, por diseño.
- **IA con fallback local:** garantiza que la app sea demostrable sin credenciales.
- **Rutas asíncronas desactivadas en web:** evita pantallas en blanco en la primera navegación; el bundle web queda en un solo archivo.
- **Datos demo relativos:** permiten mostrar todos los estados sin configuración manual.
