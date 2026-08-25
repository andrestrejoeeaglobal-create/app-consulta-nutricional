---
name: tilo-phase-documentation
description: Estandariza la creación y formato de reportes de documentación técnica para cada Fase Clínica del ecosistema T.I.L.O. basado en el estándar de la Fase 0.
---

# T.I.L.O. Phase Documentation Standard (tilo-phase-documentation)

Esta skill se activa de forma prioritaria cada vez que el usuario solicita documentar, resumir o generar un reporte técnico sobre una "Fase" (Phase) de la entrevista clínica o componente del asistente T.I.L.O.

## Propósito

Asegurar que **todos** los reportes de documentación de las fases clínicas mantengan un formato estructurado, profesional y altamente legible, replicando fielmente la "estructura o modelo dorado" definido inicialmente en el reporte de la Fase 0 (Identidad y Privacidad Clínica).

## 🛠️ Estructura Obligatoria del Reporte

Cada vez que documentes una Fase a partir de su código, tu output debe ser un documento Markdown entregado al usuario con la siguiente estructura jerárquica exacta:

### 1. Cabecera Principal

- **Título:** `# Documentación Técnica: Fase [Número] - [Nombre Temático de la Fase]` (ej. *Fase 12 - Logística de la Cita*).
- **Párrafo Introductorio:** Breve descripción de 2 o 3 líneas explicando el propósito principal del componente en la arquitectura, qué datos recolecta y cómo impacta en el flujo clínico.
- **Divisor:** Un separador `---` para iniciar el desglose operativo.

### 2. Desglose de Pasos (Sub-Flujos)

Debes agrupar la lógica de la conversación mapeando los estados internos (`step` de estado o equivalentes del componente). Usa encabezados de nivel 2 (`##`) y numéralos consecutivamente:

```markdown
## 1. [Nombre del Paso o Interacción] (`step: 'nombre_estado'`)
