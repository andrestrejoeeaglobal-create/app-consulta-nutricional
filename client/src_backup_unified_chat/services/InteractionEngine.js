// -----------------------------------------------------------------------
// MIDDLEWARE: CORTEX INTERACTION ENGINE (V2.0 - Standalone)
// -----------------------------------------------------------------------

/**
 * Checks for dangerous interactions between patient's medical history, habits, and new inputs.
 * 
 * @param {Object} patientData - The current patient data object.
 * @param {boolean} hasDrugs - Whether the user has reported drug use in the current context.
 * @param {string} drugName - The name of the drug reported, if applicable.
 * @returns {Object} - Result containing flags array and the critical flag (if any).
 */
export const checkInteractionsAndProceed = (patientData, hasDrugs, drugName = "") => {
  const meds = patientData?.history?.medications || [];
  const alcohol = patientData?.habits?.alcohol || { is_drinker: false, units_per_session: 0, calculated_weekly_calories: 0 };
  const drugs = hasDrugs ? drugName.toUpperCase() : "";

  const flags = [];

  // 1. PHENTERMINE + STIMULANTS (CRITICAL)
  const hasPhentermine = meds.some(m => m.name.toUpperCase().includes("FENTER") || m.name.toUpperCase().includes("PHENTER") || m.name.toUpperCase().includes("ACXION") || m.name.toUpperCase().includes("TERFAMEX"));
  const hasStimulants = drugs.includes("COCA") || drugs.includes("META") || drugs.includes("CRISTAL") || drugs.includes("ANFETA") || alcohol.calculated_weekly_calories > 2000; // alcohol abuse as proxy

  if (hasPhentermine && hasStimulants) {
    flags.push({
      severity: "CRITICAL",
      trigger_source_A: "FENTERMINA",
      trigger_source_B: drugs || "HIGH_ALCOHOL",
      risk_code: "RISK_CARDIOVASCULAR",
      user_message: "RIESGO CARDIOVASCULAR GRAVE: La combinación de Fentermina con estimulantes puede causar crisis hipertensiva o infarto."
    });
  }

  // 2. BENZOS/OPIOIDES + ALCOHOL (CRITICAL)
  const hasDowners = meds.some(m => m.name.toUpperCase().includes("CLONA") || m.name.toUpperCase().includes("DIAZE") || m.name.toUpperCase().includes("ALPRA") || m.name.toUpperCase().includes("TRAMA"));
  const hasAlcohol = alcohol.is_drinker && alcohol.units_per_session > 2;

  if (hasDowners && hasAlcohol) {
    flags.push({
      severity: "CRITICAL",
      trigger_source_A: "DEPRESOR_SNC",
      trigger_source_B: "ALCOHOL",
      risk_code: "RISK_RESPIRATORY",
      user_message: "RIESGO RESPIRATORIO: La mezcla de alcohol con este medicamento puede causar sedación extrema o paro respiratorio."
    });
  }

  // 3. SSRI + ALCOHOL (HIGH)
  const hasSSRI = meds.some(m => m.name.toUpperCase().includes("FLUOX") || m.name.toUpperCase().includes("SERTR") || m.name.toUpperCase().includes("ESCITA"));
  if (hasSSRI && (hasAlcohol || drugs)) {
    flags.push({
      severity: "HIGH",
      trigger_source_A: "ANTIDEPRESIVO",
      trigger_source_B: "ALCOHOL_DROGAS",
      risk_code: "RISK_SEROTONIN",
      user_message: "ADVERTENCIA: El alcohol anula el efecto del antidepresivo y empeora la depresión a largo plazo."
    });
  }

  // 4. METFORMIN + ALCOHOL (HIGH)
  const hasMetformin = meds.some(m => m.name.toUpperCase().includes("METFORM") || m.name.toUpperCase().includes("GLIBEN"));
  if (hasMetformin && alcohol.is_drinker) {
    flags.push({
      severity: "HIGH",
      trigger_source_A: "METFORMINA",
      trigger_source_B: "ALCOHOL",
      risk_code: "RISK_HYPOGLYCEMIA",
      user_message: "PRECAUCIÓN: El alcohol en ayuno con Metformina aumenta riesgo de hipoglucemia severa."
    });
  }

  const critical = flags.find(f => f.severity === "CRITICAL");

  return { flags, critical };
};
