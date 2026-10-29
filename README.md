# Hoja

Note taker sobre un lienzo, construido con el design system de M4PL3. Next.js, desplegado en Vercel.

```bash
npm install
npm run dev
```

## Qué hace

- **Lienzo:** notas como ventanas (arrastrar, redimensionar, etiquetar, buscar) y **conexiones** entre ellas. Plantillas, mapas y notas nuevas se colocan en espacio libre, sin pisar lo que ya tienes. El lienzo no tiene bordes: te mueves arrastrando el fondo, haces zoom con Ctrl/Cmd + rueda (o el pellizco del trackpad) y, al arrastrar una nota cerca de la orilla, la vista avanza sola. Abajo a la izquierda: zoom, **Ajustar** (ver todo, centrado) y **Ordenar** (acomoda las notas en filas, con deshacer).
- **Documentos:** cada nota se abre en un panel lateral (con botón para ampliarlo a pantalla completa) con un editor de texto enriquecido: títulos, listas, tareas, citas, negritas. Se guarda como Markdown. Las tarjetas del lienzo muestran una vista previa.
- **Notas entrelazadas:** escribe `[[` para enlazar otra nota (o crearla). Cada enlace dibuja solo una flecha punteada en el lienzo, y cada nota muestra su índice, las notas que la mencionan y a las que enlaza.
- **Mapas mentales:** cualquier nota se expande en un mapa con IA ("IA ✦ → Expandir en mapa mental").
- **Tablas:** notas tipo hoja de cálculo (texto, número, dinero, fecha) con totales, promedio y resumen por categoría; plantillas de control de gastos, presupuesto, clientes, horario y calificaciones; descarga en CSV.
- **Calendario:** vista mensual con tus eventos y las tareas con fecha (`☐ tarea — AAAA-MM-DD`) de tus notas; marcar una tarea la tacha en la nota. Exporta a .ics.
- **Estudio:** tarjetas de repaso con repetición espaciada (teclado: espacio y 1–4) y guías de examen armadas con varias notas.
- **Reunión:** graba, transcribe y saca decisiones y pendientes con responsable y fecha; los pendientes con fecha se exportan al calendario (.ics).
- **Dictado por voz** (Web Speech API del navegador) y **resúmenes** con IA.
- **Plantillas:** Lean Canvas, validar una idea, pitch, semana de trabajo, repaso de examen, agenda de reunión.
- **Pregúntale a tus notas:** respuestas con las notas fuente.
- **Exportar** a Markdown o JSON, y **compartir** un lienzo por enlace de solo lectura.
- Transiciones entre secciones (View Transitions): la barra se queda quieta, la pestaña activa se desliza y la página entra por el lado hacia donde navegas; las ventanas "caen" sobre el lienzo. Se desactivan con "reducir movimiento".
- Instalable como app (PWA) y cuentas con **correo y contraseña** (Supabase); recuperación de contraseña y enlace al correo como alternativa.

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

### Contraseñas y límites de correo

El correo integrado de Supabase manda muy pocos mensajes por hora. Para no depender de él:
- Authentication → Providers → Email: desactiva **Confirm email** (así crear una cuenta no envía correo) y sube **Minimum password length** a 8.
- Los correos solo quedan para recuperar la contraseña. Para uso real configura un SMTP propio en Authentication → SMTP Settings.
- Quien ya entró con enlace puede poner contraseña desde "Contraseña" en la barra.

## IA y costos

- Todas las funciones de IA pasan por `/api/ai` (OpenAI, modelo en `OPENAI_MODEL`). Solo con sesión iniciada.
- Límite mensual por persona: `AI_MONTHLY_LIMIT` (por defecto 150), contado en la base de datos. Además hay límites por minuto y por día.
- Pon también un límite de gasto mensual en la cuenta de OpenAI.

## Siguiente

1. Búsqueda por significado con embeddings (hoy "Preguntar" elige notas por palabras clave).
2. Funcionamiento sin conexión.
3. Planes de pago.
