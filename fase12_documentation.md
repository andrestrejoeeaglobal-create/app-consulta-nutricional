# Documentación Técnica: Fase 12 - Logística

Este documento detalla la lógica de flujo y las opciones de diálogo programadas en el componente `Fase12_Logistica.jsx` de la arquitectura T.I.L.O. La **Fase 12** tiene el propósito de perfilar la viabilidad operativa del paciente para acatar el plan alimenticio, determinando carga de tiempo de cocina, hábitos de compra externa y la infraestructura de su entorno de comida regular (acceso a refrigeración o métodos de calentamiento), inyectando "AI Constraints" críticas al algoritmo generador de menús.

---

## 1. Puerta de Cocina y Origen Alimentario (`step: 'COOK_GATE'`)

**Descripción:**  
T.I.L.O. inicializa la fase validando si el paciente es autosuficiente para preparar sus comidas, tiene delegada la tarea, o depende netamente del consumo externo.

**Diálogo de T.I.L.O.:**
> "Para diseñar un plan que realmente pueda cumplir: ¿Quién se encarga normalmente de preparar sus alimentos?"

**Opciones de Usuario [Botones / Inputs]:**

- `✅ Yo mismo (Control Total)` *(Acción: Avanza a `TIME_COOK`)*
- `✅ Pareja o Familiar (Apoyo)` *(Acción: Avanza a `TIME_COOK`)*
- `✅ Personal doméstico (Delegado)` *(Acción: Avanza a `VENUE_GATE`)*
- `✅ Nadie / Compro hecho (Dependencia externa)` *(Acción: Avanza a `BUYING_MODE`)*

> [!NOTE]
> **Al procesar componentes complejos:**
> El sistema despliega las opciones usando el componente incrustado `SearchableVerticalMenu` para estructurar limpiamente las selecciones que superan los 3 botones estándar a lo largo de toda la fase.

---

## 2A. Disponibilidad de Tiempo de Cocina (`step: 'TIME_COOK'`)

**Descripción:**  
Si el usuario o su familia cocinan, se determina la carga de tiempo libre diario o si operan en formato "Meal Prep" de fines de semana.

**Diálogo de T.I.L.O.:**
> "¿De cuánto tiempo dispone para cocinar entre semana?"

**Opciones de Usuario [Botones / Inputs]:**

- `✅ Mucho (Me gusta cocinar)` *(Acción: Avanza a `VENUE_GATE`)*
- `✅ Poco (30 min máx)` *(Acción: Avanza a `VENUE_GATE`)*
- `✅ Solo fines de semana (Meal Prep)` *(Acción: Avanza a `VENUE_GATE`)*

---

## 2B. Hábitos de Consumo Externo (`step: 'BUYING_MODE'`)

**Descripción:**  
Si el usuario respondió que compra comida hecha, se debe tipificar el perfil de adquisición comercial de alimentos para generar "hacks" metabólicos específicos relativos y viables (comida rápida, fondas de la esquina, callejero).

**Diálogo de T.I.L.O.:**
> "Entendido. Si suele comprar la comida, ¿dónde lo hace principalmente?"

**Opciones de Usuario [Botones / Inputs]:**

- `✅ Restaurantes / Apps de Delivery` *(Acción: Avanza a `VENUE_GATE`)*
- `✅ Fondas / Comida Corrida (Casera)` *(Acción: Avanza a `VENUE_GATE`)*
- `✅ Tiendas de Conveniencia / Supermercado` *(Acción: Avanza a `VENUE_GATE`)*
- `✅ Puestos en la calle` *(Acción: Avanza a `VENUE_GATE`)*

---

## 3. Entorno Alimentario Central (`step: 'VENUE_GATE'`)

**Descripción:**  
Una vez fijado cómo se consiguen los alimentos y la disponibilidad de tiempo, se identifica la geografía en donde se comerá, lo que determinará la portabilidad requerida.

**Diálogo de T.I.L.O.:**
> "En sus horas de mayor actividad (Lunes a Viernes), ¿dónde acostumbra desayunar y comer?"

**Opciones de Usuario [Botones / Inputs]:**

- `✅ Casa (Home Office / Ama de casa)` *(Acción: Finaliza Fase y dispara transición final)*
- `✅ Trabajo / Oficina` *(Acción: Avanza a `AMENITIES`)*
- `✅ En la calle / Tránsito (Vendedor, Chofer, etc.)` *(Acción: Avanza a `NO_KITCHEN`)*

---

## 4A. Infraestructura en Oficina (`step: 'AMENITIES'`)

**Descripción:**  
Si el paciente come en el trabajo, debe garantizarse validación térmica, impidiendo sugerencias frágiles que la temperatura e infraestructura local puedan pudrir.

**Diálogo de T.I.L.O.:**
> "Para saber qué tipo de recipientes enviarle: En su lugar de trabajo, ¿con qué equipo cuenta para sus alimentos?"

**Opciones de Usuario [Botones / Inputs]:**

- `✅ Refri y Microondas (Puedo calentar y refrigerar)` *(Acción: Finaliza Fase)*
- `✅ Solo tengo Refrigerador (Comida fría o ensaladas)` *(Acción: Finaliza Fase)*
- `✅ Solo tengo Microondas (Debo llevar hielera o perecederos)` *(Acción: Finaliza Fase)*
- `✅ No tengo nada (Escritorio/Mochila)` *(Acción: Finaliza Fase)*

---

## 4B. Portabilidad en Calle / Tránsito (`step: 'NO_KITCHEN'`)

**Descripción:**  
Para pacientes que operan rutinariamente desde la calle, valida de forma binaria su capacidad de contención (maleta hermética vs dependencia absoluta de no-perecederos).

**Diálogo de T.I.L.O.:**
> "Entendido. Adaptaré el menú a opciones 'Grab & Go' (Bolsa/Mochila). ¿Le es posible cargar una pequeña lonchera térmica o prefiere alimentos secos (barras, atún, frutas)?"

**Opciones de Usuario [Botones / Inputs]:**

- `✅ Lonchera Térmica` *(Acción: Finaliza Fase)*
- `✅ Solo Secos/Ambiente` *(Acción: Finaliza Fase)*

---

## 5. Cierre y Transición Oficial (`step: 'FINALIZED'`)

**Descripción:**  
Toda la matriz logística generada, se destila transpilando variables contextuales (`cooking_time`, `environment.amenities`, etc.) a un vector final de restricciones generativas de IA (`computeAIConstraints()`) empujando flags operativas clínicas hacia el ecosistema.

**Diálogo de T.I.L.O.:**
> "Perfecto. He configurado la logística de su plan para que sea fácil de seguir en su día a día."
>
> [!WARNING]
> **Transición Crítica y Mapeo Cognitivo:**
> Tras 1000ms del mensaje final, T.I.L.O invoca `onPhaseComplete()` pasando por defecto a `PHASE_13_CONTEXTO_ESPECIAL` enviando tanto el Historial actualizado, como inyectando los `AIConstraints` extraídos (como `LOW_PREP_TIME` o `COLD_CHAIN_BROKEN`) a los `clinical_flags` globales para análisis central modular. El UI frontal se inhabilita asíncronamente mientras resuelve.
