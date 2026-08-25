/**
 * Utilitario para formatear el expediente clínico de Fase 20 a texto plano estructurado
 * para copiarlo limpiamente al portapapeles.
 */
export const formatPlanForClipboard = ({ patientData, citationId, cleanDiagnoses, sups, cleanManagement, viewMode = 'patient', guiaPaciente }) => {
  const fecha = new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const pInfo = patientData?.identityLock?.patientInfo;
  const nombrePaciente = pInfo?.first_name || pInfo?.name || patientData?.identificacion?.nombre || patientData?.fullName || 'Paciente';
  const folio = citationId || patientData?.identificacion?.folio || '15000';
  const isMinor = (pInfo?.age !== undefined && pInfo?.age < 18) || patientData?.isLactante || patientData?.isPediatrico;

  if (viewMode === 'patient') {
    let text = `==================================================\n`;
    text += `  🌱 PLAN DE BIENESTAR Y CUIDADOS - ECOSISTEMA T.I.L.O.\n`;
    text += `==================================================\n`;
    text += `📅 Fecha: ${fecha}\n`;
    text += `👤 ${isMinor ? 'Paciente (Tutor):' : 'Paciente:'} ${nombrePaciente}\n`;
    text += `📋 Cita / Folio: #${folio}\n`;
    text += `--------------------------------------------------\n\n`;

    const titulo = guiaPaciente?.titulo_resumen || (isMinor ? `🌱 El Crecimiento y Salud de ${nombrePaciente}` : `🌱 Tu Estado de Salud y Plan Metabólico`);
    const p1 = guiaPaciente?.pilar_salud_crecimiento || (isMinor ? `${nombrePaciente} se encuentra en una etapa hermosa de desarrollo acelerado con constantes vitales normales.` : 'Tu cuerpo se encuentra en un estado metabólico estable con parámetros ajustados a tus objetivos.');
    const p2 = guiaPaciente?.pilar_alimentacion_diaria || (isMinor ? 'Mantener la lactancia materna o fórmula de continuación como base principal, complementando con papillas caseras e introducción guiada de sólidos (BLW).' : 'Mantener alimentación equilibrada sin conteo calórico estricto, priorizando alimentos naturales e hidratación.');
    const p3 = guiaPaciente?.pilar_juegos_movimiento || (isMinor ? 'Estimulación psicomotriz diaria con juego libre, gateo activo y tiempo boca abajo (Tummy Time) para fortalecer articulaciones y postura.' : 'Actividad física constante con caminata diaria (NEAT) y ejercicio aeróbico adaptado a tu condición.');
    const p4 = guiaPaciente?.pilar_cuidados_suplementacion || (isMinor ? 'Monitoreo constante de crecimiento con su pediatra tratante. Las sugerencias nutricionales son orientativas bajo la NOM-043.' : 'Seguir los horarios de tomas diarias para optimizar tu energía diurna y descanso nocturno.');

    text += `${titulo.toUpperCase()}\n\n`;
    text += `1. 💓 ESTADO DE SALUD Y CRECIMIENTO:\n   ${p1}\n\n`;
    text += `2. 🥗 ALIMENTACIÓN Y GUÍA NUTRICIONAL:\n   ${p2}\n\n`;
    text += `3. 🧸 ACTIVIDADES Y MOVIMIENTO:\n   ${p3}\n\n`;
    text += `4. 💧 CUIDADOS Y SEGUIMIENTO:\n   ${p4}\n\n`;
    text += `--------------------------------------------------\n`;
    text += `✨ Equipo en Acción & Ecosistema T.I.L.O. (Visión 2030)\n`;
    text += `==================================================\n`;

    return text.trim();
  }

  // --- VISTA MÉDICA (NOM-004) ---
  let text = `==================================================\n`;
  text += `  EXPEDIENTE CLÍNICO CONSOLIDADO - ECOSISTEMA T.I.L.O. v2.1\n`;
  text += `==================================================\n`;
  text += `Fecha: ${fecha}\n`;
  text += `Paciente: ${nombrePaciente}\n`;
  text += `Folio de Cita: #${folio}\n`;
  text += `--------------------------------------------------\n\n`;

  text += `1. DIAGNÓSTICOS CLÍNICOS APORTADOS (MATRIZ IFM DE 7 NODOS):\n`;
  if (cleanDiagnoses && cleanDiagnoses.length > 0) {
    cleanDiagnoses.forEach((d) => {
      let dStr = typeof d === 'object' ? (d.nombre || d.text || JSON.stringify(d)) : String(d);
      text += `   • ${dStr}\n`;
    });
  } else {
    text += `   • Homeostasis Metabólica General (Sin Alteraciones Agudas Registradas).\n`;
  }
  text += `\n`;

  text += `2. PROTOCOLO DE SUPLEMENTACIÓN AVANZADA (33+ & 34+ CRONOBIOLÓGICO):\n`;
  if (sups && sups.length > 0) {
    sups.forEach((s) => {
      text += `   • ${s.name}: ${s.dosage} (${s.timing})\n`;
      if (s.rationale) text += `     Racional: ${s.rationale}\n`;
    });
  } else {
    text += `   • 33 PLUS (Ignición Mitocondrial): 1 toma por la mañana con primer alimento.\n`;
    text += `   • 34 PLUS (Ingeniería Tisular): 1 toma por la noche (1h antes de dormir) en MÍNIMO 500ml DE AGUA 💧.\n`;
  }
  text += `\n`;

  text += `3. RECOMENDACIONES Y MANEJO CLÍNICO DINÁMICO (CDSS):\n`;
  if (cleanManagement && cleanManagement.length > 0) {
    cleanManagement.forEach((m) => {
      let mStr = typeof m === 'object' ? (m.accion || m.text || JSON.stringify(m)) : String(m);
      text += `   • ${mStr}\n`;
    });
  } else {
    text += `   • Sin Indicaciones de Manejo Especial Adicionales.\n`;
  }
  text += `\n`;

  text += `4. LOGÍSTICA DE EJECUCIÓN:\n`;
  const env = patientData?.logistics_profile?.environment?.venue || 'HOME';
  const cook = patientData?.logistics_profile?.cook_type || 'SELF';
  const translateV = (v) => v === 'WORK' ? 'Oficina' : v === 'STREET' ? 'Calle' : 'Casa';
  const translateC = (c) => c === 'SELF' ? 'Propia' : c === 'FAMILY' ? 'Familiar' : 'Personal';
  text += `   • Entorno Principal: ${translateV(env)}\n`;
  text += `   • Preparación de Alimentos: ${translateC(cook)}\n`;
  text += `   • Ruta de Evolución: 28 Días de seguimiento continuo (Fases Calibradas).\n\n`;
  text += `==================================================\n`;

  return text.trim();
};
