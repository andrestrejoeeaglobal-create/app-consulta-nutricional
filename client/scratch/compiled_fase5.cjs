var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/src/components/interview/Fase5_PatologicosPersonales.jsx
var Fase5_PatologicosPersonales_exports = {};
__export(Fase5_PatologicosPersonales_exports, {
  default: () => Fase5_PatologicosPersonales_default
});
module.exports = __toCommonJS(Fase5_PatologicosPersonales_exports);
var import_react3 = __toESM(require("react"), 1);

// client/node_modules/zustand/esm/vanilla.mjs
var createStoreImpl = (createState) => {
  let state;
  const listeners = /* @__PURE__ */ new Set();
  const setState = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };
  const getState = () => state;
  const getInitialState = () => initialState;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const api = { setState, getState, getInitialState, subscribe };
  const initialState = state = createState(setState, getState, api);
  return api;
};
var createStore = ((createState) => createState ? createStoreImpl(createState) : createStoreImpl);

// client/node_modules/zustand/esm/react.mjs
var import_react = __toESM(require("react"), 1);
var identity = (arg) => arg;
function useStore(api, selector = identity) {
  const slice = import_react.default.useSyncExternalStore(
    api.subscribe,
    import_react.default.useCallback(() => selector(api.getState()), [api, selector]),
    import_react.default.useCallback(() => selector(api.getInitialState()), [api, selector])
  );
  import_react.default.useDebugValue(slice);
  return slice;
}
var createImpl = (createState) => {
  const api = createStore(createState);
  const useBoundStore = (selector) => useStore(api, selector);
  Object.assign(useBoundStore, api);
  return useBoundStore;
};
var create = ((createState) => createState ? createImpl(createState) : createImpl);

// client/src/store/useClinicalGenome.js
var useClinicalGenome = create((set, get) => ({
  // 1. BLOQUE I: ANCLAJE LEGAL (Safety Locks)
  identityLock: {
    verified: false,
    privacySigned: false,
    serverName: null,
    // Guarded name from Appointments API
    patientInfo: { age: null, sex: null, curp: null, name: null, apellidoPaterno: null, apellidoMaterno: null },
    emergencyContact: { name: "", relation: "", phone: "" }
  },
  // 1.5. BLOQUE I: PERFIL SOCIOCULTURAL (Fase 1)
  socioculturalProfile: {
    civilStatus: null,
    religion: null,
    occupation: null,
    educationLevel: null,
    lifeStage: null
    // Lactante, Escolar, Adolescente, Adulto, Geriátrico
  },
  // 2. BLOQUE II & V: CERO RIESGO (Hardware & Biometry Blocks)
  vitalSigns: {
    bloodPressure: { systolic: null, diastolic: null },
    heartRate: null,
    respiratoryRate: null,
    temperature: null,
    spo2: null,
    glucose: null,
    glucoseContext: null
  },
  allergies: {
    food: [],
    medication: [],
    verified: false
    // Must be true to pass Phase 7
  },
  // 3. EJES ASÍNCRONOS (El Cerebro Multinúcleo)
  metabolicAxis: {
    glucoseRisk: false,
    insulinResistance: false
  },
  hormonalAxis: {
    cyclePhase: null,
    // Female only
    stressLevel: 0
  },
  psychiatricAxis: {
    sleepQuality: 0,
    anxietyMarkers: false
  },
  biomechanicalAxis: {
    activityLevel: "sedentary",
    // NEAT
    exerciseRoutine: false
  },
  // 4. INTERFAZ DE AUTORIDAD (Human in the Loop)
  pendingAlerts: [],
  // Sugerencias de la IA (ej. "Déficit B12 por Metformina")
  medicalOverrides: [],
  // Decisiones del Sherpa (Aprobar/Descartar)
  // -- ACCIONES (Mutators) --
  // Actualización Parcial del Seguro de Identidad
  updateIdentityLock: (updates) => set((state) => ({
    identityLock: { ...state.identityLock, ...updates }
  })),
  // Actualización del Perfil Sociocultural
  updateSocioculturalProfile: (updates) => set((state) => ({
    socioculturalProfile: { ...state.socioculturalProfile, ...updates }
  })),
  // Actualización Parcial de Signos Vitales
  updateVitalSigns: (updates) => set((state) => ({
    vitalSigns: { ...state.vitalSigns, ...updates }
  })),
  // Actualización de Ejes (La IA llama esto en el fondo)
  updateAxis: (axisName, updates) => set((state) => ({
    [axisName]: { ...state[axisName], ...updates }
  })),
  // Añadir Alerta para el Sherpa (con deduplicación por tipo)
  addAlert: (alert) => set((state) => {
    if (state.pendingAlerts.some((a) => a.type === alert.type)) return state;
    return {
      pendingAlerts: [...state.pendingAlerts, { id: Date.now(), ...alert }]
    };
  }),
  // Aprobar/Descartar Alerta (El Sherpa llama esto)
  resolveAlert: (alertId, resolution) => set((state) => ({
    pendingAlerts: state.pendingAlerts.filter((a) => a.id !== alertId),
    medicalOverrides: [...state.medicalOverrides, { alertId, resolution, timestamp: /* @__PURE__ */ new Date() }]
  })),
  // Evaluador de Integridad Legal (El Daemon consulta esto)
  isLegallyCompliant: () => {
    const { identityLock, allergies } = get();
    return identityLock.privacySigned && identityLock.emergencyContact.phone !== "" && allergies.verified;
  }
}));

// client/src/utils/utils.js
var toSentenceCase = (text) => {
  if (!text || typeof text !== "string") return text;
  const trimmed = text.trim();
  if (trimmed.length === 0) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

// client/src/components/interview/Fase5_PatologicosPersonales.jsx
var import_framer_motion = require("framer-motion");
var import_tilo = __toESM(require("../../assets/tilo.png"), 1);
var import_react_markdown = __toESM(require("react-markdown"), 1);

// client/src/components/ui/SearchableVerticalMenu.jsx
var import_react2 = __toESM(require("react"), 1);
var import_lucide_react = require("lucide-react");

// client/src/components/interview/Fase5_PatologicosPersonales.jsx
var import_lucide_react2 = require("lucide-react");
var BASE_OPTIONS = [
  { label: "Diabetes (Tipo 1 o 2)", value: "Diabetes" },
  { label: "Hipertensi\xF3n Arterial", value: "Hipertension" },
  { label: "Hipotiroidismo / Tiroides", value: "Tiroides" },
  { label: "Dislipidemia (Colesterol/Triglic\xE9ridos)", value: "Dislipidemia" },
  { label: "Gastritis / Colitis", value: "Gastritis" },
  { label: "Artritis", value: "Artritis" },
  { label: "Otras / Diagn\xF3stico manual", value: "Otras" }
];
var getInitialFlowState = (messages, patientData) => {
  if (!messages || messages.length === 0) return "ASK_START";
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  if (assistantMessages.length === 0) return "ASK_START";
  const lastMsg = assistantMessages[assistantMessages.length - 1];
  const content = lastMsg.content || "";
  if (content.includes("\xBFEs correcta esta informaci\xF3n?") || content.includes("verifique los datos declarados")) {
    return "REVIEW_SUMMARY";
  }
  if (content.includes("\xBFQu\xE9 desea hacer?") || content.includes("\xBFQu\xE9 acci\xF3n desea tomar respecto a sus antecedentes")) {
    return "ASK_MORE";
  }
  if (content.includes("escriba brevemente el nombre de la patolog\xEDa")) {
    return "TYPE_DETAIL";
  }
  if (content.includes("seleccione una condici\xF3n m\xE9dica") || lastMsg.showMenu === "disease") {
    return "SELECT_DISEASES";
  }
  if (patientData?.history?.personal_structured?.length > 0) return "ASK_MORE";
  return "ASK_START";
};
var Fase5_PatologicosPersonales = ({
  patientData,
  setPatientData,
  onPhaseComplete,
  messages,
  setMessages,
  registerInputHandler,
  setIsGlobalTyping
}) => {
  const addAlert = useClinicalGenome((state) => state.addAlert);
  const updateAxis = useClinicalGenome((state) => state.updateAxis);
  const ptCtx = patientData?.profile?.pediatric_profile || patientData?.identificacion?.pediatric_profile;
  const ageStr = patientData?.profile?.pediatric_profile?.age || patientData?.identificacion?.edad || "0";
  const age = parseInt(ageStr, 10) || 0;
  const isMinor = ptCtx?.is_minor === true && age < 12;
  let pName = patientData?.profile?.first_name || patientData?.identificacion?.nombre || patientData?.identificacion?.nombres || patientData?.identityLock?.patientInfo?.firstName;
  pName = pName ? pName.split(" ")[0] : null;
  const pNameFormatted = pName || (isMinor ? "el menor" : "el paciente");
  const pSex = patientData?.identificacion?.sexo || patientData?.profile?.sex || "Femenino";
  const isFemale = pSex === "Femenino" || pSex === "FEMALE" || pSex === "2";
  const prnPatient = isMinor ? isFemale ? "la menor" : "el menor" : isFemale ? "la paciente" : "el paciente";
  const prnEvaluated = isFemale ? "evaluada" : "evaluado";
  const getOptionsList = () => {
    const list = [...BASE_OPTIONS];
    if (isFemale) {
      list.splice(4, 0, { label: "SOP (S\xEDndrome de Ovario Poliqu\xEDstico)", value: "SOP" });
    }
    return list;
  };
  const [personalStructured, setPersonalStructured] = (0, import_react3.useState)(() => {
    return patientData?.history?.personal_structured || [];
  });
  const [flowState, setFlowState] = (0, import_react3.useState)(() => {
    return getInitialFlowState(messages, patientData);
  });
  const [currentCondition, setCurrentCondition] = (0, import_react3.useState)(null);
  const chatEndRef = (0, import_react3.useRef)(null);
  const setChatEndRef = import_react3.default.useCallback((node) => {
    if (node) {
      chatEndRef.current = node;
      node.scrollIntoView({ behavior: "auto" });
    }
  }, []);
  const isConfirming = (0, import_react3.useRef)(false);
  const isFirstRender = (0, import_react3.useRef)(true);
  const makeP1P2 = (p1, p2) => `${p1}

${p2}`;
  (0, import_react3.useEffect)(() => {
    setMessages((prev) => {
      const alreadyGreetedInPrev = prev.some(
        (msg) => msg.role === "assistant" && (msg.content.includes("expediente patol\xF3gico personal") || msg.content.includes("antecedentes personales patol\xF3gicos") || msg.content.includes("Integridad del expediente restablecida"))
      );
      if (alreadyGreetedInPrev) return prev;
      if (patientData?.history?.personal_structured?.length > 0) {
        const resumeMsg = {
          role: "assistant",
          content: makeP1P2(
            "Integridad del expediente restablecida. El sistema mantiene cargada su informaci\xF3n biol\xF3gica previa en la sesi\xF3n activa.",
            "\xBFQu\xE9 acci\xF3n desea tomar respecto a sus antecedentes personales patol\xF3gicos?"
          ),
          options: [
            { label: "\u2795 REGISTRAR OTRA CONDICI\xD3N", value: "ADD_MORE" },
            { label: "\u27A1\uFE0F CONTINUAR AL HISTORIAL", value: "FINISH" }
          ]
        };
        return [...prev, resumeMsg];
      } else {
        const initialContent = makeP1P2(
          isMinor ? `El perfil gen\xF3mico y la carga heredofamiliar de **${pNameFormatted}** han sido consolidados exitosamente en nuestro n\xFAcleo de datos. En cumplimiento estricto de la **NOM-004-SSA3-2012**, procedemos a la calibraci\xF3n del expediente patol\xF3gico personal para modular con precisi\xF3n celular la terap\xE9utica nutricional.` : `Su perfil gen\xF3mico y la carga heredofamiliar han sido consolidados exitosamente en nuestro n\xFAcleo de datos. En cumplimiento estricto de la **NOM-004-SSA3-2012**, procedemos a la calibraci\xF3n de su expediente patol\xF3gico personal para modular con precisi\xF3n celular la terap\xE9utica nutricional.`,
          `Como ${isMinor ? "tutor responsable de la cuenta" : "titular de este expediente"}, por favor **declare** si ${isMinor ? `**${pNameFormatted}**` : "usted"} padece o ha recibido un diagn\xF3stico cl\xEDnico formal para alguna enfermedad cr\xF3nica o patolog\xEDa activa:`
        );
        const greetingMsg = {
          role: "assistant",
          content: initialContent,
          options: [
            { label: `\u274C NINGUNA / DECLARAR SAN${isFemale ? "A" : "O"}`, value: "NO_DIAGNOSIS" },
            { label: "\u2705 S\xCD, SELECCIONAR DIAGN\xD3STICOS", value: "YES_DIAGNOSIS" }
          ]
        };
        return [...prev, greetingMsg];
      }
    });
  }, [isMinor, isFemale, pNameFormatted, patientData, setMessages]);
  (0, import_react3.useEffect)(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);
  const [inputValue, setInputValue] = (0, import_react3.useState)("");
  const [isAnalyzing, setIsAnalyzing] = (0, import_react3.useState)(false);
  const pushMessage = (msg) => {
    setMessages((prev) => {
      const newMsgs = [...prev];
      for (let i = newMsgs.length - 1; i >= 0; i--) {
        if (newMsgs[i].role === "assistant") {
          newMsgs[i] = {
            ...newMsgs[i],
            options: void 0,
            showMenu: void 0
          };
          break;
        }
      }
      return [...newMsgs, msg];
    });
  };
  const handleSend = (text, type = "text") => {
    const textToProcess = text || inputValue;
    if (!textToProcess.trim()) return;
    let userLabel = textToProcess;
    if (textToProcess === "YES_DIAGNOSIS") userLabel = "S\xED, seleccionar diagn\xF3sticos";
    if (textToProcess === "NO_DIAGNOSIS") userLabel = `Ninguna / Declarar san${isFemale ? "a" : "o"}`;
    if (textToProcess === "FINISH") userLabel = "Continuar al historial";
    if (textToProcess === "ADD_MORE") userLabel = "Registrar otra condici\xF3n";
    if (textToProcess === "CONFIRM_DATA") userLabel = "S\xED, es correcta";
    if (textToProcess === "CORRECT_DATA") userLabel = "No, quiero corregir algo";
    if (type === "disease") {
      userLabel = getOptionsList().find((o) => o.value === textToProcess)?.label || textToProcess;
    }
    const newUserMsg = { role: "user", content: type === "text" ? toSentenceCase(userLabel) : userLabel };
    let nextMsgs;
    setMessages((prev) => {
      const newMsgs = [...prev];
      for (let i = newMsgs.length - 1; i >= 0; i--) {
        if (newMsgs[i].role === "assistant") {
          newMsgs[i] = {
            ...newMsgs[i],
            options: void 0,
            showMenu: void 0
          };
          break;
        }
      }
      if (type === "text") {
        nextMsgs = [...newMsgs, newUserMsg];
      } else {
        nextMsgs = newMsgs;
      }
      return nextMsgs;
    });
    setInputValue("");
    setIsAnalyzing(true);
    setTimeout(() => {
      processState(textToProcess, type, nextMsgs || messages);
    }, 600);
  };
  const processState = (val, type, currentMsgs = messages) => {
    if (flowState === "ASK_START") {
      if (val === "NO_DIAGNOSIS") {
        const updatedList = [];
        setPersonalStructured(updatedList);
        setPatientData((prev) => ({
          ...prev,
          history: {
            ...prev.history,
            personal_structured: updatedList,
            personal_raw_text: "Niega antecedentes personales patol\xF3gicos.",
            personal_checklist_verified: true
          }
        }));
        const finalMessages = [
          ...currentMsgs,
          {
            role: "assistant",
            content: makeP1P2(
              "Declaratoria de salud \xF3ptima registrada en el expediente base. Procedemos al cierre de validaci\xF3n bajo la firma del cl\xEDnico.",
              "Confirmaci\xF3n exitosa. Avanzamos hacia la siguiente secci\xF3n del triage."
            )
          }
        ];
        onPhaseComplete?.(updatedList, finalMessages);
        setIsAnalyzing(false);
        return;
      } else if (val === "YES_DIAGNOSIS") {
        setFlowState("SELECT_DISEASES");
        pushMessage({
          role: "assistant",
          content: makeP1P2(
            "Alineaci\xF3n de datos en proceso. El sistema ha habilitado el panel de selecci\xF3n patol\xF3gica del ecosistema central para mapear de manera detallada el historial cl\xEDnico.",
            "Por favor, seleccione una condici\xF3n m\xE9dica diagnosticada de la siguiente lista oficial:"
          ),
          showMenu: "disease",
          options: getOptionsList()
        });
      }
    } else if (flowState === "SELECT_DISEASES") {
      if (val === "Otras") {
        setFlowState("TYPE_DETAIL");
        pushMessage({
          role: "assistant",
          content: makeP1P2(
            "Entrada anal\xF3gica detectada. Procedemos a registrar una condici\xF3n cl\xEDnica no listada para salvaguardar la exactitud del expediente m\xE9dico.",
            "Por favor, escriba brevemente el nombre de la patolog\xEDa o condici\xF3n diagnosticada:"
          )
        });
      } else {
        const newCondition = {
          condition_category: val,
          specific_condition: val,
          status: "ACTIVE",
          source: "CHECKLIST"
        };
        triggerClinicalIntegrations(val);
        const updatedList = [...personalStructured, newCondition];
        setPersonalStructured(updatedList);
        setPatientData((prev) => ({
          ...prev,
          history: {
            ...prev.history,
            personal_structured: updatedList,
            personal_raw_text: `Presenta antecedentes de: ${updatedList.map((a) => a.specific_condition).join(", ")}.`,
            personal_checklist_verified: true
          }
        }));
        setFlowState("ASK_MORE");
        pushMessage({
          role: "assistant",
          content: `Condici\xF3n **${getOptionsList().find((o) => o.value === val)?.label || val}** agregada. \xBFQu\xE9 desea hacer?`,
          options: [
            { label: "\u2795 REGISTRAR OTRA CONDICI\xD3N", value: "ADD_MORE" },
            { label: "\u27A1\uFE0F CONTINUAR AL HISTORIAL", value: "FINISH" }
          ]
        });
      }
    } else if (flowState === "TYPE_DETAIL") {
      const newCondition = {
        condition_category: "Otras",
        specific_condition: val,
        status: "ACTIVE",
        source: "MANUAL"
      };
      triggerClinicalIntegrations(val, true);
      const updatedList = [...personalStructured, newCondition];
      setPersonalStructured(updatedList);
      setPatientData((prev) => ({
        ...prev,
        history: {
          ...prev.history,
          personal_structured: updatedList,
          personal_raw_text: `Presenta antecedentes de: ${updatedList.map((a) => a.specific_condition).join(", ")}.`,
          personal_checklist_verified: true
        }
      }));
      setFlowState("ASK_MORE");
      pushMessage({
        role: "assistant",
        content: `Condici\xF3n **${val}** agregada. \xBFQu\xE9 desea hacer?`,
        options: [
          { label: "\u2795 REGISTRAR OTRA CONDICI\xD3N", value: "ADD_MORE" },
          { label: "\u27A1\uFE0F CONTINUAR AL HISTORIAL", value: "FINISH" }
        ]
      });
    } else if (flowState === "ASK_MORE") {
      if (val === "FINISH") {
        setFlowState("REVIEW_SUMMARY");
        const summaryText = personalStructured.length > 0 ? personalStructured.map((a) => `- \u{1F4CB} **${a.specific_condition}**`).join("\n") : "Ning\xFAn antecedente personal patol\xF3gico registrado.";
        const finalContent = makeP1P2(
          "Para dar cumplimiento a la NOM-004-SSA3-2012 y consolidar formalmente su expediente patol\xF3gico, por favor verifique los datos declarados:",
          `${summaryText}

---

\xBFEs correcta esta informaci\xF3n?`
        );
        pushMessage({
          role: "assistant",
          content: finalContent,
          options: [
            { label: "\u2705 S\xED, es correcta", value: "CONFIRM_DATA" },
            { label: "\u274C No, quiero corregir algo", value: "CORRECT_DATA" }
          ]
        });
      } else if (val === "ADD_MORE") {
        setFlowState("SELECT_DISEASES");
        const selectedCats = personalStructured.map((i) => i.condition_category);
        const filteredOptions = getOptionsList().filter((opt) => !selectedCats.includes(opt.value) || opt.value === "Otras");
        pushMessage({
          role: "assistant",
          content: "Por favor, seleccione otra patolog\xEDa o condici\xF3n cl\xEDnica activa:",
          options: filteredOptions,
          showMenu: filteredOptions.length > 3 ? "disease" : void 0
        });
      }
    } else if (flowState === "REVIEW_SUMMARY") {
      if (val === "CONFIRM_DATA") {
        if (isConfirming.current) return;
        isConfirming.current = true;
        const rawTextSummary = personalStructured.length > 0 ? `Presenta antecedentes de: ${personalStructured.map((a) => a.specific_condition).join(", ")}.` : "Niega antecedentes personales patol\xF3gicos.";
        const syncedPatientData = {
          ...patientData,
          history: {
            ...patientData.history,
            personal_structured: personalStructured,
            personal_raw_text: rawTextSummary,
            personal_checklist_verified: true
          }
        };
        setPatientData(syncedPatientData);
        const currentMessages = [...currentMsgs];
        if (currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === "assistant") {
          currentMessages[currentMessages.length - 1] = {
            ...currentMessages[currentMessages.length - 1],
            options: void 0,
            showMenu: void 0
          };
        }
        const updatedMessagesList = currentMessages;
        onPhaseComplete?.(personalStructured, updatedMessagesList);
        return;
      } else if (val === "CORRECT_DATA") {
        setFlowState("ASK_START");
        setPersonalStructured([]);
        setPatientData((prev) => ({
          ...prev,
          history: {
            ...prev.history,
            personal_structured: [],
            personal_raw_text: "",
            personal_checklist_verified: false
          }
        }));
        pushMessage({
          role: "assistant",
          content: makeP1P2(
            "Sistemas cl\xEDnicos reiniciados. Se ha limpiado el mapa patol\xF3gico de la sesi\xF3n para evitar contaminaci\xF3n cruzada de datos.",
            `Por favor declare nuevamente si ${isMinor ? `**${pNameFormatted}**` : "usted"} padece alguna patolog\xEDa diagnosticada:`
          ),
          options: [
            { label: `\u274C NINGUNA / DECLARAR SAN${isFemale ? "A" : "O"}`, value: "NO_DIAGNOSIS" },
            { label: "\u2705 S\xCD, SELECCIONAR DIAGN\xD3STICOS", value: "YES_DIAGNOSIS" }
          ]
        });
      }
    }
    setIsAnalyzing(false);
  };
  const triggerClinicalIntegrations = (conditionValue, isManual = false) => {
    const cond = String(conditionValue).toUpperCase();
    if (cond.includes("DIABETES") || cond.includes("GLUCOSA")) {
      addAlert({
        type: "EVALUACI\xD3N GLUC\xC9MICA / DISFUNCI\xD3N METAB\xD3LICA",
        message: `Paciente ${prnEvaluated} con antecedente de Diabetes. Rigor en la prescripci\xF3n de hidratos de carbono simples y acoplamiento de control gluc\xE9mico.`
      });
      updateAxis("metabolicAxis", { glucoseRisk: true });
    } else if (cond.includes("HIPERTENS") || cond.includes("PRESI")) {
      addAlert({
        type: "MONITOREO DE TENSI\xD3N ARTERIAL",
        message: `Presencia de Hipertensi\xF3n Arterial en ${prnPatient}. Restricci\xF3n estricta de sodio en preparaciones y control de suplementaci\xF3n con cafe\xEDna o termog\xE9nicos.`
      });
    } else if (cond.includes("TIROI") || cond.includes("HIPOTIRO")) {
      addAlert({
        type: "ADAPTACI\xD3N END\xD3CRINA TIROIDEA",
        message: `Hipotiroidismo diagnosticado. Sincronizar ingesta matutina de Levotiroxina (ayuno completo) y evitar boci\xF3genos crudos en el plan nutricional.`
      });
    } else if (cond.includes("SOP") || cond.includes("OVARIO POLIQUIS")) {
      addAlert({
        type: "MODULACI\xD3N HORMONAL DE ALTO RANGO",
        message: `Diagn\xF3stico de SOP en la paciente. Prescribir estrategias de modulaci\xF3n de resistencia a la insulina y control de andr\xF3genos.`
      });
      updateAxis("metabolicAxis", { insulinResistance: true });
    } else if (cond.includes("GASTRIT") || cond.includes("COLIT") || cond.includes("INTESTINO")) {
      addAlert({
        type: "INTEGRIDAD DE MUCOSA INTESTINAL",
        message: `Manifestaci\xF3n de inflamaci\xF3n en tubo digestivo. Modular ingesta de fibra insoluble, prohibir irritantes de alto impacto y valorar L-Glutamina.`
      });
    } else if (cond.includes("DISLIPIDEMIA") || cond.includes("COLESTEROL") || cond.includes("TRIGLICERID")) {
      addAlert({
        type: "RIESGO DISLIPID\xC9MICO ACTIVO",
        message: `Niveles lip\xEDdicos alterados reportados. Optimizar perfil de \xE1cidos grasos (Omega 3/9) y suprimir grasas trans en el recetario terap\xE9utico.`
      });
    }
  };
  (0, import_react3.useEffect)(() => {
    if (registerInputHandler) {
      registerInputHandler(() => (text, val) => handleSend(text, val));
    }
  }, [registerInputHandler, flowState, isAnalyzing, inputValue, personalStructured]);
  return null;
};
var Fase5_PatologicosPersonales_default = Fase5_PatologicosPersonales;
