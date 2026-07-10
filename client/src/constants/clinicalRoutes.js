/* eslint-disable no-unused-vars */
export const ROUTE_CATEGORIES = [
  { id: 'CAT_A', nombre: 'A. Ciclo de Vida' },
  { id: 'CAT_B', nombre: 'B. Composición Corporal' },
  { id: 'CAT_C', nombre: 'C. Especialidad' },
  { id: 'CAT_D', nombre: 'D. Rutas de Seguridad y Accesibilidad' }
];

const isFemale = (sex) => {
    if (typeof sex === 'undefined' || sex === null) return false;
    const s = String(sex).trim().toUpperCase();
    return ['F', 'FEMALE', 'FEMENINO', 'MUJER', '2', 'M'].includes(s);
};
const isMale = (sex) => {
    if (typeof sex === 'undefined' || sex === null) return false;
    const s = String(sex).trim().toUpperCase();
    return ['M', 'MALE', 'MASCULINO', 'HOMBRE', '1', 'H'].includes(s);
};

export const CLINICAL_ROUTES = [
  // ==========================================
  // A. CICLO DE VIDA
  // ==========================================
  {
    id: "ROUTE_PEDIATRIA",
    categoryId: "CAT_A",
    nombre: "Pediatría",
    normas_involucradas: ["NOM-031", "NOM-043"],
    flags: ["Z_SCORE_ENGINE", "CEPHALIC_PERIMETER", "PREVENTIVE_HEALTH_ALERT"],
    prompt_tilo: "Paciente pediátrico. Desactiva cálculo de IMC y activa motor de variables 'Z-Scores de la OMS'. Perímetro cefálico mandatorio en menores de 2 años. Validar vacunación.",
    fases_requeridas_extra: ["HITOS_DESARROLLO"],
    icon: "Baby",
    hard_lock: (age, sex) => age < 18,
    visibilidad_prose: "Visible solo para menores de 18 años. Oculto para adultos."
  },
  {
    id: "ROUTE_EMBARAZO",
    categoryId: "CAT_A",
    nombre: "Embarazo",
    normas_involucradas: ["NOM-007", "NOM-043"],
    flags: ["ADDON_CALORICO_T2_T3", "BLOCK_KETO", "PREECLAMPSIA_WATCH"],
    prompt_tilo: "Protocolo Materno-Fetal. Inyecta el add-on calórico según trimestre de gestación (+340 kcal T2 / +450 kcal T3). Se deshabilitan dietas keto/ayuno en Fase 13. Cuidado con preeclampsia en toma de T.A.",
    fases_requeridas_extra: ["SEMANAS_GESTACION"],
    icon: "Baby",
    hard_lock: (age, sex) => isFemale(sex) && age >= 12 && age <= 50,
    visibilidad_prose: "Visible solo para mujeres de 12 a 50 años. Oculto para hombres, niñas < 12 y mujeres > 50."
  },
  {
    id: "ROUTE_MENOPAUSIA",
    categoryId: "CAT_A",
    nombre: "Climaterio",
    normas_involucradas: ["NOM-043"],
    flags: ["METABOLIC_SYNDROME_WATCH", "BONE_HEALTH_CARD", "RESTRICT_FE_WITHOUT_ANEMIA"],
    prompt_tilo: "Endocrinología Femenina en perimenopausia/post. Si perímetro cintura > 88cm, alerta de síndrome metabólico. Bloquea suplementos de hierro a menos que haya anemia. Activa tarjeta de Salud Ósea deportiva.",
    fases_requeridas_extra: ["HISTORIAL_MENSTRUAL"],
    icon: "Flower",
    hard_lock: (age, sex) => isFemale(sex) && age >= 40,
    visibilidad_prose: "Visible solo para mujeres de 40 años o más. Oculto para hombres y mujeres < 40."
  },
  {
    id: "ROUTE_GERIATRIA",
    categoryId: "CAT_A",
    nombre: "Adulto Mayor",
    normas_involucradas: ["NOM-043"],
    flags: ["MNA_PRELOAD", "CAREGIVER_MODE", "CALF_CIRCUMFERENCE_MANDATORY"],
    prompt_tilo: "Protocolo Geriátrico. Activa la pre-carga del MNA. Si hay dependencia, activa 'Modo Cuidador'. Medición de circunferencia de pantorrilla (<31 cm = Sarcopenia) obligatoria. Refuerza hidratación.",
    fases_requeridas_extra: ["MINI_NUTRITIONAL_ASSESSMENT"],
    icon: "Users",
    hard_lock: (age, sex) => age >= 60,
    visibilidad_prose: "Visible solo para personas de 60 años o más. Oculto para menores de 60."
  },

  // ==========================================
  // B. METABÓLICA
  // ==========================================
  {
    id: "ROUTE_BAJAR_PESO",
    categoryId: "CAT_B",
    nombre: "Bajar de Peso",
    normas_involucradas: ["NOM-043", "NOM-008"],
    flags: ["METABOLIC_RISK", "MANDATORY_WAIST_CIRCUMFERENCE", "BLOCK_NATURAL_STIMULANTS_IF_HISTORY"],
    prompt_tilo: "El paciente busca Bajar de Peso. El cálculo de IMC será automático en Fase 16. La circunferencia de cintura es obligatoria (>80cm M o >90cm H dispara RIESGO_METABOLICO_ALTO). Si hay historial de anorexigénicos, bloquea estimulantes.",
    fases_requeridas_extra: ["METRICAS_AVANZADAS"],
    icon: "TrendingDown",
    hard_lock: (age, sex) => age >= 12,
    visibilidad_prose: "Visible solo para mayores de 12 años. Oculto para neonatos y niños pequeños."
  },
  {
    id: "ROUTE_GANAR_MUSCULO",
    categoryId: "CAT_B",
    nombre: "Ganar Músculo",
    normas_involucradas: ["NOM-043"],
    flags: ["ATHLETE_VIBE", "CUNNINGHAM_KATCH_MCARDLE", "FFM_PRIMARY_KPI", "ALERTA_PROTECCIÓN_HEPÁTICA_RENAL"],
    prompt_tilo: "Optimización deportiva y ganancia muscular. Usa modo 'Athlete Vibe'. El IMC pasa a segundo plano; prioriza la Masa Libre de Grasa (FFM). Atento a uso de SARMs/Esteroides para disparar alerta hepática/renal.",
    fases_requeridas_extra: ["PERFIL_ENTRENAMIENTO", "PLIEGUES_CUTANEOS"],
    icon: "Dumbbell",
    hard_lock: (age, sex) => age >= 15,
    visibilidad_prose: "Visible solo para personas de 15 años o más. Oculto para infancia temprana."
  },
  {
    id: "ROUTE_BIOHACKING",
    categoryId: "CAT_B",
    nombre: "Biohacking",
    normas_involucradas: ["NOM-043"],
    flags: ["DARK_CLINICAL_PRO", "PHASE_ANGLE_MANDATORY", "NAD_PRECURSORS"],
    prompt_tilo: "Protocolo Longevity. Tema UI Dark Clinical Pro. Ángulo de Fase y Viscosidad Sanguínea obligatorios en HW Electret. Pre-carga lista de labs (PCR-us, HbA1c, Insulina). Prioriza precursores de NAD+ y antioxidantes.",
    fases_requeridas_extra: ["METRICAS_WEARABLES"],
    icon: "Zap",
    hard_lock: (age, sex) => age >= 18,
    visibilidad_prose: "Visible solo para adultos (18+). Oculto para todos los menores de edad."
  },

  // ==========================================
  // C. ESPECIALIDAD
  // ==========================================
  {
    id: "ROUTE_CONTROL_CLINICO",
    categoryId: "CAT_C",
    nombre: "Control Metabólico / Clínico",
    normas_involucradas: ["NOM-043", "NOM-015"],
    flags: ["METABOLIC_CONTROL", "GLYCEMIC_INDEX_TRACKER"],
    prompt_tilo: "Protocolo de Control Clínico para enfermedades crónico-degenerativas (Diabetes, Dislipidemias). Enfoque estricto en estabilidad glucémica e índice glucémico.",
    fases_requeridas_extra: ["PERFIL_BIOQUIMICO"],
    icon: "HeartPulse",
    hard_lock: (age, sex) => age >= 18,
    visibilidad_prose: "Visible solo para adultos mayores de 18 años."
  },
  {
    id: "ROUTE_CARDIOVASCULAR",
    categoryId: "CAT_C",
    nombre: "Salud Cardiovascular / HTA",
    normas_involucradas: ["NOM-030", "NOM-043"],
    flags: ["DASH_DIET_PROTOCOL", "SODIUM_RESTRICTION", "HYPERTENSION_WATCH"],
    prompt_tilo: "Protocolo de Riesgo Cardiovascular. Implementa Dieta DASH estricta y restricción de Sodio (<1500mg). Monitoreo constante de Tensión Arterial y vigilancia de síntomas como cefaleas o tinnitus.",
    fases_requeridas_extra: ["MONITOREO_PRESION_ARTERIAL"],
    icon: "Activity",
    hard_lock: (age, sex) => age >= 18,
    visibilidad_prose: "Visible solo para adultos mayores de 18 años."
  },
  {
    id: "ROUTE_RENAL",
    categoryId: "CAT_C",
    nombre: "Salud Renal",
    normas_involucradas: ["NOM-043", "NOM-004"],
    flags: ["BLOCK_MACRO_K_P", "CKD_EPI_ACTIVE", "DRY_WEIGHT_CAPTURE"],
    prompt_tilo: "Protocolo Renal Crítico. MÁXIMA ALERTA MACRO. Bloquea recetas ricas en Potasio y Fósforo. Habilita el cálculo CKD-EPI y la captura de 'Peso Seco'.",
    fases_requeridas_extra: ["FILTRADO_GLOMERULAR"],
    icon: "Activity",
    hard_lock: (age, sex) => true,
    visibilidad_prose: "Acceso Universal. Visible para todas las edades y sexos."
  },
  {
    id: "ROUTE_HORMONAL",
    categoryId: "CAT_C",
    nombre: "Salud Hormonal",
    normas_involucradas: ["NOM-043"],
    flags: ["ENDOCRINE_WATCH", "PCOS_PROTOCOL"],
    prompt_tilo: "Enfoque clínico en balance endocrino (SOP, Tiroidopatías, Resistencia a la Insulina). Vigilar estatus de cortisol e inflamación de bajo grado.",
    fases_requeridas_extra: ["PERFIL_TIROIDEO"],
    icon: "HeartPulse",
    hard_lock: (age, sex) => isFemale(sex) && age >= 12,
    visibilidad_prose: "Visible solo para mujeres de 12 años o más. Oculto para hombres y niñas < 12."
  },
  {
    id: "ROUTE_PROSTATA",
    categoryId: "CAT_C",
    nombre: "Salud Prostática",
    normas_involucradas: ["NOM-043"],
    flags: ["PROSTATE_WATCH", "LYCOPENE_FOCUS"],
    prompt_tilo: "Enfermedades prostáticas (HPB, Prostatitis) y prevención. Incrementar sugerencias de Zinc, Selenio y Licopeno. Evitar exceso de lácteos y grasas saturadas.",
    fases_requeridas_extra: ["ANTIGENO_PROSTATICO"],
    icon: "Activity",
    hard_lock: (age, sex) => isMale(sex) && age >= 40,
    visibilidad_prose: "Visible solo para hombres de 40 años o más. Oculto para mujeres y hombres < 40."
  },
  {
    id: "ROUTE_TCA",
    categoryId: "CAT_C",
    nombre: "TCA (Conducta)",
    normas_involucradas: ["NOM-025", "NOM-043", "LFPDPPP"],
    flags: ["TCA_PROTOCOL", "HIDE_WEIGHT", "HIDE_CALORIES", "HIGH_VULNERABILITY"],
    prompt_tilo: "ALERTA TCA. Activa el protocolo ciego ('display_weight: false', 'display_calories: false'). Elimina opciones restrictivas en Fase 13; solo intercambios o alimentación consciente. Derivación psicológica obligatoria ante 'palabras de culpa'.",
    fases_requeridas_extra: ["HISTORIAL_PSICOLOGICO"],
    icon: "Brain",
    hard_lock: (age, sex) => age >= 10,
    visibilidad_prose: "Visible solo para personas de 10 años o más. Oculto para primera infancia."
  },
  {
    id: "ROUTE_BARIATRIA",
    categoryId: "CAT_C",
    nombre: "Bariátrica / Quirúrgico",
    normas_involucradas: ["NOM-043", "NOM-008"],
    flags: ["TEXTURE_ENGINE_ACTIVE", "MALABSORPTION_PROTOCOL", "CARB_RESTRICTION_STRICT"],
    prompt_tilo: "Fase Post-operatoria Bariátrica. Aplica el bloqueo físico de texturas según los días post-op (líquidos, purés). Activa protocolo agresivo de malabsorción (B12, Fe, Whey). Restricción estricta de carbohidratos en caso de Síndrome de Dumping.",
    fases_requeridas_extra: ["CRONOLOGIA_CIRUGIA"],
    icon: "Scissors",
    hard_lock: (age, sex) => true,
    visibilidad_prose: "Acceso Universal."
  },
  {
    id: "ROUTE_ONCOLOGIA",
    categoryId: "CAT_C",
    nombre: "Oncología Nutricional",
    normas_involucradas: ["NOM-043", "NOM-004"],
    flags: ["PROTEIN_SURGE", "SOFT_DIET_ONLY", "CACHEXIA_RISK_HIGH", "DRUG_NUTRIENT_INTERACTION"],
    prompt_tilo: "Protocolo Oncológico. Rango proteico inicial de 1.2 a 1.5 g/kg. Si hay Mucositis reportada, pasa a dieta suave libre de irritantes. SafetyEngine debe pre-procesar toxicidades cruzadas Fármaco-Suplemento.",
    fases_requeridas_extra: ["HISTORIAL_TRATAMIENTOS_ACTIVOS"],
    icon: "ShieldAlert",
    hard_lock: (age, sex) => true,
    visibilidad_prose: "Acceso Universal."
  },
  {
    id: "ROUTE_VIH",
    categoryId: "CAT_C",
    nombre: "VIH e Inmunodeficiencias",
    normas_involucradas: ["NOM-043", "LFPDPPP"],
    flags: ["SUPER_PRIVACY_PROTOCOL", "HYDROLYZED_FORMULAS", "WASTING_SYNDROME_RISK"],
    prompt_tilo: "Protocolo Inmunonutricional. Activa SÚPER PRIVACIDAD (Encriptación de campos visible como [REDACTED]). Incremento calórico del 10% al 30%. Bloquea enzimas que interactúen con fármacos TARV (ej. Hierba de San Juan).",
    fases_requeridas_extra: ["CARGA_VIRAL_CD4_OPCIONAL"],
    icon: "HeartPulse",
    hard_lock: (age, sex) => true,
    visibilidad_prose: "Acceso Universal."
  },
  {
    id: "ROUTE_PALIATIVOS",
    categoryId: "CAT_C",
    nombre: "Cuidados Paliativos",
    normas_involucradas: ["NOM-043"],
    flags: ["CONFORT_MODE", "HIDE_BIOMETRICS", "HYDRATION_SPRAYS_OR_ICE"],
    prompt_tilo: "Modo de Cuidado Paliativo y Confort. Desactiva cálculos de IMC, déficit calórico o metas visuales estresantes. Cambia nomenclatura de 'Menú' a 'Sugerencias de Confort'. Si barrera es 'Boca Seca', activa hidratación perioral en rocíos o hielos.",
    fases_requeridas_extra: ["REGISTRO_CONFORT"],
    icon: "Heart",
    hard_lock: (age, sex) => true,
    visibilidad_prose: "Acceso Universal."
  },

  // ==========================================
  // D. SEGURIDAD Y ACCESIBILIDAD
  // ==========================================
  {
    id: "ROUTE_ALERGIAS",
    categoryId: "CAT_D",
    nombre: "Alergias Graves (Protocolo Anafilaxia)",
    normas_involucradas: ["NOM-051", "NOM-043"],
    flags: ["PHYSICAL_FILTER_RECIPES", "ANAFILAXIA_RISK_MAX", "SAFE_SEAL_REQUIRED"],
    prompt_tilo: "Filtro Físico Anti-Anafilaxia en CORTEX_RECIPES. Si detecta NOM-051, desaparecen de la interfaz sin opción a sustitución. Si el modelo NLP lee 'choque' o 'asfixia', genera alerta máxima. Exige el Sello de Seguridad en UI.",
    fases_requeridas_extra: ["PANEL_ALERGENOS"],
    icon: "Siren",
    hard_lock: (age, sex) => true,
    visibilidad_prose: "Acceso Universal."
  },
  {
    id: "ROUTE_ADICCIONES",
    categoryId: "CAT_D",
    nombre: "Adicciones y Sustancias",
    normas_involucradas: ["NOM-028", "NOM-043"],
    flags: ["PHARMOCOKINETIC_CROSSING", "BLOCK_STIMULANTS", "AGGRESSIVE_FLUSH"],
    prompt_tilo: "Programa de Rehabilitación vs Fármacos. Cruce imperativo del consumo contra medicamentos activos (Ej. riesog acidosis). Si consumo estimulante, bloquea energizantes en Fase 20 (taurina, guaraná, cafeína).",
    fases_requeridas_extra: ["HISTORIAL_CONSUMO"],
    icon: "PillDrop",
    hard_lock: (age, sex) => true,
    visibilidad_prose: "Acceso Universal."
  },
  {
    id: "ROUTE_DISCAPACIDAD",
    categoryId: "CAT_D",
    nombre: "Discapacidad y Rehabilitación",
    normas_involucradas: ["NOM-043", "WCAG 2.2"],
    flags: ["INDIRECT_ANTHROPOMETRY", "TEE_DISABILITY_FACTOR", "HIGH_CONTRAST_ACCESSIBILITY"],
    prompt_tilo: "Atención especializada y Accesibilidad Total. Si 'standing_capacity = FALSE', sustituye captura de Estatura Real por Altura de Rodilla/Media Brazada (Ecuaciones de Chumlea). Activa el motor WCAG 2.2 y contrastes altos en Stitch.",
    fases_requeridas_extra: ["ANTROPOMETRIA_INDIRECTA"],
    icon: "PersonStanding",
    hard_lock: (age, sex) => true,
    visibilidad_prose: "Acceso Universal."
  }
];

export const getRouteById = (id) => CLINICAL_ROUTES.find(route => route.id === id);

export const getFlagsForRoutes = (routeIds = []) => {
    let allFlags = new Set();
    routeIds.forEach(id => {
        const route = getRouteById(id);
        if(route && route.flags){
            route.flags.forEach(flag => allFlags.add(flag));
        }
    });
    return Array.from(allFlags);
};
