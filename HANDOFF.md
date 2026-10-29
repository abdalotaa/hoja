# Hoja · traspaso para Codex

Estado al 2026-10-29. Hoja es un note taker sobre un lienzo infinito (Next.js 16 en Vercel, Supabase, OpenAI). App en producción: https://hoja.m4pl3.xyz. Repo: este directorio (`/Users/abdala/Developer/projects/hoja`), rama `main`.

> **Antes de tocar nada:** lee `AGENTS.md`. Este Next.js tiene cambios incompatibles con lo que sabes; consulta `node_modules/next/dist/docs/` antes de escribir código.

## Reglas de trabajo con el dueño

- Español, informal.
- **No hacer push a GitHub salvo que el dueño lo pida** («sube…»). Pedir el visto bueno antes de cada push.
- No exponer secretos (API keys, claves de Supabase) en el código, chats ni commits. `.mcp.json` está sin trackear y se queda así.
- Marca escrita `m4pl3` (en el código del sitio portafolio, `M4PL3` solo en el design system de Hoja).
- No inventar datos de usuarios, cifras ni resultados en nada público.

## Stack y arquitectura (resumen)

- **Next 16** con `cacheComponents`, `proxy.ts` (antes middleware), páginas dinámicas con `connection()` + `<Suspense>`. View Transitions (`ViewTransition` + `Link transitionTypes`).
- **Supabase**: auth con correo y contraseña (enlace al correo como alternativa), RLS por usuario, RPC. Esquema idempotente en `supabase/schema.sql`: se vuelve a ejecutar completo cuando cambie.
- **Sincronización**: `lib/useSynced.ts` (local-first: `localStorage` sin cuenta; con cuenta, nube + cola de ediciones/borrados pendientes por usuario, reintento cada 5 s y al reconectar). Estado en la barra: `components/SyncStatus.tsx`.
- **Editor**: Tiptap 3 + `@tiptap/markdown` (`components/DocEditor.tsx`, `DocPanel.tsx`). Notas con `[[enlaces]]` que dibujan flechas.
- **IA**: `app/api/ai/route.ts` + `lib/ai-tasks.ts`; OpenAI por `fetch`, modelo por defecto `gpt-4o-mini` (`OPENAI_MODEL`). Solo usuarios con sesión; hay cuota (`tests/ai-quota.test.ts`).
- **Lienzo**: `components/Canvas.tsx` (arrastrar fondo, zoom, ordenar con deshacer, autoscroll al arrastrar).
- Otras vistas: `Study.tsx` (tarjetas, repetición espaciada, guías), `Calendar.tsx`, `SharedBoard.tsx` (enlace de solo lectura), respaldos en `lib/backup.ts`, exportación en `lib/export.ts`.

Variables de entorno necesarias (nombres, sin valores): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o la equivalente que ya use `lib/`), `OPENAI_API_KEY`, opcional `OPENAI_MODEL`. Revisa `lib/` y `proxy.ts` para los nombres exactos antes de usarlas.

## Estado del repositorio (importante)

Último commit: `a17acd4` (documentos con panel lateral, `[[enlaces]]`, backlinks). **Hay trabajo sin commitear en el árbol**, no hecho por la sesión que escribe esto; revisarlo con `git status` / `git diff` antes de seguir, y no sobreescribirlo:

```
 M README.md  app/api/ai/route.ts  app/calendario/page.tsx  app/estudio/page.tsx  app/page.tsx
 M components/{Calendar,Canvas,DocEditor,SharedBoard,Study}.tsx
 M lib/{export,useSpeech,useSynced}.ts  package.json  package-lock.json
?? .github/workflows/ci.yml  components/SyncStatus.tsx  lib/backup.ts
?? tests/{ai-quota.test.ts,backup.test.ts,sync.test.tsx}  vitest.config.mts
```

Resumen por los diffs: se añadió Vitest + Testing Library (`npm test`), CI en GitHub Actions, respaldos JSON versionados (`lib/backup.ts`), indicador de estado de guardado y cuota de IA. En `lib/useSpeech.ts` el cambio es solo `supported` con `useSyncExternalStore` (no toca los problemas de abajo). Correr `npm run lint`, `npm test` y `npm run build` antes de dar nada por bueno.

---

## ACTUALIZACIÓN 2026-10-29 · voz ya implementada (sin commitear, sin push)

Se implementó el arreglo de la sección siguiente: `lib/useRecorder.ts` (graba en segmentos de 10 s el primero y 25 s los demás, guarda cada uno en IndexedDB vía `lib/audio-store.ts` antes de subirlo, reintenta con backoff), `app/api/transcribe/route.ts` (OpenAI, `OPENAI_TRANSCRIBE_MODEL`, por defecto `gpt-4o-mini-transcribe` con respaldo `whisper-1`), `guardAudioRequest` en `lib/guards.ts`, `lib/transcript.ts` y cambios en `components/Canvas.tsx` (banner «grabación sin guardar» con Recuperar/Descartar; el dictado del navegador queda como respaldo y ya conserva lo oído si falla). Pruebas: `tests/transcribe.test.ts`, `tests/recorder.test.tsx`. `npm run lint` (0 errores), `npm test` (30 pasan) y `npm run build` OK.

**Falta verificar a mano** (no se pudo con micrófono real): Chrome escritorio, Android y Safari iOS (PWA); reunión de 30+ min; apagar el wifi a mitad y recuperar; que el nombre del modelo de transcripción exista en la cuenta de OpenAI. Límite de audios en memoria por instancia (igual que `/api/ai`); no consume la cuota mensual de IA. Si una grabación falla en parte, la nota se crea una sola vez desde «Recuperar».

## PROBLEMA PRIORITARIO · reconocimiento de voz (dictado y Reunión) — diagnóstico original

El dueño reporta, usando el modo **Reunión** y **Dictar**:

1. **No detecta bien las voces** (errores de transcripción, sobre todo con varias personas o habla natural).
2. **A veces se pierde en las reuniones** (se corta o deja de transcribir a la mitad).
3. Le salió el aviso **«No pude escuchar. Intenta de nuevo.»** y **se le borró la nota** (perdió lo dictado).

### Dónde está el código

- `lib/useSpeech.ts`: hook sobre la **Web Speech API del navegador** (`SpeechRecognition` / `webkitSpeechRecognition`), `lang = "es-MX"`, `continuous = true`, `interimResults = true`.
- `components/Canvas.tsx`, `toggleDictation(as: "note" | "meeting")` (≈ líneas 491–532) y la barra de escucha (≈ 730–745). Botones «Reunión» / «Dictar» (≈ 646–663).
- `lib/ai-tasks.ts` + `app/api/ai/route.ts`: tarea `meeting` (resumen, decisiones, pendientes con fecha) y resumen de nota.

### Causas probables (verificadas leyendo el código)

**A. La nota se pierde por diseño, no por casualidad.** La nota solo se crea cuando el usuario pulsa **Detener mientras `speech.listening` es true** (`toggleDictation` crea la nota ahí). Pero en `useSpeech`:
   - `onerror` con cualquier error distinto de `no-speech`/`aborted` (p. ej. `network`, `audio-capture`, `service-not-allowed`) pone `wanted.current = false` y muestra «No pude escuchar. Intenta de nuevo.».
   - Después `onend` hace `setListening(false)`.
   - Con `listening === false`, el siguiente clic en «Reunión» **llama a `start()`, que ejecuta `setFinalText("")`**: todo lo dictado hasta el error se descarta. Además, si el usuario ya estaba en pantalla y no pulsa nada, el texto parcial vive solo en el estado del hook (se pierde al recargar o navegar).
   - Resultado: error de red/servicio a mitad de reunión ⇒ aviso + transcripción perdida, sin nota.

**B. La Web Speech API no sirve para reuniones largas.** En Chrome el audio va a un servicio de Google; la sesión termina sola tras silencios o a los pocos minutos, y falla con `network` si la conexión parpadea. El auto-reinicio de `onend` (`r.start()`) a veces lanza o reinicia sin contexto, y se pierden segundos de audio. Safari/Firefox tienen soporte parcial o nulo. No hay separación de hablantes, puntuación fiable ni vocabulario propio (nombres, términos técnicos).

**C. Sin respaldo del audio ni de lo dictado.** No se guarda el audio, no se guarda el texto parcial en `localStorage`/IndexedDB, y no hay reintento.

### Solución recomendada (en este orden)

1. **Hotfix de pérdida de datos (hacer primero, es pequeño):**
   - Al ocurrir un error o al terminar (`onend` sin `wanted`) con texto acumulado, **crear/guardar la nota con lo que haya** en vez de descartarlo, o conservarlo en un borrador recuperable.
   - No borrar `finalText` en `start()` si hay texto sin guardar; guardar el borrador continuamente (cada pocos segundos) en `localStorage`/IndexedDB con una clave por sesión, y ofrecer «Recuperar reunión sin guardar» al volver.
   - Mostrar un error más útil (distinguir `not-allowed`, `network`, `audio-capture`) sin vaciar el texto.
2. **Cambio de motor (el arreglo real):** grabar con `MediaRecorder` (trozos de ~15–30 s, webm/opus o mp4 en Safari), **guardar los trozos en IndexedDB**, enviarlos a un endpoint propio (`app/api/transcribe/route.ts`, sin exponer la key, solo usuarios con sesión y con cuota) que llame a la **transcripción de OpenAI** (`gpt-4o-transcribe` o `whisper-1`; verificar el modelo vigente y precio en la documentación oficial antes de fijarlo) con `language: "es"` y un `prompt` con nombres/términos del contexto. Reintentos con backoff por trozo; ensamblar el texto en orden; si algo falla, el audio sigue guardado y se puede reintentar. Mostrar texto parcial por trozo ya transcrito (casi en vivo) en la barra de escucha.
   - Costo orientativo: el dueño tiene crédito limitado en OpenAI (empezó con 2 USD, planeaba ~20 USD). Medir costo por minuto y mostrar/limitar duración máxima por reunión.
   - Para varios hablantes: la transcripción con diarización de OpenAI o un paso de etiquetado por IA sobre el texto; dejarlo como segunda fase y marcarlo como mejora, no prometer precisión.
3. **Pruebas:** tests de Vitest para el ensamblado/reintento de trozos y para «un error no pierde la transcripción». Probar a mano en Chrome (escritorio y Android) y Safari iOS (PWA): permisos de micrófono, pantalla apagada, cambio de pestaña y reuniones de 30+ min.

### Criterios de aceptación

- Un fallo de red o del servicio de voz **nunca** borra lo dictado: el texto o el audio queda recuperable.
- Una reunión de 30 min no se corta sola.
- Mejor reconocimiento en español de México que la Web Speech API en una prueba lado a lado con el mismo audio (guardar el audio de prueba).
- Sin API keys en el cliente; endpoint protegido por sesión y cuota.

---

## Otros pendientes conocidos (menor prioridad)

- Hoja **no tiene página pública ni forma de probar sin cuenta**; se recomendó landing + onboarding antes de publicar los videos de marketing.
- Segunda tanda de funciones: espacios, etiquetas, sugerencias de enlaces con IA.
- Sin modo offline completo (el respaldo local conserva ediciones pero no abre la app desde cero sin red) ni resolución de conflictos entre dispositivos.
- Los 6 videos de lanzamiento (carpeta de Hyperframes) citan funciones de la app: Reunión, tablas con total/promedio/por categoría, tarjetas con repaso, guías, Ordenar/Deshacer, `[[enlaces]]`. Si cambia el comportamiento de alguna, avisar para rehacer el video.

## Comandos

```bash
npm install
npm run dev      # desarrollo
npm run lint
npm test         # vitest (según el árbol sin commitear)
npm run build
```

Despliegue: Vercel (proyecto enlazado al repo). Las variables de entorno viven en Vercel; no se commitean.
