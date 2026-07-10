# Reporte de Auditoría: Alineación Clínica y Protocolo T.I.L.O. (Fase 1 y Fase 2)

A continuación, presento el análisis detallado del nivel de cumplimiento actual de los componentes `Fase1_Identificacion.jsx` y `Fase2_Seguridad.jsx` (además de la inyección de `useCortex.js`), contrastados estrictamente contra el **T.I.L.O. Binary Protocol v62.1** (Gestión de Tono, Cohortes de Edad, Verificaciones de Sexo y Párrafos de Poder).

Como fue solicitado, **no se ha modificado el código**, este es únicamente un reporte de diagnóstico de inconsistencias.

---

## 1. Fase 1: Identificación (`Fase1_Identificacion.jsx`)

Actualmente, la Fase 1 funciona más como un formulario conversacional fluido estándar que como una compuerta estricta.

> [!WARNING]
> **Falta de Trazabilidad del Interlocutor (Tutor vs. Paciente)**
> En preguntas tempranas (ej. *¿En qué DÍA nació?*, *¿Cuál es su sexo biológico?*), el sistema asume que le está hablando directamente al paciente y usa el trato de "Usted", fallando en dirigir el diálogo al **Tutor** si el paciente es un neonato, lactante o pediátrico (la edad recién se determina a mitad de la etapa, lo cual es lógicamente correcto, pero las formas iniciales no están adaptadas ni protegidas para menores conocidos tras calcular la edad).

### Inconsistencias Específicas Fase 1

- **Ausencia de Párrafos de Poder (P1 y P2):** Salvo en el mensaje inicial (que sí cita la NOM-004), las interacciones subsecuentes carecen del *Bloque de Autoridad (P1)* explícito. Son solo preguntas directas (ej. *"¿A qué se dedica actualmente?"* en `intro_job`).
- **Incumplimiento de Bolding en Verbos de Acción:** El protocolo exige que el verbo de acción en el bloque P2 vaya en **negritas**. En esta fase se subrayan en negritas los atributos (ej. **sexo biológico**, **Apellido Paterno**), pero los verbos ( *proporcione*, *seleccione*, *indique* ) están en texto normal.

---

## 2. Fase 2: Red de Apoyo / Seguridad (`Fase2_Seguridad.jsx`)

La Fase 2 tiene una integración funcional sustancialmente mayor con las lógicas institucionales (incluye bloqueos de redundancia frente a teléfonos idénticos) y fragmenta el discurso por cohortes de edad (Neonato, etc.).

> [!CAUTION]
> **Desfase en Rango Etario (Edad 12 años)**
> Existe una inconsistencia técnica-narrativa dentro del mismo componente para el manejo de pacientes con exactamente **12 años**:
>
> - En `getStarterMessage()` (Línea 28), se evalúa al menor de 12 como *Pediátrico*, y **a partir de los 12 incluyente** hasta los 17 ( `>= 12 && <= 17` ) se le habla directamente como *Adolescente* ("Por su seguridad...").
> - Sin embargo, posteriormente en `generateBinaryGateNarrative()` (Línea 134), el segmento Pediátrico se define como `<= 12.99` ( `>= 3 && < 13` ) ("...responder por el niño/la niña...").
> - **Efecto:** El sistema inicia saludando a un niño de 12 años como *Adolescente* y hablándole de "Usted", pero luego en la compuerta binaria de cierre le habla al adulto sobre "responder por el niño".

### Inconsistencias Específicas Fase 2

- **Estructura Decisional (Compuertas):** En la validación categórica (ej. "Mantener número" vs "Cambiar número"), los labels del UI muestran *“Sí, mantener número”* en lugar de seguir la estructura exigida en XML/UI del protocolo ( Ej: `[ ✅ MANTENER NÚMERO ] [ ❌ UTILIZAR OTRO ]` ).
- **Errores de Bolding en Párrafos de Poder:**
  Al igual que en la Fase 1, en `generateBinaryGateNarrative` se formula `P2` de la siguiente forma:
  `"**${patientName}**, confirme que los datos del contacto..."`
  El protocolo señala que debe ser el verbo el que lleve énfasis: `"Usted, **confirme** que los datos..."`

---

## 3. Emisión de Resúmenes y Sellado (`useCortex.js`)

Se evaluó la función interna del `useCortex.js` que construye los resúmenes demográficos (Sellos).

> [!TIP]
> **Cumplimiento Positivo ("Usted Global")**
> En general, se está respetando excelentemente bien el trato formal de "Usted" en los resumenes asíncronos cuando el usuario excede los 12/13 años.

### Puntos a Ajustar

- **Formateo del Output (CORTEX-V62.1):** En el archivo existe una función auxiliar explícita llamada `applyV621Protocol()` (Línea 313). Esta función envuelve adecuadamente los P1 y P2 con `[Triangulación Legal Activa]` y XML `<binary_gate_execution>`. Sin embargo, los textos en `Fase1_Identificacion` y `Fase2_Seguridad` están **inyectando texto *hardcoded* (fijo)**, ignorando transitar a través de esta función de la Inteligencia Central. Esto impide que los *metadatos de auditoría* (`triage_mode`, `gender_lock`) se impriman correctamente en el registro interno final para efectos de la NOM-024.

## Resumen Ejecutivo de la Auditoría

1. ✅ **Sexo Biológico:** Su captación transversal de F / M es correcta (con tu corrección preexistente ya se detecta integralmente para la lógica de Fase 2).
2. ⚠️ **Etapas y Edades:** Generalmente correcto, pero existe un "hueco semántico" crítico en los *12 años* donde la Fase 2 se contradice a sí misma entre trato adolescente y trato pediátrico.
3. ❌ **Párrafos de Poder (Verbos Bolded):** No se está cumpliendo. Se resaltan sustantivos en vez de verbos (`P2`).
4. ❌ **Alineamiento XML / v62.1:** Los diálogos están "harcodeados" (código duro) en los componentes Frontend, en vez de aprovechar las herramientas nativas/algoritmos internos de `useCortex.js` (`applyV621Protocol`) para auditar formalmente las P1 y P2 frente al Data Lake.
