# Reglas Inmutables del Proyecto: Equipo en Acción® — Ecosistema T.I.L.O. (Constitución Visual & Gobernanza v2.0.2)

Este archivo establece las **Reglas Inmutables de Ingeniería Visual, Interfaz, Seguridad NOM-004 y Blindaje Operativo** que deben cumplir de forma obligatoria todos los agentes de software y desarrolladores que operen en este espacio de trabajo, alineadas con la constitución global `sinergix-omnicanal-design-system` **v2.0.2 (Capa 3 — Módulo Clínico Especializado NOM-004)**.

---

## 🎨 1. Sistema Cromático Institucional y Tokens de Interfaz (Capa 2 / Capa 3)

La proporción **60-30-10** aplica exclusivamente a piezas gráficas y marketing (Capa 1). En interfaces operativas y módulos clínicos (Capas 2 y 3), la pantalla se rige por **70%–85% de superficies neutras** y color estrictamente semántico:

*   **Superficies Neutras (70%–85%)**:
    *   *Modo Claro (Predeterminado en Sucursal)*: Lienzo general `Slate-50` (`#F8FAFC`) y paneles/tarjetas en Blanco (`#FFFFFF`).
    *   *Modo Oscuro (Activación consciente `.dark`)*: Lienzo general `Slate-900` (`#0F172A`), paneles `Slate-800` (`#1E293B`) y bordes/elevaciones `Slate-700` (`#334155`). Queda **estrictamente prohibido** el uso de negro puro (`#000000`) en fondos, textos o sombras (`rgb(0 0 0)`), debiendo usar sombras tintadas con `#0F172A` (`rgba(15, 23, 42, ...)`).
*   **Estructura e Interacción Primaria**: Azul Corporativo (`#1C75BC`, hover `#155A92`).
*   **Acentos Biosemánticos y Fórmulas**:
    *   **Rojo Institucional UI (`#B70E0C`)**: Uso obligatorio para texto, bordes de error crítico y acento en pantalla de **33Plus®** (contraste óptico mejorado). El tono `#E30613` queda reservado exclusivamente a artes de empaque físico.
    *   **Verde Ingeniería Tisular (`#3AAA35`)**: Exclusivo para estados de validación/éxito y telemetría de **34Plus®**.
*   **Uso Gobernado de Rosa (`#F29FC5`) y Amarillo (`#FFCC00`)**:
    *   Quedan autorizados exclusivamente en: (1) la **Firma Institucional de 5 Hexágonos**, (2) micro-interacciones empáticas del Companion (`#F29FC5`), y (3) alertas preventivas AAA, validaciones `onBlur` y el banner de desconexión `CloudOff` (`#FFCC00` acompañado siempre de texto oscuro `#0F172A`, jamás texto blanco sobre amarillo).
*   **Gobernanza de Tema (Tailwind v4 + Anti-FOUC)**:
    *   Uso obligatorio de `@custom-variant dark (&:where(.dark, .dark *));`, script síncrono **Anti-FOUC** en `<head>` (iniciando en **Modo Claro `#F8FAFC` por defecto** si `ea-theme` no existe en `localStorage`) y botón manual accesible de `48x48 px`.

---

## 🔤 2. Tipografía, Datos Tabulares y Gobernanza Verbal

*   **Prototype**: Confinada únicamente al **Logotipo Principal** de `Equipo en Acción®` y a los nombres comerciales `33Plus®` y `34Plus®` a gran escala.
*   **Inter y Sansation**: De uso obligatorio para cuerpo de texto, lectura clínica densa, tablas analíticas, encabezados operativos y pantallas del sistema.
*   **Alineación Matemática (`tabular-nums`)**: El **100%** de signos vitales, biomarcadores, edades metabólicas, kilocalorías, cronómetros, folios e IDs debe declarar `font-variant-numeric: tabular-nums`.
*   **Gobernanza Verbal, Marcas `®` y Embargo**:
    *   Trato estricto de **"Usted Global"** en toda interfaz, guía o notificación.
    *   Símbolo `®` obligatorio en `Equipo en Acción®`, `33Plus®` y `34Plus®`.
    *   T.I.L.O. se denomina **"Companion"** (queda prohibido el término *"Copiloto"* y queda prohibido mencionar hardware *"Banda H7"*).
    *   **Embargo Estricto**: Queda prohibida cualquier mención pública en UI o documentos exportables a la marca embargada antes del **18 de diciembre de 2026**.

---

## ♿ 3. Accesibilidad Grado Médico (WCAG 2.2 AAA) y Ergonomía Clínica

*   **Contraste AAA (`>= 7.0:1`)**: Texto principal `#0F172A` (claro) / `#F8FAFC` (oscuro) y texto secundario mínimo `Slate-700` (`#334155` en claro) / `Slate-300` (`#CBD5E1` en oscuro). Quedan prohibidos textos informativos en `Slate-400` sobre blanco.
*   **Triple Señal Obligatoria**: Todo estado clínico, semáforo o alerta debe combinar simultáneamente **Color + Icono SVG (`stroke-width: 2px`) + Etiqueta textual explícita**.
*   **Touch Targets y Separación**: Área interactiva mínima de **44x44 px** (iOS) y **48x48 px** (Android/Web) con margen libre de **8px a 12px** entre controles adyacentes.
*   **Sticky Toasts Clínicos y Layout 50/50**:
    *   Las alertas clínicas de advertencia o error nunca se autodestruyen por temporizador; exigen confirmación manual (`Entendido` `>= 44px`).
    *   En escritorio (`>= 1024px`) rige el **Split-Screen 50/50** inmutable; en pantallas `< 1024px` debe colapsar linealmente (`flex-col lg:flex-row`, `w-full lg:w-1/2`) sin truncar información.

---

## 📑 4. Visualización de Ingredientes, Firma de 5 Hexágonos y Espaciado

1.  **Divulgación Progresiva Obligatoria**:
    *   *Nivel 1 (Glanceable)*: De 3 a 5 "Ingredientes Héroes" y semáforo/anillo modular limpio.
    *   *Nivel 2 (Interacción Activa)*: Panel con detalle de beneficio fisiológico (apegado a COFEPRIS / NOM-043, cero promesas curativas), dosificación y evidencia.
2.  **Firma Empírica de 5 Hexágonos**: SVG local `width="30" height="26" viewBox="0 0 576 512"` (`#B70E0C`, `#F29FC5`, `#1C75BC` rotado `90deg`, `#3AAA35`, `#FFCC00`) animado exclusivamente con `@keyframes eaHexWave` (`2.0s`: `1.0s` ola + `1.0s` reposo), sin `animate-bounce` ni hojas CSS externas.
3.  **Grilla de 4 Puntos**: Espaciados en múltiplos de **4px** y pie de página semántico `<footer>` con leyenda oficial `© Equipo en Acción®. Todos los derechos reservados.`.

---

## ⚡ 5. Rendimiento de Gráficos (WebGL / Animaciones) y Reducción de Movimiento

1.  **Presupuesto Cuantitativo y Ciclo de Vida**: Carga diferida (`<Suspense>`), tope de `<= 50,000` triángulos, `<= 5 MB` (KTX2/Draco), `dpr={[1, 1.5]}`, `frameloop="demand"` y pausa inmediata de cualquier `requestAnimationFrame` cuando `document.hidden === true` o al desmontar el componente.
2.  **Respeto Estricto a `prefers-reduced-motion: reduce`**: Desactivación inmediata de olas, blobs y simulaciones físicas, presentando un estado basal estático de alta nitidez.

---

## 🔒 6. Protección Estricta de Fases del Triage (Fases 0 a 17)

Queda estrictamente prohibida cualquier modificación de código, prompts, flujos de validación o copywriting clínico en las **Fases 0 a la 17** de la aplicación (incluyendo los archivos de componentes, y las reglas dentro de `useCortex.js`, `App.jsx` y `server/index.js` que afecten a estas fases), a menos que exista una orden explícita y de doble confirmación por parte del Director (Andrés Trejo).

### Protocolo de Excepción (Doble Confirmación)
Ante cualquier solicitud de cambio en estas fases (0 a 17), el agente debe:
1. **Detenerse de inmediato.**
2. **Advertir:** Recordar al usuario que estas fases están bajo protección estricta del proyecto.
3. **Preguntar de forma explícita:** *"Andrés, las Fases de la 0 a la 17 están bajo protección estricta. ¿Está absolutamente seguro de que desea proceder con este cambio en la Fase [X]?"*
4. **Esperar confirmación:** No realizar ningún cambio en el código, ejecutar comandos ni alterar archivos hasta que el Director responda afirmativamente por escrito.

---

## 🔒 7. Blindaje Inviolable de la App de Consulta Nutricional (App 1)

La **App de Consulta Nutricional** (`client/`) se declara **OFICIALMENTE COMPLETA Y FUNCIONAL EN SU TOTALIDAD**.

Queda **ESTRICTAMENTE PROHIBIDO** bajo cualquier concepto modificar, alterar, refactorizar o editar cualquier archivo, componente, hook, módulo o configuración perteneciente a la **App de Consulta Nutricional** (`client/`), a menos que se cumpla el siguiente protocolo obligatorio:

### Protocolo Obligatorio para Modificar la App 1:
1. **Presentación de Plan de Implementación:** El agente debe elaborar y presentar previamente un **Plan de Implementación detallado** (`implementation_plan.md`) exponiendo los cambios sugeridos, la justificación clínica/técnica y la evaluación de impacto.
2. **Autorización Expresa del Director:** El agente debe **detener la ejecución de inmediato** y solicitar la autorización afirmativa, explícita y por escrito del Director (Andrés Trejo) para proceder con dicho plan.
3. **Prohibición de Edición Directa:** Sin un plan presentado y la confirmación explícita recibida por escrito del Director, queda estrictamente prohibida la edición de cualquier archivo dentro de `client/`.

---

## 🔒 8. Aislamiento Estricto de Expediente Clínico y Llave Primaria `userId` (NOM-004)

Toda lectura, consulta, hidratación, persistencia, auditoría y análisis clínico dentro del ecosistema T.I.L.O. debe realizarse de manera inmutable teniendo a **`userId`** como la **Llave Primaria absoluta**:

1. **Prohibición de Fallbacks Hardcodeados**: Queda estrictamente prohibido en el frontend y backend cualquier operador de respaldo o fallback que asuma identificadores de pacientes (ej. `|| '15000'`, `|| '11000'`). Si un `userId` no se encuentra en el contexto autenticado, el sistema debe fallar de forma segura (`null`), impidiendo por diseño caer en el folio o historial de otro paciente.
2. **Particionamiento de Memoria en Cliente**: El almacenamiento local (`localStorage`) debe segmentarse obligatoriamente bajo la clave unívoca `tilo_session_data_${userId}`. Queda prohibido el almacenamiento plano compartido entre diferentes usuarios.
3. **Cero Datos Inventados en Antecedentes**: Queda prohibido a cualquier desarrollador o agente de software inyectar antecedentes clínicos, personales o familiares pre-fabricados en el código o en los prompts del motor RAG. Si un paciente niega antecedentes en el triage (ej. "Niega"), el expediente debe registrarse como ausente/negado.
