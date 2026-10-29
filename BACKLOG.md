# Hoja · backlog priorizado

Cómo trabajamos: un backlog ordenado por prioridad, sprints cortos (una a dos semanas) y una regla de "hecho".

**Prioridades**
- **P0** bloquea o puede perder datos: se hace ya.
- **P1** valor alto para quien usa Hoja: entra en el siguiente sprint.
- **P2** mejora clara, no urgente: se planea cuando P1 está vacío.
- **P3** idea a validar: no se construye hasta que haya señal.

**Hecho =** lint sin errores, `npm test` pasa, `npm run build` pasa, probado en móvil y escritorio, y el dueño dio el visto bueno antes del push.

Estado al 2026-10-29. Las tarjetas con casilla marcada ya están en `main` (o en el siguiente commit).

## Sprint actual

| Pri | Tarjeta | Estado |
|---|---|---|
| P0 | Probar voz con micrófono real: Chrome, Android, Safari iPhone, reunión de 30+ min, apagar el wifi a mitad | por probar |
| P0 | Confirmar que el modelo de transcripción existe en la cuenta de OpenAI (`OPENAI_TRANSCRIBE_MODEL`) | por probar |
| P1 | Libretas: cada libreta es su propio lienzo; mover notas entre libretas | hecho, falta SQL y prueba |
| P1 | Cuenta: nombre para mostrar en `/cuenta` | hecho, falta prueba con login |
| P1 | Refinar la web de escritorio: barra de herramientas en una fila, jerarquía, espacios | siguiente |
| P1 | Tablero ágil: nota-tablero con columnas, tarjetas con prioridad P1–P3 y orden por prioridad | siguiente |

## Por hacer

| Pri | Tarjeta | Notas |
|---|---|---|
| P1 | Página pública y probar sin cuenta | Hoy el primer contacto es el login. Es lo que más falta antes de publicar los videos |
| P1 | Probar el recorrido y la vista móvil en un teléfono real | Pellizco para zoom, teclado, Safari |
| P2 | Etiquetas libres además de la etiqueta de color | |
| P2 | Sugerencias de enlaces entre notas con IA | |
| P2 | Libretas: arrastrar una nota sobre una libreta para moverla; filtrar Estudio y Calendario por libreta | |
| P2 | Separar a quienes hablan en una reunión | La transcripción actual no distingue voces |
| P2 | Abrir la app sin conexión desde cero y resolver conflictos entre dispositivos | |
| P3 | Compartir una libreta completa por enlace | Hoy se comparte todo el lienzo |
| P3 | Plantillas de tablero (sprint, personal, estudio) | Después del tablero |

## Reglas del tablero ágil (para la tarjeta de arriba)

- Columnas por defecto: **Backlog · En curso · Hecho**. Se pueden renombrar y agregar.
- Cada tarjeta tiene prioridad **P1, P2 o P3** y se ordena de mayor a menor dentro de su columna.
- Límite sugerido de "En curso": 3 tarjetas, para no empezar más de lo que se termina.
- Las tareas con fecha del tablero aparecen en el calendario, igual que los pendientes de las notas.

## Hecho

- [x] Lienzo sin bordes, zoom, ordenar y deshacer
- [x] Documentos con `[[enlaces]]`, índice y menciones
- [x] Reunión: resumen, decisiones y pendientes con fecha
- [x] Dictado y reunión con grabación por trozos, reintentos y recuperación
- [x] Cuentas con correo y contraseña; respaldos JSON
- [x] Recorrido de bienvenida y vista móvil
- [x] Libretas y nombre de cuenta (pendiente de SQL y prueba)
