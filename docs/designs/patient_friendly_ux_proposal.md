# Propuesta de Arquitectura y Rediseño de Experiencia: Vista Empática para el Paciente (Fase 19) y Motor Clínico Cortex
**Ecosistema T.I.L.O. & Equipo en Acción® (Visión 2030)**  
**Protocolo:** EGM (Enjambre Goldfish: `egm-comprehension`, `egm-design`, `egm-zoom-out`)  
**Fecha:** Noviembre 2026  
**Director del Proyecto:** Andrés Trejo Maldonado  
**Estado:** Propuesta Técnica y Pedagógica para Revisión y Autorización (Cero modificación de código fuente)

---

## 1. Resumen Ejecutivo y Diagnóstico Forense

El objetivo de esta propuesta es erradicar de forma definitiva la experiencia fría, intimidante y desbordada que actualmente sufre la vista del paciente en la **Fase 19** (`Fase19_DiagnosticoIntegral.jsx`), en la pestaña de diagnóstico del Dashboard (`TabDiagnosis.jsx`) y en la exportación de planes clínicos (`formatPlanForClipboard.js`).

Actualmente, el paciente recibe un volcado crudo de telemetría de base de datos que destruye el vínculo terapéutico:
1. **Volcado masivo de telemetría sin procesar:** Cadenas de hasta 149 parámetros continuos con valores crudos, referencias incompletas y códigos `[CIE-10]`.
2. **Falsos positivos de anormalidad:** Marcadores fisiológicamente sanos etiquetados como `NORMAL (-)` o `OPTIMAL` son erróneamente clasificados como "fuera de rango" debido a una comparación de cadenas deficiente (`st !== 'NORMAL'`).
3. **Desborde del Nodo 7 ("Cajón de Sastre"):** Un bloque `else` no acotado en `cortexController.js` arroja al nodo de "Integridad Estructural" decenas de variables no relacionadas (pulmón, próstata, espermas, pesticidas, canales bioeléctricos).
4. **Corrupción léxica y de codificación:** Neologismos corruptos por expresiones regulares defectuosas (`Cardiovíascular`, `Víaso`, `Coraízon`) y caracteres de escape rotos por transcodificación UTF-8/CP1252 (`Est•ndar`, `P•rdida`, `oxidaci•n`).
5. **Residuos pediátricos e iconografía disonante en adultos:** Presencia del icono `🧸` (osito) en el Pilar 03 de adultos y jerga deportiva incomprensible (`RIR >= 3-4`, `Zona 5 HIIT`, `NEAT`, `sdLDL`, `aclaramiento glinfático`).
6. **Horarios rígidos desfasados:** Imposición de horarios inflexibles ("Toma 1 a las 04:00 hrs") en lugar de guías ancladas al ciclo circadiano del paciente ("Al despertar en ayunas", "Media mañana", "Media tarde", "Antes de dormir").

---

## 2. Arquitectura Dual de Presentación (NOM-004 vs. Guía Empática)

Para cumplir simultáneamente con el rigor normativo mexicano (**NOM-004-SSA3-2012** / **COFEPRIS**) y el estándar de experiencia humana y pedagógica, la arquitectura se divide en dos capas desacopladas con un interruptor claro:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   INTERRUPTOR DE VISTA (FASE 19 & DASHBOARD)           │
│   [ 💚 Modo Guía Empática (Paciente) ]    [ 🔬 Modo Médico (NOM-004) ] │
└────────────────────────────────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     MODO PACIENTE / FAMILIA     │       │    MODO EXPEDIENTE AUDITABLE    │
│  - 5 Sistemas Comprensibles     │       │  - Matriz IFM de 7 Nodos        │
│  - Metáforas y Analogías Claras │       │  - Códigos CIE-10 deterministas │
│  - Máximo 3-5 Hallazgos Héroes  │       │  - Valores de Laboratorio con Z │
│  - Semáforo Clínico Amigable    │       │  - Respaldo de 6 Fuentes (OCR,  │
│  - Consejos de Hábitos en Casa  │       │    Electret, Ojo, Lengua, Som.) │
│  - Cronobiología de Fórmulas    │       │  - Prescripción Farmacológica   │
└─────────────────────────────────┘       └─────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────┐
│   DIVULGACIÓN PROGRESIVA (Módulo 4 y 22 Clinical Branding Guide):      │
│   Acordeón colapsado al pie: "Ver desglose técnico para profesionales" │
│   (Solo muestra los biomarcadores verdaderamente fuera de rango)       │
└────────────────────────────────────────────────────────────────────────┘
```

### Contrato de Datos Desacoplado:
El backend (`cortexController.js`) emitirá un payload limpio con dos objetos diferenciados:
- `patient_summary`: Estructura humanizada, 5 sistemas pedagógicos, semáforo de bioseguridad, consejos de cocina y crononutrición amigable.
- `clinical_dossier`: Estructura médica completa bajo los 7 nodos del Institute for Functional Medicine (IFM), códigos CIE-10, telemetría cuantitativa y pistas de auditoría NOM-004.

---

## 3. Motor de Traducción Semántica: 5 Sistemas Comprensibles

En lugar de los 7 nodos técnicos del IFM (Asimilación, Biotransformación, Defensa, Comunicación, Energía, Transporte, Integridad Estructural), la vista del paciente agrupará la información en **5 Sistemas Vitales Cotidianos**:

| # | Sistema Vital para el Paciente | Nodos IFM Mapeados | Metáfora Pedagógica Aprobada | Preguntas Clave que Responde |
|---|---|---|---|---|
| **1** | **Tu Circulación y Energía** 🫀⚡ | Transporte (Nodo 5) + Energía (Nodo 3) | *"La red de tuberías y las baterías celulares"* | **¿Qué observamos?** Cómo viaja el oxígeno y cómo tus células fabrican energía diaria.<br>**¿Qué significa?** Si tus células tienen chispa suficiente o si tus arterias están trabajando con sobreesfuerzo. |
| **2** | **Tu Digestión y Absorción** 🥗🌱 | Asimilación (Nodo 1) | *"El puerto de entrada y los nutrientes"* | **¿Qué observamos?** El estado de tu estómago, intestinos y microbiota.<br>**¿Qué significa?** Si lo que comes realmente se aprovecha o si tu barrera digestiva está inflamada. |
| **3** | **Tus Filtros Naturales** 💧🛡️ | Biotransformación (Nodo 4) | *"La planta de purificación: Hígado y Riñones"* | **¿Qué observamos?** La capacidad de tu cuerpo para depurar residuos metabólicos.<br>**¿Qué significa?** Si tus filtros trabajan desahogados o si necesitan apoyo para eliminar toxinas sin fatiga. |
| **4** | **Tus Defensas y Descanso** 🛡️🌙 | Defensa (Nodo 2) + Comunicación (Nodo 6) | *"El escudo protector y el reloj biológico"* | **¿Qué observamos?** Tu nivel de inflamación, tus hormonas de estrés y la calidad de tu sueño reparador.<br>**¿Qué significa?** Si tu cuerpo está en modo de alerta continua o si logra entrar en calma para sanar. |
| **5** | **Tus Huesos, Músculos y Articulaciones** 🦴💪 | Integridad Estructural (Nodo 7) | *"Los cimientos y la estructura de tu casa"* | **¿Qué observamos?** La fortaleza de tus tejidos conectivos, colágeno y soporte muscular.<br>**¿Qué significa?** Si tus articulaciones tienen flexibilidad y amortiguación para moverte con agilidad y sin dolor. |

### Regla de los "3 a 5 Hallazgos Héroes" (Eliminación del Ruido):
- Ningún sistema mostrará más de 3 hallazgos prioritarios al paciente.
- Si un sistema no tiene anomalías, mostrará un mensaje de felicitación y estabilidad: *"Función saludable y equilibrada. No se encontraron alteraciones en este sistema."*
- Queda prohibida la exhibición de listas con comas o puntos y coma de más de 3 elementos en la capa de paciente.

---

## 4. Tabla de Sanitización Terminológica y Eliminación de Jerga

Para proteger la tranquilidad del paciente y evitar angustia innecesaria, se aplica un filtro estricto de traducción de términos:

| Término Técnico Crudo / Jerga | Traducción Aprobada al Lenguaje Ciudadano | Justificación Clínica y Emocional |
|---|---|---|
| `ANORMAL SEVERO (+++)` | **Atención Prioritaria Recomendada** | Elimina la connotación de alarma fatalista o patología irreversible. |
| `ANORMAL MODERADO (++)` | **Alerta Preventiva a Cuidar** | Enfoca la atención en la prevención activa. |
| `ANORMAL LEVE (+)` | **Observación Preventiva** | Señala áreas de optimización temprana sin alarmar. |
| `NORMAL (-)` / `OPTIMAL` | **Rango Óptimo y Saludable** | Previene que marcadores sanos se interpreten como enfermedades. |
| `[CIE-10: K90.9]` / Códigos diagnósticos | *(Oculto en Vista Paciente; visible solo en Modo Médico)* | El código numérico confunde y asusta a los familiares. |
| `Zona 5 HIIT` / `RIR >= 3-4` | **Ejercicio vigoroso o de alta exigencia cardiovascular** | Traduce términos de atletas a recomendaciones seguras para cualquier edad. |
| `NEAT` | **Movimiento cotidiano activo (caminata ligera, subir escaleras, estar de pie)** | Explica el hábito real sin siglas en inglés. |
| `Aclaramiento glinfático` | **Limpieza y regeneración cerebral durante el sueño profundo** | Conecta el concepto biológico con el descanso reparador. |
| `sdLDL` / `Aterogénico` | **Partículas de grasa pequeñas con tendencia a irritar las arterias** | Explica la función física sin sembrar terror. |
| `🧸` (Icono de osito en adultos) | **🚶‍♂️ / 🏃 / 🧘 (Actividad física según perfil)** | Elimina infantilización indigna en expedientes de personas adultas. |
| `🍵` (Té caliente en 34Plus®) | **💧 Vaso con agua purificada al tiempo (mínimo 500 ml)** | Precisión clínica: 34Plus® requiere hidratación acuosa para su absorción celular. |

---

## 5. Semáforo Clínico de Bioseguridad y Transparencia en la Suplementación

El paciente debe comprender con total tranquilidad por qué su protocolo inicia de cierta forma y cuál es el rol exacto de sus fórmulas nutricionales:

```
┌────────────────────────────────────────────────────────────────────────┐
│               SEMÁFORO DE BIOSEGURIDAD DEL PLAN DE SALUD               │
├────────────────────────────────────────────────────────────────────────┤
│ 🟢 ZONA VERDE: Hábitos de Base y Nutrición Celular                     │
│    Alimentación limpia, hidratación y caminatas diarias.               │
│                                                                        │
│ 🟡 ZONA AMARILLA: Suplementación de Precisión y Ajuste Gradual        │
│    🔴 33Plus®: Tu chispa de energía matutina y enfoque celular.        │
│    🟢 34Plus®: Tu arquitecto nocturno de regeneración y descanso.       │
│    * Si presentas digestión delicada o tensión, iniciamos con dosis    │
│      gradual para que tu cuerpo se adapte con suavidad y confort.      │
│                                                                        │
│ 🔴 ZONA ROJA: Vigilancia y Estudios Médicos Complementarios            │
│    Estudios de laboratorio recomendados o valoración paralela con tu   │
│    médico especialista para el control de tus condiciones de base.     │
└────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Transparencia Ética Institucional:** El plan declara explícitamente al paciente:  
> *"33Plus® y 34Plus® son formulaciones de nutrición celular avanzada diseñadas para nutrir tus tejidos y optimizar tu metabolismo; no sustituyen medicamentos prescritos por tu médico tratante ni tratamientos farmacológicos de base."*

---

## 6. Sincronización Circadiana Humana de Fórmulas (33Plus® & 34Plus®)

Se elimina el horario militar o rígido (`04:00 hrs` / `09:30 hrs`) que resultaba incoherente con el estilo de vida de muchos pacientes, reemplazándolo por **Momentos Ancla del Día**:

### 🔴 Fórmula 33Plus® (Energía, Enfoque y Termogénesis Mitocondrial)
*   **Momento Principal (Toma 1):** *Al despertar en ayunas o junto con tu primer vaso de agua.*  
    *Función explicada al paciente:* "Despierta tus mitocondrias (las baterías de tus células), aportando claridad mental y dinamismo para arrancar tu jornada sin recurrir a exceso de café."
*   **Momento Secundario (Toma 2 - Si aplica por protocolo de 2 tomas):** *A media mañana (entre 10:30 y 11:30 hrs) o antes de tu actividad física matutina.*  
    *Precaución de Bioseguridad:* "Evitar tomar después de las 16:00 hrs para que no interfiera con tu conciliación natural del sueño."

### 🟢 Fórmula 34Plus® (Regeneración Tisular, Homeostasis y Apoyo al Descanso)
*   **Momento de la Tarde (Toma 1 - Si el protocolo incluye 2 tomas):** *A media tarde (17:00 a 18:00 hrs).*  
    *Función explicada al paciente:* "Prepara a tu cuerpo para desactivar la tensión del día y apoya a tus articulaciones tras el desgaste de la jornada."
*   **Momento Nocturno (Toma Principal):** *30 a 60 minutos antes de acostarte a dormir.*  
    *Instrucción de Oro:* "Disolver en **un vaso con mínimo 500 ml de agua natural 💧**. Trabaja mientras duermes como un equipo de arquitectos reparando tus mucosas, articulaciones y tejidos profundos."

---

## 7. Plan de Acción Inmediato en Casa (Hábitos Prácticos y Sin Jerga)

Las restricciones alimentarias y de estilo de vida se presentan desde un enfoque constructivo y práctico para la cocina del hogar:

1. **Cocina Desinflamatoria y Amable:**
   *   *Cero Picante Irritante:* Sustituir chiles y salsas irritantes por hierbas aromáticas suaves (romero, albahaca, cilantro, orégano).
   *   *Cero Carne de Cerdo:* Favorecer pescado blanco, pechuga de pollo de libre pastoreo, huevos y caldos de vegetales ricos en minerales.
   *   *Cero Azúcares Refinados ni Harinas Ultraprocesadas:* Reemplazar refrescos y pan dulce por agua infusionada con rodajas de fruta fresca o pepino.
2. **Hidratación Inteligente por Horarios:**
   *   Tomar agua a pequeños sorbos a lo largo del día. Evitar ingerir grandes volúmenes de líquidos durante las comidas principales para favorecer la digestión gástrica natural.
3. **Caminata Digestiva y Movimiento Cotidiano:**
   *   *Caminar 10 a 15 minutos* a paso suave después de comer o cenar. Ayuda a que la glucosa se procese de manera estable y previene la pesadez estomacal.
   *   Subir escaleras, levantarse del asiento cada 50 minutos y estirarse con suavidad.

---

## 8. Plan de Corrección Técnica de los 6 Bugs Detectados

### Bug 1: Predicado `isPhysiologicallyNormal` en `cortexController.js`
*   **Causa Raíz:** Línea 730 evalúa `if (st && st !== 'NORMAL' && st !== 'OPTIMAL' && st !== 'NORMALES')`. Cadenas de Electret como `"NORMAL (-)"` o `"NORMAL (+)"` evalúan como distintas a `"NORMAL"`, tratándolas como anomalías.
*   **Solución Técnica:** Crear un predicado unificado:
    ```javascript
    function isPhysiologicallyNormal(statusStr) {
        if (!statusStr) return true;
        const s = String(statusStr).trim().toUpperCase();
        return s === 'NORMAL' || s.startsWith('NORMAL') || s.startsWith('OPTIMAL') || 
               s.startsWith('OPTIMO') || s === 'NEGATIVO' || s === 'CONSERVADO' || s === 'HOMEOSTASIS';
    }
    ```
    Si `isPhysiologicallyNormal(st)` es verdadero, el marcador se descarta de la lista de anomalías.

### Bug 2: Eliminación del Bloque `else` en el Clasificador IFM de `cortexController.js`
*   **Causa Raíz:** Línea 752 tiene un bloque `else pushAnomaly('NODO_7_ESTRUCTURAL')` que atrapa cualquier marcador no identificado (pulmón, próstata, pesticidas, meridianos).
*   **Solución Técnica:**
    1. Eliminar el `else` general.
    2. Enrutar marcadores residuales a una lista de *telemetría general secundaria* sin contaminar el Nodo 7 ni la síntesis del paciente.
    3. Acotar el Nodo 7 estrictamente a palabras clave musculoesqueléticas y de tejido conectivo (`COLAGENO`, `HUESO`, `ARTICUL`, `MUSCUL`, `CARTILAG`, `LIGAMENT`, `OSTEOP`, `FASCIA`).

### Bug 3: Reparación de Expresiones Regulares y Corrupción Léxica
*   **Causa Raíz:** Sustituciones de subcadenas descontroladas (ej. reemplazar `vas` por `vías` o `vaso` dentro de palabras compuestas transformó `Cardiovascular` en `Cardiovíascular`, `vasos` en `víasos`, `corazón` en `coraízon`).
*   **Solución Técnica:**
    - Usar límites de palabra explícitos (`\b`) en todas las expresiones regulares de reemplazo.
    - Sanitizador directo de cadenas corruptas heredadas de bases de datos o snapshots:
      ```javascript
      function sanitizeCorruptedMedicalText(text) {
          if (!text) return '';
          return String(text)
              .replace(/Cardiov[íi]asculares/gi, 'Cardiovasculares')
              .replace(/Cardiov[íi]ascular/gi, 'Cardiovascular')
              .replace(/cerebrov[íi]ascular/gi, 'cerebrovascular')
              .replace(/v[íi]aso/gi, 'vaso')
              .replace(/Cora[íi]zon/gi, 'Corazón')
              .replace(/cora[íi]zon/gi, 'corazón')
              .replace(/Est•ndar/gi, 'Estándar')
              .replace(/P•rdida/gi, 'Pérdida')
              .replace(/oxidaci•n/gi, 'oxidación')
              .replace(/•/g, '•');
      }
      ```

### Bug 4: Erradicación del Icono Pediátrico `🧸` y Jerga Atlética
*   **Causa Raíz:** En `TabDiagnosis.jsx` (línea 1008 y 1014), el icono `🧸` se renderizaba como fallback de actividad física independientemente de la edad del paciente.
*   **Solución Técnica:**
    - Si el paciente tiene 18 años o más, el icono se sustituye por `🚶‍♂️` (Movilidad y Actividad Física) o `🏃`.
    - Sanitización del texto de recomendaciones: reemplazar `NEAT`, `RIR >= 3-4` y `Zona 5 HIIT` por descripciones en español cotidiano.

### Bug 5: Sincronización Horaria Circadiana
*   En `buildOrthomolecularPrescription` de `cortexController.js`, en lugar de horas militares fijas como `04:00 hrs`, asignar descriptores biológicos:
    - Toma 1: `"Al despertar (en ayunas)"`
    - Toma 2: `"A media mañana (11:00 hrs)"`
    - Toma 3: `"A media tarde (17:30 hrs)"`
    - Toma 4: `"30 a 60 min antes de dormir"`

---

## 9. Prototipo Comparativo: "Antes vs. Después"

A continuación se muestra el contraste real entre la experiencia anterior y la nueva redacción propuesta para el paciente **Francisco Rojas Sosa (Cita #21117)**:

### 🔴 ANTES (Salida Cruda y Desbordada Anterior):
```markdown
❌ NODO 7 ESTRUCTURAL:
Correlación clínica en Integridad Estructural compatible con Examen médico general [CIE-10: Z00.0]. 
Se documentan 149 biomarcadores/signos fuera de rango fisiológico: 
COEFICIENTE_DE_SECRECION_DE_PEPSINA (61.016 (Ref: N/A | NORMAL (-))); 
INDICE_DE_REABSORCION_DE_AGUA_TUBULAR_RENAL (4.088 (Ref: N/A | NORMAL (-))); 
CONTENIDO_DE_AGUA_PULMONAR (38.163 (Ref: N/A | NORMAL (-))); 
GRADO_DE_CALCIFICACION_DE_LA_PROSTATA (0.163 (Ref: N/A | NORMAL (-))); 
SUPERVIVENCIA_DEL_ESPERMA (0.612 (Ref: N/A | NORMAL (-))); 
MERIDIANO_DE_PULMON (1.189 (Ref: N/A | NORMAL (-))); 
RESIDUO_DE_PESTICIDA (0.125 (Ref: N/A | NORMAL (-)));
... [142 marcadores más sin saltos de línea] ...

🧸 Pilar 03 - Juegos y Movimiento Adaptado:
Se establece restricción de Zona 5 HIIT por compromiso en cardiovíascular. 
Mantener NEAT alto con caminata y RIR >= 3-4 para evitar estrés endotelial.

Horario de Suplementación:
• Toma 1: 33Plus (04:00 hrs)
• Toma 2: 34Plus (21:30 hrs) en 🍵
```

---

### 🟢 DESPUÉS (Nueva Experiencia Empática y Pedagógica):
```markdown
================================================================================
  🌱 TU GUÍA DE BIENESTAR Y CUIDADO CELULAR
  Ecosistema T.I.L.O. | Equipo en Acción®
================================================================================
👤 Paciente: Francisco Rojas Sosa
📋 Expediente / Cita: #21117
📅 Fecha de Evaluación: 10 de Noviembre de 2026

Hola Francisco,
Hemos completado el análisis integral de tu salud combinando tu historial clínico, 
tu estilo de vida y las mediciones de tus pruebas de bienestar. 

Organizamos tus resultados en 5 sistemas sencillos para que conozcas con exactitud 
cómo está funcionando tu cuerpo hoy y qué pasos prácticos daremos juntos:

--------------------------------------------------------------------------------
1. TU CIRCULACIÓN Y ENERGÍA 🫀⚡
--------------------------------------------------------------------------------
¿Qué observamos en tu evaluación?
• Tus vasos sanguíneos muestran señales de esfuerzo y reactividad elevada ante el estrés.
• Tus células tienen una capacidad de producción de energía que se beneficiará de mayor 
  soporte antioxidante.

¿Qué significa en palabras sencillas?
• Imagina tus arterias como una red de mangueras de riego: hoy la presión de agua está un 
  poco alta y las paredes necesitan recuperar su flexibilidad y descanso natural.
• Para cuidar tu corazón, tu plan incluye caminata diaria tranquila y evita esfuerzos 
  agotadores o entrenamientos extenuantes mientras normalizamos tu circulación.

--------------------------------------------------------------------------------
2. TU DIGESTIÓN Y ABSORCIÓN 🥗🌱
--------------------------------------------------------------------------------
¿Qué observamos en tu evaluación?
• Tu barrera intestinal muestra señales de irritación y sobrecarga digestiva.

¿Qué significa en palabras sencillas?
• Tu intestino es como la aduana de tu cuerpo: debe dejar pasar solo los nutrientes buenos y 
  frenar las toxinas. Cuando se inflama, te sientes más pesado y absorbes menos energía.
• Con un descanso de alimentos irritantes y nutrición limpia, sellaremos nuevamente esa 
  barrera protectora.

--------------------------------------------------------------------------------
3. TUS FILTROS NATURALES: HÍGADO Y RIÑONES 💧🛡️
--------------------------------------------------------------------------------
¿Qué observamos en tu evaluación?
• Tu hígado y tus riñones están realizando un esfuerzo extra para procesar los residuos de 
  tu día a día.

¿Qué significa en palabras sencillas?
• Tus filtros están trabajando a buen ritmo, pero acumulan cansancio. Una hidratación 
  constante y una reducción de grasas pesadas les permitirán limpiarse y operar con total 
  ligereza.

--------------------------------------------------------------------------------
4. TUS DEFENSAS Y DESCANSO 🛡️🌙
--------------------------------------------------------------------------------
¿Qué observamos en tu evaluación?
• Tu sistema inmunológico está en alerta activa y tu recuperación nocturna necesita ser más 
  profunda.

¿Qué significa en palabras sencillas?
• Cuando el cuerpo pasa el día en tensión, las noches no alcanzan para reparar los tejidos. 
  Apoyaremos tu reloj biológico para que logres un descanso verdaderamente reparador.

--------------------------------------------------------------------------------
5. TUS HUESOS, MÚSCULOS Y ARTICULACIONES 🦴💪
--------------------------------------------------------------------------------
¿Qué observamos en tu evaluación?
• Estructura articular y muscular en estado conservado. 

¿Qué significa en palabras sencillas?
• Tu armazón físico tiene buena base; mantendremos tus articulaciones lubricadas y tus 
  músculos nutridos con aminoácidos y colágeno para que te muevas con ligereza.

================================================================================
  💊 TU PROTOCOLO DE NUTRICIÓN CELULAR DE PRECISIÓN
================================================================================
Tus fórmulas son aliadas de nutrición avanzada que ayudan a tus células a funcionar mejor.
Están sincronizadas con el ritmo natural de tu cuerpo:

🔴 33Plus® (Tu chispa de energía matutina y claridad mental):
   • Toma 1: Al despertar en ayunas, disuelto en tu primer vaso de agua.
   • Toma 2: A media mañana (alrededor de las 11:00 hrs).
   * Propósito: Despierta las baterías de tus células para que tengas energía constante 
     sin fatiga ni necesidad de exceso de café.

🟢 34Plus® (Tu arquitecto nocturno de reparación y descanso):
   • Toma Principal: 30 a 60 minutos antes de acostarte a dormir.
   * Regla de Oro: Disolver en UN VASO CON MÍNIMO 500 ML DE AGUA NATURAL 💧.
   * Propósito: Trabaja mientras duermes reparando tu mucosa digestiva, lubricando tus 
     articulaciones y favoreciendo un descanso profundo.

================================================================================
  🏡 TUS TAREAS INMEDIATAS EN CASA (HÁBITOS PRÁCTICOS)
================================================================================
1. En tu Cocina:
   • 0 Picante y salsas ácidas durante los primeros 28 días (tu estómago lo agradecerá).
   • 0 Carne de cerdo y embutidos (favorece pescado blanco, pollo o caldos vegetales).
   • Sustituye refrescos y pan dulce por agua natural o agua con rodajas de limón/pepino.

2. En tu Rutina Diaria:
   • Camina de 10 a 15 minutos a paso suave después de comer o cenar (caminata digestiva).
   • Bebe agua en pequeños sorbos a lo largo del día; evita tomar vasos gigantes durante la comida.
   • Apaga pantallas 30 minutos antes de dormir para preparar a tu mente para el descanso.

================================================================================
  🔬 [ACORDEÓN SECUNDARIO: VER RESPALDO TÉCNICO PARA PROFESIONALES DE LA SALUD]
================================================================================
(Haga clic para desplegar los 7 Nodos IFM, biomarcadores cuantitativos con rangos y 
códigos CIE-10 para auditoría médica NOM-004)
```

---

## 10. Hoja de Ruta de Implementación Segura

Una vez aprobada esta propuesta por el Director Andrés Trejo, la implementación se ejecutará en 3 etapas estrictamente controladas:

1. **Etapa 1: Backend (`server/controllers/cortexController.js`)**
   - Incorporar `isPhysiologicallyNormal()`.
   - Eliminar el bloque `else pushAnomaly('NODO_7_ESTRUCTURAL')`.
   - Limpiar el generador de `summary` para no concatenar 149 anomalías en texto plano.
   - Reemplazar horarios militares por momentos circadianos amigables.
2. **Etapa 2: Componentes Frontend (`Fase19_DiagnosticoIntegral.jsx` & `TabDiagnosis.jsx`)**
   - Integrar el interruptor "Modo Paciente" vs "Modo Médico".
   - Aplicar el sanitizador léxico (`Cardiovascular`, `Corazón`, `Estándar`, `Pérdida`, `oxidación`).
   - Reemplazar el icono de osito `🧸` por `🚶‍♂️` en perfiles adultos.
   - Reemplazar el icono `🍵` por `💧` en 34Plus®.
   - Mover el desglose técnico al acordeón secundario de divulgación progresiva.
3. **Etapa 3: Exportador al Portapapeles (`formatPlanForClipboard.js`)**
   - Generar el texto formateado en dos modalidades (Copia para el Paciente vs. Copia para el Expediente Médico).

---
*Fin de la Propuesta EGM — Lista para revisión y retroalimentación del Director.*
