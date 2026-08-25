/**
 * Utilitario para formatear la Programación de Periodización Celular de 28 Días
 * a texto plano para copiar al portapapeles.
 */
export const formatCalendarForClipboard = (calendarPhases, patientMetadata = {}) => {
  const age = patientMetadata.age !== undefined ? patientMetadata.age : (patientMetadata.edad !== undefined ? patientMetadata.edad : 30);
  const name = patientMetadata.nombre || patientMetadata.name || 'Paciente';
  const isLactante = age < 2 || patientMetadata.isLactante;
  const isJuvenilAdolescente = !isLactante && (age < 18 || patientMetadata.isPediatrico);
  const isGeriatric = age >= 65 || patientMetadata.isGeriatrico;

  if (isLactante) {
    return `
==================================================
  PROGRAMACIÓN DE DESARROLLO PEDIÁTRICO L-OMS (28 DÍAS)
==================================================
Paciente (Tutor): ${name} (${age < 1 ? 'Lactante - 11 meses' : `${age} años`})

FASE 1: Maduración Digestiva & Barrera Intestinal (Días 1-7)
- Estado Digestivo: ${calendarPhases?.fase1?.gut_lock_status || 'Preservación de Mucosa Intestinal Pediátrica'}
- Nutrición Pediátrica: ${calendarPhases?.fase1?.nutrition || 'Lactancia Materna / Fórmula Pediátrica + Ablactación Guiada'}
- Suplementación / Cuidados: ${calendarPhases?.fase1?.supplementation || 'Soporte Pediátrico bajo supervisión médica'}
- Estimulación Motora: ${calendarPhases?.fase1?.movement || 'Tiempo Boca Abajo (Tummy Time) + Movilización Pasiva'}

FASE 2: Diversificación Alimentaria & Tolerancia (Días 8-14)
- Nutrición Pediátrica: ${calendarPhases?.fase2?.nutrition || 'BLW / Purés caseros (Regla de 3 días por alimento)'}
- Estimulación Pediátrica: ${calendarPhases?.fase2?.zona2_range || 'Gateo Activo y Rodamientos Libres en Tapete'}
- Desarrollo Motor: ${calendarPhases?.fase2?.smr_status || 'Juego Libre e Interactivo'}

FASE 3: Neurodesarrollo & Coordinación Psicomotriz (Días 15-21)
- Nutrición Pediátrica: ${calendarPhases?.fase3?.nutrition || 'Proteínas Pediátricas Suaves + Leche Materna / Fórmula'}
- Coordinación Motora: ${calendarPhases?.fase3?.zona5_target || 'Juego de Coordinación Motora Fina'}
- Desarrollo Troncal: ${calendarPhases?.fase3?.strength || 'Favorecer Sedestación Independiente'}

FASE 4: Consolidación Ponderal L-OMS & Citas de Seguimiento (Días 22-28)
- Monitoreo L-OMS: ${calendarPhases?.fase4?.detox_status || 'Evaluación de Crecimiento Longitudinal (Peso/Talla)'}
- Seguimiento y Citas: ${calendarPhases?.fase4?.activity || 'Consolidación de 2-3 comidas complementarias + Consulta Pediátrica'}
==================================================
    `.trim();
  }

  if (isJuvenilAdolescente) {
    return `
==================================================
  PROGRAMACIÓN NUTRICIONAL Y DEPORTIVA JUVENIL (28 DÍAS)
==================================================
Paciente: ${name} (${age} años)

FASE 1: Soporte Óseo & Crecimiento Estatural (Días 1-7)
- Asimilación Digestiva: ${calendarPhases?.fase1?.gut_lock_status || 'Barrera Intestinal Juvenil Estable'}
- Nutrición para Crecimiento: ${calendarPhases?.fase1?.nutrition || 'Proteína Compleja, Calcio Fisiológico y Vitamina D3'}
- Suplementación: ${calendarPhases?.fase1?.supplementation || 'Multivitamínico Pediátrico / Juvenil Adaptado'}
- Actividad Física: ${calendarPhases?.fase1?.movement || 'Juegos Multideportivos y Calistenia Suave (30-45 min)'}

FASE 2: Energía Escolar & Densidad de Micronutrientes (Días 8-14)
- Nutrición Escolar: ${calendarPhases?.fase2?.nutrition || 'Snacks Escolares de alta densidad de micronutrientes'}
- Deporte Formativo: ${calendarPhases?.fase2?.zona2_range || 'Deporte Formativo y Recreativo (3-4 sesiones/semana)'}
- Movilidad: ${calendarPhases?.fase2?.smr_status || 'Estiramiento dinámico juvenil y movilidad articular'}

FASE 3: Habilidades Motoras & Coordinación Juvenil (Días 15-21)
- Soporte Proteico: ${calendarPhases?.fase3?.nutrition || 'Proteínas para crecimiento estatural y masa muscular en desarrollo'}
- Agilidad y Velocidad: ${calendarPhases?.fase3?.zona5_target || 'Juegos veloces, deportes en equipo y agilidad'}
- Autocarga Juvenil: ${calendarPhases?.fase3?.strength || 'Entrenamiento con peso corporal (Flexiones, Sentadillas, Saltos seguros)'}

FASE 4: Consolidación de Hábitos & Crecimiento Puberal (Días 22-28)
- Monitoreo de Desarrollo: ${calendarPhases?.fase4?.detox_status || 'Evaluación de curva de crecimiento puberal y masa magra'}
- Descarga Activa: ${calendarPhases?.fase4?.activity || 'Juegos libres y seguimiento ponderal pediátrico / hebiátrico'}
==================================================
    `.trim();
  }

  if (isGeriatric) {
    return `
==================================================
  PROGRAMACIÓN GERIÁTRICA Y PRESERVACIÓN FUNCIONAL (28 DÍAS)
==================================================
Paciente: ${name} (${age} años)

FASE 1: Estabilización Digestiva & Nutrición Antiinflamatoria (Días 1-7)
- Mucosa Digestiva: ${calendarPhases?.fase1?.gut_lock_status || 'Mucosa Digestiva Geriátrica Preservada'}
- Nutrición Geriátrica: ${calendarPhases?.fase1?.nutrition || 'Inmunointestinal Antiinflamatoria (Cero Gluten/Lácteos)'}
- Suplementación: ${calendarPhases?.fase1?.supplementation || 'Fórmulas 33+ / 34+ con dosificación geriátrica e hidratación segura'}
- Movilidad Adaptada: ${calendarPhases?.fase1?.movement || 'Caminatas ligeras postprandiales 10-15 min + Respiración diafragmática'}

FASE 2: Densidad Nutricional & Preservación Anti-Sarcopenia (Días 8-14)
- Nutrición: ${calendarPhases?.fase2?.nutrition || 'Framework 5x5x5 Geriátrico (Alimentos defensores suaves)'}
- Aeróbico Adaptado: ${calendarPhases?.fase2?.zona2_range || 'Movilidad aeróbica ligera 20-30 min'}
- Biomecánica: ${calendarPhases?.fase2?.smr_status || 'Movilización articular activa-asistida (Cero Foam Roller traumático)'}

FASE 3: Propiocepción, Equilibrio & Prevención de Caídas (Días 15-21)
- Proteína Anti-Sarcopenia: ${calendarPhases?.fase3?.nutrition || 'Proteína de alta biodisponibilidad fraccionada (1.0-1.2g/kg)'}
- Prevención de Caídas: ${calendarPhases?.fase3?.zona5_target || 'Apoyo monopodal asistido, Sit-to-Stand y equilibrio'}
- Fuerza Funcional: ${calendarPhases?.fase3?.strength || 'Trabajo con banda elástica o peso corporal suave'}

FASE 4: Consolidación de Vitalidad & Autonomía Funcional (Días 22-28)
- Soporte Fisiológico: ${calendarPhases?.fase4?.detox_status || 'Depuración hepato-renal suave con antioxidantes puros'}
- Autonomía & Citas: ${calendarPhases?.fase4?.activity || 'Evaluación de escala Barthel/Katz y seguimiento clínico'}
==================================================
    `.trim();
  }

  return `
==================================================
  PROGRAMACIÓN DE PERIODIZACIÓN CELULAR (28 DÍAS) - CORTEX v2.1
==================================================
Paciente: ${name} (${age} años)

FASE 1: Remodelación de Barrera & Estabilización de Membrana (Días 1-7)
- Estado Gut Lock: ${calendarPhases?.fase1?.gut_lock_status || 'Sellado de Barrera Activo'}
- Nutrición: ${calendarPhases?.fase1?.nutrition || 'Inmunointestinal (Cero Gluten/Lácteos)'}
- Suplementación: Fórmula 33+ (Mañana con alimentos) / Fórmula 34+ (Noche 60 min pre-sueño en MÍNIMO 500 ml de agua 💧)
- Movimiento: ${calendarPhases?.fase1?.movement || 'Caminatas postprandiales 20 min + Respiración diafragmática'}

FASE 2: Flexibilidad Metabólica & Sincronización de Ejes (Días 8-14)
- Nutrición: Framework 5x5x5 (Alimentos Defensores Dr. William Li sin conteo calórico)
- Cardio Zona 2: ${calendarPhases?.fase2?.zona2_range || '69-83% FCM / LTHR'}
- Biomecánica: Protocolo 3 Fases (${calendarPhases?.fase2?.smr_status || 'SMR (Foam Roller)'} -> Estiramiento miofascial dinámico)

FASE 3: Optimización del Exoesqueleto & Capacidad Aeróbica (Días 15-21)
- Nutrición: Protocolo Lyon 2.0 (>30g Proteína por comida / Umbral Leucina mTOR)
- HIIT Zona 5: ${calendarPhases?.fase3?.zona5_target || 'Intervalos 4x4 VO2 Máx'}
- Fuerza: Neuromuscular Multiarticular Compleja (RIR 1-2)

FASE 4: Depuración Celular & Supercompensación Fisiológica (Días 22-28)
- Detox Hepática / Quelación: ${calendarPhases?.fase4?.detox_status || '⚠️ RETENIDO'}
- Actividad: Tapering y Descarga Neuroendocrina (-40% a -50% Volumen)
==================================================
  `.trim();
};
