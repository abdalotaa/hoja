# Hoja

Note taker sobre un lienzo, construido con el design system de M4PL3. Next.js, desplegado en Vercel.

```bash
npm install
npm run dev
```

## Qué hace

- **Lienzo:** notas como ventanas (arrastrar, redimensionar, etiquetar, buscar) y **conexiones** entre ellas.
- **Mapas mentales:** cualquier nota se expande en un mapa con IA ("IA ✦ → Expandir en mapa mental").
- **Estudio:** tarjetas de repaso con repetición espaciada (teclado: espacio y 1–4) y guías de examen armadas con varias notas.
- **Reunión:** graba, transcribe y saca decisiones y pendientes con responsable y fecha; los pendientes con fecha se exportan al calendario (.ics).
- **Dictado por voz** (Web Speech API del navegador) y **resúmenes** con IA.
- **Plantillas:** Lean Canvas, validar una idea, pitch, semana de trabajo, repaso de examen, agenda de reunión.
- **Pregúntale a tus notas:** respuestas con las notas fuente.
- **Exportar** a Markdown o JSON, y **compartir** un lienzo por enlace de solo lectura.
- Instalable como app (PWA) y cuentas con enlace al correo (Supabase).

## Modos

- **Local** (sin variables de Supabase): sin login, notas en `localStorage` de este navegador.
- **Con cuenta** (con Supabase): login obligatorio, notas en la nube por usuario, y solo quien inició sesión puede usar el resumen con IA.

## Configurar cuentas (Supabase)

1. Crea un proyecto en supabase.com.
2. SQL Editor → pega y ejecuta `supabase/schema.sql`. Es idempotente: vuelve a ejecutarlo cada vez que cambie el esquema.
3. Authentication → URL Configuration:
   - **Site URL:** `https://hoja.m4pl3.xyz`
   - **Redirect URLs:** `https://hoja.m4pl3.xyz/**` y `http://localhost:3000/**`
4. Project Settings → API: copia la URL y la *publishable key* a `.env.local` y a Vercel (ver `.env.example`).
5. En Vercel, redeploy después de agregar las variables.

El correo de Supabase tiene un límite bajo por hora; para uso real configura un SMTP propio en Authentication → SMTP Settings.

## IA y costos

- Todas las funciones de IA pasan por `/api/ai` (OpenAI, modelo en `OPENAI_MODEL`). Solo con sesión iniciada.
- Límite mensual por persona: `AI_MONTHLY_LIMIT` (por defecto 150), contado en la base de datos. Además hay límites por minuto y por día.
- Pon también un límite de gasto mensual en la cuenta de OpenAI.

## Siguiente

1. Búsqueda por significado con embeddings (hoy "Preguntar" elige notas por palabras clave).
2. Funcionamiento sin conexión.
3. Planes de pago.
