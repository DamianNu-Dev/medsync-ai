# Build instalable de Android (EAS)

Esta guía genera un **APK instalable** de MedSync AI. La compilación ocurre en
la nube de Expo/EAS, así que **no necesitas Android Studio** ni el SDK de
Android en el teléfono. Funciona desde Termux.

> En Expo Go la app funciona, pero las **alarmas exactas** y el **sonido propio**
> (`alarm.wav`) solo están disponibles en un build instalado. Este documento
> produce ese build.

## 1. Requisitos

- Cuenta gratuita en <https://expo.dev/signup>.
- Node.js 20 o superior (ya está en Termux).
- Conexión a internet estable.

Instala EAS CLI una sola vez:

```bash
npm install -g eas-cli
eas --version
```

> Si `npm install -g` falla por espacio o permisos en Termux, puedes ejecutar
> EAS desde una computadora usando el mismo repositorio; no es necesario
> compilar en el teléfono.

## 2. Entrar a Expo y vincular el proyecto

```bash
cd ~/medsync-ai
eas login          # correo y contraseña de expo.dev
eas whoami
eas init           # crea/vincula el proyecto "medsync-ai"
```

`eas init` agrega `extra.eas.projectId` en `app.json`. Guarda ese cambio:

```bash
git add app.json && git commit -m "chore: vincular proyecto EAS" && git push
```

## 3. Variables de entorno del build

El archivo `.env` está en `.gitignore`, por lo que **no se sube** a los
servidores de EAS. Hay que registrar las variables en Expo.

Para el perfil `preview` (build de prueba):

```bash
eas env:set --name EXPO_PUBLIC_API_URL --value https://medsync-ai-3.onrender.com --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_AI_BASE_URL --value https://api.groq.com/openai/v1 --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_AI_MODEL --value qwen/qwen3.8-27b --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_AI_VISION_MODEL --value qwen/qwen3.8-27b --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_AI_API_KEY --value gsk_TU_CLAVE --environment preview --visibility sensitive
```

Repite los mismos comandos cambiando `--environment preview` por
`--environment production` para el build final.

Verifica:

```bash
eas env:list --environment preview
```

> **Aviso de seguridad:** todo lo que empieza con `EXPO_PUBLIC_` se incrusta en
> el APK y puede extraerse. La clave de Groq quedará dentro de la app. Para una
> publicación real conviene mover las llamadas de IA al backend de Render y no
> incluir `EXPO_PUBLIC_AI_API_KEY` en el cliente.

## 4. Generar el APK de prueba

```bash
eas build --platform android --profile preview
```

- Si pregunta por el keystore: elige **Generate new keystore** (EAS lo guarda).
- El build tarda entre 5 y 20 minutos según la cola del plan gratuito.
- Al terminar, EAS muestra un enlace y un código QR. Abre el enlace en el
  teléfono y descarga el `.apk`.
- Android pedirá permitir la instalación desde el navegador/archivos.
- Se instala como una app aparte (`com.medsync.ai`); no reemplaza Expo Go.

También puedes verlo después en <https://expo.dev/builds>.

## 5. Build final

- **APK para instalar directamente en el teléfono:**

  ```bash
  eas build --platform android --profile production-apk
  ```

- **AAB para Google Play (cuando publiques):**

  ```bash
  eas build --platform android --profile production
  ```

Cada build nuevo de Android recibe un `versionCode` automático
(`appVersionSource: remote`). La versión visible se controla con
`expo.version` en `app.json`.

## 6. Primer arranque en el teléfono

1. Abre **MedSync AI** e inicia sesión como paciente (`rosa@medsync.app`).
2. Acepta **notificaciones**.
3. Acepta **alarmas y recordatorios** (alarmas exactas). En Android 14+ puede
   aparecer como ajuste aparte: *Ajustes → Apps → MedSync AI → Alarmas y
   recordatorios*.
4. Desactiva la optimización de batería:
   *Ajustes → Apps → MedSync AI → Batería → Sin restricciones*.
   Especialmente importante en Xiaomi, Samsung, Huawei y Oppo.
5. En **Perfil**, toca **Probar sonido** y luego **Aviso en 10 s**; bloquea la
   pantalla para comprobar que suena con el teléfono bloqueado.
6. Crea un tratamiento con hora 2 minutos adelante para validar la alarma
   interna y la notificación.

## Notas

- El canal de notificaciones de Android es inmutable: si cambias el sonido o la
  configuración del canal, desinstala y vuelve a instalar la app (o borra los
  datos) para que se recree.
- Las notificaciones locales se reprograman al abrir la app o volver del
  segundo plano. No se necesita FCM para recordatorios locales.
- Tras cada cambio de código: sube el commit y vuelve a ejecutar
  `eas build --platform android --profile preview`.
- Alternativa local: `npx expo run:android` requiere SDK de Android y no es
  práctico en Termux; usa EAS.
