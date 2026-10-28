# Hoja

Note taker sobre un lienzo, construido con el design system de M4PL3. Next.js, desplegado en Vercel.

```bash
npm install
npm run dev
```

## Qué hace

- Canvas con notas como ventanas: arrastrar, redimensionar, etiquetar, buscar.
- Dictado por voz (Web Speech API del navegador) y resúmenes con IA (OpenAI).
- Cuentas con enlace al correo (Supabase) y notas sincronizadas en la nube.

## Modos

- **Local** (sin variables de Supabase): sin login, notas en `localStorage` de este navegador.
- **Con cuenta** (con Supabase): login obligatorio, notas en la nube por usuario, y solo quien inició sesión puede usar el resumen con IA.

## Configurar cuentas (Supabase)

1. Crea un proyecto en supabase.com.
2. SQL Editor → pega y ejecuta `supabase/schema.sql` (tabla `notes` con seguridad por usuario).
3. Authentication → URL Configuration:
   - **Site URL:** `https://hoja.m4pl3.xyz`
   - **Redirect URLs:** `https://hoja.m4pl3.xyz/**` y `http://localhost:3000/**`
4. Project Settings → API: copia la URL y la *publishable key* a `.env.local` y a Vercel (ver `.env.example`).
5. En Vercel, redeploy después de agregar las variables.

El correo de Supabase tiene un límite bajo por hora; para uso real configura un SMTP propio en Authentication → SMTP Settings.

## Siguiente

1. Tarjetas de repaso y búsqueda por significado.
2. Límite de uso por plan.
