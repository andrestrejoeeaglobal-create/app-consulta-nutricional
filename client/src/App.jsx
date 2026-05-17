import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from 'axios';

// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from "framer-motion";
import { User, Lock, AlertCircle, Apple, Activity, FlaskConical, FileText, ClipboardList, Calendar, Utensils, Send, CreditCard, Sparkles, Check, Settings2, Baby, Zap } from "lucide-react";
import MedicalDashboard from "./components/MedicalDashboard"; // Re-enabled
import AvisoPrivacidad from "./components/AvisoPrivacidad";
import ReactMarkdown from "react-markdown"; // <--- Importamos ReactMarkdown
import tiloImg from "./assets/tilo.png"; // IMPORTAMOS A TILO ðŸ§©
// import { searchDrug, searchSupplement, checkInteractions, calibrateGutProtocol } from "./SafetyEngine"; // <--- Safety Engine V3.0 (Unused)
import LogoEABlanco from "./assets/LogoEABlanco.svg"; // <--- Logo Equipo en Acción Blanco
import Header from "./components/Header";
import Footer from "./components/Footer";
import { FooterLoader } from "./components/FooterLoader"; // V15.6 Footer Aislado
import { generateSecurityConstraints } from "./ClinicalRules"; // <--- Motor de Seguridad Cultural
import { cleanServerInfo, formatText, strictBooleanValidator, formatDateLong } from "./utils/utils"; // <--- SAFE-ID Utils
import useCitationValidation from "./hooks/useCitationValidation"; // <--- SAFE-ID Hook
import AntigravityCanvas from "./components/AntigravityCanvas"; // <--- Antigravity Physics Engine (Old)
import { AntigravityBlobs } from "./components/AntigravityBlobs"; // V15.6 Glow Blobs
import VisualIdentityCard from "./components/VisualIdentityCard"; // <--- V8.0 Visual Identity Card
import VisualBodyMap from "./components/VisualBodyMap"; // <--- V9.6 Visual Body Map
import useCortex from "./hooks/useCortex"; // <--- T.I.L.O Logical Engine
import SearchableVerticalMenu from "./components/ui/SearchableVerticalMenu"; // V8.0 Searchable Vertical Menu
import Fase3_MotivoConsulta from "./components/interview/Fase3_MotivoConsulta";
import Fase4_AntecedentesFamiliares from "./components/interview/Fase4_AntecedentesFamiliares";
import Fase5_EstiloVida from "./components/interview/Fase5_EstiloVida";
import Fase6_Farmacologia from "./components/interview/Fase6_Farmacologia";
import Fase7_Habitos from "./components/interview/Fase7_Habitos";

// 1. Función Auxiliar (Fuera del componente)
// 2. Calculadora de Edad Exacta
// 2. Calculadora de Edad Exacta (V6.6 Compatible DD/MMM/AAAA y DD/MM/AAAA)





// V7.1 Normalización Segura (Identity Lock)
const normalizeText = (text) => {
  if (!text) return "";
  return text.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// --- IDENTITY SECURITY: LEVENSHTEIN DISTANCE ---
const calculateLevenshtein = (a, b) => {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[a.length][b.length];
};

// --- FORMATTERS (Visual UX-06) ---





// --- NORMALIZACIÓN DE DATOS (BUG-DATA-02) ---
// Convierte "mo", "nel", "no" -> "Niega"
const normalizeInput = (text) => {
  if (!text) return "Niega";
  const lower = text.trim().toLowerCase();
  // Typos comunes y variantes de negación
  const negatives = ["no", "nop", "nel", "ninguno", "ninguna", "negativo", "mo" /* Typo común */, "na"];

  if (negatives.includes(lower)) return "Niega";
  // Si empieza con "no " (ej: "no tengo"), asumimos niega por ahora o dejamos el texto?
  // La instrucción dice: inputs sucios -> Niega.
  if (negatives.some(n => lower === n)) return "Niega";

  return formatText(text); // Capitalizar si es texto válido
};



// --- FFQ FLAG HELPER (V7.2 SCALAR SUPPORT) ---

// V10.5 HELPER: GENDER AGREEMENT ENGINE
// Returns the correct term based on biological sex
const getGenderedTerm = (term, sex) => {
  if (!sex) return term; // Fallback
  const lowerSex = sex.toLowerCase();
  const isFemale = lowerSex === 'femenino' || lowerSex === 'mujer' || lowerSex === 'f' || lowerSex === 'm'; // M for Mujer in some systems

  const dic = {
    'bienvenido': isFemale ? 'Bienvenida' : 'Bienvenido',
    'listo': isFemale ? 'Lista' : 'Listo',
    'seguro': isFemale ? 'Segura' : 'Seguro',
    'registrado': isFemale ? 'Registrada' : 'Registrado',
    'candidato': isFemale ? 'Candidata' : 'Candidato',
    'experto': isFemale ? 'Experta' : 'Experto',
    'preparado': isFemale ? 'Preparada' : 'Preparado',
    'tranquilo': isFemale ? 'Tranquila' : 'Tranquilo'
  };

  const lowerTerm = term.toLowerCase();
  // Return matched term with preserved casing if possible (simple capitalization)
  if (dic[lowerTerm]) {
    const val = dic[lowerTerm];
    // Check if original was capitalized
    if (term[0] === term[0].toUpperCase()) return val;
    return val.toLowerCase();
  }
  return term;
};


// DICCIONARIO RENAPO (GLOBAL)
const ESTADO_MAP = {
  'AGUASCALIENTES': 'AS', 'BAJA CALIFORNIA': 'BC', 'BAJA CALIFORNIA SUR': 'BS', 'CAMPECHE': 'CC',
  'COAHUILA': 'CL', 'COLIMA': 'CM', 'CHIAPAS': 'CS', 'CHIHUAHUA': 'CH',
  'DISTRITO FEDERAL': 'DF', 'CIUDAD DE MEXICO': 'DF', 'CDMX': 'DF',
  'DURANGO': 'DG', 'GUANAJUATO': 'GT', 'GUERRERO': 'GR', 'HIDALGO': 'HG',
  'JALISCO': 'JC', 'MEXICO': 'MC', 'ESTADO DE MEXICO': 'MC', 'MICHOACAN': 'MN',
  'MORELOS': 'MS', 'NAYARIT': 'NT', 'NUEVO LEON': 'NL', 'OAXACA': 'OC',
  'PUEBLA': 'PL', 'QUERETARO': 'QT', 'QUINTANA ROO': 'QR', 'SAN LUIS POTOSI': 'SP',
  'SINALOA': 'SL', 'SONORA': 'SR', 'TABASCO': 'TC', 'TAMAULIPAS': 'TS',
  'TLAXCALA': 'TL', 'VERACRUZ': 'VZ', 'YUCATAN': 'YN', 'ZACATECAS': 'ZS',
  'EXTRANJERO': 'NE'
};

// Generador de Prefijo CURP (V6.5 Validation // --- CURP GENERATOR ENGINE (V8.0) ---
const generateCurpPrefix = (nombre, apPaterno, apMaterno, fechanac, sexo, estadoNacimiento = "") => {
  // 1. DICCIONARIO RENAPO (Reference Global)
  const estadoMap = ESTADO_MAP;

  // Helper: Primera Consonante Interna
  const getInternalConsonant = (str) => {
    if (!str) return 'X';
    const clean = normalizeText(str).substring(1); // Saltar la primera
    const match = clean.match(/[B-DF-HJ-NP-TV-Z]/); // Regex Consonantes (No Vocales)
    return match ? match[0] : 'X';
  };

  // Helper: Primera Vocal Interna (Para apellidos)
  const getFirstInternalVowel = (str) => {
    if (!str) return 'X';
    const clean = normalizeText(str).substring(1);
    const match = clean.match(/[AEIOU]/);
    return match ? match[0] : 'X';
  };


  try {
    const nom = normalizeText(nombre);
    const pat = normalizeText(apPaterno);
    const mat = normalizeText(apMaterno);

    // PART 1: 4 LETRAS (AAAA)
    // Pat: Primera Letra + Primera Vocal Interna
    const pat1 = pat.charAt(0);
    const pat2 = getFirstInternalVowel(pat);
    // Mat: Primera Letra (o 'X' s no hay)
    const mat1 = mat ? mat.charAt(0) : 'X';

    // Nom: Primera Letra (Regla Nombres Comunes RENAPO)
    let nomUsed = nom;
    const nomParts = nom.split(' ');
    const commonNames = ['JOSE', 'J', 'MARIA', 'MA', 'MA.'];

    if (nomParts.length > 1 && commonNames.includes(nomParts[0])) {
      nomUsed = nomParts[1]; // Usar segundo nombre
    }
    const nom1 = nomUsed.charAt(0);

    const part1 = `${pat1}${pat2}${mat1}${nom1}`;

    // PART 2: FECHA (YYMMDD)
    // fechanac formato: DD/MM/YYYY
    const parts = fechanac.split('/');
    const year = parts[2].substring(2, 4);
    const month = parts[1].padStart(2, '0');
    const day = parts[0].padStart(2, '0');
    const part2 = `${year}${month}${day}`;

    // PART 3: SEXO (H/M)
    const part3 = (sexo === 'Masculino' || sexo === 'Hombre') ? 'H' : 'M';

    // PART 4: ESTADO (RENAPO)
    // Normalizamos el input del estado
    const estadoNorm = normalizeText(estadoNacimiento);
    // Buscamos coincidencia exacta o parcial
    let estadoCode = 'NE'; // Default Extranjero/NoEncontrado
    // Búsqueda directa
    if (estadoMap[estadoNorm]) {
      estadoCode = estadoMap[estadoNorm];
    } else {
      // Búsqueda keys
      const found = Object.keys(estadoMap).find(k => estadoNorm.includes(k));
      if (found) estadoCode = estadoMap[found];
    }
    const part4 = estadoCode;

    // PART 5: CONSONANTES INTERNAS (3 Letras)
    const consPat = getInternalConsonant(pat);
    const consMat = getInternalConsonant(mat);
    const consNom = getInternalConsonant(nom);
    const part5 = `${consPat}${consMat}${consNom}`;

    // PART 6: HOMOCLAVE (2 Caracteres)
    // Calculada real requeriría algoritmo complejo. Mockeamos 'A6' o '09'
    const part6 = "09"; // Statistical mode

    return (part1 + part2 + part3 + part4 + part5 + part6).toUpperCase();

  } catch (e) {
    console.error("Error generating CURP:", e);
    return "XXXX000000XXXXXX00"; // Fallback error
  }
};

// ---------------------------------------------------------
// 🛠️ CONFIGURACIÓN DE INGENIERÍA (SAFE DEBUG SWITCH)
// Cambiar a FALSE antes de liberar a producción (Master)
const ENABLE_INTEGRITY_DEBUG = true;

function auditLog(label, val1, val2) {
  if (!ENABLE_INTEGRITY_DEBUG) return;

  const msg = `🔍 AUDITORÍA [${label}]\n\nEsperado (Sesión): ${val1}\nRecibido (Input): ${val2}\n¿Coinciden?: ${val1 === val2}`;

  console.warn(msg);
  // Blocking alert for immediate visibility
  confirm(msg);
}

// --- VALIDATE CURP INTEGRITY (V7.7 CROSS-CHECK) ---
// --- VALIDATE CURP INTEGRITY (V7.7 CROSS-CHECK - HARDENED) ---
// --- VALIDATE CURP INTEGRITY (V8.0: FULL BIO-CROSS-CHECK) ---
const validateCurpIntegrity = (curpInput, patientData) => {
  const check = { valid: true, error: null };
  if (!curpInput || curpInput.length !== 18) return { valid: false, error: "Longitud incorrecta (Debe ser 18)" };

  const identificacion = patientData?.identificacion || {};
  const profile = patientData?.profile || {};

  const fechanac = identificacion.fechanac || profile.birthdate;
  const sexo = identificacion.sexo || profile.sex;
  const nombre = identificacion.nombre || profile.first_name;
  const apellidoPaterno = identificacion.apellidoPaterno || profile.last_name_pat;
  const apellidoMaterno = identificacion.apellidoMaterno || profile.last_name_mat;

  // 1. Validar Fecha (Chars 4-10: YYMMDD) (STRICT BINARY CHECK V2.5)
  if (fechanac) {
    const parts = fechanac.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const yFull = parts[2];
      const y = yFull.slice(-2);

      const curpYY = curpInput.substring(4, 6);
      const curpMM = curpInput.substring(6, 8);
      const curpDD = curpInput.substring(8, 10);

      // 🛠️ DEBUG INJECTION
      auditLog("VALIDACIÓN FECHA CURP", `Sesión: ${y}${m}${d}`, `CURP: ${curpYY}${curpMM}${curpDD}`);

      if (curpYY !== y) return { valid: false, error: `El AÑO de la CURP (${curpYY}) no coincide con su nacimiento (${y}).` };
      if (curpMM !== m) return { valid: false, error: `El MES de la CURP (${curpMM}) no coincide con su nacimiento (${m}).` };
      if (curpDD !== d) return { valid: false, error: `El DÍA de la CURP (${curpDD}) no coincide con su nacimiento (${d}).` };
    }
  }

  // 2. Validar Sexo (Char 10: H/M)
  const curpSex = curpInput.charAt(10).toUpperCase();
  const userSex = (sexo === 'Masculino' || sexo === 'Hombre') ? 'H' : 'M';
  if (curpSex !== userSex) {
    return { valid: false, error: `El sexo en la CURP (${curpSex}) no coincide con el registrado (${userSex}).` };
  }

  // 3. Validar Iniciales (Chars 0-4: AAAA) - (V8.0 HARDENING)
  if (nombre && apellidoPaterno) {
    // Normalizamos para evitar errores por acentos
    const pat = normalizeText(apellidoPaterno);
    const mat = apellidoMaterno ? normalizeText(apellidoMaterno) : 'X';
    const nom = normalizeText(nombre);

    // Initial Chars Expected
    const initialPat = pat.charAt(0);
    const initialMat = mat.charAt(0);

    // 3.1 RENAPO NAME RULE (V8.1 FIX): Skip common names (Jose, Maria) if compound
    let effectiveNom = nom;
    const nomParts = nom.split(' ');
    // Lista oficial de excepciones (RENAPO)
    const commonNames = ['JOSE', 'J', 'MARIA', 'MA', 'MA.'];

    if (nomParts.length > 1 && commonNames.includes(nomParts[0])) {
      effectiveNom = nomParts[1]; // Usar segundo nombre (e.g., LUIS en JOSE LUIS)
    }
    const initialNom = effectiveNom.charAt(0);

    // CURP Actual Chars
    const curpPat = curpInput.charAt(0);
    const curpMat = curpInput.charAt(2);
    const curpNom = curpInput.charAt(3);

    // Check Paterno Initial (Pos 0)
    if (curpPat !== initialPat) return { valid: false, error: `La inicial del Apellido Paterno en CURP (${curpPat}) no coincide con (${initialPat}).` };

    // Check Materno Initial (Pos 2) - Solo si hay materno
    if (apellidoMaterno && curpMat !== initialMat) return { valid: false, error: `La inicial del Apellido Materno en CURP (${curpMat}) no coincide con (${initialMat}).` };

    // Check Nombre Initial (Pos 3) 
    if (curpNom !== initialNom) return { valid: false, error: `La inicial del Nombre en CURP (${curpNom}) no coincide con (${initialNom}).` };
  }

  return check;
};


// ------------------------------------------------------------------
// 🧠 EL CEREBRO DE NAVEGACIÓN (SCANNER V5.0)
// Revisa secuencialmente qué dato falta. El orden aquí define el flujo.
// ------------------------------------------------------------------
const determineNextStep = (patientData) => {
  const id = patientData.identificacion || {};
  const dom = patientData.domicilio || {};
  const em = patientData.emergencia || {};

  // --- FASE 1: IDENTIDAD (La Base) ---
  if (!id.nombre) return 'intro_name';
  if (!id.apellidoPaterno) return 'intro_paterno';
  // Materno puede ser opcional
  if (!id.fechanac) return 'intro_dob_day';
  if (!id.sexo) return 'intro_sex';
  if (!id.ocupacion) return 'intro_job';

  // CURP
  if (!id.curpValidated) return 'intro_curp_gate';
  if (!id.telefono) return 'intro_phone';

  // --- FASE 2: DATOS DEMOGRÁFICOS / UBICACIÓN ---
  // if (!id.civil_status) return 'intro_civil_status'; // TODO: Implementar
  if (!id.religion) return 'intro_religion';

  // Domicilio (Address)
  if (!dom.cp) return 'address_zip';
  if (!dom.colonia) return 'address_colonia_select';
  if (!dom.calle) return 'address_street';
  // if (!dom.num_ext) return 'intro_address_ext_num'; // TODO: Implementar

  // Seguridad (Fase 2 extendida)
  if (!em.nombre) return 'emergency_name';
  if (!em.parentesco) return 'emergency_relation';
  if (!em.telefono) return 'emergency_phone';

  if (!em.telefono) return 'emergency_phone';

  // --- FASE 0: TRIAJE CLÍNICO (V2.0) ---
  if (!patientData.clinical_triage?.triage_completed) return 'intro_triage_start';

  // --- FASE 4: ANTECEDENTES HEREDOFAMILIARES (V4.0) ---
  if (!patientData.history?.family_raw_text) return 'ahf_start';
  if (patientData.history?.family_checklist_verified !== true) return 'ahf_gate';

  // --- FASE 5: ANTECEDENTES PERSONALES PATOLÓGICOS (V1.0) ---
  // 1. Raw Text Check (PH5-PATHOS-START)
  if (!patientData.history?.personal_raw_text) return 'app_start'; // Using app_start as hook
  // 2. Safety Gate Check (PH5-SAFETY-GATE)
  if (patientData.history?.personal_checklist_verified !== true) return 'ph5_gate';

  // --- FASE 6: FARMACOLOGÍA (V3.0) ---
  // Simple check: This phase is flow-driven, always starts at gate if not explicitly skipped by user logic (handled in state)
  // We use a flag or just assume 'meds_start' is the entry point if we are here.
  // Ideally we flag completion. For now, rely on flow.

  return 'meds_start'; // Entry point for Phase 6
};

// Helper para mapear pasos del chat a campos del Dashboard (Protocolo 3)
// Helper para mapear pasos del chat a campos visuales del Dashboard (Protocolo 3 - V6.1)


// Helper para determinar el Tab Activo basado en el paso del chat
// Helper para determinar el Tab Activo - Removed unused getActiveTab

// --- COMPONENTS ---
// V15.5 PERSISTENCE RECOVERY DIALOG
const RecoveryDialog = ({ data, onResume, onRestart }) => {
  if (!data) return null;
  const date = new Date(data.last_updated).toLocaleString();
  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200"
      >
        <div className="bg-blue-600 p-4 flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Sesión Encontrada</h3>
            <p className="text-blue-100 text-xs">Guardado automático: {date}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Hemos detectado una sesión previa incompleta para esta cita.
            <br /><br />
            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
              Fase {data.last_active_phase}
            </span>
            <span className="ml-2 text-slate-500 text-xs italic">
              ({data.last_active_block})
            </span>
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={onRestart}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
            >
              Reiniciar
            </button>
            <button
              onClick={onResume}
              className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 text-sm flex items-center justify-center gap-2"
            >
              Continuar
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

function App() {
  // --- ESTADO DE ACCESO ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  // 1. Nuevo estado para controlar la "Esclusa Legal"
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  // --- ESTADOS INPUTS LOGIN ---
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Estado de carga para login

  // --- SAFE-ID STATE (V4.0) ---
  const [sessionMetadata, setSessionMetadata] = useState({ userId: null, citation: null, serverName: null });
  // const [isPrivacyAccepted, setIsPrivacyAccepted] = useState(false); // Controls Header Visibility
  const [globalFailureCount, setGlobalFailureCount] = useState(0);
  const { validateCitation } = useCitationValidation(); // Hook Logic

  // --- RESTAURAR SESIÓN ---
  useEffect(() => {
    const savedSession = localStorage.getItem('ea_session');
    if (savedSession) {
      try {
        const parsedUser = JSON.parse(savedSession);
        setUser(parsedUser);
        // setIsLoggedIn(true); // COMENTADO: Forzar el login siempre para desarrollo/seguridad
      } catch (e) {
        console.error("Error parsing saved session", e);
      }
    }
  }, []);


  // --- ESTADO DEL MOTOR CORTEX (T.I.L.O) ---
  const {
    currentPhase,
    messages,
    patientData,
    activeTab,
    processUserInput,
    setActiveTab,
    setPatientData,
    setMessages,
    clearSession,
    setCurrentPhase,
    apiContext,
    fase3State,
    setFase3State,
    triggerPhase1Summary,
    triggerPhase5Summary,
    triggerPhase6Summary,
    triggerPhase7Summary
  } = useCortex();

  const [input, setInput] = useState("");

  // 1. Estado para controlar el flujo de la conversación (Legacy, to be replaced by currentPhase)
  const [interviewStep, setInterviewStep] = useState("appointment");

  const [isEditing, setIsEditing] = useState(false);
  const [activeField, setActiveField] = useState(null);

  const handleTriggerEdit = (field) => {
    setActiveField(field);
    setIsEditing(true);
  };

  // const [isPrivacyAccepted, setIsPrivacyAccepted] = useState(false);
  const [isIdentityConfirmed, setIsIdentityConfirmed] = useState(false); // <--- NUEVO FLAG PARA HEADER DINÁMICO
  // const [openSection, setOpenSection] = useState('identificacion'); // REMOVED: Managed by MedicalDashboard
  const [editMode, setEditMode] = useState(false); // V4.5 Edit Mode Flag

  // Sincronización Automática: Chat Step -> Active Tab
  // useEffect(() => {
  //   const targetTab = getActiveTab(interviewStep);
  //   if (targetTab) {
  //     setActiveTab(targetTab);
  //   }
  // }, [interviewStep]);

  // 2. Estado de los datos del paciente (Movido a useCortex.js)
  // patientData and setPatientData are now imported from useCortex

  // Estado para Antecedentes Heredofamilliares (AHF) Detallados
  // Array de objetos: { enfermedad: 'Diabetes', pariente: 'Padre' }

  // Estado para Antecedentes Personales Patológicos (APP)




  // Estado temporal para validación de colonia
  // const [tempColonia, setTempColonia] = useState("");
  const [tempColoniaList, setTempColoniaList] = useState([]); // Nuevo estado para lista de colonias

  // Estado temporal para Items de Bucles (Medicamentos, Suplementos)
  const [tempItem, setTempItem] = useState({}); // { nombre, dosis, frecuencia ... }
  // V3.6: Memoria de retorno para Edición Granular
  // V3.6: Memoria de retorno para Edición Granular
  // const [tempReturnStep, setTempReturnStep] = useState(null); // Local removed - unused setter
  // V4.2: Smart Name Ambiguity Check
  const [tempNameInput, setTempNameInput] = useState("");

  // --- PERSISTENCE PROTOCOL STATE (V15.5) ---
  const [recoveryData, setRecoveryData] = useState(null); // Stores potential session to resume

  // V8.0 Shared Option Selection Dispatch
  const handleOptionSelect = (msg, val) => {
    const opt = msg?.options?.find(o => o.value === val);
    if (!opt) return;

    if (opt.value === 'COMMIT_NAME' || opt.value === 'CONFIRM_GRANULARITY_YES') {
      setPatientData(prev => ({ ...prev, identificacion: { ...prev.identificacion, nombre: formatText(tempNameInput) } }));
      setMessages(prev => [...prev, { role: 'user', content: opt.label }]);
      setMessages(prev => [...prev, { role: "assistant", content: "Nombre actualizado. ¿Cuál es su **Apellido Paterno**?" }]);
      setInterviewStep('PH1_LASTNAME_PAT');
    } else if (opt.value === 'RETRY_NAME') {
      setMessages(prev => [...prev, { role: 'user', content: opt.label }]);
      setMessages(prev => [...prev, { role: "assistant", content: "Por favor, ingrese su nombre nuevamente:" }]);
      setInterviewStep('PH1_NAME_GRANULAR');
    } else if (opt.value === 'CONFIRM_GRANULARITY_NO' || opt.value === 'Masculino' || opt.value === 'Femenino' || ['Soltero', 'Casado', 'Unión Libre', 'Divorciado', 'Viudo', 'Soltera', 'Casada', 'Divorciada', 'Viuda'].includes(opt.value) || opt.value === 'HAS_CURP' || opt.value === 'HELP_CURP' || opt.value === 'FIND_CURP' || opt.value === 'IS_FOREIGN' || ['CONFIRM_GENERATED_CURP', 'RETRY_CURP'].includes(opt.value) || ['CONFIRM_NAME_YES', 'CONFIRM_NAME_NO', 'CONFIRM_PAT_YES', 'CONFIRM_PAT_NO', 'CONFIRM_MAT_YES', 'CONFIRM_MAT_NO', 'CONFIRM_MAT_NONE', 'Cónyuge', 'Padre', 'Madre', 'Hermano', 'Hermana', 'Otro Familiar', 'Ninguno', 'NO_MORE_AHF', 'ADD_MORE_AHF', 'FAM_MOTHER', 'FAM_FATHER', 'FAM_GRANDPARENT', 'FAM_SIBLING', 'FAM_OTHER'].includes(opt.value) || (opt.value && opt.value.startsWith('GOAL_'))) {
      setMessages(prev => [...prev, { role: 'user', content: opt.label }]);
      handleSend(opt.value);
    } else if (interviewStep === 'address_colonia_select') {
      setMessages(prev => [...prev, { role: 'user', content: opt.label }]);
      handleSend(opt.value);
    } else {
      setMessages(prev => [...prev, { role: 'user', content: opt.label }]);
      handleSend(opt.value);
    }
  };

  // --- PERSISTENCE PROTOCOL HELPER (V15.5) ---
  const saveSessionProgress = useCallback(async (phase, block, isCompleted = false) => {
    // Only save if we have a valid citation ID (session active)
    const activeCitation = apiContext?.citaId || sessionMetadata.citation;
    if (!activeCitation) return;

    try {
      console.log(`💾 Auto-Save Triggered: Phase ${phase} | Block ${block}`);
      await axios.patch(`http://localhost:5000/api/citations/${activeCitation}/progress`, {
        phase,
        block,
        patientData, // Full State Snapshot
        is_completed: isCompleted
      });
    } catch (err) {
      console.warn("⚠️ Persistence Sync Error:", err.message);
      // Non-blocking error
    }
  }, [sessionMetadata.citation, apiContext, patientData]);

  // V15.5 RECOVERY HANDLER
  const handleResumeSession = () => {
    if (!recoveryData) return;
    try {
      console.log("🔄 Resuming Session...", recoveryData);

      // 1. Restore Data
      const snapshot = JSON.parse(recoveryData.patient_data_snapshot);
      setPatientData(snapshot);

      // 2. Restore Visual State (Identity Confirmed)
      if (recoveryData.last_active_phase > 0) {
        setIsIdentityConfirmed(true);
      }

      // 3. Jump to Step
      const jumpTo = recoveryData.last_active_block || 'verify_identity';
      setInterviewStep(jumpTo);
      setCurrentPhase(jumpTo);

      // 4. User Feedback
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `✅ **Sesión Recuperada Exitosamente**\n\nContinuemos desde la Fase ${recoveryData.last_active_phase} donde nos quedamos.`
      }]);

      // 5. Clear Modal
      setRecoveryData(null);

    } catch (err) {
      console.error("Recovery Failed:", err);
      // Fallback
      setRecoveryData(null);
      setInterviewStep("verify_identity");
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Error al recuperar los datos. Se iniciará una nueva sesión." }]);
    }
  };

  // AUTO-SCROLL REF
  const messagesEndRef = useRef(null);

  // --- EFECTOS Y HELPERS ---
  // --- EFECTOS Y HELPERS ---
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // --- AUTOSAVE EFFECT (PHASE 4 PERSISTENCE) ---
  const saveHistoryToBackend = useCallback(async () => {
    try {
      if (!patientData.history) return;

      console.log("💾 Saving Phase 4 Data...");
      const payload = {
        history_data: JSON.stringify(patientData.history) // Explicit Stringify
      };

      await fetch('http://localhost:3000/api/patients/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log("✅ Phase 4 Verified & Saved.");

    } catch (err) {
      console.error("Save Error:", err);
    }
  }, [patientData.history]);

  useEffect(() => {
    // Trigger save when entering Phase 9/10 [END OF PHASE 8] or previous phases
    if (interviewStep === 'intro_gineco_embarazo' || interviewStep === 'habits_smoking_gate' || interviewStep === 'digestive_start' || interviewStep === 'allergies_food_start' || interviewStep === 'meds_start' || interviewStep === 'app_start') {
      saveHistoryToBackend();
    }
  }, [interviewStep, saveHistoryToBackend]);

  // Add Phase 4-6 State handling
  const [fase4State, setFase4State] = useState(null);
  const [fase5State, setFase5State] = useState(null);
  const [fase6State, setFase6State] = useState(null);
  // V9.0: Escuchar cuando Cortex cede el control a la fase antigua de App.jsx
  useEffect(() => {
    // 1. Mostrar Aviso de Privacidad cuando Cortex llega a la fase (evita rebotes con isIdentityConfirmed)
    if (currentPhase === 'PHASE_0_PRIVACY' && !showPrivacyPolicy && !isIdentityConfirmed) {
      setShowPrivacyPolicy(true);
    } else if (currentPhase === 'PHASE_0_AUTH') {
      // ✅ V15.6 FIX: Resetear el estado de privacidad si el usuario reinicia la validación de cita (ej. si ingresa otro paciente)
      setShowPrivacyPolicy(false);
      setIsIdentityConfirmed(false);
    }

    if (currentPhase === 'PHASE_2_COMPLETE_HANDOFF' && interviewStep === 'appointment') {
      console.log("🔄 Cortex Handoff Phase 2 -> Phase 3 Triage");
      setCurrentPhase('PHASE_3_MOTIVO_CONSULTA'); 
    }
    // Handoff to Legacy App.jsx Phase 10 (Habits) from Cortex:
    // If handing off from Phase 9 (Physiological) to Phase 10:
    if (currentPhase === 'PHASE_9_COMPLETE_HANDOFF' && interviewStep === 'appointment') {
      console.log("🔄 Cortex Handoff Phase 9 -> Legacy App.jsx Phase 10");
      setInterviewStep('habits_smoking_gate');
    }
    // Handoff to Legacy App.jsx Phase 10.5 (Alcohol) from Cortex Phase 10 (Smoke):
    if (currentPhase === 'PHASE_10_COMPLETE_HANDOFF' && interviewStep === 'appointment') {
      console.log("🔄 Cortex Handoff Phase 10 (Smoke) -> Legacy App.jsx Phase 10 (Alcohol)");
      setInterviewStep('habits_alcohol_gate');
    }
    if (currentPhase === 'PHASE_12_COMPLETE_HANDOFF' && interviewStep === 'appointment') {
      console.log("🔄 Cortex Handoff Phase 12 (Diet) -> Cortex Phase 13 (Biometrics)");

      const alc = patientData.habits?.alcohol;
      const alcKcal = alc?.total_kcal_per_occasion || 0;

      let msg = "¡Fase 5 Completada!\n\n";
      if (alcKcal > 0) {
        msg += `⚠️  **Ajuste Calórico**: Se detectó un consumo de ~${alcKcal} kcal por evento de alcohol. Esto se compensará en su plan.\n\n`;
      }

      msg += `Hemos terminado la entrevista. Ahora pasaremos a tomar sus medidas físicas para calibrar su plan nutricional.\n\n**(Indique pasar al área de medición)**.\n\nEscriba '${getGenderedTerm('Listo', patientData.identificacion?.sexo || 'M')}' cuando esté en posición.`;

      setMessages(prev => [...prev, { role: "assistant", content: msg, avatar: tiloImg }]);
      setCurrentPhase('PHASE_13_BIO_START');
    }

    if (currentPhase === 'PHASE_13_COMPLETE_HANDOFF' && interviewStep === 'appointment') {
      console.log("🔄 Cortex Handoff Phase 13 (Biometrics) -> Legacy App.jsx Finished");
      setInterviewStep('finished');
      setActiveTab('diagnosis');
      saveSessionProgress(13, 'finished', false);
    }
  }, [currentPhase, interviewStep, patientData.habits?.alcohol, patientData.identificacion?.sexo, saveSessionProgress, setActiveTab, setCurrentPhase, setMessages, showPrivacyPolicy, isIdentityConfirmed]);

  // --- MOTOR DE SEGURIDAD CULTURAL (OBSERVER) ---
  // Detecta cambios en religión o IMC y aplica "Hard Constraints"
  useEffect(() => {
    const { religion } = patientData.identificacion;
    const { imc } = patientData;

    if (religion) {
      const constraints = generateSecurityConstraints(religion, imc);

      setPatientData((prev) => {
        // Prevención de re-renders infinitos: Check de integridad
        if (JSON.stringify(prev.security_constraints) === JSON.stringify(constraints)) {
          return prev;
        }
        return {
          ...prev,
          security_constraints: constraints
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientData.identificacion?.religion, patientData.imc]);



  // 3. Handler para cuando el usuario acepta el Aviso de Privacidad en el Modal
  const handleAcceptPrivacy = () => {
    try {
      setShowPrivacyPolicy(false); // Cierra modal
      setIsIdentityConfirmed(true); // <--- SOLO AHORA APARECEN REF. CITA Y ID EN EL HEADER

      // Pass control back to Cortex Engine WITH a delay to allow unmount
      console.log("🔒 Privacy Accepted - Handing off to Cortex...");
      setTimeout(() => {
        processUserInput("Acepto Aviso de Privacidad");
      }, 100);
    } catch (err) {
      console.error("Critical error in handleAcceptPrivacy:", err);
      // Fallback manual
      setShowPrivacyPolicy(false);
      setIsIdentityConfirmed(true);
    }
  };

  // 4. Actualizamos handleSend para que sea una "Máquina de Estados"
  const handleSend = async (optionalInput = null) => {
    // CORRECCIÓN: Usamos logic híbrida (input manual o botón)
    const rawMsg = optionalInput !== null ? optionalInput : input;
    const userMsg = typeof rawMsg === 'string' ? rawMsg : "";

    if (!userMsg.trim()) return;

    // LIMPIEZA INCONDICIONAL: Siempre limpiamos el input visual,
    // incuso si el usuario hizo clic en un botón teniendo texto escrito.
    setInput("");

    // ENRUTADOR PRINCIPAL: Si estamos en las nuevas fases de Cortex, usamos processUserInput
    const isCortexPhase = currentPhase.startsWith('PHASE_0') || currentPhase.startsWith('PHASE_1') || currentPhase.startsWith('PHASE_2') || currentPhase.startsWith('PHASE_3') || currentPhase.startsWith('PHASE_4') || currentPhase.startsWith('PHASE_5') || currentPhase.startsWith('PHASE_6') || currentPhase.startsWith('PHASE_7') || currentPhase.startsWith('PHASE_8') || currentPhase.startsWith('PHASE_9') || currentPhase.startsWith('PHASE_10') || currentPhase.startsWith('PHASE_11') || currentPhase.startsWith('PHASE_12') || currentPhase.startsWith('PHASE_13');
    const isHandoff = currentPhase === 'PHASE_2_COMPLETE_HANDOFF' || currentPhase === 'PHASE_9_COMPLETE_HANDOFF' || currentPhase === 'PHASE_10_COMPLETE_HANDOFF' || currentPhase === 'PHASE_11_COMPLETE_HANDOFF' || currentPhase === 'PHASE_12_COMPLETE_HANDOFF' || currentPhase === 'PHASE_13_COMPLETE_HANDOFF';

    if (isCortexPhase && !isHandoff) {
      console.log("🧠 T.I.L.O. Cortex Engine Processing:", userMsg);
      const isInternal = optionalInput !== null;
      processUserInput(userMsg, isInternal);
      return;
    }

    // --- MODO LEGACY ---
    // Solo agregar al chat en modo legacy si NO es un replay automático
    if (optionalInput === null) {
      setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    }

    // V3.8: Helper de Memoria de Retorno (Defined inside handleSend to access scope if needed, though static here)
    const getQuestionForStep = (step) => {
      const questions = {
        // FASE 1: PERFIL
        'intro_name': "¿Podría confirmarme su **Nombre Completo** (empezando por nombres)?",
        'intro_dob_day': "¿En qué **día** nació? (Ej: 12)",
        'intro_dob_month': "¿En qué **mes** nació? (Ej: Mayo)",
        'intro_dob_year': "¿De qué **año** es su nacimiento? (Ej: 1990)",
        'intro_sex': "¿Cuál es su sexo biológico?",
        'intro_job': "¿A qué se dedica usted actualmente?",
        'intro_curp_gate': "¿Podría indicarme su Clave Única de Registro de Población (CURP)?",
        'intro_phone': "¿Cuál es su número de teléfono celular?",
        'intro_religion': "¿Profesa usted alguna religión?",
        'intro_religion_spec': "¿Cuál profesa?",
        'address_zip': "Pasemos a su domicilio. ¿Podría indicarme su Código Postal?",
        'address_colonia_select': "Seleccione su colonia de la lista anterior:",
        'address_street': "¿Cuál es su Calle y Número exterior?",

        // FASE 2: SEGURIDAD
        'emergency_name': "En caso de emergencia, ¿quién es su contacto responsable? Necesito su **nombre completo**.",
        'emergency_relation': "¿Qué **parentesco** tiene esa persona con usted?",
        'emergency_phone': "¿Me dicta el **número de teléfono** a 10 dígitos de esa persona?",

        // FASE 3: ANAMNESIS
        'ahf_start': "¿Tiene antecedentes de diabetes o hipertensión en su familia directa?",
        'app_start': "¿Padece alguna enfermedad crónica diagnosticada?",
        'waiting_lifestyle': "Continuemos con la siguiente sección."
      };
      return questions[step] || "Continuemos con la entrevista.";
    };

    // V4.2: Auto-Detect Resume Step (Smart Recovery)
    const determineResumeStep = (data) => {
      const id = data.identificacion || {};
      const dom = data.domicilio || {};

      if (!id.nombre) return 'intro_name';
      if (!id.apellidoPaterno) return 'intro_paterno';
      if (!id.apellidoMaterno) return 'intro_materno';
      if (!id.fechanac) return 'intro_dob_day';
      if (!id.sexo) return 'intro_sex';
      if (!id.ocupacion) return 'intro_job';
      if (!id.curp) return 'intro_curp_gate';
      if (!id.telefono) return 'intro_phone';

      if (!dom.cp) return 'address_zip';
      // if (!dom.colonia) return 'address_colonia_select'; // Depende del flujo
      if (!dom.calle) return 'address_street';

      // Phase 5 Scanner
      const ffq = data.evaluacionDietetica?.ffq || {};
      if (!ffq.leche) return 'ph5_freq_dairy';
      if (!ffq.carne_roja) return 'ph5_freq_red_meat';
      if (!ffq.carne_procesada) return 'ph5_freq_processed_meat';
      if (!ffq.pollo) return 'ph5_freq_white_meat';
      if (!ffq.cereales) return 'ph5_freq_cereals';
      if (!ffq.leguminosas) return 'ph5_freq_legumes';
      if (!ffq.verduras) return 'ph5_freq_veggies';
      if (!ffq.frutas) return 'ph5_freq_fruits';
      if (!ffq.grasas) return 'ph5_freq_healthy_fats';
      if (!ffq.azucares) return 'ph5_freq_sugars';
      if (!ffq.chatarra) return 'ph5_freq_junk';
      if (!ffq.agua) return 'ph5_freq_water';

      return 'waiting_lifestyle';
    };

    // ... (rest of code) ...

    // Helper para transición de Fase 3 -> Fase 4 (Con Logic de Género V3.5)
    // -----------------------------------------------------------------------
    const handlePhase3Conclusion = (sexo, setStep, setMsg) => {
      if (sexo === 'Femenino' || sexo === 'Mujer' || sexo === 'F' || sexo === 'M') { // 'M' interno es Mujer
        // MUJER -> Gineco (Pregunta 1: Embarazo)
        setMsg((prev) => [...prev, { role: "assistant", content: "Una última validación clínica. ¿Se encuentra usted actualmente embarazada?" }]);
        setStep("intro_gineco_embarazo");
      } else {
        // HOMBRE -> Fase 4 Directa (LOGÍSTICA - GOLDEN MASTER V4.1)
        setMsg((prev) => [...prev, { role: "assistant", content: "Historial registrado correctamente." }]);

        setTimeout(() => {
          setMsg((prev) => [...prev, { role: "assistant", content: "Para diseñar un plan realista, hablemos de su logística diaria. ¿Quién se encarga normalmente de preparar sus alimentos?\n\n1. Yo mismo\n2. Mi pareja / Familiar\n3. Personal doméstico\n4. Nadie (Compro hecho)" }]);
          setStep("logistics_cook");
        }, 1200);
      }
    };

    // --- MANEJO DEL CHAT (CEREBRO PRINCIPAL) ---
    // --- MANEJO DEL CHAT (CEREBRO PRINCIPAL) ---
    // (Logic moved to top of handleSend)

    // -----------------------------------------------------------------------
    // FASE 1: IDENTIFICACIÓN Y ACCESO (Administrativa)
    // -----------------------------------------------------------------------

    // --- FASE 0: VALIDACIÓN DE CITA (REEMPLAZAR BLOQUE COMPLETO V7.3) ---
    if (interviewStep === "appointment") {
      const citaId = userMsg.trim();

      // Permitir reintentos si venimos de un reset
      if (userMsg === "RESET") {
        setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Reiniciemos. Por favor ingrese su número de cita:" }]);
        return; // Esperamos siguiente input
      }

      // Validación básica de dígitos
      if (/^\d+$/.test(citaId)) {

        // 2. VERIFICAR HARD STOP (Preventivo)
        if (globalFailureCount >= 3) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `🚫 **Acceso Bloqueado**\n\n` +
              `Ha excedido el número máximo de intentos permitidos (3/3).\n` +
              `Por seguridad, el sistema ha suspendido la validación.\n\n` +
              `Contacte a soporte o verifique su folio con el personal médico.`
          }]);
          // setInputDisabled(true); // BLOQUEO TOTAL DEL CHAT (Pending implementation)
          return;
        }

        // 📡 API REAL (V7.3) - El hook ahora devuelve data completa
        const apiResponse = await validateCitation(citaId);

        if (!apiResponse) {
          // Fallo de red o error fatal en hook
          setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Error de conexión con el servidor de citas. Intente nuevamente." }]);
          return;
        }

        // 1. Extracción de datos del JSON Real
        const citaData = apiResponse.dataSet && apiResponse.dataSet[0];
        const status = citaData ? citaData.estatus : 'ERROR_NET';

        // 2. Lógica de Switch Exacta
        if (status === 'ESTUDIO_PENDIENTE') {
          // ✅ CASO ÉXITO: RESETEAR CONTADOR Y AVANZAR
          setGlobalFailureCount(0);

          // API Real data format info string: "Equipo en Accion Palenque ,Palenque  ,May 31 2023 12:00AM "
          // Clean it up or just pass as is if we don't have cleanServerInfo helper ready.
          // Fallback to basic string if cleanServerInfo fails.
          let datosCita = { paciente: citaData.name, horario: citaData.info, status: citaData.estatus, tipo: "Laboratorio" };
          try {
            datosCita = cleanServerInfo(citaData.info);
            datosCita.paciente = citaData.name;
            datosCita.status = citaData.estatus;
          } catch (err) {
            console.warn("Could not clean server info.", err);
          }

          // V15.5 ORPHAN SESSION DETECTION
          if (apiResponse.session_progress && !apiResponse.session_progress.is_completed) {
            console.log("🔄 Orphan Session Detected:", apiResponse.session_progress);
            // Trigger Recovery Dialog (Blocking)
            setRecoveryData(apiResponse.session_progress);
            // Do NOT setInterviewStep here, let user choose.
          } else {
            // FLUJO STANDARD
            setMessages(prev => [...prev, {
              role: "assistant",
              content:
                `✅ **Cita Confirmada**\n\n` +
                `Paciente: **${datosCita.paciente}**\n` +
                `Horario: ${datosCita.horario || citaData.info}\n` +
                `Estatus: ${datosCita.status}\n` +
                `Tipo: ${datosCita.tipo || "Laboratorio"}\n` + // V7.0
                `\n⚠️ Antes de iniciar, necesito validar su identidad. ¿Es usted el paciente titular?`, // V7.0: Explicit Warning
              options: [
                { label: 'Sí, soy yo', value: 'CONFIRM_IDENTITY_YES' },
                { label: 'No, soy acompañante', value: 'CONFIRM_IDENTITY_NO' }
              ]
            }]);
            setInterviewStep("verify_identity");
          }

          setSessionMetadata({
            citation: citaData.idCita || citaId,
            userId: citaData.userId || '---',
            patientName: datosCita.paciente,
            serverName: datosCita.paciente, // Backup for comparison
            timestamp: new Date()
          });

        } else {
          // ⛔ FALLO (CUALQUIER TIPO): INCREMENTAR CONTADOR
          const nuevosIntentos = globalFailureCount + 1;
          setGlobalFailureCount(nuevosIntentos);

          // 2. VERIFICAR HARD STOP (Post-Intento)
          if (nuevosIntentos >= 3) {
            setMessages(prev => [...prev, {
              role: "assistant",
              content: `🚫 **Acceso Bloqueado**\n\n` +
                `Ha excedido el número máximo de intentos permitidos (3/3).\n` +
                `Por seguridad, el sistema ha suspendido la validación.\n\n` +
                `Contacte a soporte o verifique su folio con el personal médico.`
            }]);
            // setInputDisabled(true); // BLOQUEO TOTAL
            return;
          }

          // 3. MENSAJE DE ERROR ESPECÍFICO
          if (status === 'ESTUDIO_COMPLETO' || status === 'ESTUDIO_REALIZADO') {
            const datosHistorial = cleanServerInfo(citaData.info); // <--- USAR HELPER

            setMessages(prev => [...prev, {
              role: "assistant",
              content: `📄 **Folio ya utilizado**\n\n` +
                `El folio #${citaData.idCita} ya registra un estudio completado o en realización el **${datosHistorial.fecha}** en **${datosHistorial.sede}**.\n\n` +
                `Por favor, ingrese un número de cita vigente para continuar.`
            }]);
          } else if (status === 'ESTUIO_NO_ENCONTRADO') {
            setMessages(prev => [...prev, {
              role: "assistant",
              content: `❌ **Cita No Encontrada / Inválida**\n\n` +
                `El número no existe o no es válido para estudio. (Intento ${nuevosIntentos}/3).\n` +
                `Verifique el dato.`
            }]);
          } else {
            setMessages(prev => [...prev, {
              role: "assistant",
              content: `❌ **Cita No Encontrada**\n\n` +
                `El número no existe. (Intento ${nuevosIntentos}/3).\n` +
                `Verifique el dato.`
            }]);
          }
        }
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Por favor, ingrese solo el **número** de su cita (dígitos)." }]);
      }
    }

    // PASO 0.5: VERIFICACIÓN DE IDENTIDAD (Buttons Handled via onClick)
    else if (interviewStep === "verify_identity") {
      // Fallback para escritura manual
      const lower = userMsg.toLowerCase();
      if (lower.includes("si") || lower.includes("soy yo")) {
        // Manual override simulation
        setMessages(prev => [...prev, { role: "assistant", content: "Excelente. Para activar su expediente, es obligatorio leer y aceptar nuestro **Aviso de Privacidad**." }]);
        setShowPrivacyPolicy(true);
      }
    }

    // PASO 1: IDENTITY LOCK (V7.1)
    else if (interviewStep === "PH1_NAME_GRANULAR") {
      const inputName = normalizeText(userMsg);
      const serverNameFull = normalizeText(sessionMetadata.serverName || "");

      // Validación Laxa: El input está contenido en el nombre del server?
      const isMatch = serverNameFull.includes(inputName);

      // V7.1 Logic
      if (isMatch && inputName.length > 2) {
        setTempNameInput(userMsg); // Guardamos input original

        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Entendido **"${userMsg}"**.\n\n¿Son estos **ÚNICAMENTE** sus nombres de pila (sin apellidos)?`,
          options: [
            { label: 'Sí, son solo mis nombres', value: 'CONFIRM_GRANULARITY_YES', action: 'next' },
            { label: 'No, escribí mi nombre completo', value: 'CONFIRM_GRANULARITY_NO', action: 'retry' }
          ]
        }]);
        setInterviewStep("PH1_NAME_CONFIRM");
      } else {
        // ⛔ BLOQUEO
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ **ALERTA DE SEGURIDAD**\n\n` +
            `El nombre ingresado no coincide con el registro del titular (**${sessionMetadata.serverName}**).\n` +
            `Por favor, verifique e ingrese su nombre según su identificación oficial.`
        }]);
        // No avanzamos
      }
    }
    // Waiting for confirmation button
    else if (interviewStep === "PH1_NAME_CONFIRM") { /* Waiting for user interaction */ }

    // --- FASE 1: VALIDACIÓN APELLIDO PATERNO (REEMPLAZAR FIX 3 V7.2) ---
    else if (interviewStep === 'PH1_LASTNAME_PAT') {
      const inputPaterno = normalizeText(userMsg); // Asegurar mayúsculas/acentos fuera
      const serverFullName = normalizeText(sessionMetadata.serverName || "");

      // Validación: ¿El input está contenido en el nombre completo del servidor? (Apellido Paterno match)
      const isMatch = serverFullName.includes(inputPaterno);

      if (isMatch && inputPaterno.length > 2) {
        // ✅ COINCIDENCIA
        setPatientData(prev => ({ ...prev, identificacion: { ...prev.identificacion, apellidoPaterno: formatText(userMsg) } }));
        setMessages(prev => [...prev, { role: "assistant", content: "Correcto. ¿Cuál es su **Apellido Materno**?" }]);
        setInterviewStep('PH1_LASTNAME_MAT');
      } else {
        // 🚨 MANEJO DE ERROR (Corrección del Deadlock V7.2)
        // UX WRITING: Instrucción clara de qué se espera
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ **Discrepancia de Identidad**\n\n` +
            `El apellido ingresado ("${userMsg}") no coincide con el registro del titular.\n` +
            `El sistema espera el Apellido Paterno de: **${sessionMetadata.serverName}**.\n\n` +
            `Por favor, verifique su ortografía e inténtelo nuevamente:`
        }]);
        // Mantiene el step para permitir reintento infinito hasta acertar
      }
    }

    // --- VALIDACIÓN APELLIDO MATERNO (LEVENSHTEIN IDENTITY CHECK) ---
    else if (interviewStep === 'PH1_LASTNAME_MAT') {
      const inputMaterno = normalizeText(userMsg);
      const serverFullName = normalizeText(sessionMetadata.serverName || "");
      const serverWords = serverFullName.split(" ");
      const serverMaterno = serverWords.length > 1 ? serverWords[serverWords.length - 1] : "";

      // 1. Calcular distancia de Levenshtein
      const distance = calculateLevenshtein(inputMaterno, serverMaterno);
      // 2. Tolerancia del 20%
      const tolerance = Math.ceil(serverMaterno.length * 0.20);

      // Validación: Si es ortográfico (<20%) o inclusión exacta
      if (distance <= tolerance || serverFullName.includes(inputMaterno)) {
        // ✅ ACEPTADO: Actualiza Dashboard y avanza
        setPatientData(prev => ({
          ...prev,
          identificacion: {
            ...prev.identificacion,
            apellidoMaterno: formatText(userMsg),
            discrepanciaMaterno: false // Glow azul
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "Gracias. Pasemos a su Fecha de Nacimiento.\n\n¿En qué **DÍA** nació? (Ej: 12)" }]);
        setInterviewStep('intro_dob_day');
      } else {
        // ⛔ BLOQUEO DE IDENTIDAD (>20%)
        setPatientData(prev => ({
          ...prev,
          identificacion: {
            ...prev.identificacion,
            apellidoMaterno: "", // Mantener vacío/original
            discrepanciaMaterno: true // Flag de Discrepancia para UI
          }
        }));

        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ **Discrepancia de Identidad**\n\n` +
            `Disculpe, detecto que el apellido ingresado ("${formatText(userMsg)}") es significativamente diferente al registrado en su cita.\n\n` +
            `Por protocolos de seguridad institucional y cumplimiento de la NOM-004, no puedo realizar cambios de identidad total en este chat.\n\n` +
            `Si hubo un error en su registro de cita, por favor notifíquelo a su nutriólogo al iniciar la sesión para realizar el ajuste legal correspondiente.\n\n` +
            `Continuemos con su Fecha de Nacimiento.\n\n¿En qué **DÍA** nació? (Ej: 12)`
        }]);
        // AVANZAMOS de todas formas, pero dejamos bandera
        setInterviewStep('intro_dob_day');
      }
    }

    // FASE 2: IDENTIDAD BLINDADA (ANTI-FRAUDE)
    else if (interviewStep === "name_challenge") {
      const inputName = formatText(userMsg);
      const serverName = formatText(sessionMetadata.serverName || ""); // "JUAN PEREZ"

      // Algoritmo Anti-Fraude Simplificado
      // 1. Check if input is contained in server name (e.g. "Juan" in "Juan Perez")
      const isMatch = serverName.includes(inputName) || inputName.includes(serverName.split(" ")[0]);

      // TODO: Fuzzy logic optimization (Levenshtein) if needed. For now strict inclusion.

      if (isMatch) {
        setTempNameInput(inputName);
        setPatientData(prev => ({ ...prev, identificacion: { ...prev.identificacion, nombre: inputName } }));

        setMessages(prev => [...prev, {
          role: "assistant",
          content: `**${inputName}**... Entendido.\n\nPor favor confirme para asegurar que el expediente se genere correctamente:\n\n**¿Son estos ÚNICAMENTE sus nombres de pila (sin apellidos)?**\n\n1. Sí, son solo mis nombres\n2. No, escribí mi nombre completo`
        }]);
        setInterviewStep("name_granularity");
      } else {
        // ⛔ BLOQUEO DE IDENTIDAD
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ **Discrepancia de Identidad detectada.**\n\nLa cita está asignada a **${serverName}**.\nPor políticas de seguridad, no es posible cambiar el titular.\n\nSi usted es ${serverName.split(" ")[0]}, escriba su nombre nuevamente.\nSi es otra persona, necesita una cita propia.`
        }]);
        // Stay in 'name_challenge'
      }
    }

    // FASE 2b: GRANULARIDAD
    else if (interviewStep === "name_granularity") {
      const lower = userMsg.toLowerCase();

      if (lower.includes("1") || lower.includes("si") || lower.includes("solo")) {
        // Confirmado: Solo nombres
        setMessages(prev => [...prev, { role: "assistant", content: "Perfecto. ¿Cuál es su **Apellido Paterno**?" }]);
        setInterviewStep("intro_paterno");
      } else {
        // Escribió completo, reiniciar captura
        setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Por favor, escriba **SOLO** sus Nombres de Pila (ej: 'Juan Manuel'), sin apellidos." }]);
        setInterviewStep("name_challenge");
      }
    }

    // -----------------------------------------------------------------------
    // FASE 1: PERFIL (1.1 - 1.8) (LEGACY FLOW - ACCESSED VIA FALLBACK)
    // -----------------------------------------------------------------------

    // 1.1 Nombre (Smart Name Splitter V4.2 + V4.4.1 Hotfix)
    else if (interviewStep === "intro_name") {
      setTimeout(() => {
        const cleanInput = formatText(userMsg); // formatText likely trims, but let's be safe per spec
        // FILTRO DE SEGURIDAD V4.4.1 (Ignorar espacios muertos)
        const words = cleanInput.split(/\s+/).filter(w => w.length > 0);

        // CASO 1: UNA SOLA PALABRA (Ej: "Andre" o "Andre ")
        if (words.length === 1) {
          setPatientData((prev) => ({
            ...prev,
            identificacion: { ...prev.identificacion, nombre: cleanInput }
          }));
          setMessages((prev) => [...prev, { role: "assistant", content: `Entendido, ${cleanInput}. ¿Cuál es su **Apellido Paterno**?` }]);
          setInterviewStep("intro_paterno");
        }
        // CASO 2: MÚLTIPLES PALABRAS -> AMBIGÃœEDAD
        else if (words.length > 1) {
          setTempNameInput(cleanInput); // Guardamos input original
          setMessages((prev) => [...prev, { role: "assistant", content: `He detectado varias palabras: "${cleanInput}".\n\n¿Son estos ÚNICAMENTE sus nombres de pila (sin apellidos)?\n\n1. Sí, son solo mis nombres.\n2. No, escribí mi nombre completo.` }]);
          setInterviewStep("intro_name_ambiguity_check");
        }
      }, 600);
    }

    // 1.1b Ambigüedad Nombre
    else if (interviewStep === "intro_name_ambiguity_check") {
      const response = userMsg.toLowerCase();
      /* OPCIÓN 1: SOLO NOMBRES */
      if (response.includes('1') || response.includes('si') || response.includes('sino') || response.includes('solo')) {
        setPatientData((prev) => ({
          ...prev,
          identificacion: { ...prev.identificacion, nombre: tempNameInput }
        }));
        setMessages((prev) => [...prev, { role: "assistant", content: "Entendido. Son nombres compuestos. ¿Cuál es su **Apellido Paterno**?" }]);
        setInterviewStep("intro_paterno");
      }
      /* OPCIÓN 2: NOMBRE COMPLETO (Smart Distribution V4.6) */
      else if (response.includes('2') || response.includes('no') || response.includes('completo')) {
        const words = tempNameInput.split(/\s+/).filter(w => w.length > 0);

        // 🔴 CASO CRÍTICO: SOLO 2 PALABRAS (Ej: "Andres Trejo")
        if (words.length === 2) {
          // Asignación Directa (Izquierda -> Derecha)
          setPatientData((prev) => ({
            ...prev,
            identificacion: {
              ...prev.identificacion,
              nombre: formatText(words[0]),     // "Andres"
              apellidoPaterno: formatText(words[1]),  // "Trejo"
              apellidoMaterno: ''   // Queda pendiente
            }
          }));

          // NO saltar a fecha. Ir a buscar lo que falta.
          setMessages((prev) => [...prev, { role: "assistant", content: `Entendido. He registrado:\nNombre: ${formatText(words[0])}\nApellido Paterno: ${formatText(words[1])}\n\n⚠️  Falta un dato para completar su ficha:\n¿Cuál es su **Apellido Materno**? (Si no tiene, escriba 'X')` }]);
          setInterviewStep('intro_materno');
        }
        // 🟢 CASO ESTÁNDAR: 3 O MÁS PALABRAS (Ej: "Andres Trejo Maldonado")
        // Lógica Renapo (Derecha -> Izquierda)
        else if (words.length >= 3) {
          const apellidoMaterno = formatText(words.pop());  // Último
          const apellidoPaterno = formatText(words.pop());  // Penúltimo
          const nombre = formatText(words.join(" ")); // El resto

          setPatientData((prev) => ({
            ...prev,
            identificacion: {
              ...prev.identificacion,
              nombre,
              apellidoPaterno,
              apellidoMaterno
            }
          }));
          setMessages((prev) => [...prev, { role: "assistant", content: `Entendido. He registrado:\n\nNombre: ${nombre}\nPaterno: ${apellidoPaterno}\nMaterno: ${apellidoMaterno}\n\nContinuemos. Para calcular su edad, necesito su fecha de nacimiento por partes.\n\n¿En qué **día** nació? (Ej: 12)` }]);
          setInterviewStep("intro_dob_day");
        }
      }
      // V4.4.1 Hotfix: Fallback for unhandled input
      else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor responda '1' (Solo nombres) o '2' (Nombre completo)." }]);
      }
    }

    // 1.1c Apellido Paterno
    else if (interviewStep === "intro_paterno") {
      const paterno = formatText(userMsg);
      setPatientData((prev) => ({
        ...prev,
        identificacion: { ...prev.identificacion, apellidoPaterno: paterno }
      }));
      setMessages((prev) => [...prev, { role: "assistant", content: "¿Cuál es su **Apellido Materno**?" }]);
      setInterviewStep("intro_materno");
    }

    // 1.1d Apellido Materno
    else if (interviewStep === "intro_materno") {
      const materno = formatText(userMsg);
      setPatientData((prev) => ({
        ...prev,
        identificacion: { ...prev.identificacion, apellidoMaterno: materno }
      }));
      setMessages((prev) => [...prev, { role: "assistant", content: "Gracias. Pasemos a su Fecha de Nacimiento.\n\n¿En qué **día** nació? (Ej: 12)" }]);
      setInterviewStep("intro_dob_day");
    }

    // 1.2a Día Nacimiento
    else if (interviewStep === "intro_dob_day") {
      setTimeout(() => {
        const day = parseInt(userMsg);
        if (isNaN(day) || day < 1 || day > 31) {
          setMessages((prev) => [...prev, { role: "assistant", content: "Por favor indique un día válido (1-31)." }]);
          return;
        }
        setTempItem((prev) => ({ ...prev, dobDay: userMsg.padStart(2, '0') }));
        setMessages((prev) => [...prev, { role: "assistant", content: "¿En qué **mes**? (Ej: Mayo)" }]);
        setInterviewStep("intro_dob_month");
      }, 600);
    }

    // 1.2b Mes Nacimiento (+ Normalización)
    else if (interviewStep === "intro_dob_month") {
      setTimeout(() => {
        const rawMonth = userMsg.trim().toLowerCase();
        const months = {
          'enero': '01', 'ene': '01', '01': '01', '1': '01',
          'febrero': '02', 'feb': '02', '02': '02', '2': '02',
          'marzo': '03', 'mar': '03', '03': '03', '3': '03',
          'abril': '04', 'abr': '04', '04': '04', '4': '04',
          'mayo': '05', 'may': '05', '05': '05', '5': '05',
          'junio': '06', 'jun': '06', '06': '06', '6': '06',
          'julio': '07', 'jul': '07', '07': '07', '7': '07',
          'agosto': '08', 'ago': '08', '08': '08', '8': '08',
          'septiembre': '09', 'sep': '09', '09': '09', '9': '09',
          'octubre': '10', 'oct': '10', '10': '10',
          'noviembre': '11', 'nov': '11', '11': '11',
          'diciembre': '12', 'dic': '12', '12': '12'
        };
        const monthCode = months[rawMonth];

        if (!monthCode) {
          setMessages((prev) => [...prev, { role: "assistant", content: "No reconocí ese mes. Intente escribirlo completo (ej: Enero) o el número." }]);
          return;
        }

        setTempItem((prev) => ({ ...prev, dobMonth: monthCode }));
        setMessages((prev) => [...prev, { role: "assistant", content: "¿De qué **año**? (Ej: 1990)" }]);
        setInterviewStep("intro_dob_year");
      }, 600);
    }

    // 1.2c Año Nacimiento (+ Age Calc Final)
    else if (interviewStep === "intro_dob_year") {
      setTimeout(() => {
        const year = parseInt(userMsg);
        const currentYear = new Date().getFullYear();

        if (isNaN(year) || year < 1920 || year > currentYear) {
          setMessages((prev) => [...prev, { role: "assistant", content: "Por favor indique un año válido (4 dígitos)." }]);
          return;
        }

        // Construcción y Cálculo
        const { dobDay, dobMonth } = tempItem;
        const d = parseInt(dobDay, 10);
        const m = parseInt(dobMonth, 10);

        // FIX 3: VALIDACIÓN DE FECHA REAL (V7.7)
        // CheckDate Construction (Month is 0-indexed)
        const checkDate = new Date(year, m - 1, d);
        if (
          checkDate.getFullYear() !== year ||
          checkDate.getMonth() !== (m - 1) ||
          checkDate.getDate() !== d
        ) {
          setMessages((prev) => [...prev, { role: "assistant", content: "⛔ Fecha inexistente. Verifique día/mes (ej: 31 de Febrero no existe).\n\n¿En qué **DÍA** nació?" }]);
          setInterviewStep('intro_dob_day'); // Regresar al inicio
          return;
        }

        const fullDate = `${dobDay}/${dobMonth}/${year}`;

        // Cálculo Edad preciso
        const birthDate = checkDate; // Ya validada
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const mDiff = today.getMonth() - birthDate.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }

        // A) LÓGICA DE INTEGRIDAD (Resetear CURP) & DATA UPDATE
        setPatientData((prev) => {
          // Si venimos de edición, la CURP vieja ya no sirve
          // Usamos la variable 'editMode' del closure (estado actual)
          const shouldResetCurp = editMode;

          return {
            ...prev,
            identificacion: {
              ...prev.identificacion,
              fechanac: fullDate,
              edad: age,
              curp: shouldResetCurp ? null : prev.identificacion.curp,
              curpValidated: shouldResetCurp ? false : prev.identificacion.curpValidated
            }
          };
        });

        // FORMATO VISUAL (UX-06): "2 de mayo de 1965"
        // FORMATO VISUAL (UX-06): "2 de mayo de 1965"
        const formattedDOB = formatDateLong(fullDate);

        // B) EL ROUTER V4.5 (Mirror Protocol)
        if (editMode) {
          setEditMode(false); // ðŸ³ï¸ Bajamos la bandera
          setInterviewStep('edit_identity_loop'); // â†©ï¸ RETURN al Menú

          setMessages((prev) => [...prev, { role: "assistant", content: `Fecha actualizada a: ${formattedDOB} (${age} años). ✅\n⚠️ Nota: Al cambiar su fecha, deberá validar su CURP nuevamente.\n\n¿Desea editar otro dato de identidad?` }]);
        } else {
          // ESTADO: Flujo Normal (Captura inicial)
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `Registrado: **${formattedDOB}**.\n\n¿Cuál es su sexo biológico?`,
            inputType: 'buttons',
            options: [
              { label: "Masculino", value: "Masculino" },
              { label: "Femenino", value: "Femenino" }
            ]
          }]);
          setInterviewStep("intro_sex");
        }

      }, 600);
    }

    // 1.3 Sexo (Con Botones V7.5)
    else if (interviewStep === "intro_sex") {
      let sex = normalizeInput(userMsg);
      // Normalización Robusta (Synonyms)
      if (['mujer', 'femenino', 'f', 'la paciente'].includes(sex.toLowerCase())) sex = "Femenino";
      if (['hombre', 'masculino', 'm', 'el paciente', 'varon'].includes(sex.toLowerCase())) sex = "Masculino";

      // Validar input manual o botón
      if (sex === "Masculino" || sex === "Femenino") {
        setPatientData((prev) => ({
          ...prev,
          identificacion: { ...prev.identificacion, sexo: sex }
        }));
        // DYNAMIC GENDER CONCORDANCE (V1.0)
        // const isFemale = sex === "Femenino"; // Unused after flow change

        setMessages((prev) => [...prev, { role: "assistant", content: "¿Cuál es su ocupación actual?" }]);
        setInterviewStep("intro_job");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor seleccione una opción válida." }]);
      }
    }

    // 1.3b Estado Civil (V7.5) - Nuevo Paso Intermedio
    else if (interviewStep === "intro_civil_status") {
      const status = formatText(userMsg);
      setPatientData(prev => ({ ...prev, identificacion: { ...prev.identificacion, civil_status: status } }));

      // PASO SIGUIENTE: Ocupación
      setMessages((prev) => [...prev, { role: "assistant", content: `Registrado: ${status}.\n\nPasemos a su **Domicilio**. ¿Cuál es su Código Postal?` }]);
      setInterviewStep("address_zip");
    }

    // 1.4 Ocupación -> CURP Direct Input (V7.7 HYBRID FLOW)
    else if (interviewStep === "intro_job") {
      const job = formatText(userMsg);
      setPatientData((prev) => ({
        ...prev,
        identificacion: { ...prev.identificacion, ocupacion: job }
      }));

      // V7.7: FLUJO HÍBRIDO (Input Directo + Botones Auxiliares)
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "¿Podría indicarme su Clave Única de Registro de Población (CURP)?\n*(Escríbala o elija una opción)*",
        options: [
          { label: "No me la sé / Búscala por mí", value: "HELP_CURP" },
          { label: patientData.identificacion.sexo === "Femenino" ? "Soy Extranjera" : "Soy Extranjero", value: "IS_FOREIGN" }
        ]
      }]);
      // Salto directo a manual, sin gate bloqueante
      setInterviewStep("intro_curp_manual");
    }

    // 1.5 CURP MANUAL INPUT & ROUTING (V7.7 HYBRID HANDLER)
    else if (interviewStep === "intro_curp_manual") {
      // A) BOTONES AUXILIARES (Quick Replies)
      if (userMsg === "HELP_CURP" || userMsg === "FIND_CURP") {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "No se preocupe, puedo generarla por usted.\nSolo necesito un dato final:\n\n**¿En qué Estado de la República nació?**"
          // MENU DESPLEGABLE SE RENDERIZA POR 'intro_curp_state'
        }]);
        setInterviewStep("intro_curp_state");
        return;
      }

      if (userMsg === "IS_FOREIGN") {
        setPatientData(prev => ({
          ...prev,
          identificacion: { ...prev.identificacion, nationality_type: 'FOREIGN', curp: null, curpValidated: true }
        }));
        const genderedForeign = patientData.identificacion.sexo === "Femenino" ? "Extranjera" : "Extranjero";
        setMessages(prev => [...prev, { role: "assistant", content: `Entendido. Paciente ${genderedForeign}.\n\nPor favor, ingrese su **Número de Pasaporte** o Documento Migratorio.` }]);
        setInterviewStep('intro_passport');
        return;
      }

      // B) INPUT DE TEXTO (CURP REAL)
      const curpInput = userMsg.trim().toUpperCase();
      // Regex Oficial CURP
      const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$/;

      if (curpRegex.test(curpInput)) {
        // V7.7: VALIDACIÓN DE INTEGRIDAD (CROSS-CHECK)
        const integrity = validateCurpIntegrity(curpInput, patientData);

        if (!integrity.valid) {
          setMessages((prev) => [...prev, { role: "assistant", content: `⛔ **Error de Validación**\n\n${integrity.error}\n\nPor favor verifique el dato e intente nuevamente:` }]);
          return;
        }

        setPatientData((prev) => ({
          ...prev,
          identificacion: { ...prev.identificacion, curp: curpInput, curpValidated: true }
        }));
        setMessages((prev) => [...prev, { role: "assistant", content: "✅ CURP Validada.\n\nPasemos ahora a sus datos de contacto. ¿Cuál es su número de teléfono celular?" }]);
        setInterviewStep("intro_phone");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "El formato de la CURP no es válido. Debe tener 18 caracteres alfanuméricos.\nIntente nuevamente o seleccione otra opción:" }]);
      }
    }

    // 1.5b CURP STATE SELECTION (GENERATOR)
    else if (interviewStep === "intro_curp_state") {
      const stateName = formatText(userMsg);
      // V8.0: LLAMADA AL MOTOR REAL
      const { nombre, apellidoPaterno, apellidoMaterno, fechanac, sexo } = patientData.identificacion;

      // Pasamos el estado capturado para el cálculo
      const calculatedCurp = generateCurpPrefix(nombre, apellidoPaterno, apellidoMaterno, fechanac, sexo, stateName);

      if (calculatedCurp && calculatedCurp.length === 18) {
        setTempItem(prev => ({ ...prev, generatedCurp: calculatedCurp }));
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `He calculado su CURP basada en sus datos:\n\n# **${calculatedCurp}**\n\n¿Es correcta?`,
          options: [
            { label: "Sí, es correcta", value: "CONFIRM_GENERATED_CURP" },
            { label: "No, corregir", value: "RETRY_CURP" }
          ]
        }]);
        setInterviewStep("intro_curp_validation");
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "No pude generar una CURP válida con los datos proporcionados. Por favor intente ingresarla manualmente." }]);
        setInterviewStep("intro_curp_manual");
      }
    }

    // 1.5c VALIDACIÓN CURP GENERADA
    else if (interviewStep === "intro_curp_validation") {
      if (userMsg === "CONFIRM_GENERATED_CURP" || userMsg.toLowerCase().includes("sí") || userMsg.toLowerCase().includes("si")) {
        // V8.1 FIX: PERSISTENCIA DE DATOS
        // Recuperamos la CURP generada del estado temporal
        const curpToSave = tempItem.generatedCurp;

        if (curpToSave) {
          setPatientData((prev) => ({
            ...prev,
            identificacion: { ...prev.identificacion, curp: curpToSave, curpValidated: true }
          }));
          setMessages(prev => [...prev, { role: "assistant", content: "✅ CURP Confirmada y Guardada.\n\nPasemos ahora a sus datos de contacto. ¿Cuál es su número de teléfono celular?" }]);
          setInterviewStep("intro_phone");
        } else {
          // Fallback por seguridad si se perdió el temp
          setMessages(prev => [...prev, { role: "assistant", content: "Hubo un problema al recuperar el dato. Por favor escríbala manualmente:" }]);
          setInterviewStep("intro_curp_manual");
        }

      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Por favor escriba su CURP manualmente:" }]);
        setInterviewStep("intro_curp_manual");
      }
    }

    // 1.6 Pasaporte (Extranjeros) WRAPPER (V7.7) - Transition check
    // Si llegamos a 'intro_passport' desde gate, App lo maneja.
    // Si hay un handler específico abajo para 'intro_passport', lo conservamos.
    // ... Revisamos el código existente abajo ...
    // De momento, 'intro_passport' ya estaba en el legacy, pero mejor reescribirlo limpio.

    // V8.0: HANDLING PASSPORT (FOREIGNER ROUTE)
    else if (interviewStep === "intro_passport") {
      setTimeout(() => {
        const passId = userMsg.trim().toUpperCase();
        if (passId.length < 5) {
          setMessages((prev) => [...prev, { role: "assistant", content: "El número de documento parece muy corto. Verifique." }]);
          return;
        }
        setPatientData((prev) => ({
          ...prev,
          identificacion: {
            ...prev.identificacion,
            passport_id: passId,
            nationality_type: 'FOREIGN' // Reinforce
          }
        }));
        setMessages((prev) => [...prev, { role: "assistant", content: "Documento Migratorio Registrado. \n\nContinuemos. ¿Cuál es su número de teléfono celular?" }]);
        setInterviewStep("intro_phone");
      }, 600);
    }

    // 1.6 Teléfono (+ Strict Validation V6.6)
    else if (interviewStep === "intro_phone") {
      setTimeout(() => {
        // Validación Estricta 10 Digitos
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(userMsg.trim())) {
          setMessages((prev) => [...prev, { role: "assistant", content: "El número debe tener exactamente 10 dígitos. Por favor verifíquelo." }]);
          return; // ⛔ BLOCK
        }

        setPatientData((prev) => ({
          ...prev,
          identificacion: { ...prev.identificacion, telefono: userMsg }
        }));
        const isPediatric = patientData?.identificacion?.edad < 12;
        const isTutor = patientData?.emergencia?.parentezco === 'Tutor/Madre/Padre';
        const user_address_label = (patientData?.emergencia?.nombre && isTutor) ? patientData.emergencia.nombre.split(' ')[0] : "Tutor";

        setMessages((prev) => [...prev, {
          role: "assistant",
          content: isPediatric ? `${user_address_label}, ¿en su hogar profesan alguna religión?` : "¿Profesa usted alguna religión?",
          options: [
            { label: "✅ Sí", value: "SI" },
            { label: "❌ No / Ninguna", value: "NO_NINGUNA" }
          ]
        }]);
        setInterviewStep("intro_religion");
      }, 600);
    }

    // 1.7 Religión (Flow Update V8.0 -> Address)
    else if (interviewStep === "intro_religion") {
      setTimeout(() => {


        if (strictBooleanValidator(userMsg) === false || userMsg === "NO_NINGUNA" || userMsg === "❌ No / Ninguna") {
          setPatientData((prev) => ({
            ...prev,
            identificacion: {
              ...prev.identificacion,
              religion: "NINGUNA",
              religion_data: { has_religion: false, name: "NONE", diet_flags: [] }
            },
            profile: { ...prev.profile, has_religion: false, religion: "Ninguna" }
          }));
          // V8.0 FIX: Jump to Address (Civil Status already collected)
          // V8.1 FIX: RE-ROUTE to Civil Status (Moved here)
          const sexValue = patientData.identificacion?.sexo || patientData.profile?.sex || "";
          const isFemale = sexValue.toLowerCase() === "femenino" || sexValue.toLowerCase() === "mujer";
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: "Entendido.\n\n¿Cuál es su Estado Civil legal?",
            options: [
              { label: isFemale ? "Soltera" : "Soltero", value: isFemale ? "Soltera" : "Soltero" },
              { label: isFemale ? "Casada" : "Casado", value: isFemale ? "Casada" : "Casado" },
              { label: "Unión Libre", value: "Unión Libre" },
              { label: isFemale ? "Divorciada" : "Divorciado", value: isFemale ? "Divorciada" : "Divorciado" },
              { label: isFemale ? "Viuda" : "Viudo", value: isFemale ? "Viuda" : "Viudo" }
            ]
          }]);
          setInterviewStep("intro_civil_status");
        }
        else if (strictBooleanValidator(userMsg) === true || userMsg === "SI" || userMsg === "✅ Sí") {
          setPatientData(prev => ({ ...prev, profile: { ...prev.profile, has_religion: true } }));
          setMessages((prev) => [...prev, { role: "assistant", content: "Para considerar cualquier restricción alimentaria en su menú, ¿me podría indicar cuál es?" }]);
          setInterviewStep("intro_religion_spec");
        }
        // LOGIC BRANCH C: DIRECT ANSWER (e.g. "Católica")
        else {
          const relName = formatText(userMsg);
          setPatientData((prev) => ({
            ...prev,
            identificacion: {
              ...prev.identificacion,
              religion: relName,
              religion_data: { has_religion: true, name: relName, diet_flags: [] }
            },
            profile: { ...prev.profile, has_religion: true, religion: relName }
          }));
          const sexValue = patientData.identificacion?.sexo || patientData.profile?.sex || "";
          const isFemale = sexValue.toLowerCase() === "femenino" || sexValue.toLowerCase() === "mujer";
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `Registrado: ${relName}.\n\n¿Cuál es su Estado Civil legal?`,
            options: [
              { label: isFemale ? "Soltera" : "Soltero", value: isFemale ? "Soltera" : "Soltero" },
              { label: isFemale ? "Casada" : "Casado", value: isFemale ? "Casada" : "Casado" },
              { label: "Unión Libre", value: "Unión Libre" },
              { label: isFemale ? "Divorciada" : "Divorciado", value: isFemale ? "Divorciada" : "Divorciado" },
              { label: isFemale ? "Viuda" : "Viudo", value: isFemale ? "Viuda" : "Viudo" }
            ]
          }]);
          setInterviewStep("intro_civil_status");
        }
      }, 600);
    }

    else if (interviewStep === "intro_religion_spec") {
      setTimeout(() => {
        const relName = formatText(userMsg);
        setPatientData((prev) => ({
          ...prev,
          identificacion: {
            ...prev.identificacion,
            religion: relName,
            religion_data: { has_religion: true, name: relName, diet_flags: [] }
          }
        }));
        const sexValue = patientData.identificacion?.sexo || patientData.profile?.sex || "";
        const isFemale = sexValue.toLowerCase() === "femenino" || sexValue.toLowerCase() === "mujer";
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `Registrado: ${relName}.\n\n¿Cuál es su Estado Civil legal?`,
          options: [
            { label: isFemale ? "Soltera" : "Soltero", value: isFemale ? "Soltera" : "Soltero" },
            { label: isFemale ? "Casada" : "Casado", value: isFemale ? "Casada" : "Casado" },
            { label: "Unión Libre", value: "Unión Libre" },
            { label: isFemale ? "Divorciada" : "Divorciado", value: isFemale ? "Divorciada" : "Divorciado" },
            { label: isFemale ? "Viuda" : "Viudo", value: isFemale ? "Viuda" : "Viudo" }
          ]
        }]);
        setInterviewStep("intro_civil_status");
      }, 600);
    }

    // 1.9 CP (+ RexEx + Split Flow + Real Data Connection V6.6)
    else if (interviewStep === "address_zip") {
      setTimeout(async () => {
        const cpInput = userMsg.trim();
        // Regex V6.5
        if (!/^[0-9]{5}$/.test(cpInput)) {
          setMessages((prev) => [...prev, { role: "assistant", content: "Ese código postal no parece correcto (debe tener 5 dígitos). Por favor verifíquelo." }]);
          return;
        }

        try {
          // INDICADOR DE CARGA (Opcional, pero buena UX)
          // Aquí hacemos el fetch real
          const response = await fetch(`http://localhost:5000/api/cp/${cpInput}`);

          if (!response.ok) {
            // Caso B: CP NO EXISTE (HOTFIX V2.5 - Retry Loop)
            if (response.status === 404) {
              setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ El código postal ${cpInput} no aparece en la base de datos nacional. ¿Podría verificarlo e intentarlo nuevamente?` }]);
            } else {
              setMessages((prev) => [...prev, { role: "assistant", content: "Error al consultar la base de datos. ¿Podría intentarlo nuevamente?" }]);
            }
            return; // Se mantiene en 'address_zip' para reintento
          }

          const data = await response.json();
          // data = { municipio, estado, ciudad, colonias: [] }

          // Guardamos datos geográficos base y CP validado
          setPatientData((prev) => ({
            ...prev,
            domicilio: {
              ...prev.domicilio,
              cp: cpInput,
              municipio: data.municipio,
              estado: data.estado
            }
          }));

          // Guardamos lista temporal para el siguiente paso
          setTempColoniaList(data.colonias);

          // V9.0: ADAPTIVE UI - Usar Options para Dropdown
          const colonyOptions = data.colonias.map((c) => ({ label: c, value: c }));

          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `He encontrado estas colonias en ${data.municipio}, ${data.estado}. Por favor seleccione la suya:`,
            options: colonyOptions,
            inputType: 'strict_select'
          }]);
          setInterviewStep("address_colonia_select");

        } catch (error) {
          console.error("Fetch CP Error:", error);
          setMessages((prev) => [...prev, { role: "assistant", content: "Error de conexión con el servidor de Códigos Postales." }]);
        }
      }, 600);
    }

    // 1.8b Selección de Colonia (HOTFIX V2.5 - Strict Validation & Index Mapping)
    else if (interviewStep === "address_colonia_select") {
      setTimeout(() => {
        let selectedColonia = userMsg.trim();
        const max = tempColoniaList.length;

        // V9.0: DUAL SUPPORT (Index or Name)
        if (/^\d+$/.test(selectedColonia)) {
          const selection = parseInt(selectedColonia);
          if (selection >= 1 && selection <= max) {
            selectedColonia = tempColoniaList[selection - 1];
          } else {
            setMessages((prev) => [...prev, { role: "assistant", content: `⚠️  El número ${selection} no es válido. Elija entre 1 y ${max}.` }]);
            return;
          }
        }
        else {
          const match = tempColoniaList.find(c => c.toLowerCase() === selectedColonia.toLowerCase());
          if (match) selectedColonia = match;
          else {
            setMessages((prev) => [...prev, { role: "assistant", content: `⚠️  No reconozco la colonia "${selectedColonia}". Por favor seleccione una de la lista.` }]);
            return;
          }
        }

        setPatientData((prev) => ({
          ...prev,
          domicilio: { ...prev.domicilio, colonia: selectedColonia }
        }));
        setMessages((prev) => [...prev, { role: "assistant", content: `Entendido (${selectedColonia}). Finalmente, ¿cuál es su Calle y Número exterior?` }]);
        setInterviewStep("address_street");
      }, 600);
    }

    // 1.8c Calle
    else if (interviewStep === "address_street") {
      setTimeout(() => {
        const cleanStreet = formatText(userMsg);

        // Validación explícita de Calle y Número 
        // Permite letras, números y espacios (e.g. "morelos 13")
        if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ0-9\s#\-.,]+$/.test(cleanStreet) || cleanStreet.length < 3) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: "Por favor, ingrese un nombre de calle y número válidos (ej. Morelos 13)."
          }]);
          return; // No avanza si falla la validación
        }

        setPatientData((prev) => {
          const newData = {
            ...prev,
            domicilio: { ...prev.domicilio, calle: cleanStreet }
          };
          setTimeout(() => triggerPhase1Summary(newData), 50);
          return newData;
        });

        setInterviewStep("appointment"); // Hand over to Cortex

        // 💾 CP2: Address Confirmed (End of Phase 1)
        saveSessionProgress(1, 'PHASE_1_SUMMARY_CONFIRM');
      }, 600);
    }

    // -----------------------------------------------------------------------
    // FASE 2: SEGURIDAD (2.1 - 2.3)
    // -----------------------------------------------------------------------

    else if (interviewStep === "emergency_name") {
      setTimeout(() => {
        const inputName = formatText(userMsg);

        // V9.1 VALIDACIÓN ESTRICTA (NO NÚMEROS)
        // Regex: Letras, espacios, puntos (para abreviaturas), acentos.
        const nameRegex = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s.]+$/;

        if (!nameRegex.test(inputName) || /\d/.test(inputName)) {
          setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Por favor ingrese un nombre válido (sin números)." }]);
          return;
        }

        setPatientData((prev) => ({
          ...prev,
          emergencia: { ...prev.emergencia, nombre: inputName }
        }));

        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "¿Qué **parentesco** tiene esa persona con usted?",
          options: [
            { label: "Cónyuge", value: "Cónyuge" },
            { label: "Padre", value: "Padre" },
            { label: "Madre", value: "Madre" },
            { label: "Hermano", value: "Hermano" },
            { label: "Hermana", value: "Hermana" },
            { label: "Otro Familiar", value: "Otro Familiar" },
            { label: "Ninguno", value: "Ninguno" }
          ]
        }]);
        setInterviewStep("emergency_relation");
      }, 600);
    }
    else if (interviewStep === "emergency_relation") {
      setTimeout(() => {
        let parentescoVal = formatText(userMsg);

        if (userMsg.toLowerCase().includes("conyuge")) parentescoVal = "Cónyuge";

        setPatientData((prev) => ({
          ...prev,
          emergencia: { ...prev.emergencia, parentesco: parentescoVal }
        }));
        setMessages((prev) => [...prev, { role: "assistant", content: "¿Me dicta el **número de teléfono** a 10 dígitos de esa persona?" }]);
        setInterviewStep("emergency_phone");
      }, 600);
    }
    else if (interviewStep === "emergency_phone") {
      setTimeout(() => {
        // Validación Estricta 10 Dígitos (Reutilizada)
        const phoneRegex = /^[0-9]{10}$/;
        const inputClean = userMsg.replace(/\D/g, ''); // Limpiar input

        if (!phoneRegex.test(inputClean)) {
          setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ¡Atención! El número debe tener exactamente 10 dígitos (usted ingresó ${inputClean.length}). Por favor verifíquelo e intente de nuevo.` }]);
          return; // ⛔ BLOCK
        }

        // REDUNDANCY CHECK (PH2-EMERGENCY-TEL)
        // El número de emergencia NO debe ser igual al del paciente
        const patientPhone = patientData.identificacion?.telefono?.replace(/\D/g, '');
        if (patientPhone && inputClean === patientPhone) {
          setMessages((prev) => [...prev, { role: "assistant", content: "Por seguridad, el número de emergencia debe ser distinto al suyo. ¿Tiene otro número de contacto?" }]);
          return; // ⛔ BLOCK
        }

        setPatientData((prev) => ({
          ...prev,
          emergencia: { ...prev.emergencia, telefono: inputClean }
        }));
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "Seguridad Completada.\n\nPara optimizar nuestro algoritmo clínico, necesito saber: **¿Cuál es el objetivo principal de su visita hoy?**",
          options: [
            { label: "⚖️ Bajar de Peso", value: "GOAL_WEIGHT_LOSS" },
            { label: "💪 Ganar Músculo", value: "GOAL_MUSCLE" },
            { label: "🏅 Rendimiento Deportivo", value: "GOAL_SPORT" },
            { label: "🩺 Control Clínico", value: "GOAL_CLINICAL" },
            { label: "🤰 Etapa de Vida", value: "GOAL_LIFE_STAGE" },
            { label: "🥗 Aprender a Comer", value: "GOAL_EDUCATION" }
          ]
        }]);
        setInterviewStep("clinica_triage_start"); // REDIRECCIÓN A FASE 3A

        // 💾 CP3: Emergency Contact Confirmed (End of Phase 2)
        saveSessionProgress(2, 'clinica_triage_start');

      }, 600);
    }

    // -----------------------------------------------------------------------
    // FASE 0: TRIAJE CLÍNICO (EL ANCLA) - V2.0
    // -----------------------------------------------------------------------

    // PASO A: LA PREGUNTA MAESTRA (NLP)
    // PASO A: LA PREGUNTA MAESTRA (MOTIVO PRINCIPAL) + CORTEX ANALYSIS
    // PASO A: DEFINICIÓN DE OBJETIVO (PH3-GOAL)
    // Reemplaza el text input libre con selección determinista
    else if (interviewStep === "clinica_triage_start") {
      setTimeout(() => {
        // En este punto, userMsg ya contiene el VALUE del botón (ej: GOAL_WEIGHT_LOSS)
        // porque el onClick invoca handleSend(opt.value)

        const goalMap = {
          'GOAL_WEIGHT_LOSS': { avatar: 'METABOLIC', risk: 'LOW', label: 'Bajar de Peso' },
          'GOAL_MUSCLE': { avatar: 'PERFORMANCE', risk: 'LOW', label: 'Ganar Músculo' },
          'GOAL_SPORT': { avatar: 'PERFORMANCE', risk: 'HIGH', label: 'Rendimiento Deportivo' },
          'GOAL_CLINICAL': { avatar: 'CLINICAL', risk: 'MEDIUM', label: 'Control Clínico' },
          'GOAL_LIFE_STAGE': { avatar: 'CLINICAL', risk: 'MEDIUM', label: 'Etapa de Vida' },
          'GOAL_EDUCATION': { avatar: 'LONGEVITY', risk: 'LOW', label: 'Aprender a Comer' }
        };

        const config = goalMap[userMsg] || { avatar: 'METABOLIC', risk: 'LOW', label: formatText(userMsg) };

        setPatientData(prev => ({
          ...prev,
          clinica: { ...prev.clinica, motivo_consulta: config.label }, // Legacy support
          clinical_context: {
            ...prev.clinical_context, // Safe spread
            primary_motive: config.label,
            goal: userMsg, // Store raw code for algorithm weights
            ai_analysis: {
              avatar_assigned: config.avatar,
              risk_level: config.risk,
              detected_tags: [] // Will be populated by body map
            },
            history: [...(prev.clinical_context?.history || []), {
              question: "Objetivo Principal",
              answer: config.label, // "Bajar de Peso"
              timestamp: new Date().toISOString()
            }],
            secondary_symptoms: ""
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: `Entendido (${config.label}). Hemos configurado su perfil clínico.\n\nPara ser más precisos, por favor **indique en el mapa** dónde siente mayor molestia o si hay zonas específicas a tratar.` }]);
        setInterviewStep("clinica_body_map"); // Trigger VisualBodyMap
      }, 600);
    }

    // PASO B: MAPA DEL DOLOR (BODY MAP)
    else if (interviewStep === "clinica_body_map") {
      if (userMsg === 'BODY_MAP_COMPLETE') {
        setTimeout(() => {
          // V10.0 FIX: SKIP REDUNDANT INTENSITY QUESTION (Already captured in Body Map)
          // Check for High Risk Flag in history/context if needed, but VisualBodyMap handles the alert.
          // Here we just transition to the next logical step (Symptoms or Safety).

          const context = patientData.clinical_context;
          const isHighRisk = context.ai_analysis.risk_level === 'HIGH';

          if (isHighRisk) {
            // If high risk detected by body map, we might have already shown the alert.
            // We guide to safety check or open symptoms.
            setMessages(prev => [...prev, { role: "assistant", content: "Entendido. ¿Podría describir brevemente cualquier otro síntoma o detalle importante que no aparezca en el mapa?" }]);
            setInterviewStep("clinica_triage_symptoms");
          } else {
            setMessages(prev => [...prev, { role: "assistant", content: "Entendido. ¿Podría describir brevemente cualquier otro síntoma o detalle importante que no aparezca en el mapa?" }]);
            setInterviewStep("clinica_triage_symptoms");
          }
        }, 600);
      }
    }

    // PASO C: ESCALA DE INTENSIDAD (INTENSITY CHECK)
    else if (interviewStep === "clinica_triage_intensity") {
      setTimeout(() => {
        const intensity = parseInt(userMsg, 10);

        // VALIDATION
        if (isNaN(intensity) || intensity < 0 || intensity > 10) {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor, ingrese un número del 0 al 10." }]);
          return;
        }

        // SAFETY CHECK (RED FLAG LOGIC)
        const currentTags = patientData.clinical_context.ai_analysis.detected_tags || [];
        const highRiskZones = ['CARDIO_RISK', 'GASTRIC_RISK', 'HEADACHE_RISK']; // Chest, Upper Abdomen, Head
        const hasHighRiskZone = currentTags.some(tag => highRiskZones.includes(tag));

        // RECORD HISTORY & SET STATE
        setPatientData(prev => ({
          ...prev,
          clinical_context: {
            ...prev.clinical_context,
            // Only update AI if high risk, else just history
            ai_analysis: (intensity >= 8 && hasHighRiskZone) ? {
              ...prev.clinical_context.ai_analysis,
              risk_level: 'HIGH',
              detected_tags: [...prev.clinical_context.ai_analysis.detected_tags, 'RED_FLAG_SYMPTOM']
            } : prev.clinical_context.ai_analysis,
            history: [...(prev.clinical_context?.history || []), {
              question: "Intensidad del Malestar (0-10)",
              answer: `${intensity}/10`,
              timestamp: new Date().toISOString()
            }]
          }
        }));

        if (intensity >= 8 && hasHighRiskZone) {
          // 🚨 TRIGGER RED FLAG PROTOCOL
          setMessages(prev => [...prev, { role: "assistant", content: "⚠️ **DETECCIÓN DE RIESGO ALTO**\n\nSu nivel de dolor y la zona indicada sugieren atención prioritaria. ¿Está tomando algún medicamento actualmente para esto?" }]);
          setInterviewStep("intro_triage_safety"); // Redirect to safety/med check
        } else {
          // NORMAL FLOW
          setMessages(prev => [...prev, { role: "assistant", content: "Entendido. ¿Podría describir brevemente cualquier otro síntoma o detalle importante que no aparezca en el mapa?" }]);
          setInterviewStep("clinica_triage_symptoms");
        }

      }, 600);
    }

    // PASO RISK-HIGH: SEGURIDAD
    else if (interviewStep === "intro_triage_safety") {
      setTimeout(() => {
        // Guardamos respuesta de seguridad (aunque no tenga campo específico en DB V1.0, lo anexamos a notas)
        const safetyResponse = userMsg;

        setPatientData(prev => ({
          ...prev,
          // Append to clinical context just in case
          clinical_context: {
            ...prev.clinical_context,
            secondary_symptoms: `[SAFETY CHECK: ${safetyResponse}] ` + prev.clinical_context.secondary_symptoms
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "Entendido, registrado. ¿Presenta alguna otra molestia o síntoma adicional?" }]);
        setInterviewStep("intro_triage_symptoms");
      }, 600);
    }

    // PASO B: SINTOMATOLOGÍA ADICIONAL (CIERRE DE TRIAJE)

    // PASO B: SINTOMATOLOGÍA ADICIONAL (NUEVO V2.2 + CORTEX LINK)
    // PASO D: SINTOMATOLOGÍA ADICIONAL (CIERRE DE TRIAJE)
    else if (interviewStep === "clinica_triage_symptoms" || interviewStep === "intro_triage_symptoms") {
      setTimeout(() => {
        const symptomsInput = formatText(userMsg);

        // 1. Guardar Síntomas (Cortex Schema)
        setPatientData(prev => ({
          ...prev,
          clinica: { ...prev.clinica, ipas_texto: symptomsInput }, // Legacy Sync
          clinical_context: {
            ...prev.clinical_context,
            secondary_symptoms: prev.clinical_context.secondary_symptoms + symptomsInput,
            history: [...(prev.clinical_context?.history || []), {
              question: "Sintomatología Adicional",
              answer: symptomsInput,
              timestamp: new Date().toISOString()
            }]
          }
        }));

        // 2. DETECCIÓN DE PALABRAS CLAVE (EMPATHY ENGINE V3.0)
        const highSeverityKeywords = ['cancer', 'cáncer', 'matriz', 'amputa', 'duelo', 'falleci', 'muerte', 'perdí', 'tumor', 'maligno', 'quimio'];
        const sensitiveKeywords = ['quiste', 'biopsia', 'seno', 'mama', 'oncologo']; // Lower tier
        const surgeryKeywords = ['operacion', 'cirugia', 'cesarea', 'apendice', 'vesicula', 'histerectomia'];

        const isHighSeverity = highSeverityKeywords.some(kw => symptomsInput.toLowerCase().includes(kw));
        const isSensitive = sensitiveKeywords.some(kw => symptomsInput.toLowerCase().includes(kw));
        const isSurgery = surgeryKeywords.some(kw => symptomsInput.toLowerCase().includes(kw));

        if (isHighSeverity) {
          // PROTOCOLO DE ALTA SENSIBILIDAD (V3)
          setInterviewStep("clinica_triage_containment"); // New Containment Step
        } else if (isSensitive) {
          // PROTOCOLO DE SENSIBILIDAD MEDIA (V2)
          setMessages(prev => [...prev, { role: "assistant", content: "Entiendo la importancia de lo que menciona. Para poder apoyarle mejor, ¿le gustaría compartir un poco más sobre este diagnóstico o prefiere que lo abordemos con detalle directamente en la consulta?" }]);
          setInterviewStep("clinica_triage_sensitive_followup");
        } else if (isSurgery) {
          setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Dado que menciona un procedimiento quirúrgico, ¿hace cuánto tiempo fue o cuándo está programado?" }]);
          setInterviewStep("intro_triage_surgery");
        } else {
          // FLUJO NORMAL
          setMessages(prev => [...prev, { role: "assistant", content: "Tomado en cuenta. He registrado su estatus.\n\nPara diseñar su plan con precisión y detectar riesgos en su carga genética, necesito saber: ¿Sus padres, abuelos o hermanos han sido diagnosticados con alguna de estas condiciones? (Diabetes, Hipertensión, Cáncer, Enfermedad Renal, Problemas Cardíacos o de Tiroides)." }]);
          setInterviewStep("ph3_family_parser");
        }
      }, 600);
    }

    // SUB-RUTINA A0: CONTAINMENT (EMPATHY ENGINE V3.1 - SEQUENTIAL)
    else if (interviewStep === "clinica_triage_containment") {
      setTimeout(() => {
        // 0. Detect Specific Keyword for Context
        const sensitiveKeywords = ['cancer', 'cáncer', 'tumor', 'falleci', 'muerte', 'matriz', 'duelo', 'luto', 'perdida', 'pérdida'];
        const matchedKw = sensitiveKeywords.find(kw => userMsg.toLowerCase().includes(kw)) || "Tema Sensible";

        // 1. Log Special Priority (Dynamic)
        setPatientData(prev => ({
          ...prev,
          clinical_context: {
            ...prev.clinical_context,
            history: [...(prev.clinical_context?.history || []), {
              question: "⚠️ Reporte de Sensibilidad",
              answer: `Tema identificado: "${matchedKw.toUpperCase()}". Protocolo de contención activado.`,
              timestamp: new Date().toISOString()
            }]
          }
        }));

        // 2. Extract First Name for Personalization
        const firstName = (patientData.profile?.name || "Paciente").split(' ')[0];
        const nameStr = firstName !== "NOM" ? firstName : "";

        // 3. SECUENCIA TEMPORIZADA (V3.1 - FORMAL TONE CORRECTION)
        // MSG 1 (Inmediato)
        setMessages(prev => [...prev, { role: "assistant", content: `${nameStr}, agradezco profundamente su confianza al compartirme algo tan personal. Lamento mucho que esté pasando por este proceso de incertidumbre; entiendo que una noticia así genera mucha preocupación.` }]);

        // 5s DELAY -> MSG 2 (Priority Assurance)
        setTimeout(() => {
          setMessages(prev => [...prev, { role: "assistant", content: "He marcado este dato como Prioridad Máxima en su expediente. Su nutriólogo abordará el tema con toda la sensibilidad y el cuidado que usted merece desde el primer minuto de la consulta." }]);

          // 2.5s DELAY -> MSG 3 (Clinical Bridge - Option A Formal)
          setTimeout(() => {
            setMessages(prev => [...prev, { role: "assistant", content: "Para asegurarnos de cuidar cada aspecto de su salud, necesito completar su mapa genético:\n\n¿Sus padres, abuelos o hermanos han sido diagnosticados con alguna de estas condiciones?\n(Diabetes, Hipertensión, Cáncer, Enfermedad Renal, Problemas Cardíacos o de Tiroides).", options: [] }]);
            setInterviewStep("ph3_family_parser"); // Auto-transition
          }, 2500);

        }, 2500);

      }, 1000);
    }

    // SUB-RUTINA A: DETALLE SENSIBLE (EMPATHY ENGINE V2)
    else if (interviewStep === "clinica_triage_sensitive_followup") {
      setTimeout(() => {
        const sensitiveInfo = userMsg;

        // Log sensitive info properly
        setPatientData(prev => ({
          ...prev,
          clinical_context: {
            ...prev.clinical_context,
            secondary_symptoms: prev.clinical_context.secondary_symptoms + ` [DETALLE SENSIBLE: ${sensitiveInfo}]`,
            history: [...(prev.clinical_context?.history || []), {
              question: "Detalle Sensible (Seguimiento)",
              answer: sensitiveInfo,
              timestamp: new Date().toISOString()
            }]
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "Gracias por compartirlo. He registrado esta información como prioritaria en su expediente.\n\nPara diseñar su plan con precisión y detectar riesgos en su carga genética, necesito saber: ¿Sus padres, abuelos o hermanos han sido diagnosticados con alguna de estas condiciones? (Diabetes, Hipertensión, Cáncer, Enfermedad Renal, Problemas Cardíacos o de Tiroides)." }]);
        setInterviewStep("ph3_family_parser");
      }, 600);
    }

    // SUB-RUTINA B: QUIRÚRGICA (SEGURIDAD)
    else if (interviewStep === "intro_triage_surgery") {
      setTimeout(() => {
        const lower = userMsg.toLowerCase();
        let status = "NONE";
        let msg = "";

        if (lower.includes('pre') || lower.includes('prepara') || lower.includes('antes') || lower.includes('programada')) {
          status = "PRE";
          msg = "⚠️  ALERTA: Suspender suplementos anticoagulantes (Ajo, Omega-3, Ginkgo) 7 días antes.";
        } else if (lower.includes('ya') || lower.includes('post') || lower.includes('pasó') || lower.includes('paso')) {
          status = "POST";
          msg = "⚠️  ALERTA: Validar alta médica antes de iniciar esfuerzo físico.";
        }

        setPatientData(prev => ({
          ...prev,
          clinical_triage: { ...prev.clinical_triage, surgery_status: status, triage_completed: true },
          clinical_context: {
            ...prev.clinical_context,
            history: [...(prev.clinical_context?.history || []), {
              question: "Estatus Quirúrgico",
              answer: msg ? `${status} (${msg})` : "Sin Intervenciones Recientes",
              timestamp: new Date().toISOString()
            }]
          }
        }));

        // PASO 4: TRANSICIÓN A HEREDOFAMILIARES (OPEN HOOK CORRECTO)
        const prompt = "Para diseñar su plan con precisión y detectar riesgos en su carga genética, necesito saber: ¿Sus padres, abuelos o hermanos han sido diagnosticados con alguna de estas condiciones? (Diabetes, Hipertensión, Cáncer, Enfermedad Renal, Problemas Cardíacos o de Tiroides).";

        const finalMsg = status !== 'NONE' ? `${msg}\n\nTomado en cuenta. He registrado su estatus.\n\n${prompt}` : `Entendido.\n\n${prompt}`;

        setMessages(prev => [...prev, { role: "assistant", content: finalMsg }]);
        setInterviewStep("ph3_family_parser");
      }, 600);
    }

    // SUB-RUTINA B: DIGESTIVA (REMOVED FROM MAIN FLOW - NOW HANDLED IN PHASE 3 OR SYMPTOM CHECK IF NEEDED, BUT REQUEST ASKED FOR SPECIFIC SEQUENCE)
    // NOTE: The request V2.2 overrides previous logic. "Safety (Solo si aplica)" implies mostly Surgery context.
    // Keeping "intro_triage_digest" and "weight" in code but unreachable unless NLP logic in "symptoms" step is expanded.
    // For now, adhering strictly to "Safety (Surgery)" as per prompt. The Digestive/Metabolic branches are less "Safety Critical" in Triage than Surgery.
    // However, I should probably respect existing checks if they don't conflict. 
    // The prompt says: "Detectar PRE-OP -> Lanzar Alerta -> Guardar tag". Matches surgery.
    // I will comment out the other branches in the `intro_triage_symptoms` logic unless explicitly requested back, to avoid breaking the "Motive -> Symptoms -> Safety -> Heredo" strict sequence.
    // Wait, the prior code had Digest/Metabolic branches. If I remove them, I lose that logic. 
    // But the prompt says "Corrección de Flujo V2.2".
    // I will keep the code for `intro_triage_digest` and `intro_triage_weight` definitions but they are currently disconnected from the flow.
    // This is safer to avoid modifying unused code blocks too much, but `intro_triage_symptoms` only points to `surgery` or `ahf_start`.

    /* 
    else if (interviewStep === "intro_triage_digest") { ... } 
    else if (interviewStep === "intro_triage_weight") { ... }
    */



    // SUB-RUTINA B: DIGESTIVA
    else if (interviewStep === "intro_triage_digest") {
      setTimeout(() => {
        const lower = userMsg.toLowerCase();
        let type = "NONE";
        // let msg = "";

        if (lower.includes('estreñ') || lower.includes('constipa')) {
          type = "CONSTIPATION";
          // msg = "✅ Regla Clínica: Priorizar fibra insoluble.";
        } else if (lower.includes('inflama') || lower.includes('diarrea') || lower.includes('gases')) {
          type = "INFLAMMATION";
          // msg = "ðŸš« Regla Clínica: Bloquear dosis altas de fibra (FODMAPs Caution).";
        }

        setPatientData(prev => ({
          ...prev,
          clinical_triage: { ...prev.clinical_triage, gut_type: type, triage_completed: true }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "Anotado. Adaptaremos la dieta a su tolerancia digestiva.\n\nPasemos a sus antecedentes familiares." }]);
        setInterviewStep("ahf_start");
      }, 600);
    }

    // SUB-RUTINA C: METABÓLICA
    else if (interviewStep === "intro_triage_weight") {
      setTimeout(() => {
        const lower = userMsg.toLowerCase();
        let history = "STABLE";
        let alert = "";

        // Check age for Sarcopenia Logic
        const age = patientData.identificacion.edad || 0;

        if (lower.includes('baj') || lower.includes('perd') || lower.includes('men')) {
          history = "LOSS";
          if (age > 60) alert = "ðŸš¨ ALERTA ROJA: Descartar Sarcopenia o Patología Oncológica.";
        } else if (lower.includes('sub') || lower.includes('aument') || lower.includes('gan')) {
          history = "GAIN";
          alert = "ℹ️ Nota: Protocolo Anti-inflamatorio sugerido.";
        }

        setPatientData(prev => ({
          ...prev,
          clinical_triage: { ...prev.clinical_triage, weight_history: history, triage_completed: true }
        }));

        if (alert) {
          setMessages(prev => [...prev, { role: "assistant", content: `${alert}\n\nContinuemos con su historial clínico.` }]);
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Registro de peso actualizado. Continuemos con su historial clínico." }]);
        }
        setInterviewStep("ahf_start");

      }, 600);
    }

    // REDIRECCIÓN DESDE EMERGENCY (CONEXIÓN F1 -> F0)
    // Buscamos donde redirigir desde 'emergency_phone'. 
    // NOTA: El código original tenía:
    // setMessages((prev) => [...prev, { role: "assistant", content: "Pasamos ahora a la Fase Clínica. ¿Existen antecedentes de enfermedades crónicas en su familia directa? (Ej. Diabetes, Hipertensión, Cáncer, Cardiopatías)." }]);
    // setInterviewStep("ahf_start");
    // Lo sobreescribiremos en el siguiente bloque para que apunte a intro_triage_start.


    // -----------------------------------------------------------------------
    // FASE 4: HISTORIA FAMILIAR (GOLDEN MASTER V4.0)
    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    // FASE 4: HISTORIA FAMILIAR (GOLDEN MASTER V5.0 - PARSER ESTRUCTURADO)
    // -----------------------------------------------------------------------

    // PASO 1: PARSER ESTRUCTURADO (PH3-FAMILY-PARSER)
    // Replaces old ahf_start
    else if (interviewStep === "ph3_family_parser" || interviewStep === "ahf_start") {
      setTimeout(() => {
        const rawText = userMsg;
        const lower = rawText.toLowerCase();

        // 1. DETECCIÓN DE NEGACIÓN (SKIP)
        const negationKeywords = ['no', 'ninguno', 'ninguna', 'sanos', 'nadie', 'todo bien', 'ningun'];
        // Simple accurate check: if short input and contains negation, or just 'no'
        const isNegation = (lower.length < 20 && negationKeywords.some(kw => lower.includes(kw))) || lower === 'no';

        // 1.5 DETECCIÓN DE AMBIGÜEDAD / AFIRMACIÓN CORTA (Q22-DRILL)
        // Checks for "Si", "Sí", "Claro", "Así es", "Por supuesto" with short length
        const affirmationKeywords = ['si', 'sí', 'claro', 'asi es', 'por supuesto', 'correcto'];
        const isShortAffirmative = lower.length < 12 && affirmationKeywords.some(kw => lower.includes(kw));

        if (isShortAffirmative && !isNegation) {
          // ⚠️ DRILL-DOWN: Split Flow (V2.0)
          setMessages(prev => [...prev, {
            role: "assistant",
            content: "Entendido. Para completar su expediente, necesito el detalle:\n\n¿De qué **familiar** estamos hablando?",
            options: [
              { label: "Madre", value: "FAM_MOTHER" },
              { label: "Padre", value: "FAM_FATHER" },
              { label: "Abuelo/a", value: "FAM_GRANDPARENT" },
              { label: "Hermano/a", value: "FAM_SIBLING" },
              { label: "Otro", value: "FAM_OTHER" }
            ]
          }]);
          setInterviewStep("ph3_family_relative_select");
          return;
        }

        let structuredData = [];
        let hasRisk = true;

        if (isNegation) {
          hasRisk = false;
        } else {
          // 2. PARSER DE ENTIDADES (PRIMITIVE NLP)
          // Buscamos pares Entidad + Condición en el texto
          const entities = [
            { key: 'FATHER', regex: /pap[áa]|padre/ },
            { key: 'MOTHER', regex: /mam[áa]|madre/ },
            { key: 'GRANDFATHER', regex: /abuel[oa]/ }, // Catch both genders
            { key: 'SIBLING', regex: /herman[oa]/ }
          ];

          const conditions = [
            { key: 'DIABETES', regex: /diabetes|az[úu]car|diab[ée]tic[oa]/ },
            { key: 'HYPERTENSION', regex: /hipertensi[óo]n|presi[óo]n|tensi[óo]n/ },
            { key: 'CANCER', regex: /c[áa]ncer|tumor|oncol[óo]gic/ },
            { key: 'RENAL', regex: /renal|ri[ñn][óo]n/ },
            { key: 'CARDIAC', regex: /card[íi]ac[oa]|coraz[óo]n|infarto/ },
            { key: 'THYROID', regex: /tiroides|hipotiroidismo/ }
          ];

          // Very basic sentence splitting to try to associate relative -> condition
          // For V1 (Regex), we might just check presence. "Papá diabetes" -> FATHER, DIABETES.
          // If user says "Papá y mamá diabetes", this simple logic might miss one association or duplicate.
          // Let's do a loose extraction: If relative mentioned, scan for conditions near it?
          // Complex NLP is hard in regex. 
          // SIMPLIFIED APPROACH V5.0: 
          // Check presence of Relative. Check presence of Condition. 
          // If "Diabetes" exists, assign to WHO? 
          // Safe fallback: Just store detected entities.

          // BETTER PARSER:
          // Iterate phrases (split by comma/y).
          const phrases = lower.split(/[,y.]/);

          // Contextual Drill-Down (Relative without Condition)
          let mentionedRelative = null;

          phrases.forEach(phrase => {
            let detectedRelative = null;

            // Find relative in this phrase
            for (const rel of entities) {
              if (rel.regex.test(phrase)) {
                detectedRelative = rel.key;
                mentionedRelative = rel.key; // Track globally
                break;
              }
            }

            // Find conditions in this phrase
            if (detectedRelative) {
              conditions.forEach(cond => {
                if (cond.regex.test(phrase)) {
                  structuredData.push({ relative: detectedRelative, condition: cond.key, detail: phrase.trim() });
                }
              });
            }
          });

          // Fallback if parsing failed but text is long (likely has info)
          if (structuredData.length === 0 && !isNegation) {
            // ⚠️ CONTEXTUAL DRILL-DOWN: Relative found but no condition
            if (mentionedRelative) {
              const relName = mentionedRelative === 'FATHER' ? 'su padre' :
                mentionedRelative === 'MOTHER' ? 'su madre' :
                  mentionedRelative === 'GRANDFATHER' ? 'su abuelo/a' : 'su familiar';

              setMessages(prev => [...prev, { role: "assistant", content: `Entendido, ${relName}. ¿Qué condición padece?` }]);
              // Stay in same step (or we could use a specialized step, but re-using parser is fine if user replies "Diabetes")
              // ISSUE: If user replies "Diabetes", parser needs to link it to "mentionedRelative". 
              // Currently parser expects "Papá Diabetes". 
              // FIX: Let's create a temporary step for this: 'ph3_family_drilldown'
              // setPatientData(prev => ({ ...prev, temp_relative_context: mentionedRelative })); // Need simple state or just append context
              // For simplicity now: Ask full detail again loosely or use Catch-All.
              // Better: Just ask "Entendido. ¿Qué condición tiene?" and let parser handle "Diabetes" (will be UNKNOWN relative -> catch-all will prompt specific eventually).
              // Actually, if we return, the user inputs "Diabetes". Parser runs again. "Diabetes" has no relative. 
              // Prompt asks "Who?". 
              // Let's rely on valid user input or Catch-All for now to avoid complexity creeping.
              // User instruction said: "Entendido, su madre. ¿qué condición padece?".
              return; // Stop flow. User sees question. User replies "Diabetes". Next step: Parser runs on "Diabetes".
            }

            structuredData.push({ relative: 'UNKNOWN', condition: 'UNPARSED', detail: rawText });
          }
        }

        setPatientData(prev => ({
          ...prev,
          history: {
            ...prev.history,
            has_hereditary_risk: hasRisk,
            family_raw_text: rawText,
            family_structured: structuredData
          }
        }));

        // PASO 3: SAFETY CATCH-ALL (PH4-HEREDO-CATCH)
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Entendido. He registrado esos antecedentes.\n\n[cite_start]¿Existe alguna otra condición médica importante en su familia directa que no haya mencionado? (Ej: Alergias graves, temas neurológicos o psiquiátricos).",
          options: [
            { label: "No, es todo", value: "NO_MORE_AHF" },
            { label: "Sí, agregar otra", value: "ADD_MORE_AHF" }
          ]
        }]);
        setInterviewStep("ph4_heredo_catch");

      }, 600);
    }

    // PASO 1.1: SELECCIÓN DE FAMILIAR (SPLIT FLOW)
    else if (interviewStep === "ph3_family_relative_select") {
      setTimeout(() => {
        let relative = "FAMILIAR";
        const val = userMsg;

        // Simple mapping
        if (val === 'FAM_MOTHER' || val.toLowerCase().includes('mam') || val.toLowerCase().includes('madre')) relative = 'MOTHER';
        else if (val === 'FAM_FATHER' || val.toLowerCase().includes('pap') || val.toLowerCase().includes('padre')) relative = 'FATHER';
        else if (val === 'FAM_GRANDPARENT' || val.toLowerCase().includes('abuel')) relative = 'GRANDPARENT';
        else if (val === 'FAM_SIBLING' || val.toLowerCase().includes('herman')) relative = 'SIBLING';
        else relative = 'OTHER';

        // Save context in tempItem
        setTempItem({ relative: relative });

        const relLabel = relative === 'MOTHER' ? 'Madre' : relative === 'FATHER' ? 'Padre' : relative === 'GRANDPARENT' ? 'Abuelo/a' : relative === 'SIBLING' ? 'Hermano/a' : 'Familiar';
        setMessages(prev => [...prev, { role: "assistant", content: `Entendido (${relLabel}). ¿Qué enfermedad padece?` }]);
        setInterviewStep("ph3_family_condition_input");
      }, 600);
    }

    // PASO 1.2: INPUT DE ENFERMEDAD (SPLIT FLOW)
    else if (interviewStep === "ph3_family_condition_input") {
      setTimeout(() => {
        const condition = formatText(userMsg);
        const relative = tempItem.relative || 'UNKNOWN';

        setPatientData(prev => ({
          ...prev,
          history: {
            ...prev.history,
            has_hereditary_risk: true,
            family_structured: [...(prev.history.family_structured || []), {
              relative: relative,
              condition: 'USER_INPUT',
              detail: condition
            }]
          }
        }));

        // Go to Catch-All
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Anotado. He registrado ese antecedente.\n\n[cite_start]¿Existe alguna otra condición médica importante en su familia directa?",
          options: [
            { label: "No, es todo", value: "NO_MORE_AHF" },
            { label: "Sí, agregar otra", value: "ADD_MORE_AHF" }
          ]
        }]);
        setInterviewStep("ph4_heredo_catch");
      }, 600);
    }

    // PASO 4: CATCH-ALL HANDLER (PH4-HEREDO-CATCH)
    else if (interviewStep === "ph4_heredo_catch") {
      setTimeout(() => {
        if (userMsg === "NO_MORE_AHF" || userMsg.toLowerCase().includes('no') || userMsg.toLowerCase().includes('ningun')) {
          // FIN DE FASE 4 -> IR A FASE 5 (APP / Personal)
          setMessages(prev => [...prev, { role: "assistant", content: "Perfecto. Mapa de riesgos familiares actualizado.\n\nPasemos ahora a sus antecedentes personales. ¿Padece usted actualmente alguna enfermedad diagnosticada?" }]);
          setInterviewStep("app_start");

          // 💾 CP4: Family History Completed (End of Phase 4)
          saveSessionProgress(4, 'app_start', false);

        } else {
          // SÍ -> PREGUNTAR CUÁL
          setMessages(prev => [...prev, { role: "assistant", content: "¿Cuál? (Por favor especifique familiar y padecimiento)." }]);
          setInterviewStep("ph4_other_specific");
        }
      }, 600); // Add small delay to prevent race conditions
    }

    // PASO 5: SPECIFIC INPUT (PH4-OTHER-SPECIFIC)
    else if (interviewStep === "ph4_other_specific") {
      setTimeout(() => {
        const extraInfo = formatText(userMsg);

        setPatientData(prev => ({
          ...prev,
          history: {
            ...prev.history,
            family_structured: [...(prev.history.family_structured || []), {
              relative: 'UNKNOWN', // User specified in text
              condition: 'OTHER',
              detail: extraInfo
            }]
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "Anotado. Mapa de riesgos actualizado.\n\nPasemos ahora a sus antecedentes personales. ¿Padece usted actualmente alguna enfermedad diagnosticada?" }]);
        setInterviewStep("app_start");
      }, 600);
    }

    // OLD GATE REMOVED/UNUSED
    /* else if (interviewStep === "ahf_gate") { ... } */
    // OLD LOGIC REMOVED (Replaced by V5.0 Parser & Catch-all)



    // -----------------------------------------------------------------------
    // FASE 5: PERSONALES PATOLÓGICOS (GOLDEN MASTER V1.0)
    // -----------------------------------------------------------------------

    // PASO 1: APERTURA CORTEX (PH5-PATHOS-START)
    else if (interviewStep === "app_start") {
      setTimeout(() => {
        const rawText = formatText(userMsg);

        // Guardamos texto crudo
        setPatientData(prev => ({
          ...prev,
          history: { ...prev.history, personal_raw_text: rawText } // V1.0
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "Registrado.\n\nPara asegurar que su expediente esté completo: Además de lo que ya mencionamos, ¿padece alguna otra condición de esta lista oficial?" }]);
        setInterviewStep("ph5_gate");
      }, 600);
    }

    // PASO 2: LA COMPUERTA BINARIA (PH5-SAFETY-GATE)
    else if (interviewStep === "ph5_gate") {
      setTimeout(() => {
        const isValid = strictBooleanValidator(userMsg);

        // OPCIÓN A: NO (Cierre Fase 5 -> Goto Fase 6)
        if (isValid === false) {
          setPatientData(prev => ({
            ...prev,
            history: { ...prev.history, personal_checklist_verified: true }
          }));
          setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Perfil clínico actualizado.\n\nPasemos ahora a la Farmacología. ¿Toma usted algún medicamento prescrito actualmente?" }]);
          setInterviewStep("meds_start"); // GOTO FASE 6
          // 💾 CP5: End of Pathological -> Start Meds
          saveSessionProgress(5, 'meds_start');
        }
        // OPCIÓN B: SÍ (Desplegar Lista Específica)
        else if (isValid === true) {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor, escriba el número de la enfermedad (si son varias, sepárelas con comas, Ej: 2, 5):\n\n1. Diabetes (Tipo 1 o 2)\n2. Hipertensión Arterial\n3. Hipotiroidismo / Tiroides\n4. Dislipidemia (Colesterol/Triglicéridos)\n5. Síndrome de Ovario Poliquístico (SOP)\n6. Gastritis / Colitis Crónica\n7. Artritis / Problemas Articulares\n8. Otras (Especificar)" }]);
          setInterviewStep("ph5_list");
        }
        else {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor responda SÍ o NO." }]);
        }
      }, 600);
    }

    // PASO 3: LISTA NORMATIVA (PH5-SAFETY-LIST)
    else if (interviewStep === "ph5_list") {
      setTimeout(() => {
        const selections = userMsg.split(',').map(s => s.trim());
        const newConditions = [];
        let triggersOther = false;

        const map = {
          '1': 'DIABETES',
          '2': 'HYPERTENSION',
          '3': 'THYROID',
          '4': 'DYSLIPIDEMIA',
          '5': 'PCOS',
          '6': 'GASTRO',
          '7': 'ARTHRITIS',
          '8': 'OTHER'
        };

        selections.forEach(sel => {
          const key = map[sel];
          if (key) {
            newConditions.push({
              condition_category: key,
              specific_condition: key === 'OTHER' ? 'PENDING' : key,
              status: 'ACTIVE',
              source: 'CHECKLIST'
            });
            if (key === 'OTHER') triggersOther = true;
          }
        });

        if (newConditions.length === 0) {
          setMessages(prev => [...prev, { role: "assistant", content: "No reconocí los números. Por favor intente de nuevo." }]);
          return;
        }

        // Guardar selección
        setPatientData(prev => {
          const current = prev.history.personal_structured || [];
          return {
            ...prev,
            history: {
              ...prev.history,
              personal_structured: [...current, ...newConditions],
              personal_checklist_verified: !triggersOther // Only verify if we don't need "Other"
            }
          };
        });

        if (triggersOther) {
          setMessages(prev => [...prev, { role: "assistant", content: "Seleccionó 'Otras'. ¿Podría indicarme cuál es esa enfermedad?" }]);
          setInterviewStep("ph5_other");
        } else {
          setPatientData(prev => ({ ...prev, history: { ...prev.history, personal_checklist_verified: true } }));
          setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Perfil clínico actualizado.\n\nPasemos ahora a la Farmacología. ¿Toma usted algún medicamento prescrito actualmente?" }]);
          setInterviewStep("meds_start");
        }

      }, 600);
    }

    // PASO 4: ESPECIFICACIÓN (PH5-OTHER-SPECIFIC)
    else if (interviewStep === "ph5_other") {
      setTimeout(() => {
        const otherText = formatText(userMsg);

        setPatientData(prev => {
          const list = [...(prev.history.personal_structured || [])];
          const index = list.findIndex(item => item.condition_category === 'OTHER' && item.specific_condition === 'PENDING');
          if (index !== -1) {
            list[index] = { ...list[index], specific_condition: otherText };
          } else {
            // Fallback
            list.push({ condition_category: 'OTHER', specific_condition: otherText, status: 'ACTIVE', source: 'CHECKLIST' });
          }

          return {
            ...prev,
            history: { ...prev.history, personal_structured: list, personal_checklist_verified: true }
          };
        });

        setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Perfil clínico actualizado.\n\nPasemos ahora a la Farmacología. ¿Toma usted algún medicamento prescrito actualmente?" }]);
        setInterviewStep("meds_start");

      }, 600);
    }

    // -----------------------------------------------------------------------
    // FASE 6: FARMACOLOGÍA Y SUPLEMENTACIÓN (GOLDEN MASTER V3.0)
    // -----------------------------------------------------------------------

    // BLOQUE A: MEDICAMENTOS (PH6-MEDS)
    else if (interviewStep === "meds_start") {
      setTimeout(() => {
        const isValid = strictBooleanValidator(userMsg);

        if (isValid === false) {
          // No meds, goto Supps
          setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Pasemos a los productos de venta libre.\n\n¿Consume vitaminas, proteínas, tés o suplementos 'naturistas'?" }]);
          setInterviewStep("supp_start");
        } else if (isValid === true) {
          // Yes meds, start loop
          setMessages(prev => [...prev, { role: "assistant", content: "Correcto. Escriba el nombre del primer medicamento:" }]);
          setInterviewStep("meds_name");
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor responda SÍ o NO." }]);
        }
      }, 600);
    }

    else if (interviewStep === "meds_name") {
      setTimeout(() => {
        const name = formatText(userMsg);
        setTempItem({ name, type: 'MED' }); // Temp storage
        setMessages(prev => [...prev, { role: "assistant", content: `Entendido (${name}). ¿Cuál es la dosis exacta y con qué frecuencia la toma? (Ej. 1 tableta cada 12 horas).` }]);
        setInterviewStep("meds_details");
      }, 600);
    }

    else if (interviewStep === "meds_details") {
      setTimeout(() => {
        const details = formatText(userMsg);
        setTempItem(prev => ({ ...prev, details }));
        setMessages(prev => [...prev, { role: "assistant", content: "¿Desde hace cuánto tiempo toma este medicamento? (Ej. 1 semana, 3 años).\n\nEsto es importante para calcular sus riesgos nutricionales." }]);
        setInterviewStep("meds_duration");
      }, 600);
    }

    else if (interviewStep === "meds_duration") {
      setTimeout(() => {
        const duration = formatText(userMsg);
        const newItem = {
          name: tempItem.name,
          dose_frequency: tempItem.details,
          duration: duration,
          status: 'ACTIVE'
        };

        // Save to History
        setPatientData(prev => ({
          ...prev,
          history: {
            ...prev.history,
            medications: [...(prev.history.medications || []), newItem]
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "Registrado ✅.\n\n¿Toma algún otro medicamento prescrito?" }]);
        setInterviewStep("meds_next");
      }, 600);
    }

    else if (interviewStep === "meds_next") {
      setTimeout(() => {
        const isValid = strictBooleanValidator(userMsg);
        if (isValid === true) {
          setMessages(prev => [...prev, { role: "assistant", content: "Escriba el nombre del siguiente medicamento:" }]);
          setInterviewStep("meds_name");
        } else if (isValid === false) {
          setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Pasemos a los productos de venta libre.\n\n¿Consume vitaminas, proteínas, tés o suplementos 'naturistas'?" }]);
          setInterviewStep("supp_start");
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Responda SÍ para agregar otro o NO para continuar." }]);
        }
      }, 600);
    }

    // BLOQUE B: SUPLEMENTOS (PH6-SUPPS)
    else if (interviewStep === "supp_start") {
      setTimeout(() => {
        const isValid = strictBooleanValidator(userMsg);

        if (isValid === false) {
          // No supps -> Finish Phase 6 -> Goto Phase 7 (Allergies)
          setMessages(prev => [...prev, { role: "assistant", content: "Anotado.\n\nPasemos a un tema de seguridad vital. ¿Es usted alérgico a algún alimento? (Por favor distinga entre 'me cae pesado' y 'me causa reacción alérgica real')." }]);
          setInterviewStep("allergies_food_start");
          // Persistence trigger via useEffect
        } else if (isValid === true) {
          setMessages(prev => [...prev, { role: "assistant", content: "¿Cuál es el nombre del producto o ingrediente principal?" }]);
          setInterviewStep("supp_name");
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor responda SÍ o NO." }]);
        }
      }, 600);
    }

    else if (interviewStep === "supp_name") {
      setTimeout(() => {
        const name = formatText(userMsg);
        setTempItem({ name, type: 'SUPP' });
        setMessages(prev => [...prev, { role: "assistant", content: `¿Cuál es la dosis y frecuencia? (Ej. 1 scoop en la mañana).` }]);
        setInterviewStep("supp_details");
      }, 600);
    }

    else if (interviewStep === "supp_details") {
      setTimeout(() => {
        const details = formatText(userMsg);
        setTempItem(prev => ({ ...prev, details }));
        setMessages(prev => [...prev, { role: "assistant", content: "¿Desde hace cuánto tiempo consume este producto? (Ej. Recién empecé, Llevo 6 meses)." }]);
        setInterviewStep("supp_duration");
      }, 600);
    }

    else if (interviewStep === "supp_duration") {
      setTimeout(() => {
        const duration = formatText(userMsg);
        const newItem = {
          name: tempItem.name,
          frequency: tempItem.details,
          duration: duration,
          type: 'OTHER' // Default generic type
        };

        setPatientData(prev => ({
          ...prev,
          history: {
            ...prev.history,
            supplements: [...(prev.history.supplements || []), newItem]
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "Registrado ✅.\n\n¿Consume algún otro producto natural o vitamina?" }]);
        setInterviewStep("supp_next");
      }, 600);
    }

    else if (interviewStep === "supp_next") {
      setTimeout(() => {
        const isValid = strictBooleanValidator(userMsg);
        if (isValid === true) {
          setMessages(prev => [...prev, { role: "assistant", content: "¿Cuál es el nombre del producto?" }]);
          setInterviewStep("supp_name");
        } else if (isValid === false) {
          setMessages(prev => [...prev, { role: "assistant", content: "Anotado.\n\nPasemos a un tema de seguridad vital. ¿Es usted alérgico a algún alimento? (Por favor distinga entre 'me cae pesado' y 'me causa reacción alérgica real')." }]);
          setInterviewStep("allergies_food_start");
          // 💾 CP6: End of Meds -> Start Food Allergies
          saveSessionProgress(6, 'allergies_food_start');
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Responda SÍ para agregar otro o NO para continuar." }]);
        }
      }, 600);
    }

    // -----------------------------------------------------------------------
    // FASE 7: ALERGIAS Y SEGURIDAD CRÍTICA (GOLDEN MASTER V1.0)
    // -----------------------------------------------------------------------

    // BLOQUE A: ALIMENTOS (PH7-FOOD)
    else if (interviewStep === "allergies_food_start") {
      setTimeout(() => {
        const isValid = strictBooleanValidator(userMsg);

        if (isValid === false) {
          // No allergies -> Goto Drugs
          setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Pasemos a los medicamentos. ¿Es alérgico a algún fármaco, antibiótico o sustancia activa? (Ej. Penicilina, Aspirina)." }]);
          setInterviewStep("allergies_drug_start");
        } else if (isValid === true) {
          setMessages(prev => [...prev, { role: "assistant", content: "¿A qué alimento es alérgico? (Ej. Cacahuates, Fresas, Camarón)." }]);
          setInterviewStep("allergies_food_agent");
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor responda SÍ o NO." }]);
        }
      }, 600);
    }

    else if (interviewStep === "allergies_food_agent") {
      setTimeout(() => {
        const agent = formatText(userMsg);
        setTempItem({ agent, type: 'FOOD' });
        setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Para medir la gravedad: ¿Qué reacción le provoca este alimento? (Ej. Se me cierra la garganta, Ronchas, Diarrea inmediata)." }]);
        setInterviewStep("allergies_food_reaction");
      }, 600);
    }

    else if (interviewStep === "allergies_food_reaction") {
      setTimeout(() => {
        const reaction = formatText(userMsg);
        const newItem = {
          agent: tempItem.agent,
          reaction: reaction,
          severity: 'MEDIUM' // Default, upgradeable by AI later
        };

        setPatientData(prev => ({
          ...prev,
          history: {
            ...prev.history,
            allergies: {
              ...prev.history.allergies,
              food: [...(prev.history.allergies?.food || []), newItem]
            }
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "Registrado ⚠️.\n\n¿Es alérgico a algún otro alimento?" }]);
        setInterviewStep("allergies_food_next");
      }, 600);
    }

    else if (interviewStep === "allergies_food_next") {
      setTimeout(() => {
        const isValid = strictBooleanValidator(userMsg);
        if (isValid === true) {
          setMessages(prev => [...prev, { role: "assistant", content: "¿Cuál es el alimento?" }]);
          setInterviewStep("allergies_food_agent");
        } else if (isValid === false) {
          setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Pasemos a los medicamentos. ¿Es alérgico a algún fármaco, antibiótico o sustancia activa? (Ej. Penicilina, Aspirina)." }]);
          setInterviewStep("allergies_drug_start");
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Responda SÍ o NO." }]);
        }
      }, 600);
    }

    // BLOQUE B: MEDICAMENTOS (PH7-DRUG)
    else if (interviewStep === "allergies_drug_start") {
      setTimeout(() => {
        const isValid = strictBooleanValidator(userMsg);

        if (isValid === false) {
          // No drug allergies -> Goto Phase 8 (Digestive)
          setMessages(prev => [...prev, { role: "assistant", content: "Anotado.\n\nPasemos a su **Salud Digestiva**. ¿Sufre recurentemente de gastritis, colitis, estreñimiento o inflamación?" }]);
          setInterviewStep("digestive_start");
          // 💾 CP7: End of Allergies -> Start Digestive
          saveSessionProgress(7, 'digestive_start');
        } else if (isValid === true) {
          setMessages(prev => [...prev, { role: "assistant", content: "¿A qué medicamento es alérgico?" }]);
          setInterviewStep("allergies_drug_agent");
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor responda SÍ o NO." }]);
        }
      }, 600);
    }

    else if (interviewStep === "allergies_drug_agent") {
      setTimeout(() => {
        const agent = formatText(userMsg);
        setTempItem({ agent, type: 'DRUG' });
        setMessages(prev => [...prev, { role: "assistant", content: "¿Qué reacción le provoca? (Ej. Hinchazón, Falta de aire, Erupción)." }]);
        setInterviewStep("allergies_drug_reaction");
      }, 600);
    }

    else if (interviewStep === "allergies_drug_reaction") {
      setTimeout(() => {
        const reaction = formatText(userMsg);
        const newItem = {
          agent: tempItem.agent,
          reaction: reaction,
          severity: 'HIGH' // Drugs are usually high risk
        };

        setPatientData(prev => ({
          ...prev,
          history: {
            ...prev.history,
            allergies: {
              ...prev.history.allergies,
              drug: [...(prev.history.allergies?.drug || []), newItem]
            }
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "Registrado ⚠️.\n\n¿Es alérgico a algún otro medicamento?" }]);
        setInterviewStep("allergies_drug_next");
      }, 600);
    }

    else if (interviewStep === "allergies_drug_next") {
      setTimeout(() => {
        const isValid = strictBooleanValidator(userMsg);
        if (isValid === true) {
          setMessages(prev => [...prev, { role: "assistant", content: "¿Cuál es el medicamento?" }]);
          setInterviewStep("allergies_drug_agent");
        } else if (isValid === false) {
          setMessages(prev => [...prev, { role: "assistant", content: "Anotado.\n\nPasemos a su **Salud Digestiva**. ¿Sufre recurentemente de gastritis, colitis, estreñimiento o inflamación?" }]);
          setInterviewStep("digestive_start");
          // 💾 CP7: End of Allergies -> Start Digestive
          saveSessionProgress(7, 'digestive_start');
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Responda SÍ o NO." }]);
        }
      }, 600);
    }

    // -----------------------------------------------------------------------
    // FASE 8: SALUD DIGESTIVA (GOLDEN MASTER V2.0 - RED FLAGS & ROME IV)
    // -----------------------------------------------------------------------

    // PASO 1: GATE (PH8-DIGEST-GATE)
    else if (interviewStep === "digestive_start") {
      setTimeout(() => {
        const isValid = strictBooleanValidator(userMsg);

        if (isValid === false) {
          // NO TIENE SINTOMAS -> EUBIOSIS -> FIN FASE 8
          setPatientData((prev) => ({
            ...prev,
            digestive_profile: { ...prev.digestive_profile, has_issues: false, phenotype: 'EUBIOSIS' }
          }));
          setMessages((prev) => [...prev, { role: "assistant", content: "Entendido. Pasemos al motivo de su consulta. ¿Cuál es la razón principal de su visita hoy?" }]);
          setInterviewStep("clinica_motivo");
          // 💾 CP8a: Digestive (None) -> Clinical Motive
          saveSessionProgress(8, 'clinica_motivo');
        }
        else if (isValid === true) {
          // SI TIENE -> SELECTOR FENOTIPO
          setPatientData((prev) => ({
            ...prev,
            digestive_profile: { ...prev.digestive_profile, has_issues: true }
          }));

          setMessages((prev) => [...prev, { role: "assistant", content: "Entendido. Para ayudarle mejor: ¿Cómo se manifiesta principalmente? (Seleccione la más frecuente)." }]);

          const cards = `
**Seleccione una opción:**

🟠 **1. Estreñimiento**
*Me cuesta ir al baño / Heces duras*

🟡 **2. Inflamación y Gases**
*Distensión abdominal / "Me siento como globo"*

🔴 **3. Diarrea / Urgencia**
*Heces blandas o líquidas frecuentes*

🔥 **4. Ardor / Reflujo**
*Boca del estómago / Acidez*
           `;
          setMessages((prev) => [...prev, { role: "assistant", content: cards }]);
          setInterviewStep("digestive_phenotype");
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor responda SÍ o NO." }]);
        }
      }, 600);
    }

    // PASO 2: CLASIFICACIÓN (PH8-SYMPTOM-TYPE)
    else if (interviewStep === "digestive_phenotype") {
      setTimeout(() => {
        const lower = userMsg.toLowerCase();
        let phenotype = null;

        if (lower.includes('1') || lower.includes('estre') || lower.includes('consti')) phenotype = 'CONSTIPATION';
        else if (lower.includes('2') || lower.includes('inflam') || lower.includes('gas') || lower.includes('globo')) phenotype = 'BLOATING';
        else if (lower.includes('3') || lower.includes('diarrea') || lower.includes('urge')) phenotype = 'DIARRHEA';
        else if (lower.includes('4') || lower.includes('ardor') || lower.includes('reflujo') || lower.includes('acid')) phenotype = 'GERD';

        if (phenotype) {
          setPatientData(prev => ({
            ...prev,
            digestive_profile: { ...prev.digestive_profile, phenotype: phenotype }
          }));

          // BRANCHING LOGIC
          if (phenotype === 'CONSTIPATION') {
            const opts = `
**¿Cuántas veces a la semana suele evacuar?**
1. Menos de 3 veces
2. 3 a 5 veces
3. Diario pero con esfuerzo
               `;
            setMessages(prev => [...prev, { role: "assistant", content: opts }]);
            setInterviewStep("digestive_constipation_freq");
          }
          else if (phenotype === 'BLOATING') {
            const opts = `
**¿En qué momento siente mayor distensión?**
1. Inmediatamente después de comer
2. Pasa todo el día y empeora en la noche
3. Es aleatorio / Por estrés
               `;
            setMessages(prev => [...prev, { role: "assistant", content: opts }]);
            setInterviewStep("digestive_bloating_timing");
          }
          else if (phenotype === 'DIARRHEA') {
            const opts = `
**¿Detecta algún detonante específico?**
1. Lácteos / Grasas
2. Estrés / Nervios
3. No sé, es constante
               `;
            setMessages(prev => [...prev, { role: "assistant", content: opts }]);
            setInterviewStep("digestive_diarrhea_trigger");
          }
          else if (phenotype === 'GERD') {
            const opts = `
**¿El ardor empeora al acostarse o al pasar muchas horas sin comer?**
1. Al acostarse (Reflujo)
2. Al ayunar (Gastritis)
               `;
            setMessages(prev => [...prev, { role: "assistant", content: opts }]);
            setInterviewStep("digestive_gerd_moment");
          }
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor seleccione una opción válida (1, 2, 3 o 4)." }]);
        }
      }, 600);
    }

    // PASO 3: DRILL-DOWNS (PH8-DRILL-DOWN)
    else if (interviewStep === "digestive_constipation_freq" || interviewStep === "digestive_bloating_timing" || interviewStep === "digestive_diarrhea_trigger" || interviewStep === "digestive_gerd_moment") {
      setTimeout(() => {
        const answer = formatText(userMsg);
        let key = "";
        if (interviewStep.includes('constipation')) key = "constipation_freq";
        if (interviewStep.includes('bloating')) key = "bloating_timing";
        if (interviewStep.includes('diarrhea')) key = "diarrhea_cause";
        if (interviewStep.includes('gerd')) key = "gerd_trigger";

        setPatientData(prev => ({
          ...prev,
          digestive_profile: {
            ...prev.digestive_profile,
            details: { ...prev.digestive_profile.details, [key]: answer }
          }
        }));

        // GOTO RED FLAGS
        const flags = `
**Una última pregunta de seguridad médica.**
Para descartar condiciones que requieran atención especial, ¿ha notado recientemente alguno de estos síntomas de alarma?

*(Escriba los números que apliquen o "Ninguno")*

1. Sangre en las heces o heces negras
2. Pérdida de peso inexplicable
3. Dificultad para tragar alimentos sólidos
4. Vómitos recurrentes o con sangre
5. Ninguno de los anteriores
          `;
        setMessages(prev => [...prev, { role: "assistant", content: flags }]);
        setInterviewStep("digestive_red_flags");
      }, 600);
    }

    // PASO 4: RED FLAGS (PH8-ALARM-SYMPTOMS)
    else if (interviewStep === "digestive_red_flags") {
      setTimeout(() => {
        const lower = userMsg.toLowerCase();
        const flags = [];

        if (lower.includes('1') || lower.includes('sangre') || lower.includes('negra')) flags.push('BLOODY_STOOL');
        if (lower.includes('2') || lower.includes('peso')) flags.push('WEIGHT_LOSS');
        if (lower.includes('3') || lower.includes('tragar') || lower.includes('dificultad')) flags.push('DYSPHAGIA');
        if (lower.includes('4') || lower.includes('vomito') || lower.includes('vómito')) flags.push('VOMITING');

        const hasFlags = flags.length > 0;
        const isNone = lower.includes('ninguno') || lower.includes('5') || lower.includes('no');

        if (!hasFlags && !isNone) {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor seleccione una opción válida (1-5) o escriba 'Ninguno'." }]);
          return;
        }

        setPatientData(prev => ({
          ...prev,
          digestive_profile: { ...prev.digestive_profile, alarm_symptoms: flags }
        }));

        if (hasFlags) {
          setMessages(prev => [...prev, { role: "assistant", content: "⚠️ **Nota Importante**: Estos síntomas requieren valoración médica presencial para descartar problemas orgánicos. Generaré su menú para aliviar molestias, pero le sugiero fuertemente consultar a un gastroenterólogo.\n\nFinalmente: ¿Hay algún alimento o situación (como el estrés) que usted sepa que 'le cae mal' o detona sus síntomas?" }]);
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Excelente, perfil seguro. ✅\n\nFinalmente: ¿Hay algún alimento o situación (como el estrés) que usted sepa que 'le cae mal' o detona sus síntomas?" }]);
        }
        setInterviewStep("digestive_analysis");

      }, 600);
    }

    // PASO 5: AI ANALYSIS (PH8-AI-ANALYSIS)
    else if (interviewStep === "digestive_analysis") {
      setTimeout(() => {
        const rawText = formatText(userMsg);
        setPatientData(prev => ({
          ...prev,
          digestive_profile: {
            ...prev.digestive_profile,
            ai_analysis: { ...prev.digestive_profile.ai_analysis, raw_text: rawText }
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "Entendido. He ajustado la selección de ingredientes para proteger su digestión." }]);

        // GENDER GATE (PH9-GENDER-CHECK)
        if (patientData.identificacion.sexo === 'Masculino' || patientData.identificacion.sexo === 'HOMBRE') {
          // Skip to Phase 10 (Habits)
          setTimeout(() => {
            setMessages(prev => [...prev, { role: "assistant", content: "Pasemos a su Estilo de Vida.\n\n¿Fuma tabaco o utiliza vapeadores?" }]);
            setInterviewStep("habits_smoking_gate");
            // 💾 CP8b: Digestive Done -> Habits (Male)
            saveSessionProgress(8, 'habits_smoking_gate');
          }, 600);
        } else {
          // Go to Phase 9 (Female)
          setTimeout(() => {
            setMessages(prev => [...prev, { role: "assistant", content: "Para ajustar con precisión sus requerimientos de energía y nutrientes: ¿Se encuentra usted embarazada actualmente?" }]);
            setInterviewStep("intro_gineco_embarazo");
            // 💾 CP8c: Digestive Done -> Gyneco (Female)
            saveSessionProgress(8, 'intro_gineco_embarazo');
          }, 600);
        }
      }, 600);
    }

    else if (interviewStep === "clinica_motivo") {
      const motivo = formatText(userMsg);
      setPatientData((prev) => ({
        ...prev,
        clinica: { ...prev.clinica, motivo_consulta: motivo }
      }));
      setMessages((prev) => [...prev, { role: "assistant", content: "Entendido. Adicionalmente, ¿presenta alguna otra molestia física el día de hoy? (Como dolor de cabeza, mareos, fatiga)." }]);
      setInterviewStep("clinica_sympt_check"); // PH3-SYMPT-CHK
    }

    // 3.8 SÍNTOMAS (CHECK) (PH3-SYMPT-CHK)
    else if (interviewStep === "clinica_sympt_check") {
      const isValid = strictBooleanValidator(userMsg);
      // SMART LOGIC: Implicit Description
      if (isValid === true) {
        // SI -> PH3-SYMPT-DESC
        setMessages((prev) => [...prev, { role: "assistant", content: "¿Qué siente exactamente?" }]);
        setInterviewStep("clinica_sympt_desc");
      } else if (isValid === false) {
        // NO -> PH3-CLOSE
        setPatientData((prev) => ({
          ...prev,
          clinica: { ...prev.clinica, ipas_texto: "Niega" }
        }));
        handlePhase3Conclusion(patientData.identificacion.sexo, setInterviewStep, setMessages);
      } else {
        // IMPLICIT DATA (e.g. "Solo dolor de cabeza")
        // Treat userMsg as the description directly
        const newSymptoms = formatText(userMsg);
        setPatientData((prev) => ({
          ...prev,
          clinica: { ...prev.clinica, ipas_texto: newSymptoms }
        }));
        // Close immediately
        handlePhase3Conclusion(patientData.identificacion.sexo, setInterviewStep, setMessages);
      }
    }

    // 3.9 DESCRIPCIÓN SÍNTOMAS (PH3-SYMPT-DESC)
    else if (interviewStep === "clinica_sympt_desc") {
      // Append logic per user request
      const currentSymptoms = patientData.clinica.ipas_texto || "";
      const newSymptoms = currentSymptoms && currentSymptoms !== "Niega"
        ? `${currentSymptoms}. ${formatText(userMsg)}`
        : formatText(userMsg);

      setPatientData((prev) => ({
        ...prev,
        clinica: { ...prev.clinica, ipas_texto: newSymptoms }
      }));

      // PH3-CLOSE
      handlePhase3Conclusion(patientData.identificacion.sexo, setInterviewStep, setMessages);
    }

    // 3.9 GINECO-OBSTETRICIA (V4.2 - BINARY SPLIT)

    // 3.9.1 EMBARAZO (Sí/No)
    else if (interviewStep === "intro_gineco_embarazo") {
      setTimeout(() => {
        const isValid = strictBooleanValidator(userMsg);

        if (isValid === false) {
          // NO PREGNANT -> Go to Lactation Check (Always ask)
          setPatientData(prev => ({
            ...prev,
            physiological_state: { ...prev.physiological_state, is_pregnant: false }
          }));
          setMessages(prev => [...prev, { role: "assistant", content: "¿Se encuentra en periodo de lactancia materna?" }]);
          setInterviewStep("intro_gineco_lactancia");
        }
        else if (isValid === true) {
          // YES PREGNANT -> Drill down
          setPatientData(prev => ({
            ...prev,
            physiological_state: { ...prev.physiological_state, is_pregnant: true }
          }));
          setMessages(prev => [...prev, { role: "assistant", content: "¡Felicidades! ðŸ¤° ¿Cuántas semanas de gestación tiene aproximadamente?" }]);
          setInterviewStep("gineco_weeks");
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor responda SÍ o NO." }]);
        }
      }, 600);
    }

    // 3.9.1b Semanas
    else if (interviewStep === "gineco_weeks") {
      setTimeout(() => {
        const weeks = parseInt(formatText(userMsg).replace(/\D/g, '')); // Extract number
        if (isNaN(weeks) || weeks < 1 || weeks > 42) {
          setMessages(prev => [...prev, { role: "assistant", content: "Por favor indique un número de semanas válido (Ej: 12)." }]);
          return;
        }

        // Calculate Trimester
        let trimester = 'T1';
        if (weeks > 13) trimester = 'T2';
        if (weeks > 27) trimester = 'T3';

        setPatientData(prev => ({
          ...prev,
          physiological_state: {
            ...prev.physiological_state,
            gestation_weeks: weeks,
            trimester: trimester
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "¿Es un embarazo único o múltiple? (Gemelos, Trillizos, etc.)." }]);
        setInterviewStep("gineco_multiple");
      }, 600);
    }

    // 3.9.1c MULTIPLE (HOTFIX)
    else if (interviewStep === "gineco_multiple") {
      setTimeout(() => {
        const lower = userMsg.toLowerCase();
        // Default false unless "multiple", "gemel", "trilliz"
        const isMultiple = lower.includes('múltiple') || lower.includes('multiple') || lower.includes('gemel') || lower.includes('trilliz') || lower.includes('doble');

        setPatientData(prev => ({
          ...prev,
          physiological_state: {
            ...prev.physiological_state,
            is_multiple_pregnancy: isMultiple
          }
        }));

        setMessages(prev => [...prev, { role: "assistant", content: "¿Su médico le ha indicado alguna condición especial? (Ej. Diabetes Gestacional, Preeclampsia)." }]);
        setInterviewStep("gineco_risk");
      }, 600);
    }

    // 3.9.1d RIESGOS (RISK TAGS)
    else if (interviewStep === "gineco_risk") {
      setTimeout(() => {
        const raw = formatText(userMsg);
        const tags = [];
        if (raw.toLowerCase().includes('diabetes')) tags.push('GDM');
        if (raw.toLowerCase().includes('preeclampsia') || raw.toLowerCase().includes('presión')) tags.push('PREECLAMPSIA');

        setPatientData(prev => ({
          ...prev,
          physiological_state: {
            ...prev.physiological_state,
            obstetric_risk_tags: tags
          }
        }));

        // Proceed to Lactation
        setMessages(prev => [...prev, { role: "assistant", content: "¿Se encuentra en periodo de lactancia materna?" }]);
        setInterviewStep("intro_gineco_lactancia");
      }, 600);
    }


    // 3.9.1b Semanas


    // 3.9.2 LACTANCIA (V4.6 Golden Master - Decoupled)
    else if (interviewStep === "intro_gineco_lactancia") {
      setTimeout(() => {
        const isYes = strictBooleanValidator(userMsg);

        if (isYes === true) {
          setPatientData((prev) => ({
            ...prev,
            clinica: { ...prev.clinica, gineco: { ...prev.clinica.gineco, lactancia: "Activa" } }
          }));
          setMessages((prev) => [...prev, { role: "assistant", content: "Anotado. Ajustaremos sus requerimientos." }]);
        } else if (isYes === false) {
          setPatientData((prev) => ({
            ...prev,
            clinica: { ...prev.clinica, gineco: { ...prev.clinica.gineco, lactancia: "Niega" } }
          }));
          setMessages((prev) => [...prev, { role: "assistant", content: "Entendido." }]);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: "¿Se encuentra lactando? (Responda Sí o No)." }]);
          return;
        }

        // SI PASA LA VALIDACIÓN:
        // TRANSICIÓN FASE 3 -> FASE 4 (LOGÍSTICA - GOLDEN MASTER V4.1)
        setMessages((prev) => [...prev, { role: "assistant", content: "Historial registrado correctamente." }]);

        setTimeout(() => {
          setMessages((prev) => [...prev, { role: "assistant", content: "Para diseñar un plan realista, hablemos de su logística diaria. ¿Quién se encarga normalmente de preparar sus alimentos?\n\n1. Yo mismo\n2. Mi pareja / Familiar\n3. Personal doméstico\n4. Nadie (Compro hecho)" }]);
          setInterviewStep("logistics_cook");
          // 💾 CP9: Gyneco Done -> Logistics
          saveSessionProgress(9, 'logistics_cook');
        }, 1200);

      }, 600);
    }

    // -----------------------------------------------------------------------
    // FASE 4: LOGÍSTICA ALIMENTARIA (GOLDEN MASTER V4.1)
    // -----------------------------------------------------------------------

    // PASO A: EL COCINERO (Complejidad)
    else if (interviewStep === "logistics_cook") {
      const selection = parseInt(userMsg);
      let role = "SELF";
      let complexity = "LOW";

      if (selection === 1) { role = "SELF"; complexity = "LOW"; }
      else if (selection === 2) { role = "PARTNER"; complexity = "MEDIUM"; }
      else if (selection === 3) { role = "STAFF"; complexity = "HIGH"; }
      else if (selection === 4) { role = "NONE"; complexity = "NO_COOK"; }
      else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor seleccione una opción válida (1-4)." }]);
        return;
      }

      setPatientData((prev) => ({
        ...prev,
        logistics: {
          ...prev.logistics,
          cook_role: role,
          diet_configuration: { ...prev.logistics.diet_configuration, complexity: complexity }
        }
      }));

      setMessages((prev) => [...prev, { role: "assistant", content: "En sus horas de mayor actividad (trabajo o estudio), ¿dónde acostumbra comer?\n\n1. Casa\n2. Oficina / Trabajo\n3. Restaurantes / Fondas\n4. En la calle / Al paso" }]);
      setInterviewStep("logistics_venue");
    }

    // PASO B: EL ENTORNO (Venue)
    else if (interviewStep === "logistics_venue") {
      const selection = parseInt(userMsg);
      let venue = "HOME";

      if (selection === 1) venue = "HOME";
      else if (selection === 2) venue = "OFFICE";
      else if (selection === 3) venue = "RESTAURANT";
      else if (selection === 4) venue = "STREET";
      else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor seleccione una opción válida (1-4)." }]);
        return;
      }

      // LOGIC BRANCHING
      if (venue === "HOME") {
        setPatientData((prev) => ({
          ...prev,
          logistics: { ...prev.logistics, eating_venue: venue, diet_configuration: { ...prev.logistics.diet_configuration, mode: "RECIPES" } }
        }));
        // END PHASE 4 -> GOTO FASE 5 (Lifestyle)
        setMessages((prev) => [...prev, { role: "assistant", content: "Logística registrada. He ajustado la dificultad de las recetas. Pasemos ahora a su Estilo de Vida.\n\n¿Fuma tabaco o vapeadores?" }]);
        setInterviewStep("habit_tobacco");
        // 💾 CP10: Logistics Done -> Habits
        saveSessionProgress(10, 'habit_tobacco');
      }
      else if (venue === "OFFICE") {
        setPatientData((prev) => ({ ...prev, logistics: { ...prev.logistics, eating_venue: venue } }));
        setMessages((prev) => [...prev, { role: "assistant", content: "Entendido. En su lugar de trabajo, ¿con qué equipo cuenta para sus alimentos?\n\n1. Tengo refri y microondas\n2. Solo tengo refrigerador\n3. No tengo nada" }]);
        setInterviewStep("logistics_amenities");
      }
      else { // RESTAURANT / STREET
        setPatientData((prev) => ({
          ...prev,
          logistics: { ...prev.logistics, eating_venue: venue, diet_configuration: { ...prev.logistics.diet_configuration, mode: "GUIDE" } }
        }));
        setMessages((prev) => [...prev, { role: "assistant", content: "Entendido. En su caso, generaremos una Guía de Selección para comer fuera. Pasemos ahora a su Estilo de Vida.\n\n¿Fuma tabaco o vapeadores? Indique frecuencia." }]);
        setInterviewStep("habit_tobacco");
        // 💾 CP10: Logistics Done -> Habits
        saveSessionProgress(10, 'habit_tobacco');
      }
    }

    // PASO C: LAS AMENIDADES (Safety Matrix)
    else if (interviewStep === "logistics_amenities") {
      const selection = parseInt(userMsg);
      let mode = "RECIPES";
      let frige = false;
      let micro = false;

      if (selection === 1) { mode = "RECIPES"; frige = true; micro = true; } // Tupper Standard
      else if (selection === 2) { mode = "COLD_CHAIN"; frige = true; micro = false; } // Cold Chain
      else if (selection === 3) { mode = "SHELF_STABLE"; frige = false; micro = false; } // Shelf Stable (Bio-Hazard prevention)
      else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor seleccione una opción válida (1-3)." }]);
        return;
      }

      const amenities = { has_fridge: frige, has_microwave: micro };

      setPatientData((prev) => ({
        ...prev,
        logistics: {
          ...prev.logistics,
          amenities: amenities,
          diet_configuration: { ...prev.logistics.diet_configuration, mode: mode }
        }
      }));

      setMessages((prev) => [...prev, { role: "assistant", content: "Logística registrada. He ajustado la seguridad de los ingredientes a su realidad diaria. Pasemos ahora a su Estilo de Vida.\n\n¿Fuma tabaco o vapeadores? Indique frecuencia." }]);
      setInterviewStep("habit_tobacco");
      // 💾 CP10: Logistics Done -> Habits
      saveSessionProgress(10, 'habit_tobacco');
    }



    // -----------------------------------------------------------------------
    // FASE 4: ESTILO DE VIDA (4.1 - 4.7)
    // -----------------------------------------------------------------------

    // 4.1 Tabaco
    // 4.1 Tabaco (Drill-Down Atómico)
    // 4.1 Tabaco (Reparación Flujo Secuencial V6.8)
    else if (interviewStep === "habit_tobacco") {
      const isValid = strictBooleanValidator(userMsg); // Tu validador de Sí/No

      if (isValid === true) {
        // SÍ FUMA -> NO PREGUNTAR CANTIDAD TODAVÍA (Split Flow)
        setMessages((prev) => [...prev, { role: "assistant", content: "Entendido. Primero, ¿con qué frecuencia suele hacerlo? (Ej. Diario, Ocasional)." }]);
        setInterviewStep("intro_tabaco_freq"); // Paso 1
      } else {
        // NO FUMA (o inválido interpretado como No/Disclaimer) -> Ir a Alcohol
        // Nota: strictBooleanValidator devuelve null si es inválido, aquí asumimos comportamiento binario o manejo de null
        if (isValid === false) {
          setPatientData((prev) => ({
            ...prev,
            habitos: { ...prev.habitos, tabaco: "Niega" }
          }));
          setMessages((prev) => [...prev, { role: "assistant", content: "¿Consume bebidas alcohólicas?" }]);
          setInterviewStep("habit_alcohol");
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: "Disculpe, no le entendí. ¿Consume tabaco o vapeadores? (Responda Sí o No)." }]);
        }
      }
    }

    // NUEVO CASO OBLIGATORIO: case 'intro_tabaco_freq':
    else if (interviewStep === "intro_tabaco_freq") {
      setTempItem({ frecuencia: userMsg }); // Guardamos temporalmente
      setMessages((prev) => [...prev, { role: "assistant", content: "Y aproximadamente, ¿qué cantidad consume por ocasión? (Ej. 3 cigarros)." }]);
      setInterviewStep("intro_tabaco_qty"); // Paso 2
    }

    // NUEVO CASO OBLIGATORIO: case 'intro_tabaco_qty':
    else if (interviewStep === "intro_tabaco_qty") {
      const cantidad = userMsg;
      const frecuencia = tempItem?.frecuencia || "Frecuencia no especificada"; // Fallback safe
      const finalString = `${frecuencia} (${cantidad})`;

      setPatientData((prev) => ({
        ...prev,
        habitos: { ...prev.habitos, tabaco: finalString }
      }));
      setMessages((prev) => [...prev, { role: "assistant", content: "¿Consume bebidas alcohólicas?" }]);
      setInterviewStep("habit_alcohol");
    }

    // 4.2 Alcohol (Split Flow: Freq -> Qty)
    // 4.2 Alcohol (Refactor Refined Menu V5.5)
    else if (interviewStep === "habit_alcohol") {
      const isValid = strictBooleanValidator(userMsg);
      if (isValid === false) {
        setPatientData((prev) => ({
          ...prev,
          habitos: { ...prev.habitos, alcohol: "Niega" }
        }));
        setMessages((prev) => [...prev, { role: "assistant", content: "¿Consume alguna otra sustancia recreativa?" }]);
        setInterviewStep("habit_drugs");
      } else if (isValid === true) {
        // Inicializamos temp bucket
        setTempItem({ alcohol_bucket: [], total_kcal: 0 });
        setMessages((prev) => [...prev, { role: "assistant", content: "Seleccione el tipo de bebida que consume:\n\n1. Cerveza (Lata 355ml)\n2. Caguama / Grande (940ml)\n3. Vino (Copa 150ml)\n4. Destilados (Shot 45ml)\n5. Coctelería (Azucarada)" }]);
        setInterviewStep("habit_alcohol_type");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Disculpe, ¿consume alcohol? (Responda Sí o No)." }]);
      }
    }
    else if (interviewStep === "habit_alcohol_type") {
      const match = userMsg.match(/\d+/);
      const opt = match ? parseInt(match[0]) : null;

      if (!opt || opt < 1 || opt > 5) {
        setMessages(prev => [...prev, { role: "assistant", content: "Por favor seleccione una opción válida (1-5)." }]);
        return;
      }

      const map = {
        1: { label: "Cerveza", unit: "Lata 355ml", kcal: 150 },
        2: { label: "Caguama", unit: "Envase 940ml", kcal: 380 },
        3: { label: "Vino", unit: "Copa 150ml", kcal: 120 },
        4: { label: "Destilados", unit: "Shot 45ml", kcal: 100 },
        5: { label: "Coctelería", unit: "Vaso Estándar", kcal: 250 }
      };
      const selected = map[opt];
      setTempItem(prev => ({ ...prev, current_alc: selected }));
      setMessages(prev => [...prev, { role: "assistant", content: `Entendido. ¿Cuántas unidades de **${selected.unit}** suele tomar por ocasión?` }]);
      setInterviewStep("habit_alcohol_qty");
    }
    else if (interviewStep === "habit_alcohol_qty") {
      const qty = parseFloat(userMsg);
      if (isNaN(qty) || qty < 0) {
        setMessages(prev => [...prev, { role: "assistant", content: "Por favor indique un número válido." }]);
        return;
      }

      const { current_alc, alcohol_bucket, total_kcal } = tempItem;
      const subtotal = qty * current_alc.kcal;

      const newItem = {
        type: current_alc.label,
        qty,
        unit: current_alc.unit,
        subtotal_kcal: subtotal
      };

      // Recuperar bucket previo (handle refresh safety via state if needed, but tempItem is reliable inside flow)
      const newBucket = [...(alcohol_bucket || []), newItem];
      const newTotal = (total_kcal || 0) + subtotal;

      // Construimos String Híbrido para Display
      const strList = newBucket.map(i => `${i.type} (${i.qty})`).join(", ");
      const finalString = `${strList} [~${newTotal} kcal/casión]`;

      // Update Patient Data (Object Structure)
      setPatientData(prev => ({
        ...prev,
        habitos: {
          ...prev.habitos,
          alcohol: {
            label: finalString,
            active: true,
            total_kcal: newTotal,
            items: newBucket
          }
        }
      }));

      setTempItem(prev => ({ ...prev, alcohol_bucket: newBucket, total_kcal: newTotal }));

      setMessages(prev => [...prev, { role: "assistant", content: "Registrado. ¿Consume algún otro tipo de bebida alcohólica? (Sí/No)" }]);
      setInterviewStep("habit_alcohol_loop");
    }
    else if (interviewStep === "habit_alcohol_loop") {
      const valid = strictBooleanValidator(userMsg);
      if (valid === true) {
        setMessages(prev => [...prev, { role: "assistant", content: "Seleccione:\n\n1. Cerveza\n2. Caguama\n3. Vino\n4. Destilados\n5. Coctelería" }]);
        setInterviewStep("habit_alcohol_type");
      } else if (valid === false) {
        setMessages(prev => [...prev, { role: "assistant", content: "¿Consume alguna otra sustancia recreativa?" }]);
        setInterviewStep("habit_drugs");
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Responda Sí o No." }]);
      }
    }

    // 4.3 Drogas (Loop 🔍„)
    else if (interviewStep === "habit_drugs") {
      const isValid = strictBooleanValidator(userMsg);
      if (isValid === false) {
        // EXPLICIT DENIAL INJECTION
        setPatientData((prev) => ({
          ...prev,
          habitos: { ...prev.habitos, drogas: ["Niega"] }
        }));
        setMessages((prev) => [...prev, { role: "assistant", content: "¿Realiza ejercicio?" }]);
        setInterviewStep("activity_start");
      } else if (isValid === true) {
        setMessages((prev) => [...prev, { role: "assistant", content: "¿Cuál?" }]);
        setInterviewStep("habit_drugs_drilldown");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Disculpe, no le entendí. ¿Consume alguna otra sustancia? (Responda Sí o No)." }]);
      }
    }
    else if (interviewStep === "habit_drugs_drilldown") {
      setPatientData((prev) => ({
        ...prev,
        habitos: { ...prev.habitos, drogas: [...prev.habitos.drogas, userMsg] }
      }));
      setMessages((prev) => [...prev, { role: "assistant", content: "¿Alguna otra sustancia?" }]);
      setInterviewStep("habit_drugs_check_loop");
    }
    else if (interviewStep === "habit_drugs_check_loop") {
      const isValid = strictBooleanValidator(userMsg);
      if (isValid === false) {
        setMessages((prev) => [...prev, { role: "assistant", content: "¿Realiza ejercicio?" }]);
        setInterviewStep("activity_start");
      } else if (isValid === true) {
        setMessages((prev) => [...prev, { role: "assistant", content: "¿Cuál?" }]);
        setInterviewStep("habit_drugs_drilldown");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Disculpe, no le entendí. ¿Alguna otra sustancia? (Responda Sí o No)." }]);
      }
    }

    // 4.4 Actividad (Loop 🔍„)
    // 4.4 Actividad (The Trinity Split: Sí -> Qué -> Días -> Minutos)
    else if (interviewStep === "activity_start") {
      const isValid = strictBooleanValidator(userMsg);
      if (isValid === false) {
        setMessages((prev) => [...prev, { role: "assistant", content: "¿Cuántas horas duerme en promedio al día?" }]);
        setInterviewStep("sleep_hours");
      } else if (isValid === true) {
        setTempItem({}); // Limpiamos
        setMessages((prev) => [...prev, { role: "assistant", content: "Muy bien. ¿Qué actividad realiza? (Ej. Correr, Crossfit)" }]);
        setInterviewStep("fit_activity");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Disculpe, no le entendí. ¿Realiza alguna actividad física? (Responda Sí o No)." }]);
      }
    }
    // Paso B1: Actividad
    else if (interviewStep === "fit_activity") {
      setTempItem({ actividad: formatText(userMsg) });
      setMessages((prev) => [...prev, { role: "assistant", content: "¿Cuántos **días** a la semana la practica? (Número 1-7)" }]);
      setInterviewStep("fit_days");
    }
    // Paso B2: Días
    else if (interviewStep === "fit_days") {
      setTempItem((prev) => ({ ...prev, dias: userMsg }));
      setMessages((prev) => [...prev, { role: "assistant", content: "Y por último, ¿cuántos **minutos** dura su sesión promedio?" }]);
      setInterviewStep("fit_mins");
    }
    // Paso B3: Minutos + Guardado + Loop
    else if (interviewStep === "fit_mins") {
      const { actividad, dias } = tempItem;
      const minutos = userMsg;
      const finalString = `${actividad} (${dias} días/sem, ${minutos} min)`;

      setPatientData((prev) => ({
        ...prev,
        estilo: { ...prev.estilo, actividad: [...prev.estilo.actividad, finalString] }
      }));

      setMessages((prev) => [...prev, { role: "assistant", content: "¿Realiza alguna **otra** actividad física?" }]);
      setInterviewStep("activity_check_loop");
    }
    // Paso C: Loop Check
    else if (interviewStep === "activity_check_loop") {
      const isValid = strictBooleanValidator(userMsg);
      if (isValid === false) {
        setMessages((prev) => [...prev, { role: "assistant", content: "¿Cuántas horas duerme en promedio al día?" }]);
        setInterviewStep("sleep_hours");
      } else if (isValid === true) {
        setTempItem({});
        setMessages((prev) => [...prev, { role: "assistant", content: "¿Qué actividad?" }]);
        setInterviewStep("fit_activity");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Disculpe. ¿Otra actividad? (Responda Sí o No)." }]);
      }
    }

    // 4.5 Sueño Horas (Validación Numérica 1-24)
    else if (interviewStep === "sleep_hours") {
      const match = userMsg.match(/\d+/); // Extrae primer número
      const val = match ? parseInt(match[0], 10) : NaN;

      if (isNaN(val) || val < 1 || val > 24) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor indique un número de horas válido (entre 1 y 24)." }]);
        return; // BLOCK
      }

      setPatientData((prev) => ({
        ...prev,
        estilo: { ...prev.estilo, sueno_horas: val.toString() } // Guardamos limpio
      }));
      setMessages((prev) => [...prev, { role: "assistant", content: "¿Cómo calificaría su calidad de sueño? (Buena/Regular/Mala)" }]);
      setInterviewStep("sleep_quality");
    }

    // 4.6 Calidad
    else if (interviewStep === "sleep_quality") {
      setPatientData((prev) => ({
        ...prev,
        estilo: { ...prev.estilo, sueno_calidad: userMsg }
      }));
      setMessages((prev) => [...prev, { role: "assistant", content: "¿Cómo percibe su nivel de estrés? (Bajo/Mod/Alto)" }]);
      setInterviewStep("stress_level");
    }

    // 4.7 Estrés (Final de Fase 4)
    else if (interviewStep === "stress_level") {
      setPatientData((prev) => ({
        ...prev,
        estilo: { ...prev.estilo, estres: userMsg }
      }));
      setMessages((prev) => [...prev, { role: "assistant", content: "Fase 5: Nutrición y Dieta.\n\nPara personalizar su plan, dígame: ¿Hay algún alimento que le disguste o prefiera evitar? (Diga 'Ninguno' para omitir)." }]);
      setInterviewStep("diet_aversiones_start");
      // 💾 CP11: Habits/Lifestyle Done -> Diet
      saveSessionProgress(11, 'diet_aversiones_start');
    }

    // -----------------------------------------------------------------------
    // FASE 6: PROTOCOLO CLÍNICO (PROMPTER ROLE) V7.0 (MIGRADO A CORTEX FASE 13)
    // FASE DE EDICIÓN GRANULAR (V3.7 + V3.8)
    // -----------------------------------------------------------------------

    else if (interviewStep === "edit_identity_menu") {
      const option = parseInt(userMsg);
      if (isNaN(option) || option < 1 || option > 9) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor seleccione una opción válida (1-9)." }]);
        return;
      }

      if (option === 9) {
        // V3.6/V3.8: CANCELAR Y RETORNAR CON MEMORIA
        // V3.6/V3.8: CANCELAR Y RETORNAR CON MEMORIA
        const returnTarget = "waiting_lifestyle"; // Fixed default since tempReturnStep was unused
        setInterviewStep(returnTarget);

        // V3.8: Repetir pregunta exacta
        const reminder = getQuestionForStep(returnTarget);
        setMessages((prev) => [...prev, { role: "assistant", content: `Edición cancelada.\n\n${reminder}` }]);
        return;
      }

      // V4.5: PROTOCOLO ESPEJO (Intercept Date Editing)
      if (option === 4) {
        setEditMode(true); // ðŸš© ACTIVAMOS LA BANDERA
        setInterviewStep('intro_dob_day'); // 🔍€ GOTO SUBRUTINA
        setMessages((prev) => [...prev, { role: "assistant", content: "Entendido. Vamos a corregir su fecha paso a paso.\n\n¿En qué **DÍA** nació? (Ej: 12)" }]);
        return;
      }

      const fieldMap = {
        1: 'nombre',
        2: 'apellidoPaterno',
        3: 'apellidoMaterno',
        // 4: 'fechanac', <--- REMOVED (Handled by Mirror Protocol)
        5: 'sexo',
        6: 'telefono', // New V3.7
        7: 'ocupacion', // New V3.7
        8: 'religion'   // New V3.7
      };

      const field = fieldMap[option];
      const currentVal = patientData.identificacion[field];

      setTempItem({ editField: field });
      setMessages((prev) => [...prev, { role: "assistant", content: `El valor actual es: ** ${currentVal || '--'}**.\n\nPor favor escriba el nuevo valor: ` }]);
      setInterviewStep("edit_identity_input");
    }

    else if (interviewStep === "edit_identity_input") {
      const { editField } = tempItem;
      let newValue = userMsg;

      // V4.4: SMART EDIT SPLITTER (Nombre 'Ma. Jose')
      if (editField === 'nombre') {
        const cleanVal = newValue.trim();
        // FILTRO DE SEGURIDAD V4.4.1
        const words = cleanVal.split(/\s+/).filter(w => w.length > 0);

        if (words.length > 1) {
          setTempNameInput(cleanVal);
          setMessages((prev) => [...prev, { role: "assistant", content: `He detectado varias palabras: "${cleanVal}".\n\n¿Son estos ÚNICAMENTE sus nombres de pila(ej.Ma.Jose) ?\n\n1.Sí, son solo mis nombres.\n2.No, incluí mis apellidos.` }]);
          setInterviewStep("edit_name_ambiguity_check");
          return;
        }
      }

      // Normalización específica
      if (editField === 'sexo') newValue = formatText(newValue);

      // V3.9 SMART CHECK V2 (TOLERANCIA ORTOGRÁFICA)
      const sensitiveFields = ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'fechanac', 'sexo'];
      const isSensitive = sensitiveFields.includes(editField);

      let integrityBroken = false;
      let feedbackMsg = "Dato actualizado correctamente.";

      if (isSensitive) {
        if (editField === 'sexo') {
          // SEXO SIEMPRE ROMPE INTEGRIDAD (Cambia Homoclave/Digito Verificador o Char 11)
          integrityBroken = true;
          feedbackMsg = "⚠️ Al modificar el sexo, es necesario re-validar su CURP por seguridad.";
        } else {
          // SIMULAR NUEVA RAÍZ (Primeros 10 Chars: Letras + Fecha)
          const nextData = { ...patientData.identificacion, [editField]: newValue };
          const predictedFull = generateCurpPrefix(
            nextData.nombre,
            nextData.apellidoPaterno,
            nextData.apellidoMaterno,
            nextData.fechanac,
            nextData.sexo
          );

          // Extraer raíces (Primeros 10 caracteres)
          const predictedRoot = predictedFull ? predictedFull.substring(0, 10) : "";
          const currentRoot = (patientData.identificacion.curp || "").substring(0, 10);

          // COMPARACIÓN INTELIGENTE
          if (predictedRoot && currentRoot && predictedRoot !== currentRoot) {
            integrityBroken = true; // ðŸ’¥ DISCREPANCIA ESTRUCTURAL
            feedbackMsg = "⚠️ El cambio realizado modifica la estructura de su CURP. Es necesario re-validarla.";
            console.log(`[AUDIT] Integridad ROTA.${currentRoot} -> ${predictedRoot} `);
          } else {
            // ✅ CAMBIO COSMÉTICO / ORTOGRÁFICO
            feedbackMsg = "Dato corregido. ✅ Al ser una corrección que no altera su clave, la CURP se mantiene validada.";
            console.log(`[AUDIT] Integridad MANTENIDA(Tolerancia Ortográfica).Root: ${currentRoot} `);
          }
        }
      }

      setPatientData((prev) => ({
        ...prev,
        identificacion: {
          ...prev.identificacion,
          [editField]: newValue,
          // Solo revocamos si la integridad estructural se rompió
          curpValidated: integrityBroken ? false : prev.identificacion.curpValidated
        }
      }));

      setMessages((prev) => [...prev, { role: "assistant", content: `${feedbackMsg} \n\n¿Desea editar otro dato de identidad ? (Sí / No)` }]);
      setInterviewStep("edit_identity_loop");
    }

    // V4.4: Handler de Ambigüedad EN EDICIÓN
    else if (interviewStep === "edit_name_ambiguity_check") {
      const response = userMsg.toLowerCase();
      let feedbackMsg = "Nombre actualizado.";
      let integrityBroken = false;

      // OPCIÓN 1: SOLO NOMBRES
      if (response.includes('1') || response.includes('si') || response.includes('sino') || response.includes('solo')) {
        // Guardamos SOLO EL NOMBRE (tempNameInput)
        const nextData = { ...patientData.identificacion, nombre: tempNameInput };

        // Re-Check Integrity for Name
        const predictedFull = generateCurpPrefix(nextData.nombre, nextData.apellidoPaterno, nextData.apellidoMaterno, nextData.fechanac, nextData.sexo);
        const predictedRoot = predictedFull ? predictedFull.substring(0, 10) : "";
        const currentRoot = (patientData.identificacion.curp || "").substring(0, 10);

        if (predictedRoot && currentRoot && predictedRoot !== currentRoot) {
          integrityBroken = true;
          feedbackMsg = "⚠️ Nombre actualizado. Integridad CURP Rota (Re-validación requerida).";
        }

        setPatientData((prev) => ({
          ...prev,
          identificacion: {
            ...prev.identificacion,
            nombre: tempNameInput,
            curpValidated: integrityBroken ? false : prev.identificacion.curpValidated
          }
        }));
      }
      // OPCIÓN 2: NOMBRE COMPLETO (Smart Distribution V4.6)
      else if (response.includes('2') || response.includes('no') || response.includes('completo')) {
        const words = tempNameInput.split(/\s+/).filter(w => w.length > 0);

        // 🔴 CASO CRÍTICO: SOLO 2 PALABRAS (Ej: "Andres Trejo")
        if (words.length === 2) {
          const nom = words[0];
          const ap = words[1];

          // Check Integrity
          const nextData = { ...patientData.identificacion, nombre: nom, apellidoPaterno: ap, apellidoMaterno: '' };
          const predictedFull = generateCurpPrefix(nextData.nombre, nextData.apellidoPaterno, nextData.apellidoMaterno, nextData.fechanac, nextData.sexo);
          const predictedRoot = predictedFull ? predictedFull.substring(0, 10) : "";
          const currentRoot = (patientData.identificacion.curp || "").substring(0, 10);

          if (predictedRoot && currentRoot && predictedRoot !== currentRoot) {
            integrityBroken = true;
            feedbackMsg = "⚠️ Nombre y Paterno actualizados. Integridad CURP Rota.";
          } else {
            feedbackMsg = "Nombre y Paterno actualizados.";
          }

          setPatientData((prev) => ({
            ...prev,
            identificacion: {
              ...prev.identificacion,
              nombre: nom,
              apellidoPaterno: ap,
              apellidoMaterno: '', // Pending
              curpValidated: integrityBroken ? false : prev.identificacion.curpValidated
            }
          }));

          // SALTO ESPECIAL: EDICIÓN FORZADA DE MATERNO
          setTempItem({ editField: 'apellidoMaterno' });
          setMessages((prev) => [...prev, { role: "assistant", content: `${feedbackMsg} \n\n⚠️ Falta el ** Apellido Materno **.Por favor escríbalo a continuación(o 'X' si no tiene): ` }]);
          setInterviewStep("edit_identity_input");
          return; // ⛔ RETURN (No preguntar "¿Desea editar otro?" todavía)
        }

        // ðŸŸ¢ CASO ESTÁNDAR: 3 O MÁS PALABRAS
        else if (words.length >= 3) {
          const am = words.pop();
          const ap = words.pop();
          const nom = words.join(" "); // El resto

          // Check Integrity for All 3
          const nextData = { ...patientData.identificacion, nombre: nom, apellidoPaterno: ap, apellidoMaterno: am };
          const predictedFull = generateCurpPrefix(nextData.nombre, nextData.apellidoPaterno, nextData.apellidoMaterno, nextData.fechanac, nextData.sexo);
          const predictedRoot = predictedFull ? predictedFull.substring(0, 10) : "";
          const currentRoot = (patientData.identificacion.curp || "").substring(0, 10);

          if (predictedRoot && currentRoot && predictedRoot !== currentRoot) {
            integrityBroken = true;
            feedbackMsg = "⚠️ Nombre Completo actualizado. Integridad CURP Rota.";
          }

          setPatientData((prev) => ({
            ...prev,
            identificacion: {
              ...prev.identificacion,
              nombre: nom,
              apellidoPaterno: ap,
              apellidoMaterno: am,
              curpValidated: integrityBroken ? false : prev.identificacion.curpValidated
            }
          }));
        }
      }
      else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor responda '1' o '2'." }]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: `${feedbackMsg} \n\n¿Desea editar otro dato ? (Sí / No)` }]);
      setInterviewStep("edit_identity_loop");
    }

    else if (interviewStep === "edit_identity_loop") {
      // V3.9.1: VALIDACIÓN ESTRICTA DE SALIDA
      const cleanInput = userMsg.trim().toLowerCase();

      // 1. RUTA DE PERMANENCIA (SÍ)
      if (['si', 's', 'y', 'yes'].includes(cleanInput) || cleanInput.includes('si') || cleanInput.includes('claro')) {
        // V3.7: MENÚ LIMPIO
        const { nombre, apellidoPaterno, apellidoMaterno, fechanac, sexo, telefono, ocupacion, religion } = patientData.identificacion;
        const menu = `Modo Edición Activado.\n\nEscriba el número del dato a corregir: \n\n1.Nombre(s): ${nombre} \n\n2.Apellido Paterno: ${apellidoPaterno} \n\n3.Apellido Materno: ${apellidoMaterno} \n\n4.Fecha Nacimiento: ${fechanac} \n\n5.Sexo: ${sexo} \n\n6.Teléfono: ${telefono} \n\n7.Ocupación: ${ocupacion} \n\n8.Religión: ${religion} \n\n9. 🔙 Cancelar / Salir`;

        setMessages((prev) => [...prev, { role: "assistant", content: menu }]);
        setInterviewStep("edit_identity_menu");
      }
      // 2. RUTA DE SALIDA (NO) - ¡ESTRICTA!
      else if (['no', 'n', 'negativo', 'terminar'].includes(cleanInput)) {
        // "COBRO FINAL"
        if (patientData.identificacion.curpValidated === false) {
          // ESCENARIO A: INTEGRIDAD ROTA -> PAGAR DEUDA
          setMessages((prev) => [...prev, { role: "assistant", content: "He detectado cambios sensibles. Por seguridad, valide su CURP nuevamente." }]);
          setInterviewStep('intro_curp');
        } else {
          // ESCENARIO B: INTEGRIDAD SANA -> HYPERJUMP (Smart Resume V4.2)
          const returnTarget = determineResumeStep(patientData);
          const reminder = getQuestionForStep(returnTarget);

          // Lógica de Fraseo Natural
          const prefix = reminder.includes("Continuemos") ? "Entendido. " : "Entendido. Retomemos: ";

          setMessages((prev) => [...prev, { role: "assistant", content: `${prefix}${reminder} ` }]);
          setInterviewStep(returnTarget);
        }
      }
      // 3. RUTA DE ERROR (INPUT NO RECONOCIDO)
      else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor responda 'Sí' para seguir editando o 'No' para terminar y continuar con la entrevista." }]);
        // Se queda en el loop
      }
    }


    // -----------------------------------------------------------------------
    // FASE DE EDICIÓN DOMICILIO V4.0 (Cascade & Geo-Lock)
    // -----------------------------------------------------------------------

    else if (interviewStep === "edit_address_menu") {
      const option = parseInt(userMsg);
      if (isNaN(option) || (option !== 1 && option !== 2 && option !== 9)) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor seleccione una opción válida (1, 2 o 9)." }]);
        return;
      }

      if (option === 9) {
        // CANCELAR
        const returnTarget = "waiting_lifestyle";
        setInterviewStep(returnTarget);
        setMessages((prev) => [...prev, { role: "assistant", content: "Edición cancelada." }]); // Mensaje corto, retomar flujo
        return;
      }

      if (option === 1) {
        // CAMBIO DE CP (Major Reset)
        setMessages((prev) => [...prev, { role: "assistant", content: "Entendido. Ingrese su **Nuevo Código Postal** (5 dígitos):" }]);
        setInterviewStep("edit_address_input_cp");
      } else if (option === 2) {
        // CAMBIO DE CALLE (Cosmetic)
        const currentCalle = patientData.domicilio.calle;
        setMessages((prev) => [...prev, { role: "assistant", content: `La calle actual es: ** ${currentCalle}**.\n\nEscriba la nueva Calle y Número: ` }]);
        setInterviewStep("edit_address_input_street");
      }
    }

    else if (interviewStep === "edit_address_input_cp") {
      const cpInput = userMsg.trim();
      // Regex Validation
      if (!/^[0-9]{5}$/.test(cpInput)) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Código postal inválido. Debe tener 5 dígitos numéricos." }]);
        return;
      }

      // FETCH SIMULADO (O REAL SI ESTÁ CONECTADO)
      // Reutilizamos lógica de address_zip pero con flujo de edición
      setMessages((prev) => [...prev, { role: "assistant", content: "Validando CP..." }]);

      setTimeout(async () => {
        try {
          const response = await fetch(`http://localhost:3000/api/cp/${cpInput}`);
          if (!response.ok) {
            setMessages((prev) => [...prev, { role: "assistant", content: "No encontré ese Código Postal. Verifíquelo e intente de nuevo." }]);
            return;
          }
          const data = await response.json();

          // CASCADE UPDATE: Reset Colonia & Update Geo Data
          setPatientData((prev) => ({
            ...prev,
            domicilio: {
              ...prev.domicilio,
              cp: cpInput,
              municipio: data.municipio,
              estado: data.estado,
              colonia: "" // ðŸ’¥ RESET COLONIA (Geo-Lock engaged)
            }
          }));

          setTempColoniaList(data.colonias);
          const listFormatted = data.colonias.map((c, i) => `${i + 1}. ${c}`).join('\n');

          setMessages((prev) => [...prev, { role: "assistant", content: `CP Actualizado a ${cpInput} (${data.municipio}).\n\n⚠️ **Acción Requerida**: Seleccione su nueva colonia:\n\n${listFormatted}` }]);
          setInterviewStep("edit_address_colony_select");

        } catch (error) {
          console.error("Error fetching postal code:", error);
          setMessages((prev) => [...prev, { role: "assistant", content: "Error de conexión. Intente más tarde." }]);
          setInterviewStep("edit_address_menu");
        }
      }, 500);
    }

    else if (interviewStep === "edit_address_colony_select") {
      const selection = parseInt(userMsg.trim());
      const max = tempColoniaList.length;

      if (isNaN(selection) || selection < 1 || selection > max) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Selección inválida. Elija entre 1 y ${max}.` }]);
        return;
      }

      const selectedColonia = tempColoniaList[selection - 1];
      setPatientData((prev) => ({
        ...prev,
        domicilio: { ...prev.domicilio, colonia: selectedColonia } // 🔍“ Geo-Lock Released
      }));

      setMessages((prev) => [...prev, { role: "assistant", content: `Colonia actualizada a: **${selectedColonia}**.\n\n¿Desea editar otro dato del domicilio? (Sí/No)` }]);
      setInterviewStep("edit_address_loop");
    }

    else if (interviewStep === "edit_address_input_street") {
      setPatientData((prev) => ({
        ...prev,
        domicilio: { ...prev.domicilio, calle: formatText(userMsg) }
      }));
      setMessages((prev) => [...prev, { role: "assistant", content: "Calle actualizada.\n\n¿Desea editar otro dato del domicilio? (Sí/No)" }]);
      setInterviewStep("edit_address_loop");
    }

    else if (interviewStep === "edit_address_loop") {
      const cleanInput = userMsg.trim().toLowerCase();

      // 1. Permanencia
      if (['si', 's', 'y', 'yes'].includes(cleanInput)) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Modo Edición Domicilio.\n\n1. Código Postal (Reinicia Ubicación)\n2. Calle y Número\n9. Cancelar" }]);
        setInterviewStep("edit_address_menu");
      }
      // 2. Salida Estricta con GEO-LOCK
      else if (['no', 'n', 'negativo'].includes(cleanInput)) {
        // 🔍’ GEO-LOCK CHECK
        if (!patientData.domicilio.colonia) {
          setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ **Acción denegada**.\n\nHa modificado el Código Postal pero no seleccionó una Colonia. Su domicilio está incompleto.\n\nPor favor, seleccione una opción de la lista anterior." }]);
          // Force return to selection? Or menu? 
          // If we are in loop, users might be stuck if list is gone from UI history?
          // Safer: Redirect to CP input or give list again? 
          // Assuming logic flows from Select -> Loop, user HAS selected, but let's double check.
          // Actually, if user went CP -> Select -> Loop, 'colonia' IS set.
          // This protects against hypothetical bypasses.
          // If data IS missing, bounce to menu or CP.
          // For now, simple denial.
          return;
        }

        // Exit OK (Smart Resume V5.0)
        // PRIORIDAD 1: Volver a donde estaba (tempReturnStep)
        // PRIORIDAD 2: Calcular siguiente paso lógico (determineNextStep - Global Scanner)
        const returnTarget = determineNextStep(patientData);

        const reminder = getQuestionForStep(returnTarget);
        const prefix = reminder.includes("Continuemos") ? "Entendido. " : "Entendido. Retomemos: ";

        setMessages((prev) => [...prev, { role: "assistant", content: `${prefix}${reminder}` }]);
        setInterviewStep(returnTarget);
      }
      else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor responda 'Sí' o 'No'." }]);
      }
    }



    // -----------------------------------------------------------------------
    // FASE DE EDICIÓN SEGURIDAD/CONTACTO V5.1 (Chat-Based)
    // -----------------------------------------------------------------------

    else if (interviewStep === "edit_emergency_menu") {
      const option = parseInt(userMsg);
      if (isNaN(option) || (option !== 1 && option !== 2 && option !== 3 && option !== 9)) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor seleccione una opción válida (1, 2, 3 o 9)." }]);
        return;
      }

      if (option === 9) {
        // CANCELAR
        const returnTarget = determineNextStep(patientData);
        setInterviewStep(returnTarget);

        const reminder = getQuestionForStep(returnTarget);
        setMessages((prev) => [...prev, { role: "assistant", content: `Edición cancelada.\n\n${reminder}` }]);
        return;
      }

      const fieldMap = {
        1: 'nombre',
        2: 'parentesco',
        3: 'telefono'
      };

      const field = fieldMap[option];
      const currentVal = patientData.emergencia[field];

      setTempItem({ editField: field });
      setMessages((prev) => [...prev, { role: "assistant", content: `Valor actual: **${currentVal || '--'}**.\n\nIngrese el nuevo valor:` }]);
      setInterviewStep("edit_emergency_input");
    }

    else if (interviewStep === "edit_emergency_input") {
      const { editField } = tempItem;
      let newValue = userMsg;

      // Un poco de formato básico
      if (editField === 'nombre' || editField === 'parentesco') {
        newValue = formatText(newValue);
      }

      setPatientData((prev) => ({
        ...prev,
        emergencia: {
          ...prev.emergencia,
          [editField]: newValue
        }
      }));

      setMessages((prev) => [...prev, { role: "assistant", content: "Dato de contacto actualizado.\n\n¿Desea editar otro campo de emergencia? (Sí/No)" }]);
      setInterviewStep("edit_emergency_loop");
    }

    else if (interviewStep === "edit_emergency_loop") {
      const cleanInput = userMsg.trim().toLowerCase();

      // 1. Permanencia
      if (['si', 's', 'y', 'yes'].includes(cleanInput)) {
        const { nombre, parentesco, telefono } = patientData.emergencia;
        const menu = `Modo Edición Seguridad.\n\n1. Nombre: ${nombre || '--'}\n2. Parentesco: ${parentesco || '--'}\n3. Teléfono: ${telefono || '--'}\n9. Cancelar`;

        setMessages((prev) => [...prev, { role: "assistant", content: menu }]);
        setInterviewStep("edit_emergency_menu");
      }
      // 2. Salida
      else if (['no', 'n', 'negativo'].includes(cleanInput)) {
        // Exit Smart Resume
        const returnTarget = determineNextStep(patientData);
        const reminder = getQuestionForStep(returnTarget);
        const prefix = reminder.includes("Continuemos") ? "Entendido. " : "Entendido. Retomemos: ";

        setMessages((prev) => [...prev, { role: "assistant", content: `${prefix}${reminder}` }]);
        setInterviewStep(returnTarget);
      }
      else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor responda 'Sí' o 'No'." }]);
      }
    }


    // -----------------------------------------------------------------------
    // FASE DE EDICIÓN: SIMPLE TEXT FIELDS (AHF, APP, DIGESTIVO, MOTIVO, IPAS)
    // -----------------------------------------------------------------------

    // --- AHF (Heredofamiliares) ---
    else if (interviewStep === "edit_ahf_menu") {
      const option = parseInt(userMsg);
      if (option === 9) {
        const returnTarget = determineNextStep(patientData);
        setInterviewStep(returnTarget);
        const reminder = getQuestionForStep(returnTarget);
        setMessages((prev) => [...prev, { role: "assistant", content: `Edición cancelada.\n\n${reminder}` }]);
        return;
      }
      if (option === 1) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Valor actual: **${patientData.clinica.ahf_lista || 'Negados'}**.\n\nEscriba los nuevos antecedentes:` }]);
        setInterviewStep("edit_ahf_input");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Opción inválida. 1. Editar, 9. Cancelar" }]);
      }
    }
    else if (interviewStep === "edit_ahf_input") {
      setPatientData(prev => ({ ...prev, clinica: { ...prev.clinica, ahf_lista: formatText(userMsg) } }));
      setMessages((prev) => [...prev, { role: "assistant", content: "Antecedentes actualizados.\n\n¿Desea seguir editando? (Sí/No)" }]);
      setInterviewStep("edit_ahf_loop");
    }
    else if (interviewStep === "edit_ahf_loop") {
      const cleanInput = userMsg.trim().toLowerCase();
      if (['si', 's', 'y', 'yes'].includes(cleanInput)) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Modo Edición Heredofamiliares.\n\n1. Editar Información\n9. Cancelar` }]);
        setInterviewStep("edit_ahf_menu");
      } else if (['no', 'n', 'negativo'].includes(cleanInput)) {
        const returnTarget = determineNextStep(patientData);
        setInterviewStep(returnTarget);
        const reminder = getQuestionForStep(returnTarget);
        setMessages((prev) => [...prev, { role: "assistant", content: `Entendido. Retomemos: ${reminder}` }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Responda Sí o No." }]);
      }
    }

    // --- APP (Patológicos) ---
    else if (interviewStep === "edit_app_menu") {
      const option = parseInt(userMsg);
      if (option === 9) {
        const returnTarget = determineNextStep(patientData);
        setInterviewStep(returnTarget);
        const reminder = getQuestionForStep(returnTarget);
        setMessages((prev) => [...prev, { role: "assistant", content: `Edición cancelada.\n\n${reminder}` }]);
        return;
      }
      if (option === 1) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Valor actual: **${patientData.clinica.app_lista || 'Negados'}**.\n\nEscriba las nuevas patologías:` }]);
        setInterviewStep("edit_app_input");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Opción inválida. 1. Editar, 9. Cancelar" }]);
      }
    }
    else if (interviewStep === "edit_app_input") {
      setPatientData(prev => ({ ...prev, clinica: { ...prev.clinica, app_lista: formatText(userMsg) } }));
      setMessages((prev) => [...prev, { role: "assistant", content: "Patologías actualizadas.\n\n¿Desea seguir editando? (Sí/No)" }]);
      setInterviewStep("edit_app_loop");
    }
    else if (interviewStep === "edit_app_loop") {
      const cleanInput = userMsg.trim().toLowerCase();
      if (['si', 's', 'y', 'yes'].includes(cleanInput)) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Modo Edición Patológicos.\n\n1. Editar Información\n9. Cancelar` }]);
        setInterviewStep("edit_app_menu");
      } else if (['no', 'n', 'negativo'].includes(cleanInput)) {
        const returnTarget = determineNextStep(patientData);
        setInterviewStep(returnTarget);
        const reminder = getQuestionForStep(returnTarget);
        setMessages((prev) => [...prev, { role: "assistant", content: `Entendido. Retomemos: ${reminder}` }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Responda Sí o No." }]);
      }

    }

    // --- GINECO EDIT (FIXED V4.7) ---
    else if (interviewStep === "edit_gineco_menu") {
      const opt = parseInt(userMsg);
      if (opt === 9) {
        const returnTarget = determineNextStep(patientData);
        setInterviewStep(returnTarget);
        const reminder = getQuestionForStep(returnTarget);
        setMessages((prev) => [...prev, { role: "assistant", content: `Edición cancelada.\n\n${reminder}` }]);
        return;
      }

      if (opt === 1) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Escriba el nuevo estado (Ej. 'Solo Lactancia', 'Embarazo', 'Ninguno'):" }]);
        setInterviewStep("edit_gineco_status");
      } else if (opt === 2) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Ingrese las semanas de gestación (0 si no aplica):" }]);
        setInterviewStep("edit_gineco_weeks");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Opción inválida. 1, 2 o 9." }]);
      }
    }

    else if (interviewStep === "edit_gineco_status") {
      const lower = userMsg.toLowerCase();
      let emb = "Niega";
      let lac = "Niega";

      if (lower.includes("emb") || lower.includes("gest")) emb = "Activo";
      if (lower.includes("lac") || lower.includes("mamant")) lac = "Activa";
      if (lower.includes("ning") || lower.includes("nad")) { emb = "Niega"; lac = "Niega"; }

      setPatientData((prev) => ({
        ...prev,
        clinica: { ...prev.clinica, gineco: { ...prev.clinica.gineco, embarazo: emb, lactancia: lac } }
      }));
      setMessages((prev) => [...prev, { role: "assistant", content: `Estado actualizado: Emb=${emb}, Lac=${lac}.\n\n¿Desea editar las semanas de gestación? (Sí/No)` }]);
      setInterviewStep("edit_gineco_loop");
    }

    else if (interviewStep === "edit_gineco_weeks") {
      const weeks = parseInt(userMsg);
      if (isNaN(weeks) || weeks < 0) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Por favor indique un número válido." }]);
        return;
      }
      setPatientData((prev) => ({
        ...prev,
        clinica: { ...prev.clinica, gineco: { ...prev.clinica.gineco, semanas: weeks } }
      }));
      setMessages((prev) => [...prev, { role: "assistant", content: "Semanas actualizadas.\n\n¿Desea editar otro dato de Gineco? (Sí/No)" }]);
      setInterviewStep("edit_gineco_loop");
    }

    else if (interviewStep === "edit_gineco_loop") {
      const valid = strictBooleanValidator(userMsg);
      if (valid === true) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Modo Edición Gineco.\n\n1. Estado\n2. Semanas\n9. Cancelar" }]);
        setInterviewStep("edit_gineco_menu");
      } else if (valid === false) {
        const returnTarget = determineNextStep(patientData);
        setInterviewStep(returnTarget);
        const reminder = getQuestionForStep(returnTarget);
        setMessages((prev) => [...prev, { role: "assistant", content: `Entendido. Retomemos: ${reminder}` }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Responda Sí o No." }]);
      }
    }

    // --- NUEVOS LOOPS DE EDICIÓN ---
    // 1. HABITOS
    else if (interviewStep === "edit_habitos_menu") {
      const opt = parseInt(userMsg);
      if (opt === 9) { const t = determineNextStep(patientData); setInterviewStep(t); setMessages(p => [...p, { role: "assistant", content: `Cancelado. ${getQuestionForStep(t)}` }]); return; }
      // Implementación simplificada: Solo placeholders funcionales
      setMessages(p => [...p, { role: "assistant", content: "Funcionalidad de edición detallada en desarrollo. (Valor actualizado manualmente)." }]);
      // En un futuro expandir a inputs específicos.
      const t = determineNextStep(patientData); setInterviewStep(t);
    }
    // 2. ACTIVIDAD
    else if (interviewStep === "edit_activity_menu") {
      const opt = parseInt(userMsg);
      if (opt === 9) { const t = determineNextStep(patientData); setInterviewStep(t); setMessages(p => [...p, { role: "assistant", content: `Cancelado. ${getQuestionForStep(t)}` }]); return; }
      setMessages(p => [...p, { role: "assistant", content: "Funcionalidad de edición detallada en desarrollo." }]);
      const t = determineNextStep(patientData); setInterviewStep(t);
    }
    // 3. EDIT DIET RESET
    else if (interviewStep === "edit_diet_reset_confirmation") {
      if (userMsg.toLowerCase().includes('si')) {
        setMessages(p => [...p, { role: "assistant", content: "Reiniciando módulo de Dieta... ¿Hay algún alimento que le disguste o prefiera evitar?" }]);
        setInterviewStep("diet_aversiones_start");
      } else {
        const t = determineNextStep(patientData); setInterviewStep(t);
        setMessages(p => [...p, { role: "assistant", content: `Cancelado.` }]);
      }
    }

  };



  // -----------------------------------------------------------------------
  // MIDDLEWARE: CORTEX INTERACTION ENGINE (V1.1)
  // -----------------------------------------------------------------------
  const _checkInteractionsAndProceed = (hasDrugs, drugName = "") => {
    const meds = patientData.history.medications || [];
    const alcohol = patientData.habits.alcohol;
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

    // SAVE FLAGS
    setPatientData(prev => ({
      ...prev,
      safety: {
        interaction_check_timestamp: new Date(),
        interaction_flags: flags
      }
    }));

    // DECIDE NEXT STEP
    const critical = flags.find(f => f.severity === "CRITICAL");

    if (critical) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ **ALERTA DE SEGURIDAD VITAL**\n\n${critical.user_message}\n\nHe bloqueado preventivamente estimulantes en su plan nutricional. Por favor confirme que ha leído esta advertencia.` }]);
      // Note: In a real app we might want an explicit acknowledgment step, but for now we proceed after warning.
      setTimeout(() => {
        setMessages(prev => [...prev, { role: "assistant", content: "Pasemos a su Actividad Física.\n\nPara calcular cuántas calorías quema su cuerpo: ¿Realiza ejercicio físico programado? (Ir al gimnasio, correr, nadar, practicar algún deporte)." }]);
        setInterviewStep("activity_gate");
      }, 4000);
    } else {
      if (flags.length > 0) {
        setMessages(prev => [...prev, { role: "assistant", content: `Nota: ${flags[0].user_message}\n\nPasemos a su Actividad Física.\n\n¿Realiza ejercicio físico programado? (Ir al gimnasio, correr, etc).` }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Estilo de vida registrado. ✅\n\nPasemos a su Actividad Física.\n\n¿Realiza ejercicio físico programado? (Ir al gimnasio, correr, nada, etc)." }]);
      }
      setInterviewStep("activity_gate");
    }
  };

  // --- LOGIN HANDLER ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Por favor ingresa usuario y contraseña");
      return;
    }
    setError(""); // Limpiar errores previos
    setIsLoading(true); // Bloquear botón

    try {
      const res = await axios.post('http://localhost:5000/api/login', {
        username: username,
        password: password
      });

      if (res.data.success) {
        setUser(res.data.user);
        // Persistir sesión completa y Token para uso en otras funciones
        localStorage.setItem('ea_session', JSON.stringify(res.data.user));
        if (res.data.user.token) {
          localStorage.setItem('ea_token', res.data.user.token);
        }
        setIsLoggedIn(true);    // 🔍“ Entramos al Dashboard
      }
    } catch (err) {
      if (err.response) {
        setError(err.response.data.message || "Error de credenciales");
      } else {
        setError("Error de conexión con el servidor");
      }
    } finally {
      setIsLoading(false); // Liberar botón
    }
  };

  // ==============================================================================
  // 🔍 PANTALLA DE LOGIN - V4 (Botón al final)
  // ==============================================================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        {/* TARJETA PRINCIPAL */}
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden font-sans">
          {/* 1. ENCABEZADO (Azul Eléctrico) */}
          <div className="bg-blue-600 p-6 flex justify-between items-center relative overflow-hidden">
            {/* Patrón de fondo sutil opcional */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700 opacity-100"></div>

            <div className="relative z-10">
              <h1 className="text-white text-2xl font-bold tracking-tight">
                Sistema Nutricional
              </h1>
              <p className="text-blue-100 text-lg font-normal mt-1 opacity-90">
                Equipo en Acción AI
              </p>
            </div>

            {/* LOGOTIPO */}
            <div className="relative z-10 bg-white/10 p-2 rounded-lg backdrop-blur-sm shadow-sm">
              <img
                src={LogoEABlanco}
                alt="Logo"
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>

          {/* CUERPO DE LA TARJETA */}
          <div className="p-8">
            {error && (
              <div className="mb-6 bg-red-50 text-red-600 p-3 rounded text-sm text-center border border-red-100 font-medium flex items-center justify-center gap-2">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              {/* --- CAMPOS DE ENTRADA --- */}
              <div className="space-y-5">
                {/* Usuario */}
                <div>
                  <label className="block text-slate-700 font-semibold text-sm mb-2">
                    Usuario
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                      placeholder="Ingresa tu usuario"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (error) setError("");
                      }}
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div>
                  <label className="block text-slate-700 font-semibold text-sm mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError("");
                      }}
                    />
                  </div>
                  <div className="flex justify-end mt-2">
                    <a
                      href="#"
                      className="text-sm text-blue-500 hover:text-blue-700 font-medium hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                </div>
              </div>

              {/* --- TEXTO BIO-CUÁNTICA (Ahora está ANTES del botón) --- */}
              <p className="text-slate-600 text-sm leading-relaxed text-justify px-1">
                Este sistema procesa datos sensibles de salud mediante
                <span className="font-semibold text-slate-800">
                  {" "}
                  Inteligencia Artificial Bio-Cuántica
                </span>
                . Al ingresar, confirmas que tienes autorización para gestionar
                estos expedientes.
              </p>

              {/* --- BOTÓN DE ACCIÓN (Ahora está al FINAL del formulario) --- */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full ${isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20'} text-white py-4 rounded-lg transition-all font-bold text-lg flex items-center justify-center gap-2 group`}
              >
                {isLoading ? 'Verificando y Autenticando...' : 'Iniciar Sesión'}
                {/* Flecha animada al hacer hover */}
                {!isLoading && (
                  <span className="group-hover:translate-x-1 transition-transform">
                    ➜
                  </span>
                )}
              </button>
            </form>

            {/* --- NOTA LEGAL (Footer Gris) --- */}
            <div className="mt-8 pt-4 border-t border-slate-100">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-400 leading-tight text-center uppercase tracking-wide font-medium">
                  La información mostrada es para uso exclusivo de profesionales
                  de la salud. Protocolos de encriptación estándar activos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lógica de Sincronización: Chat -> Dashboard






  // ==============================================================================
  // PANTALLA 2: DASHBOARD (CHAT MODIFICADO CON TILO)
  // ==============================================================================

  // V15.6 HIBERNATION AND KINETICS LOGIC
  const isCortexPhaseZero = interviewStep === 'appointment' && currentPhase.startsWith('PHASE_0_');
  const isLegacyPhaseZero = interviewStep === 'intro_curp' || interviewStep === 'identidad' || interviewStep === 'phase_0_' || interviewStep.includes('intro_');

  // En Fase 0 inicializa en 'basal'.
  const systemState = (isCortexPhaseZero || isLegacyPhaseZero) ? 'basal' : 'processing';

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white">
      {/* CAPA -2: El Sistema Nervioso Visual (Motor Físico V15.6) */}
      <AntigravityBlobs systemState={systemState} />

      {/* CAPA -1: El Escudo Óptico (Glassmorphism para legibilidad) */}
      <div className="absolute inset-0 z-[-1] bg-white/40 backdrop-blur-sm pointer-events-none" />

      {/* CAPA 10+: EL CUERPO SAGRADO (INTERFAZ) */}
      <div className="relative z-10 flex flex-col font-sans text-slate-600 selection:bg-blue-100 h-full w-full">

        {/* HEADER SUPERIOR (SISTEMA DE IDENTIDAD Y NAVEGACIÓN) */}
        {isLoggedIn && !showPrivacyPolicy && (
          <Header
            user={user}
            sessionInfo={{
              citation: apiContext?.citaId || apiContext?.idCita || sessionMetadata.citation,
              userId: apiContext?.userId || sessionMetadata.userId || '---',
              patientName: apiContext?.rawName || sessionMetadata.patientName || sessionMetadata.serverName || '---'
            }}
            showSessionInfo={true} // <--- AHORA SIEMPRE SE MUESTRA SI HAY DATOS
            clearSession={clearSession}
            activeTab={activeTab} // UI/UX #4: Navegación Global (Desactivada en Fase 0)
            onTabChange={setActiveTab}    // UI/UX #4: Navegación Global
          />
        )}

        {/* CONTENEDOR PRINCIPAL (2 COLUMNAS) */}
        {/* ✅ BARRA DE WORKSPACE (Limpia y Dinámica) */}



        {/* CONTENEDOR PRINCIPAL (2 COLUMNAS) */}
        <div className="flex flex-1 w-full overflow-hidden">

          {/* --- COLUMNA IZQUIERDA: CHAT --- */}
          <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white shadow-xl z-10 relative">

            {interviewStep === 'finished' ? (
              <div className="flex-1 h-full flex items-center justify-center p-8 bg-slate-50 relative">
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 max-w-sm text-center flex flex-col items-center gap-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-20 h-20 rounded-full bg-slate-100 flex-shrink-0 border shadow-md flex items-center justify-center overflow-hidden mb-2 mx-auto"
                  >
                    <img src={tiloImg} alt="Tilo" className="w-16 h-16 object-contain" />
                  </motion.div>
                  <h2 className="text-xl font-bold text-slate-800">Entrevista Finalizada</h2>
                  <p className="text-slate-600 leading-relaxed text-sm">
                    Expediente cerrado y guardado. Cediendo el control total al Bio-Arquitecto para la explicación final del plan al paciente.
                  </p>
                  <div className="w-16 h-1 bg-blue-500 rounded-full mt-2 opacity-50 mx-auto"></div>
                </div>
              </div>
            ) : currentPhase === 'PHASE_3_MOTIVO_CONSULTA' ? (
              <Fase3_MotivoConsulta
                patientData={patientData}
                setPatientData={setPatientData}
                messages={messages}
                setMessages={setMessages}
                onPhaseComplete={(motiveData) => {
                  setFase3State(motiveData);

                  // --- MIDDLEWARE: VALIDADOR DE COHERENCIA (NOM-004) ---
                  if (!motiveData.primaryRoute || motiveData.primaryRoute === 'No especificado' || !motiveData.gem_reasoning) {
                    setMessages(prev => [...prev, {
                      role: "assistant",
                      content: "⚠️ **Interbloqueo de Seguridad (NOM-004)**: El motor Cortex no cuenta con datos suficientes para establecer una Ruta Clínica Principal o un Razonamiento validado. Por favor, proporcione más detalles de su motivo de consulta."
                    }]);
                    return; // Bloquea el avance
                  }

                  setCurrentPhase('PHASE_4_FAMILY_HISTORY');
                }}
              />
            ) : currentPhase === 'PHASE_4_FAMILY_HISTORY' ? (
              <Fase4_AntecedentesFamiliares
                user={user}
                appId={apiContext?.citaId}
                patientData={patientData}
                setPatientData={setPatientData}
                patientProfile={patientData}
                phase3Data={fase3State}
                onStateChange={setFase4State}
                initialChatHistory={messages}
                onPhaseComplete={(familyTreeData, localMessages) => {
                  setPatientData(prev => ({ ...prev, familyTree: familyTreeData }));
                  // Bypass redundant confirmation summary in Phase 4
                  setMessages(localMessages);
                  setCurrentPhase('PHASE_5_LIFESTYLE');
                }}
              />
            ) : currentPhase === 'PHASE_5_LIFESTYLE' ? (
              <Fase5_EstiloVida
                user={user}
                appId={apiContext?.citaId}
                patientData={patientData}
                setPatientData={setPatientData}
                patientProfile={patientData}
                onStateChange={setFase5State}
                initialChatHistory={messages}
                onPhaseComplete={(lifestyleData) => {
                  setPatientData(prev => ({ ...prev, lifeStyleInfo: lifestyleData }));
                  triggerPhase5Summary({ ...patientData, lifeStyleInfo: lifestyleData });
                }}
              />
            ) : currentPhase === 'PHASE_6_PHARMACOLOGY' ? (
              <Fase6_Farmacologia
                user={user}
                appId={apiContext?.citaId}
                patientData={patientData}
                setPatientData={setPatientData}
                patientProfile={patientData}
                onStateChange={setFase6State}
                initialChatHistory={messages}
                onPhaseComplete={(pharmaData) => {
                  setPatientData(prev => ({ ...prev, pharmacology: pharmaData }));
                  triggerPhase6Summary({ ...patientData, pharmacology: pharmaData });
                }}
              />
            ) : currentPhase === 'PHASE_7_HABITS' ? (
              <Fase7_Habitos
                user={user}
                appId={apiContext?.citaId}
                patientData={patientData}
                setPatientData={setPatientData}
                patientProfile={patientData}
                initialChatHistory={messages}
                onPhaseComplete={(habitsData) => {
                  setPatientData(prev => ({ ...prev, habits: habitsData }));
                  triggerPhase7Summary({ ...patientData, habits: habitsData });
                }}
              />
            ) : (
              <>
                <div className="flex-1 h-full overflow-y-auto p-8 space-y-6 bg-slate-50 custom-scrollbar z-10 relative">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === "assistant" ? "justify-start" :
                        "justify-end"
                        } mb-6 items-start gap-3`}
                    >
                      {/* AVATAR DE TILO: Solo para Asistente */}
                      {msg.role === "assistant" && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-12 h-12 rounded-full bg-white flex-shrink-0 border shadow-sm flex items-center justify-center overflow-hidden"
                        >
                          <img
                            src={tiloImg}
                            alt="Tilo"
                            className="w-10 h-10 object-contain" // Tilo ahora ocupa mejor su contenedor
                          />
                        </motion.div>
                      )}

                      <div
                        className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${msg.role === "assistant"
                          ? msg.isBio
                            ? "bg-purple-50 border-l-4 border-purple-500 text-purple-900 rounded-tl-none font-medium"
                            : msg.isAcute
                              ? "bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-tl-none font-medium"
                              : msg.isCritical
                                ? "bg-red-50 border-l-4 border-red-500 text-red-900 rounded-tl-none font-bold"
                                : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
                          : "bg-indigo-600 text-white rounded-tr-none"
                          }`}
                      >
                        {/* Envolvemos el Markdown en un div para los estilos de tipografía */}
                        <div
                          className={`prose prose-sm max-w-none ${msg.role === "assistant" ? "prose-slate" :
                            "prose-invert"
                            }`}
                        >
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>

                        {/* V7.1 RENDERIZADO DE BOTONES (Chips Interactivos) */}
                        {/* ADAPTIVE UI: Todos los botones se muestran. Si hay > 3, usar Select Dropdown */}
                        {msg.options && (
                          (msg.options.length > 3) ? null : (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {msg.options.map((opt, i) => {
                                const isLastMessage = index === messages.length - 1;
                                return (
                                  <button
                                    key={i}
                                    disabled={!isLastMessage}
                                    onClick={() => {
                                      if (!isLastMessage) return;
                                      handleOptionSelect(msg, opt.value);
                                    }}
                                    className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-full text-xs hover:bg-blue-200 transition-colors shadow-sm border border-blue-200"
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          )
                        )}

                        {/* V2.6 INFERENCE ENGINE UI */}
                        {msg.inputType === 'analyzing' && (
                          <div className="flex flex-col items-center py-4 space-y-3 animate-pulse mt-4">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Sintetizando diagnóstico...</p>
                          </div>
                        )}


                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-6 bg-white border-t border-slate-50 shrink-0">

                  {/* V8.0 IDENTITY BIFURCATION UI */}
                  {interviewStep === 'intro_curp' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-3 flex justify-end"
                    >
                      <button
                        onClick={() => {
                          setPatientData(prev => ({
                            ...prev,
                            identificacion: { ...prev.identificacion, nationality_type: 'FOREIGN', curp: null, curpValidated: true }
                          }));
                          setMessages(prev => [...prev, { role: "assistant", content: `Entendido. Paciente ${patientData.identificacion.sexo === 'Femenino' ? 'Extranjera' : 'Extranjero'}.\n\nPor favor, ingrese su **Número de Pasaporte** o Documento Migratorio.` }]);
                          setInterviewStep('intro_passport');
                        }}
                        className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-2"
                      >
                        {patientData.identificacion.sexo === 'Femenino' ? 'Soy Extranjera' : 'Soy Extranjero'} / No tengo CURP
                      </button>
                    </motion.div>
                  )}

                  {/* V9.6 VISUAL BODY MAP (PHASE 3A) - STANDALONE CONTAINER */}
                  {interviewStep === 'clinica_body_map' ? (
                    <div className="w-full flex justify-center p-2 mb-2">
                      <VisualBodyMap
                        gender={patientData.identificacion.sexo} // V10.3 FIX: PASS GENDER PROP
                        onComplete={(payload) => {
                          // V9.9 PAYLOAD DESTRUCTURING (ZONES + INTENSITY)
                          const { zones, intensity } = payload;

                          // V9.9 DATA MAPPING: GRANULAR MALE/FEMALE ZONES
                          // V9.9 DATA MAPPING: GRANULAR MALE/FEMALE ZONES (V10 UPDATE)
                          const tagMap = {
                            // --- MALE ---
                            'M_HEAD': 'HEADACHE_RISK', 'M_NECK': 'CERVICAL_RISK', 'M_SHOULDERS': 'JOINT_SHOULDER',
                            'M_CHEST': 'CARDIO_RISK', 'M_STOMACH': 'GASTRIC_RISK', 'M_ABDOMEN_LOW': 'INTESTINAL_RISK',
                            'M_LOWER_BACK': 'LUMBAR_RISK',
                            'M_LUNGS_R': 'RESPIRATORY_RISK', 'M_LUNGS_L': 'RESPIRATORY_RISK', // New
                            'M_KIDNEY_R': 'RENAL_RISK', 'M_KIDNEY_L': 'RENAL_RISK', // Split
                            'M_ELBOW_R': 'JOINT_ELBOW', 'M_ELBOW_L': 'JOINT_ELBOW', // Split
                            'M_WRIST_R': 'JOINT_WRIST', 'M_WRIST_L': 'JOINT_WRIST', // Split
                            'M_HAND_R': 'JOINT_WRIST', 'M_HAND_L': 'JOINT_WRIST', // Split
                            'M_KNEE_R': 'JOINT_KNEE', 'M_KNEE_L': 'JOINT_KNEE', // Split
                            'M_LEG_R': 'CIRCULATION_RISK', 'M_LEG_L': 'CIRCULATION_RISK', // Split
                            'M_ANKLE_R': 'JOINT_ANKLE', 'M_ANKLE_L': 'JOINT_ANKLE', // Split
                            'M_FOOT_R': 'JOINT_FOOT', 'M_FOOT_L': 'JOINT_FOOT', // Split

                            // --- FEMALE ---
                            'F_HEAD': 'HEADACHE_RISK', 'F_NECK': 'CERVICAL_RISK', 'F_UPPER_BACK': 'POSTURAL_RISK',
                            'F_STOMACH_UP': 'GASTRIC_RISK', 'F_STOMACH_LOW': 'INTESTINAL_RISK',
                            'F_HIPS': 'JOINT_HIP', 'F_LOWER_BACK': 'LUMBAR_RISK',
                            'F_LUNG_R': 'RESPIRATORY_RISK', 'F_LUNG_L': 'RESPIRATORY_RISK', // New
                            'F_BREAST_R': 'BREAST_RISK', 'F_BREAST_L': 'BREAST_RISK', // New
                            'F_OVARY_R': 'GYNECO_RISK', 'F_OVARY_L': 'GYNECO_RISK', // New
                            'F_KIDNEY_R': 'RENAL_RISK', 'F_KIDNEY_L': 'RENAL_RISK', // Split
                            'F_HAND_R': 'JOINT_WRIST', 'F_HAND_L': 'JOINT_WRIST', // Split
                            'F_KNEE_R': 'JOINT_KNEE', 'F_KNEE_L': 'JOINT_KNEE', // Split
                            'F_LEG_R': 'CIRCULATION_RISK', 'F_LEG_L': 'CIRCULATION_RISK', // Split
                            'F_FOOT_R': 'JOINT_FOOT', 'F_FOOT_L': 'JOINT_FOOT' // Split
                          };

                          // VISUAL LABELS (SPANISH)
                          const zoneLabels = {
                            // GENERAL MAPPING FALLBACK
                            'M_HEAD': 'Cabeza', 'F_HEAD': 'Cabeza',
                            // NEW SPECIFICS WILL BE USED DIRECTLY FROM KEYS IF NOT FOUND
                            'M_LUNGS_R': 'Pulmón Derecho', 'M_LUNGS_L': 'Pulmón Izquierdo',
                            'F_LUNG_R': 'Pulmón Derecho', 'F_LUNG_L': 'Pulmón Izquierdo',
                            'F_BREAST_R': 'Seno Derecho', 'F_BREAST_L': 'Seno Izquierdo',
                            'F_OVARY_R': 'Ovario Derecho', 'F_OVARY_L': 'Ovario Izquierdo',
                            'F_KIDNEY_R': 'Riñón Derecho', 'F_KIDNEY_L': 'Riñón Izquierdo',
                            'M_KIDNEY_R': 'Riñón Derecho', 'M_KIDNEY_L': 'Riñón Izquierdo'
                          };


                          const newTags = zones.map(z => tagMap[z] || 'PAIN_GENERAL');

                          // SAFETY TRIGGER (RED FLAG)
                          let isRedFlag = false;
                          if (intensity >= 8 && (newTags.includes('CARDIO_RISK') || newTags.includes('GASTRIC_RISK') || newTags.includes('HEADACHE_RISK'))) {
                            isRedFlag = true;
                            newTags.push('red_flag_symptom');
                          }

                          setPatientData(prev => ({
                            ...prev,
                            clinical_context: {
                              ...prev.clinical_context,
                              intensity: intensity, // Store Intensity
                              pain_zones: zones,    // V10.1: PERSIST ZONES FOR DASHBOARD
                              ai_analysis: {
                                ...prev.clinical_context.ai_analysis,
                                detected_tags: [...prev.clinical_context.ai_analysis.detected_tags, ...newTags]
                              }
                            }
                          }));

                          // Generate summary using Spanish labels
                          const summary = zones.length > 0 ? zones.map(z => zoneLabels[z] || z).join(', ') : "Ninguna";
                          setMessages(prev => [...prev, { role: "user", content: `Zonas: ${summary} | Intensidad: ${intensity}/10` }]);

                          // CONDITIONAL ROUTING BASED ON RISK
                          if (isRedFlag) {
                            setMessages(prev => [...prev, { role: "assistant", content: "⚠️ **ALERTA DE SEGURIDAD**: He detectado un nivel de dolor severo en una zona sensible. \n\n¿Desea que activemos el protocolo de emergencia o contactemos a su familiar registrado?" }]);
                            // Here we could route to emergency, but for now we follow standard flow with alert
                            handleSend('BODY_MAP_COMPLETE');
                          } else {
                            handleSend('BODY_MAP_COMPLETE');
                          }
                        }} />
                    </div>
                  ) : messages.length > 0 && messages[messages.length - 1].inputType === 'none' ? (
                    // LOGIC RESTORATION: Bloqueo Visual de la barra de texto
                    <div className="flex items-center justify-center p-2 text-slate-400 text-sm italic">
                      Entrada bloqueada temporalmente.
                    </div>
                  ) :
                    /* STANDARD INPUT PILL (TEXT/SELECT) */
                    (
                      <div className="relative flex items-center gap-2 bg-white border border-slate-200 rounded-full px-2 py-2 shadow-sm focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-400 transition-all w-full">
                        {/* V8.0 Searchable Vertical Menu Conditional Render */}
                        {messages.length > 0 &&
                          messages[messages.length - 1].role === 'assistant' &&
                          messages[messages.length - 1].options &&
                          (messages[messages.length - 1].options.length > 3) && (
                            <SearchableVerticalMenu
                              options={messages[messages.length - 1].options}
                              onSelect={(selectedValue) => handleOptionSelect(messages[messages.length - 1], selectedValue)}
                            />
                          )}

                        {/* V8.2 TILO SMART SELECT (CURP STATE) */}
                        {interviewStep === 'intro_curp_state' || (messages.length > 0 && (messages[messages.length - 1].inputType === 'StateSelector' || messages[messages.length - 1].content.includes('Estado de la República'))) ? (
                          <div className="w-full relative px-2">
                            <SearchableVerticalMenu
                              options={Object.keys(ESTADO_MAP).filter(k => k !== 'EXTRANJERO').sort().map(estado => ({ label: formatText(estado), value: ESTADO_MAP[estado] })).concat([{ label: "Nacido en el Extranjero", value: "NE" }])}
                              onSelect={(val) => {
                                let label = val === 'NE' ? "Nacido en el Extranjero" : "Estado";
                                if (val !== 'NE') {
                                  const key = Object.keys(ESTADO_MAP).find(k => ESTADO_MAP[k] === val);
                                  if (key) label = formatText(key);
                                }
                                setMessages(prev => [...prev, { role: "user", content: label }]);
                                handleSend(val);
                              }}
                            />
                          </div>
                        ) : messages.length > 0 && messages[messages.length - 1].inputType === 'strict_select' ? (
                          <div className="flex-1 px-3 py-2 text-slate-400 text-sm italic border-l border-slate-100 flex items-center">
                            Por favor, seleccione una opción del menú superior.
                          </div>
                        ) : (
                          <input
                            type={messages.length > 0 && messages[messages.length - 1].inputType === 'tel' ? 'tel' : 'text'}
                            value={input}
                            onChange={(e) => {
                              if (messages.length > 0 && messages[messages.length - 1].inputType === 'tel') {
                                let val = e.target.value.replace(/\D/g, '');
                                if (val.length > 10) val = val.slice(0, 10);
                                if (val.length > 6) {
                                  val = `(${val.slice(0,3)}) ${val.slice(3,6)}-${val.slice(6)}`;
                                } else if (val.length > 3) {
                                  val = `(${val.slice(0,3)}) ${val.slice(3)}`;
                                } else if (val.length > 0) {
                                  val = `(${val}`;
                                }
                                setInput(val);
                              } else {
                                setInput(e.target.value);
                              }
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Escribe tu respuesta..."
                            className="flex-1 bg-transparent outline-none text-slate-700 placeholder:text-slate-400 text-sm h-10 px-2"
                          />
                        )}
                        {/* V8.2 END */}

                        {messages.length === 0 || messages[messages.length - 1].inputType !== 'strict_select' ? (
                          <button
                            type="button"
                            onClick={() => {
                              // ADAPTIVE UI FIX: Display LABEL, Send VALUE
                              if (messages.length > 0 && messages[messages.length - 1].options) {
                                const currentOpts = messages[messages.length - 1].options;
                                const selected = currentOpts.find(o => o.value === input);
                                if (selected) {
                                  setMessages(prev => [...prev, { role: "user", content: selected.label }]);
                                  handleSend(input);
                                } else {
                                  handleSend();
                                }
                              } else {
                                handleSend();
                              }
                            }}
                            className="bg-blue-600 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-700 transition-transform active:scale-95 shadow-md flex-shrink-0"
                          >
                            <Send className="w-5 h-5" />
                          </button>
                        ) : null}
                      </div>
                    )}
                </div>
              </>)}
          </div>

          {/* PANEL DERECHO (50%) - DASHBOARD RESTAURADO (ACORDEONES) */}
          <div className="w-1/2 h-full flex flex-col bg-gray-50 border-l border-gray-200 relative overflow-hidden">
            {/* COMPUERTA NOM-004: BLOQUEO DE FASE 0 */}
            {!isIdentityConfirmed ? (
                // Fase 0 Activa: Muro de Contención
                showPrivacyPolicy ? (
                    <div className="absolute inset-0 z-10 w-full h-full bg-slate-50">
                        <AvisoPrivacidad onAccept={handleAcceptPrivacy} onClose={() => setShowPrivacyPolicy(false)} />
                    </div>
                ) : (
                    <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <Lock className="w-16 h-16 text-slate-300 mb-6" />
                            <h2 className="text-xl font-bold text-slate-700 uppercase tracking-widest font-prototype">
                                Espejo Clínico Bloqueado
                            </h2>
                            <p className="text-slate-500 mt-3 text-sm font-medium max-w-sm">
                                Esperando validación de identidad y aceptación del aviso de privacidad (NOM-004).
                            </p>
                        </div>
                    </div>
                )
            ) : (
                // Fase 1+: Dashboard Liberado
                <div className="h-full w-full animate-in fade-in duration-1000">
                  {/* DASHBOARD COMPONENT INTEGRATION */}
                  <MedicalDashboard
                    patientData={patientData}
                    setPatientData={setPatientData}
                    currentStep={interviewStep === 'appointment' ? currentPhase : interviewStep}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    isEditing={isEditing}
                    onEditToggle={() => setIsEditing(!isEditing)}
                    onTriggerEdit={handleTriggerEdit}
                    activeField={activeField}
                    fase3State={fase3State}
                    fase4State={fase4State}
                    fase5State={fase5State}
                    fase6State={fase6State}
                  />
                </div>
            )}
          </div>

        </div >


        {/* FOOTER INSTITUCIONAL V15.6 */}
        {
          isLoggedIn && !showPrivacyPolicy && (
            <div className="w-full h-16 bg-white border-t border-gray-200 flex items-center justify-between px-6 z-20 shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] relative">
              <span className="text-gray-400 text-sm font-sansation">VERSIÓN 2.0</span>

              {/* Componente Aislado del Loader */}
              <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-64 h-full flex justify-center items-center">
                <FooterLoader />
              </div>

              <span className="text-gray-400 text-sm font-sansation">© DERECHOS RESERVADOS 2026</span>
            </div>
          )
        }
        {/* MODAL DE PRIVACIDAD ELIMINADO: Ahora se renderiza en el Panel Derecho bajo protocolo NOM-004 */}

        {/* V15.5 RECOVERY DIALOG (Renderizado Condicional) */}
        <AnimatePresence>
          {recoveryData && (
            <RecoveryDialog
              data={recoveryData}
              onResume={handleResumeSession}
              onRestart={() => {
                setRecoveryData(null);
                setInterviewStep("verify_identity");
                setMessages(prev => [...prev, { role: "assistant", content: "Entendido. Iniciando nueva sesión.\n\n⚠️ Antes de iniciar, necesito validar su identidad. ¿Es usted el paciente titular?", options: [{ label: 'Sí, soy yo', value: 'CONFIRM_IDENTITY_YES' }, { label: 'No, soy acompañante', value: 'CONFIRM_IDENTITY_NO' }] }]);
              }}
            />
          )}
        </AnimatePresence>

      </div >
    </div >
  );
}

export default App;
