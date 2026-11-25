import {
  resolvePatientFriendlyGuide,
  sanitizeClinicalSpanish,
  translateLogisticsProfile,
  resolveMetabolicAgeStudySSoT,
  resolveNom004IdentificationSheet,
  resolveScheduledAppointmentSummary
} from './patientGuideAdapter.js';
import { FORMULA_33PLUS, FORMULA_34PLUS } from './pharmacopeiaCatalogSSoT.js';

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function computeDeterministicSha256Hex(asciiInput = '') {
  try {
    const bytes = new TextEncoder().encode(String(asciiInput || ''));
    const bitLen = bytes.length * 8;
    const totalLen = (((bytes.length + 9 + 63) >> 6) << 6);
    const buf = new Uint8Array(totalLen);
    buf.set(bytes);
    buf[bytes.length] = 0x80;
    const view = new DataView(buf.buffer);
    view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
    view.setUint32(totalLen - 4, bitLen >>> 0, false);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));

    for (let i = 0; i < totalLen; i += 64) {
      for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false);
      for (let j = 16; j < 64; j++) {
        const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let j = 0; j < 64; j++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + SHA256_K[j] + w[j]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map((v) => v.toString(16).padStart(8, '0')).join('');
  } catch (_) {
    return '';
  }
}

export function resolveDossierSealSha256(patientData = {}, folio = '') {
  const persisted = String(
    patientData?.clinical_dossier?.dossier_seal_sha256 ||
    patientData?.clinical_dossier?.audit_sha256 ||
    ''
  ).trim();
  if (/^[a-f0-9]{64}$/i.test(persisted)) return persisted.toLowerCase();
  const seed = JSON.stringify({
    folio: String(folio || ''),
    diag: patientData?.clinical_dossier?.human_approved_diagnosis || patientData?.clinical_dossier?.preliminary_diagnosis || [],
    mgmt: patientData?.clinical_dossier?.human_approved_management || patientData?.clinical_dossier?.suggested_management || []
  });
  return computeDeterministicSha256Hex(seed);
}

/**
 * Copia texto al portapapeles de forma defensiva (Clipboard API + fallback <textarea> execCommand)
 * previniendo cualquier excepción no controlada o bloqueo de permisos del navegador.
 */
export async function safeCopyTextToClipboard(rawText) {
  const text = String(rawText || '');
  if (!text) return false;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (clipErr) {
    console.warn('⚠️ [Clipboard API Fallback]:', clipErr?.message || clipErr);
  }

  try {
    if (typeof document !== 'undefined') {
      const tempArea = document.createElement('textarea');
      tempArea.value = text;
      tempArea.setAttribute('readonly', '');
      tempArea.style.position = 'fixed';
      tempArea.style.top = '-9999px';
      tempArea.style.left = '-9999px';
      tempArea.style.opacity = '0';
      document.body.appendChild(tempArea);
      tempArea.focus();
      tempArea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(tempArea);
      return Boolean(ok);
    }
  } catch (fallbackErr) {
    console.warn('⚠️ [Clipboard execCommand Fallback Error]:', fallbackErr?.message || fallbackErr);
  }

  return false;
}

/**
 * Verifica de forma estricta (NOM-004 Fail-Closed) que el expediente cuente con una
 * síntesis diagnóstica real antes de autorizar cualquier exportación al portapapeles.
 */
export function hasSynthesizedClinicalDossier(patientData) {
  const dossier = patientData?.clinical_dossier;
  if (!dossier || typeof dossier !== 'object') return false;
  const hasNodes = Array.isArray(dossier.ifm_nodes_matrix) && dossier.ifm_nodes_matrix.length > 0;
  const hasDiag =
    (Array.isArray(dossier.human_approved_diagnosis) && dossier.human_approved_diagnosis.length > 0) ||
    (Array.isArray(dossier.preliminary_diagnosis) && dossier.preliminary_diagnosis.length > 0) ||
    Boolean(dossier.diagnostico_causa_raiz);
  return hasNodes && (hasDiag || Boolean(dossier.orthomolecular_prescription));
}

export function resolveCanonicalClipboardIdentity(patientData, citationId = null) {
  const pInfo = patientData?.identityLock?.patientInfo;
  const composedIdentName = [
    patientData?.identificacion?.nombre,
    patientData?.identificacion?.apellidoPaterno,
    patientData?.identificacion?.apellidoMaterno
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');

  const rawNameCandidates = [
    pInfo?.full_name,
    pInfo?.name,
    patientData?.profile?.name,
    patientData?.identificacion?.nombreCompleto,
    composedIdentName,
    patientData?.fullName,
    patientData?.identificacion?.nombre,
    pInfo?.first_name
  ];

  let nombrePaciente = '';
  for (const candidate of rawNameCandidates) {
    const clean = sanitizeClinicalSpanish(String(candidate || '').trim());
    if (clean && !/^(paciente|null|undefined|s\/n|---)$/i.test(clean)) {
      nombrePaciente = clean;
      break;
    }
  }

  const rawFolioCandidates = [
    citationId,
    patientData?.profile?.citationId,
    patientData?.profile?.citaId,
    patientData?.identificacion?.idCita,
    patientData?.identificacion?.citaId,
    patientData?.identificacion?.folio,
    patientData?.citationId,
    patientData?.citaId,
    patientData?.idCita
  ];

  let folio = '';
  for (const raw of rawFolioCandidates) {
    if (raw === null || raw === undefined) continue;
    const str = String(raw).replace(/^#/, '').trim();
    if (str && str !== '0' && !/^(null|undefined|s\/f|---)$/i.test(str)) {
      folio = str;
      break;
    }
  }

  return { nombrePaciente, folio };
}

/**
 * Utilitario SSoTT v2.8.4 (Fail-Closed) para formatear el Expediente Clínico NOM-004
 * o la Guía Empática del Paciente a texto plano estructurado.
 */
export const formatPlanForClipboard = function (options) {
  if (
    arguments.length !== 1 ||
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    ('clinical_dossier' in options && !('patientData' in options))
  ) {
    throw new Error(
      '[SSoTT FAIL-CLOSED] formatPlanForClipboard exige un único objeto nombrado { patientData, citationId, viewMode }.'
    );
  }

  const {
    patientData,
    citationId,
    cleanDiagnoses,
    cleanManagement,
    viewMode = 'patient'
  } = options;

  if (!patientData || typeof patientData !== 'object' || !hasSynthesizedClinicalDossier(patientData)) {
    throw new Error(
      '[SSoTT FAIL-CLOSED] Expediente clínico no sintetizado o ausente; exportación abortada por bioseguridad NOM-004.'
    );
  }

  const { nombrePaciente, folio } = resolveCanonicalClipboardIdentity(patientData, citationId);
  if (!nombrePaciente || !folio) {
    throw new Error(
      '[SSoTT FAIL-CLOSED] Identidad del titular o folio de cita incompleto; se prohíbe exportar #S/F o plantillas anónimas.'
    );
  }

  const fecha = new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (viewMode === 'patient') {
    const guide = resolvePatientFriendlyGuide(patientData);
    const sem = guide.biosecuritySemaphore || {};
    const uiLabels = guide.uiLabels || {};
    const semLevel = sem.level || sem.color;
    if (!semLevel || !['ROJO', 'AMARILLO', 'VERDE'].includes(semLevel)) {
      throw new Error('[SSoTT FAIL-CLOSED] Semáforo de bioseguridad ausente o inválido en la Guía del Paciente.');
    }
    const semIcon = semLevel === 'ROJO' ? '🔴' : semLevel === 'AMARILLO' ? '🟡' : '🟢';
    const patientLineLabel = uiLabels.clipboardPatientLabel || (guide.isTutorMode ? 'Paciente (Atención a Madre/Padre/Tutor):' : 'Paciente:');

    let text = `==================================================\n`;
    text += `  🌱 GUÍA DE SALUD Y BIENESTAR - ECOSISTEMA T.I.L.O.\n`;
    text += `==================================================\n`;
    text += `📅 Fecha: ${fecha}\n`;
    text += `👤 ${patientLineLabel} ${nombrePaciente}\n`;
    text += `📋 Cita / Folio: #${folio}\n`;
    text += `--------------------------------------------------\n\n`;

    text += `${guide.greetingTitle}\n`;
    text += `${guide.empatheticLead}\n\n`;

    text += `${semIcon} SEMÁFORO DE BIOSEGURIDAD: ${sem.badgeLabel || 'Vía Libre Biosegura'}\n`;
    text += `   ${sem.honestExplanation || ''}\n`;
    if (Array.isArray(sem.recommendedLabs) && sem.recommendedLabs.length > 0) {
      text += `   🔬 Estudios sugeridos de acompañamiento: ${sem.recommendedLabs.join(' • ')}\n`;
    }
    if (guide.calciumAlertText) {
      text += `   🛡️ Cuidado mineral: ${guide.calciumAlertText}\n`;
    }
    text += `\n`;

    const metPatient = guide.metabolicAgeStudy || resolveMetabolicAgeStudySSoT(patientData);
    if (metPatient && !metPatient.isSuppressedBySafetyGate && metPatient.metabolicAge !== null && metPatient.metabolicAge !== undefined) {
      const exactAge = metPatient.metabolicAgeExact ?? metPatient.metabolicAge;
      const deltaVal = Number(metPatient.deltaYears ?? 0);
      const deltaFmt = deltaVal > 0 ? `+${deltaVal}` : `${deltaVal}`;
      text += `⏱️ ESTUDIO DE EDAD METABÓLICA (${metPatient.evidenceTierBadge || 'Certeza Clínica'}):\n`;
      text += `   • Edad Cronológica: ${metPatient.chronologicalAge} años | Edad Metabólica Actual: ${exactAge} años (${deltaFmt} años)\n`;
      text += `   • Meta Ciclo 1 (28 Días): ${metPatient.cycle1TargetAge28d} años (${metPatient.cycle1Delta28d} años) | Proyección a 90 Días: ${metPatient.cycle3ProjectionAge90d} años\n`;
      if (metPatient.patientSummary) {
        text += `   • Lectura integral: ${metPatient.patientSummary}\n`;
      }
      text += `\n`;
    } else if (metPatient && metPatient.isSuppressedBySafetyGate && metPatient.suppressionReasonText) {
      text += `🛡️ ENFOQUE CLÍNICO PROTECTOR:\n`;
      text += `   • ${metPatient.suppressionReasonText}\n\n`;
    }

    text += `1. 💓 ${uiLabels.clipboardSystemsHeading || 'SUS 5 SISTEMAS DE SALUD EN PALABRAS SENCILLAS'}:\n`;
    (guide.fiveSystems || []).forEach((sys) => {
      const statusDot = sys.status === 'ATENCION_PRIORITARIA' ? '🔴' : sys.status === 'VIGILANCIA_PREVENTIVA' ? '🟡' : '🟢';
      text += `   ${statusDot} ${sys.title} (${sys.statusLabel}):\n`;
      text += `      • Qué observamos: ${sys.whatWeObserved}\n`;
      text += `      • Qué significa: ${sys.whatItMeans}\n`;
    });
    text += `\n`;

    text += `2. ⚡💧 ${uiLabels.clipboardAlliesHeading || 'SUS ALIADOS NUTRICIONALES Y HORARIOS ADAPTADOS A SU DÍA'}:\n`;
    if (semLevel === 'ROJO' || sem.isPaused) {
      text += `   • Pausa Preventiva Médica (0 sobres activos): ${uiLabels.redPauseBody || 'Por precaución clínica, aún no iniciaremos sobres de suplementación. Siga hoy mismo su guía de alimentación protectora e hidratación natural mientras revisamos sus estudios con su médico.'}\n`;
    } else {
      (guide.circadianSchedule || []).forEach((slot, idx) => {
        const rawFormula = String(slot.formula || '');
        const rawDosage = String(slot.dosage || '');
        const week1Segment = rawDosage.split('•')[0] || '';
        const hasActiveSachetWeek1 = /\b(?:1|2|1\/2|1\/4|medio|cuarto|un)\s+sobres?\b/i.test(week1Segment);
        const isWaterOnlyWeek1 = Boolean(
          slot.isPaused ||
          (!hasActiveSachetWeek1 && (
            /(?:hidrataci[óo]n|agua\s+simple|agua\s+natural\s+purificada)/i.test(rawFormula) ||
            /(?:iniciar\s+solo\s+con\s+agua|solo\s+(?:con\s+)?agua\s+(?:natural|simple)|hidrataci[óo]n\s+preparatoria|pausa\s+preventiva|0\s+sobres\s+activos)/i.test(week1Segment)
          ))
        );
        const icon = isWaterOnlyWeek1 ? '💧' : (rawFormula.includes('33') ? '⚡' : '💧');
        const displayFormula = isWaterOnlyWeek1 && rawFormula.includes('33')
          ? '💧 Hidratación Preparatoria (Semana 1 — previo a 33Plus® en Semana 2)'
          : rawFormula;
        const slotName = slot.tomaNumber ? `Toma ${slot.tomaNumber}` : `Toma ${idx + 1}`;
        text += `   • ${icon} ${slotName} (${slot.timeSlot}) — ${displayFormula}: ${rawDosage}.\n`;
        if (slot.patientObjective) {
          text += `     Propósito: ${slot.patientObjective}\n`;
        }
      });
    }
    if (sem.ethicalNote) {
      text += `   ℹ️ Compromiso ético: ${sem.ethicalNote}\n`;
    }
    text += `\n`;

    const action = guide.homeActionPlan || {};
    const nut = action.protective_nutrition || {};
    const hyd = action.smart_hydration || {};
    const mov = action.gentle_movement || {};
    const movEmoji = mov.isPediatric ? '👶' : '🚶';
    const isMeaningfulExclusion = (val) => {
      const clean = String(val || '').trim();
      if (!clean) return false;
      return !/^(ninguna?|ninguno|niega|negad[oa]s?|n\/a|na|sin\s+alergias?|sin\s+exclusiones?|sin\s+restricciones?|no|no\s+refiere|null|undefined|-+)$/i.test(clean);
    };
    const rules = [
      ...(Array.isArray(nut.universalRules) ? nut.universalRules : []),
      ...(Array.isArray(nut.personalExclusions) ? nut.personalExclusions.filter(isMeaningfulExclusion).map(e => `Evitar: ${e}`) : [])
    ];

    text += `3. 🥗 ${nut.title || 'ALIMENTACIÓN PROTECTORA EN CASA'}:\n`;
    text += `   ${nut.summary || ''}\n`;
    if (rules.length > 0) {
      text += `   Reglas clave: ${rules.join(' | ')}\n`;
    }
    if (guide.logisticsSummary) {
      text += `   Logística en casa: ${guide.logisticsSummary.operationalSummary || `${guide.logisticsSummary.venueLabel} | Preparación de alimentos: ${guide.logisticsSummary.cookLabel}`}\n`;
    }
    text += `\n`;

    text += `4. 💧 ${hyd.title || 'HIDRATACIÓN INTELIGENTE'} (${hyd.litersPerDay ? `${hyd.litersPerDay} L/día` : '2.0 L/día'}):\n`;
    text += `   ${hyd.summary || ''}\n`;
    if (hyd.keyRule34Plus) {
      text += `   Importante: ${hyd.keyRule34Plus}\n`;
    }
    text += `\n`;

    text += `5. ${movEmoji} ${mov.title || 'MOVIMIENTO COTIDIANO SEGURO'}:\n`;
    text += `   ${mov.summary || ''}\n`;
    if (mov.sleepHabit) {
      text += `   🌙 Descanso: ${mov.sleepHabit}\n`;
    }
    text += `\n`;

    const apptPatient = guide.scheduledAppointmentSummary || resolveScheduledAppointmentSummary(patientData);
    const sealShaPatient = resolveDossierSealSha256(patientData, folio);
    if (apptPatient?.formattedLine) {
      text += `6. 📅 PRÓXIMA CITA DE EVALUACIÓN Y SEGUIMIENTO:\n`;
      text += `   • ${apptPatient.formattedLine}\n\n`;
    }

    text += `--------------------------------------------------\n`;
    if (sealShaPatient) {
      text += `🔒 Sello de Integridad NOM-004 (SHA-256): ${sealShaPatient}\n`;
    }
    text += `✨ Equipo en Acción® y Ecosistema T.I.L.O. (Visión 2030 • Expediente NOM-004)\n`;
    text += `==================================================\n`;

    return text.replace(/\s*&\s*/g, ' y ').trim();
  }

  // --- VISTA MÉDICA (NOM-004 — SSoTT v3.2) ---
  const dossier = patientData?.clinical_dossier || {};
  const canonicalPlan = dossier?.canonical_clinical_plan || dossier?.therapeutic_contract || dossier?.orthomolecular_prescription?.therapeutic_contract || {};
  const ortho = dossier?.orthomolecular_prescription || {};
  const bio = dossier?.bioenergetics || ortho?.bioenergetics_summary || {};
  const sem = dossier?.biosecurity_semaphore || ortho?.biosecurity_semaphore || {};
  const macros = canonicalPlan?.macros || bio?.macros || { carbs: 40, protein: 30, fat: 30 };
  const isKetoRegimen = Number(macros.carbs) > 0 && Number(macros.carbs) <= 15;
  const dynamicRegimenBadge = sanitizeClinicalSpanish(
    canonicalPlan?.regimenBadge ||
    ortho?.dietaryPlan?.regimenBadge ||
    (isKetoRegimen
      ? 'NutriKeto Clínico (0 Picante • 0 Cerdo • 0 Azúcares)'
      : 'Alimentación Antiinflamatoria (0 Picante • 0 Cerdo • 0 Azúcares)')
  );
  const weightForWater = Number(bio?.weightKg) > 0 ? Number(bio.weightKg) : 70;
  const hydrationLiters = Number(canonicalPlan?.hydrationTargetLiters || ortho?.hydrationTargetLiters) > 0
    ? Number(canonicalPlan?.hydrationTargetLiters || ortho?.hydrationTargetLiters)
    : Math.min(3.2, Math.max(1.8, Number(((weightForWater * 32) / 1000).toFixed(1))));
  const personalExclList = Array.isArray(canonicalPlan?.patientSpecificExclusions)
    ? canonicalPlan.patientSpecificExclusions
    : (Array.isArray(ortho?.dietaryPlan?.patientSpecificExclusions) ? ortho.dietaryPlan.patientSpecificExclusions : []);

  const effectiveDiagnoses = Array.isArray(cleanDiagnoses) && cleanDiagnoses.length > 0
    ? cleanDiagnoses
    : (Array.isArray(dossier.human_approved_diagnosis) && dossier.human_approved_diagnosis.length > 0
      ? dossier.human_approved_diagnosis
      : (Array.isArray(dossier.preliminary_diagnosis) ? dossier.preliminary_diagnosis : []));

  const effectiveManagement = Array.isArray(cleanManagement) && cleanManagement.length > 0
    ? cleanManagement
    : (Array.isArray(dossier.human_approved_management) && dossier.human_approved_management.length > 0
      ? dossier.human_approved_management
      : (Array.isArray(dossier.suggested_management) ? dossier.suggested_management : []));

  let text = `==================================================\n`;
  text += `  EXPEDIENTE CLÍNICO CONSOLIDADO - ECOSISTEMA T.I.L.O. (NOM-004)\n`;
  text += `==================================================\n`;
  text += `Fecha: ${fecha}\n`;
  text += `Paciente: ${nombrePaciente}\n`;
  text += `Folio de Cita: #${folio}\n`;
  text += `--------------------------------------------------\n\n`;

  const normalizeFormalClinicalField = (rawStr) =>
    sanitizeClinicalSpanish(rawStr || '')
      .replace(/\(\s*null\s*\)/giu, '')
      .replace(/\[\s*⚠️?\s*REQUIERE_REVISI[ÓO]N\s*\]/giu, '')
      .replace(/\(Matriz IFM SSoTT v2\.[45678]\)/giu, '(Matriz IFM SSoTT v3.2)')
      .replace(/\[Readaptaci[óo]n F[íi]sica\]/giu, '[Readaptación Biomecánica y Prescripción de Movimiento]')
      .replace(/6,000[–-]8,000\s*pasos\/d[íi]a/giu, '6\u00A0000 a 8\u00A0000 pasos/día')
      .replace(/1\/2\s+sobre\s*\(5\s*g\)\s+de\s+33Plus®/giu, `1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus®`)
      .replace(/1\/2\s+sobre\s*\(5\s*g\)\s+de\s+34Plus®/giu, `1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus®`)
      .replace(/\btus\s+laboratorios\b/giu, 'sus estudios de laboratorio')
      .replace(/\btu\s+cuerpo\b/giu, 'su organismo')
      .replace(/\bantes\s+de\s+acostarte\b/giu, 'antes de dormir')
      .replace(/\bcuando\s+te\s+levantas\b/giu, 'al despertar')
      .replace(/(?<![\p{L}\p{N}_])hidrata(?=\s+(?:tus|sus|el|la|los|las)\b)/giu, (m) => (m[0] === 'H' ? 'Hidrate' : 'hidrate'))
      .replace(/(?<![\p{L}\p{N}_])t[óo]malo(?![\p{L}\p{N}_])/giu, (m) => (m[0] === 'T' ? 'Tómelo' : 'tómelo'))
      .replace(/(?<![\p{L}\p{N}_])t[óo]mala(?![\p{L}\p{N}_])/giu, (m) => (m[0] === 'T' ? 'Tómela' : 'tómela'))
      .replace(/(?<![\p{L}\p{N}_])disu[ée]lvelo(?![\p{L}\p{N}_])/giu, (m) => (m[0] === 'D' ? 'Disuélvalo' : 'disuélvalo'))
      .replace(/(?<![\p{L}\p{N}_])tus(?=\s+\p{L})/giu, (m) => (m[0] === 'T' ? 'Sus' : 'sus'))
      .replace(/(?<![\p{L}\p{N}_])tu(?=\s+\p{L})/giu, (m) => (m[0] === 'T' ? 'Su' : 'su'))
      .replace(/\s*&\s*/gu, ' y ');

  const metStudy = resolveMetabolicAgeStudySSoT(patientData);
  const logistics = translateLogisticsProfile(patientData);
  const nom004Sheet = resolveNom004IdentificationSheet(patientData);
  const apptMedical = resolveScheduledAppointmentSummary(patientData);

  if (nom004Sheet) {
    text += `00. FICHA DE IDENTIFICACIÓN, ANTECEDENTES, SIGNOS VITALES Y SOMATOMETRÍA (NOM-004):\n`;
    const demoParts = [
      `Edad: ${nom004Sheet.ageYears} años`,
      `Sexo biológico: ${nom004Sheet.sexLabel}`,
      nom004Sheet.birthDate ? `Nacimiento: ${nom004Sheet.birthDate}` : null,
      nom004Sheet.curp ? `CURP: ${nom004Sheet.curp}` : null,
      `Altitud barométrica: ${sanitizeClinicalSpanish(nom004Sheet.altitudeLabel)}`
    ].filter(Boolean);
    text += `   • Demografía y Altitud: ${demoParts.join(' | ')}\n`;
    text += `   • Contacto de Emergencia: ${sanitizeClinicalSpanish(nom004Sheet.emergencyContactText)} | Motivo Primario: ${sanitizeClinicalSpanish(nom004Sheet.primaryMotive)}\n`;
    text += `   • Antecedentes Heredofamiliares (AHF): ${sanitizeClinicalSpanish(nom004Sheet.ahfText)}\n`;
    text += `   • Antecedentes Personales y Quirúrgicos: ${sanitizeClinicalSpanish(nom004Sheet.appText)} | Cirugías previas: ${sanitizeClinicalSpanish(nom004Sheet.surgicalText)}\n`;
    text += `   • Inmunología, Farmacología y Fenotipo Digestivo: Alergias: ${sanitizeClinicalSpanish(nom004Sheet.allergiesText)} | Fármacos activos: ${sanitizeClinicalSpanish(nom004Sheet.medicationsText)} | Suplementación previa: ${sanitizeClinicalSpanish(nom004Sheet.priorSupplementsText)} | Digestivo: ${sanitizeClinicalSpanish(nom004Sheet.digestivePhenotypeText)}\n`;
    text += `   • Signos Vitales (Fase 17): ${sanitizeClinicalSpanish(nom004Sheet.vitals?.summaryLine || '')}\n`;
    text += `   • Somatometría Física (Fase 16): ${sanitizeClinicalSpanish(nom004Sheet.somatometry?.summaryLine || '')}\n\n`;
  }

  if (sem?.level || ortho?.has_calcium_contraction_lock || metStudy) {
    text += `0. BIOSEGURIDAD, SALVAGUARDAS Y PARACLÍNICOS DE CONTROL:\n`;
    if (sem?.level) {
      text += `   • Semáforo (${sanitizeClinicalSpanish(sem.level)}): ${sanitizeClinicalSpanish(sem.badgeLabel || '')} — ${normalizeFormalClinicalField(sem.titrationPlanText || '')}\n`;
    }
    if (metStudy) {
      if (metStudy.isSuppressedBySafetyGate) {
        text += `   • Estudio de Edad Metabólica (Compuerta Protectora Activa): ${normalizeFormalClinicalField(metStudy.suppressionReasonText || 'Comparativa punitiva suprimida por ruta clínica sensible.')}\n`;
      } else if (metStudy.metabolicAge !== null && metStudy.metabolicAge !== undefined) {
        const exactAge = metStudy.metabolicAgeExact ?? metStudy.metabolicAge;
        const deltaVal = Number(metStudy.deltaYears ?? 0);
        const deltaFmt = deltaVal > 0 ? `+${deltaVal}` : `${deltaVal}`;
        text += `   • Estudio Multivariable de Edad Metabólica (${sanitizeClinicalSpanish(metStudy.evidenceTierBadge || metStudy.evidenceTier)}): Edad Cronológica ${metStudy.chronologicalAge} años vs Edad Metabólica ${exactAge} años (Delta ${deltaFmt} años) | Meta Ciclo 1 (28d): ${metStudy.cycle1TargetAge28d} años (${metStudy.cycle1Delta28d} años) | Proyección Ciclo 3 (90d): ${metStudy.cycle3ProjectionAge90d} años.\n`;
      }
    }
    if (ortho?.has_calcium_contraction_lock) {
      const clinicalMineralSafeguard = ortho?.calcium_clinical_safeguard_text ||
        `Riesgo biofísico de calcificación ectópica: se excluye suplementación aislada con sales de calcio inorgánico; priorizar hidratación estructurada (${hydrationLiters} L/día), magnesio y vitamina K2 alimentaria.`;
      text += `   • Salvaguarda Mineral (Bloqueo de Calcio Exógeno): ${normalizeFormalClinicalField(clinicalMineralSafeguard)}\n`;
    }
    if (Array.isArray(sem?.recommendedLabs) && sem.recommendedLabs.length > 0) {
      text += `   • Estudios Paraclínicos Solicitados: ${sem.recommendedLabs.map(sanitizeClinicalSpanish).join(' | ')}\n`;
    }
    text += `\n`;
  }

  text += `1. DIAGNÓSTICOS CLÍNICOS APORTADOS (MATRIZ IFM DE 7 NODOS):\n`;
  if (effectiveDiagnoses.length > 0) {
    effectiveDiagnoses.forEach((d) => {
      const dStr = typeof d === 'object' ? (d.nombre || d.text || JSON.stringify(d)) : String(d);
      text += `   • ${normalizeFormalClinicalField(dStr)}\n`;
    });
  } else {
    text += `   • Homeostasis Metabólica General (Sin Alteraciones Agudas Registradas).\n`;
  }
  text += `\n`;

  text += `2. PRESCRIPCIÓN BIOENERGÉTICA Y CRONOBIOLOGÍA ORTOMOLECULAR (33Plus® y 34Plus®):\n`;
  if (bio?.targetKcal) {
    const exclSuffix = personalExclList.length > 0
      ? ` | Exclusiones personalizadas: ${personalExclList.map(sanitizeClinicalSpanish).join(', ')}`
      : '';
    text += `   • Régimen y Meta Energética: ${dynamicRegimenBadge} | Meta: ${bio.targetKcal} kcal/día (${macros.carbs}% Carbohidratos / ${macros.protein}% Proteínas / ${macros.fat}% Lípidos) | Hidratación Meta: ${hydrationLiters} L/día${exclSuffix}.\n`;
  }
  const normalizeCanonicalFormulaBrand = (raw = '') =>
    sanitizeClinicalSpanish(raw)
      .replace(/\b33\s*PLUS\s*®?/gi, '33Plus®')
      .replace(/\b34\s*PLUS\s*®?/gi, '34Plus®')
      .replace(/\b33Plus(?!®)\b/g, '33Plus®')
      .replace(/\b34Plus(?!®)\b/g, '34Plus®');

  const effectiveSups = Array.isArray(ortho?.supplements) ? ortho.supplements : [];
  if (effectiveSups.length > 0) {
    effectiveSups.forEach((s) => {
      const medTiming = s.clinical_timing || s.timing || '';
      text += `   • ${normalizeCanonicalFormulaBrand(s.name)}: ${sanitizeClinicalSpanish(s.dosage).replace(/🍵/g, '💧')} (${normalizeFormalClinicalField(medTiming)})\n`;
      if (s.rationale) text += `     Racional: ${normalizeFormalClinicalField(s.rationale)}\n`;
    });
  } else if (sem?.isPaused) {
    text += `   • 33Plus® y 34Plus®: 0 sobres activos (En pausa preventiva de bioseguridad hasta valoración médica de estudios de control).\n`;
  } else if (ortho?.titration_plan) {
    text += `   • Esquema de Titulación: ${normalizeFormalClinicalField(ortho.titration_plan)}\n`;
  }
  if (Array.isArray(ortho?.circadianSchedule) && ortho.circadianSchedule.length > 0) {
    text += `   • Horario Circadiano Clínico:\n`;
    ortho.circadianSchedule.forEach((slot, idx) => {
      const slotNum = slot.tomaNumber || (idx + 1);
      const rawFormula = sanitizeClinicalSpanish(slot.formula || '');
      const rawDosage = sanitizeClinicalSpanish(slot.dosage || '').replace(/🍵/g, '💧');
      const week1Segment = rawDosage.split('•')[0] || '';
      const hasActiveSachetWeek1 = /\b(?:1|2|1\/2|1\/4|medio|cuarto|un)\s+sobres?\b/i.test(week1Segment);
      const isWaterOnlyWeek1 = Boolean(
        slot.isPaused ||
        (!hasActiveSachetWeek1 && (
          /(?:hidrataci[óo]n|agua\s+simple|agua\s+natural\s+purificada)/i.test(rawFormula) ||
          /(?:iniciar\s+solo\s+con\s+(?:300\s*ml\s+de\s+)?agua|solo\s+(?:con\s+)?agua\s+(?:natural|simple)|hidrataci[óo]n\s+preparatoria|pausa\s+preventiva|0\s+sobres\s+activos)/i.test(week1Segment)
        ))
      );
      const displayFormula = isWaterOnlyWeek1 && rawFormula.includes('33') && !/hidrataci[óo]n\s+preparatoria/i.test(rawFormula)
        ? '💧 Hidratación Preparatoria (Agua Simple en Semana 1)'
        : rawFormula;
      text += `     - Toma ${slotNum} [${sanitizeClinicalSpanish(slot.timeSlot)}]: ${displayFormula} — ${rawDosage}\n`;
    });
  }
  text += `\n`;

  text += `3. RECOMENDACIONES Y MANEJO CLÍNICO DINÁMICO (CDSS — SSoTT):\n`;
  if (effectiveManagement.length > 0) {
    effectiveManagement.forEach((m) => {
      const mStr = typeof m === 'object' ? (m.accion || m.text || JSON.stringify(m)) : String(m);
      text += `   • ${normalizeFormalClinicalField(mStr)}\n`;
    });
  } else {
    text += `   • Sin Indicaciones de Manejo Especial Adicionales.\n`;
  }
  text += `\n`;

  const isSel33Paused = Boolean(canonicalPlan?.isSelective33Paused || sem?.isSelective33Paused) && !sem?.isPaused;
  const defaultPhases = [
    {
      rangeLabel: 'Días 1 a 7',
      weekLabel: 'Semana 1',
      title: sem?.isPaused
        ? 'Estabilización Inicial y Pausa Preventiva de Suplementación'
        : isSel33Paused
          ? 'Pausa Selectiva de 33Plus® y Reparación Nocturna Gradual con 34Plus®'
          : (sem?.isMicroDose ? 'Adaptación Mucosa y Micro-Dosis Calibrada' : 'Sincronización Circadiana y Sellado de Barrera Mucosa'),
      description: sem?.isPaused
        ? `Alimentación antiinflamatoria (${bio?.targetKcal || 2000} kcal/día), hidratación (${hydrationLiters} L/día) y estudios de control (0 sobres activos).`
        : isSel33Paused
          ? `Sellado epitelial (0 Picante, 0 Cerdo, 0 Azúcares), hidratación (${hydrationLiters} L/día), 0 sobres activos de 33Plus® (pausa selectiva) y micro-dosis de 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® nocturno en mínimo 500 ml de agua simple 💧.`
          : (sem?.isMicroDose
            ? `Sellado epitelial (0 Picante, 0 Cerdo, 0 Azúcares), hidratación (${hydrationLiters} L/día) y micro-dosis de 1/2 sobre (${FORMULA_33PLUS.halfSachetGramsDisplay}) de 33Plus® matutino y 1/2 sobre (${FORMULA_34PLUS.halfSachetGramsDisplay}) de 34Plus® nocturno en mínimo 500 ml de agua simple 💧.`
            : `Integración alimentaria (${bio?.targetKcal || 2000} kcal/día), hidratación (${hydrationLiters} L/día) y protocolo completo de 33Plus® y 34Plus®.`)
    },
    {
      rangeLabel: 'Días 8 a 21',
      weekLabel: 'Semanas 2-3',
      title: sem?.isMicroDose ? 'Escalamiento Gradual según Tolerancia y Modulación Metabólica' : 'Modulación Metabólica, Vascular y Reparación Tisular',
      description: 'Valoración de tolerancia digestiva y renal a partir del Día 8, optimizando sensibilidad metabólica y oxigenación microvascular.'
    },
    {
      rangeLabel: 'Días 22 a 28',
      weekLabel: 'Semana 4',
      title: 'Consolidación Funcional y Re-Evaluación Comparativa (T0 → T1)',
      description: 'Auditoría comparativa de bioseñales y estudios paraclínicos al cierre del ciclo de 28 días.'
    }
  ];
  const phases = Array.isArray(ortho?.evolutionTimeline?.phases) && ortho.evolutionTimeline.phases.length > 0
    ? ortho.evolutionTimeline.phases
    : defaultPhases;
  const timelineSummary = sanitizeClinicalSpanish(
    ortho?.evolutionTimeline?.summaryLabel ||
    '28 Días de seguimiento continuo (Fase 1: Días 1–7 • Fase 2: Días 8–21 • Fase 3: Días 22–28)'
  );

  const sealShaMedical = resolveDossierSealSha256(patientData, folio);
  text += `4. SECUENCIACIÓN TERAPÉUTICA (CICLO DE 28 DÍAS), LOGÍSTICA Y SEGUIMIENTO:\n`;
  phases.forEach((p, idx) => {
    text += `   • Fase ${p.phase || (idx + 1)} (${sanitizeClinicalSpanish(p.rangeLabel)} • ${sanitizeClinicalSpanish(p.weekLabel)} — ${sanitizeClinicalSpanish(p.title)}): ${sanitizeClinicalSpanish(p.description)}\n`;
  });
  text += `   • Logística Operativa: ${logistics.operationalSummary || `Entorno Principal: ${logistics.venueLabel} | Preparación de Alimentos: ${logistics.cookLabel}`}\n`;
  text += `   • Ruta de Evolución: ${timelineSummary}.\n`;
  if (apptMedical?.formattedLine) {
    text += `   • Próxima Cita Programada (Fase 21): ${apptMedical.formattedLine}.\n`;
  }
  if (sealShaMedical) {
    text += `   • Huella de Integridad Criptográfica NOM-004 (SHA-256): ${sealShaMedical}\n`;
  }
  text += `\n==================================================\n`;

  return text.replace(/\s*&\s*/g, ' y ').trim();
};

/**
 * Despachador Único de Copiado SSoTT v2.8.4 (Fail-Closed NOM-004).
 * Reutilizado de manera idéntica por App.jsx, Fase20_Portapapeles.jsx y TabDiagnosis.jsx.
 */
export async function copySSoTDocument(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || ('clinical_dossier' in options && !('patientData' in options))) {
    return {
      ok: false,
      reason: 'INVALID_SIGNATURE',
      viewMode: 'patient',
      folio: '',
      patientName: '',
      formatted: ''
    };
  }

  const { patientData, citationId = null, viewMode = 'patient' } = options;
  const normalizedMode = viewMode === 'medical' ? 'medical' : 'patient';

  if (!hasSynthesizedClinicalDossier(patientData)) {
    return {
      ok: false,
      reason: 'MISSING_CLINICAL_DOSSIER',
      viewMode: normalizedMode,
      folio: '',
      patientName: '',
      formatted: ''
    };
  }

  const { nombrePaciente, folio } = resolveCanonicalClipboardIdentity(patientData, citationId);
  if (!nombrePaciente || !folio) {
    return {
      ok: false,
      reason: 'INCOMPLETE_IDENTITY',
      viewMode: normalizedMode,
      folio: folio || '',
      patientName: nombrePaciente || '',
      formatted: ''
    };
  }

  let formatted = '';
  try {
    formatted = formatPlanForClipboard({
      patientData,
      citationId: folio,
      viewMode: normalizedMode
    });
  } catch (fmtErr) {
    console.error('⚠️ [SSoTT Clipboard Fail-Closed]:', fmtErr?.message || fmtErr);
    return {
      ok: false,
      reason: 'FORMAT_ERROR',
      viewMode: normalizedMode,
      folio,
      patientName: nombrePaciente,
      formatted: ''
    };
  }

  const copied = await safeCopyTextToClipboard(formatted);
  return {
    ok: copied,
    reason: copied ? null : 'CLIPBOARD_BLOCKED',
    viewMode: normalizedMode,
    folio,
    patientName: nombrePaciente,
    formatted
  };
}
