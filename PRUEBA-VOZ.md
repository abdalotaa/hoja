# Cómo probar la transcripción de voz y las reuniones en Hoja

## Qué usa Hoja

| Pieza | Qué es |
|---|---|
| Grabación | `MediaRecorder` del navegador, en segmentos de 10 s (el primero) y 25 s (los demás). Cada segmento se guarda en IndexedDB **antes** de subirse. |
| Transcripción | `POST /api/transcribe` → OpenAI `gpt-4o-mini-transcribe` (si no está disponible, cae a `whisper-1`). Variable opcional `OPENAI_TRANSCRIBE_MODEL`. |
| Vocabulario | El servidor siempre manda una pista con «Hoja», «M4PL3», «pendientes» y «calendario», y el final del trozo anterior para no perder nombres entre cortes. |
| Resumen de reunión | `POST /api/ai` tarea `meeting` → `gpt-4o-mini` (variable `OPENAI_MODEL`): resumen, decisiones y pendientes con responsable y fecha. |
| Respaldo | Si el navegador no puede grabar, usa el dictado del propio navegador (Web Speech API). |
| Recuperación | Si algo falla, el audio queda guardado y aparece «grabación sin guardar» con Recuperar o Descartar. |

Necesita: sesión iniciada, HTTPS (o localhost) para el micrófono, `OPENAI_API_KEY` en Vercel.

## Lo ya probado (2026-11-05, sin micrófono)

Con audio en formato webm/opus (el mismo que produce el navegador):
- `gpt-4o-mini-transcribe` transcribió bien el español, incluso con audio degradado (voz de teléfono con ruido).
- El único error: la palabra «Hoja» salía como «Oja» o «Enoja». **Corregido** con la pista de vocabulario.
- La ruta local `/api/transcribe` responde 200 con el texto y rechaza (403) las llamadas que no vienen de la app.
- El resumen de reunión extrajo bien decisiones, responsables y fechas relativas («el viernes»). Se corrigió que inventara una fecha para «esta semana».

Lo que **no** se ha probado: un micrófono real, reuniones largas, iPhone, y cortar el wifi a mitad.

## Prueba 1 · guion de 1 minuto (la básica)

Abre hoja.m4pl3.xyz con sesión, pulsa **Reunión** y lee esto con calma, como si fuera una reunión:

> Bueno, empezamos. Hoy hay que decidir lo de la propuesta para el cliente nuevo. Marta, ¿cómo vas con el presupuesto? Ya está casi listo, lo mando el viernes. Perfecto. Entonces la decisión es que la propuesta sale este viernes y no la próxima semana. Alexis, necesito que revises el contrato antes del lunes. Sí, lo reviso el domingo por la noche. También falta agendar la llamada con el cliente, eso lo hace Marta esta semana, sin fecha fija. Y por último, acordamos que el presupuesto no incluye mantenimiento: eso se cotiza aparte. Listo, gracias a todos.

Pulsa **Detener** y espera unos segundos. Debe aparecer una nota «Reunión» con:
- Resumen de 2 a 4 frases.
- Decisiones: la propuesta sale el viernes; el mantenimiento se cotiza aparte.
- Pendientes: Marta manda el presupuesto el viernes (con fecha); Alexis revisa el contrato (con fecha); Marta agenda la llamada **sin fecha**.
- El texto completo al final (sección Original).

Comprueba: nombres bien escritos, fechas correctas, y que «esta semana, sin fecha fija» **no** tenga fecha.

## Prueba 2 · fallas (lo que antes borraba tu nota)

1. Empieza a grabar, y a los 20 s apaga el wifi 30 s. Enciéndelo. No debe perderse nada: al detener, el texto aparece completo.
2. Graba y cierra la pestaña a mitad. Al volver debe salir «grabación sin guardar» → **Recuperar**.
3. Graba con la sesión cerrada en otra pestaña: debe avisar que inicies sesión, sin perder el audio.

## Prueba 3 · largo y dispositivos

- Una reunión de 10 minutos (o ponle un podcast en español de fondo) y revisa que no se corte y que el texto salga en orden.
- Chrome en escritorio, Chrome en Android y **Safari en iPhone** (con la app instalada y sin instalar). Revisa el permiso del micrófono.
- Micrófono: usa el del equipo o uno con cable. **Evita los Bluetooth** (AirPods): graban con muy poca calidad y la transcripción empeora.

## Dónde mirar si algo falla

- **Consola del navegador** (F12 → Console) y pestaña **Network**: busca `/api/transcribe`. 200 con `{"text": …}` es correcto; 401 es sesión; 429 es límite o saldo; 502 es OpenAI.
- **Vercel → Logs** del proyecto.
- **platform.openai.com → Usage** para ver el consumo y el saldo.
- Si no aparece el botón Reunión, el navegador no puede grabar ni dictar: prueba otro.

## Costo aproximado

`gpt-4o-mini-transcribe` cuesta unos $0.003 USD por minuto de audio (dato de tarifas públicas, confírmalo en tu cuenta). Una reunión de 30 minutos son centavos de dólar; el resumen es otra llamada pequeña.

---

## Tiempo real, Zoom, quién habló e importar (nuevo)

**Qué hace ahora «Reunión»:** el texto aparece mientras hablas (OpenAI Realtime, `gpt-4o-mini-transcribe`, español, con tu glosario de nombres). El navegador se conecta directo a OpenAI con una clave temporal de 1 uso que crea `/api/realtime-token`; la `OPENAI_API_KEY` nunca sale del servidor. Todo el audio se guarda además en el navegador (IndexedDB): si se cae la conexión más de ~45 s, al detener Hoja rehace el texto desde ese audio. Si se cierra la pestaña, aparece «Recuperar».

**Zoom (cuenta gratis, Mac o Windows):** en «Reunión» elige «Mi micrófono + una llamada».
- Zoom en el navegador: elige la pestaña de Zoom y activa «Compartir audio de la pestaña» (Chrome/Edge/Brave).
- App de Zoom en Windows: «Toda la pantalla» + «Compartir audio del sistema».
- App de Zoom en Mac: «Toda la pantalla» + «Compartir audio del sistema» (Chrome 141+ y macOS 14.2+). Si no aparece esa opción, abre Zoom en el navegador.
- Usa audífonos. Sin ellos el micrófono repite lo que dicen los demás (Hoja descarta los duplicados evidentes, pero no es perfecto).
- Safari y celulares no pueden capturar el audio de otra pestaña/app: ahí solo funciona «Solo mi micrófono».
- Avisa a los participantes: Zoom no les muestra ningún aviso de que estás transcribiendo.

**Quién habló:** al detener, el audio de los participantes se manda a `gpt-4o-transcribe-diarize` (ventanas de 20 min; se pasan muestras de voz para que «Hablante A» sea la misma persona de principio a fin). Sale una ventana para ponerles nombre; el resumen y los pendientes usan esos nombres. Tu micrófono siempre es «Tú» (puedes ponerle tu nombre).

**Importar grabación:** «Reunión» → «Importar grabación…». Un archivo con todos (identifica voces) o varios archivos, uno por participante (el nombre sale del archivo; en Zoom: Configuración → Grabación → «Grabar un archivo de audio aparte por participante», y la grabación local en la app de escritorio funciona con cuenta gratis). Archivos de hasta ~400 MB; la transcripción va en partes de ~100 s.

**Prueba a mano (10 min):**
1. Dos pestañas: una con Zoom (o un video con voces) y Hoja. «Reunión» → micrófono + llamada, comparte la pestaña con audio. Habla tú y deja que el video hable: deben salir líneas «Tú» y «Participantes» en vivo.
2. Detén: debe decir «Identificando quién habló…» y abrir «¿quién habló?» con Hablante A/B. Ponles nombre y guarda. En la nota, los pendientes deben decir quién es responsable.
3. Apaga el wifi 60 s a mitad de reunión y vuélvelo a prender. Al detener, el texto debe quedar completo (lo rehace desde el audio).
4. Importa una grabación de Zoom (m4a) y revisa nombres.
5. Pon nombres propios en «Nombres y términos» y comprueba que salen bien escritos.

**Qué está probado y qué no:** probado con audio simulado (dos voces) en el navegador contra OpenAI: texto en vivo, dos fuentes, quitar eco, separar hablantes, nombres en el resumen, importar, caída de la conexión y recuperación. **No probado:** una llamada real de Zoom (superposición, ruido, la ventana de compartir de cada sistema), reuniones de 1 h, Windows, ni la precisión de las voces reales (la separación de hablantes puede equivocarse con gente que habla encima de otra).

**Costo (referencia de terceros, confirma en la página de precios de OpenAI):** transcribir ≈ US$0.003/min por fuente (con 2 fuentes en vivo, ≈ US$0.006/min), más ≈ US$0.006/min para identificar voces. Una reunión de 1 h con Zoom ronda unos US$0.7.

**Variables opcionales:** `OPENAI_REALTIME_TRANSCRIBE_MODEL` (por defecto `gpt-4o-mini-transcribe`), `OPENAI_DIARIZE_MODEL` (por defecto `gpt-4o-transcribe-diarize`).
