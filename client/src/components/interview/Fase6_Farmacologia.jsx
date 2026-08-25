import React, { useState, useEffect, useRef, useMemo } from 'react';
import { formatText, toSentenceCase } from '../../utils/utils';
import { usePatientLinguistics } from '../../hooks/usePatientLinguistics';
import { useClinicalGenome } from '../../store/useClinicalGenome';
import { Send } from 'lucide-react';

/**
 * T.I.L.O. - FASE 6 (FARMACOLOGÍA Y VADEMÉCUM INTERACTIVO)
 * 
 * Componente interactivo estructurado con el "Clinical Look".
 * Integra el Vademécum predictivo de PLM utilizando SearchableVerticalMenu y useMemo.
 * Conectado asíncronamente con el Safety Engine (useClinicalGenome) para alertar contraindicaciones.
 */

const PLM_OPTIONS = [
    { label: "💊 Metformina (850 mg) - Control Glucémico", value: "Metformina" },
    { label: "💊 Glibenclamida (5 mg) - Control Glucémico", value: "Glibenclamida" },
    { label: "💊 Insulina Glargina - Control Glucémico", value: "Insulina Glargina" },
    { label: "💊 Insulina NPH - Control Glucémico", value: "Insulina NPH" },
    { label: "💊 Insulina Rápida - Control Glucémico", value: "Insulina Rápida" },
    { label: "💊 Losartán (50 mg) - Antihipertensivo", value: "Losartán" },
    { label: "💊 Telmisartán (40 mg) - Antihipertensivo", value: "Telmisartán" },
    { label: "💊 Amlodipino (5 mg) - Antihipertensivo", value: "Amlodipino" },
    { label: "💊 Enalapril (10 mg) - Antihipertensivo", value: "Enalapril" },
    { label: "💊 Captopril (25 mg) - Antihipertensivo", value: "Captopril" },
    { label: "💊 Atorvastatina (20 mg) - Colesterol", value: "Atorvastatina" },
    { label: "💊 Pravastatina (10 mg) - Colesterol", value: "Pravastatina" },
    { label: "💊 Levotiroxina (100 mcg) - Hormona Tiroidea", value: "Levotiroxina" },
    { label: "💊 Omeprazol (20 mg) - Protector Gástrico", value: "Omeprazol" },
    { label: "💊 Pantoprazol (40 mg) - Protector Gástrico", value: "Pantoprazol" },
    { label: "💊 Aspirina Protect (100 mg) - Anticoagulante", value: "Aspirina Protect" },
    { label: "💊 Clopidogrel (75 mg) - Anticoagulante", value: "Clopidogrel" },
    { label: "💊 Paracetamol (500 mg) - Analgésico", value: "Paracetamol" },
    { label: "💊 Ibuprofeno (400 mg) - Antiinflamatorio", value: "Ibuprofeno" },
    { label: "💊 Tylenol (500 mg) - Paracetamol", value: "Tylenol" },
    { label: "💊 Tempra (500 mg) - Paracetamol", value: "Tempra" },
    { label: "💊 Advil (400 mg) - Ibuprofeno", value: "Advil" },
    { label: "💊 Plavix (75 mg) - Clopidogrel", value: "Plavix" },
    { label: "💊 Ketorolaco (10 mg) - Analgésico", value: "Ketorolaco" },
    { label: "💊 Diclofenaco (100 mg) - Antiinflamatorio", value: "Diclofenaco" },
    { label: "💊 Celecoxib (200 mg) - Antiinflamatorio", value: "Celecoxib" },
    { label: "💊 Naproxeno (500 mg) - Antiinflamatorio", value: "Naproxeno" },
    { label: "💊 Sertralina (50 mg) - Antidepresivo", value: "Sertralina" },
    { label: "💊 Fluoxetina (20 mg) - Antidepresivo", value: "Fluoxetina" },
    { label: "💊 Clonazepam (2 mg) - Ansiolítico", value: "Clonazepam" },
    { label: "💊 Diazepam (10 mg) - Ansiolítico", value: "Diazepam" },
    { label: "💊 Gabapentina (300 mg) - Dolor Neuropático", value: "Gabapentina" },
    { label: "💊 Pregabalina (75 mg) - Dolor Neuropático", value: "Pregabalina" },
    { label: "💊 Alopurinol (300 mg) - Ácido Úrico", value: "Alopurinol" },
    { label: "💊 Montelukast (10 mg) - Antiasmático", value: "Montelukast" },
    { label: "💊 Salbutamol (Aerosol) - Broncodilatador", value: "Salbutamol" },
    { label: "💊 Loratadina (10 mg) - Antihistamínico", value: "Loratadina" },
    { label: "💊 Cetirizina (10 mg) - Antihistamínico", value: "Cetirizina" },
    { label: "💊 Metoclopramida (10 mg) - Procinético", value: "Metoclopramida" },
    { label: "💊 Bromuro de Pinaverio (100 mg) - Antiespasmódico", value: "Bromuro de Pinaverio" },
    { label: "💊 Loperamida (2 mg) - Antidiarréico", value: "Loperamida" },
    { label: "💊 Ciprofloxacino (500 mg) - Antibiótico", value: "Ciprofloxacino" },
    { label: "💊 Amoxicilina (500 mg) - Antibiótico", value: "Amoxicilina" },
    { label: "💊 Azitromicina (500 mg) - Antibiótico", value: "Azitromicina" },
    { label: "💊 Complejo B - Vitaminas", value: "Complejo B" },
    { label: "💊 Ácido Fólico (5 mg) - Vitamina", value: "Ácido Fólico" },
    { label: "💊 Sulfato Ferroso (200 mg) - Hierro", value: "Sulfato Ferroso" },
    { label: "💊 Diane (Ciproterona/Etinilestradiol) - Anticonceptivo / Regulador Hormonal", value: "Diane" },
    { label: "💊 Yasmin (Drospirenona/Etinilestradiol) - Anticonceptivo / Regulador Hormonal", value: "Yasmin" },
    { label: "❓ No lo recuerdo / Buscar por síntoma", value: "NO_RECUERDO" },
    { label: "✍️ Otro / Escribir manualmente", value: "MANUAL" }
];

const getContextualExample = (medicationName) => {
    if (!medicationName) return "Ej. 1 tableta cada 12 horas";
    const name = String(medicationName).toLowerCase();
    
    // Anticonceptivos / Reguladores Hormonales
    if (
        name.includes("diane") || 
        name.includes("yasmin") || 
        name.includes("anticonceptivo") || 
        name.includes("etinilestradiol") || 
        name.includes("drospirenona") || 
        name.includes("ciproterona") ||
        name.includes("hormona") ||
        name.includes("hormonal")
    ) {
        return "Ej. 1 tableta diaria a la misma hora durante 21 días, seguido de 7 días de descanso";
    }
    
    // Inhaladores / Aerosoles / Broncodilatadores
    if (
        name.includes("salbutamol") || 
        name.includes("ventolin") || 
        name.includes("alvesco") || 
        name.includes("seretide") || 
        name.includes("symbicort") || 
        name.includes("combivent") || 
        name.includes("aerosol") || 
        name.includes("inhalador") || 
        name.includes("fluticasona") || 
        name.includes("budesonida")
    ) {
        return "Ej. 2 disparos en caso de crisis asmática o inhalaciones diarias";
    }
    
    // Insulinas (Inyectables)
    if (
        name.includes("insulina") || 
        name.includes("glargina") || 
        name.includes("nph") || 
        name.includes("lantus") || 
        name.includes("humalog") || 
        name.includes("novorapid") || 
        name.includes("tresiba") || 
        name.includes("inyect")
    ) {
        return "Ej. 10 UI antes del desayuno o unidades aplicadas";
    }
    
    // Protectores Gástricos (Ayunas)
    if (
        name.includes("omeprazol") || 
        name.includes("pantoprazol") || 
        name.includes("esomeprazol") || 
        name.includes("ranitidina") || 
        name.includes("lanzoprazol")
    ) {
        return "Ej. 1 cápsula en ayuno (20 minutos antes de desayunar)";
    }

    // Jarabes / Suspensiones líquidas
    if (
        name.includes("jarabe") || 
        name.includes("suspension") || 
        name.includes("ml") || 
        name.includes("solucion") || 
        name.includes("pepto") || 
        name.includes("emulsion")
    ) {
        return "Ej. 10 ml cada 8 horas";
    }

    // Gotas
    if (
        name.includes("gotas") || 
        name.includes("oftalm") || 
        name.includes("nasal") || 
        name.includes("afrin") || 
        name.includes("otico")
    ) {
        return "Ej. 2 gotas en cada fosa nasal cada 12 horas";
    }
    
    // Cremas / Ungüentos / Geles
    if (
        name.includes("crema") || 
        name.includes("ungüento") || 
        name.includes("gel") || 
        name.includes("pomada") || 
        name.includes("topico")
    ) {
        return "Ej. Aplicar una capa delgada en la zona afectada por la noche";
    }

    // Por defecto (Tableta / Comprimido)
    return "Ej. 1 tableta cada 12 horas después de los alimentos";
};

const Fase6_Farmacologia = ({ 
    messages, 
    setMessages, 
    registerInputHandler, 
    setIsGlobalTyping, 
    patientData, 
    setPatientData, 
    onPhaseComplete, 
    onStateChange 
}) => {

    const { patientName: pName, patientAge } = usePatientLinguistics(patientData);

    console.log("🔍 Fase6_Farmacologia Mount/Render. Props:", {
        hasMessages: !!messages,
        messagesLength: messages?.length,
        typeofSetMessages: typeof setMessages,
        hasRegisterInput: !!registerInputHandler,
        hasSetPatientData: !!setPatientData
    });

    const ptCtx = patientData?.profile?.pediatric_profile;
    // Para efectos de diálogo, solo consideramos menor (3ra persona) si tiene menos de 12 años (pediátricos).
    // Para adolescentes (12-17) el protocolo exige tratamiento directo ("Usted").
    const isMinor = ptCtx?.is_minor === true && patientAge < 12;

    // Sincronización del Cerebro Clínico Asíncrono
    const addAlert = useClinicalGenome(state => state.addAlert);
    const updateAxis = useClinicalGenome(state => state.updateAxis);

     const analyzeMedicationAsync = async (medName) => {
         const localFallback = getContextualExample(medName);
         try {
             if (setIsGlobalTyping) setIsGlobalTyping(true);
 
             const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
             
             // Timeout de 1000ms
             const timeoutPromise = new Promise((_, reject) => 
                 setTimeout(() => reject(new Error("Timeout de red")), 1000)
             );
             
             const fetchPromise = (async () => {
                 const response = await fetch(`${apiUrl}/api/cortex/analyzeMedication`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ medicationName: medName })
                 });
 
                 if (!response.ok) throw new Error("Vademecum API failed");
                 const data = await response.json();
                 console.log("💊 [Córtex Vademécum] Análisis obtenido para:", medName, data);
 
                 // 1. Registrar alertas dinámicas en el Safety Engine
                 if (data.alerts && data.alerts.length > 0) {
                     data.alerts.forEach(alert => {
                         addAlert({
                             type: alert.type,
                             message: alert.message
                         });
                     });
                 }
 
                 // 2. Actualizar ejes clínicos
                 if (data.axes) {
                     Object.entries(data.axes).forEach(([axisKey, isAffected]) => {
                         if (isAffected) {
                             updateAxis(axisKey, { [medName.toLowerCase().replace(/\s+/g, '_') + '_active']: true });
                         }
                     });
                 }
                 
                 return data.contextualDose || localFallback;
             })();
 
             const resolvedDose = await Promise.race([fetchPromise, timeoutPromise]);
             if (setIsGlobalTyping) setIsGlobalTyping(false);
             return resolvedDose;
 
         } catch (err) {
             console.error("⚠️ Fallo en análisis dinámico de Vademécum, usando fallback local:", err);
             if (setIsGlobalTyping) setIsGlobalTyping(false);
             return localFallback;
         }
     };

    // useMemo para evitar re-renderizados innecesarios del Vademécum
    const plmOptionsList = useMemo(() => {
        return PLM_OPTIONS;
    }, []);

    // Estado Local Initialize
    const hasInitializedRef = useRef(false);
    const [step, setStep] = useState(() => {
        const hasMeds = patientData.history?.medications && patientData.history.medications.length > 0;
        const hasSupps = patientData.history?.supplements && patientData.history.supplements.length > 0;
        if (hasMeds || hasSupps) {
            return 'pharma_correct_menu';
        }
        return 'meds_gate';
    });
    const [tempItem, setTempItem] = useState({ name: '', details: '', duration: '', type: '' });

    useEffect(() => {
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            if (step === 'pharma_correct_menu') {
                if (typeof setMessages === 'function') {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "De acuerdo. ¿Qué cambio o acción desea realizar en su historial de farmacología y suplementación?",
                        options: [
                            { label: "➕ Registrar otro medicamento", value: "ADD_MED" },
                            { label: "➕ Registrar otro suplemento", value: "ADD_SUPP" },
                            { label: "✏️ Modificar registro existente", value: "MODIFY_SELECT" },
                            { label: "🗑️ Eliminar registro de la lista", value: "DELETE_SELECT" },
                            { label: "🔄 Limpiar lista completa (Reiniciar)", value: "CLEAR_ALL" },
                            { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                        ]
                    }]);
                }
                return;
            }

            const alreadyGreeted = messages.some(msg => msg.role === 'assistant' && msg.content.includes("Farmacología"));
            if (!alreadyGreeted) {
                const initialMsg = isMinor
                    ? `Entendido. Perfil clínico actualizado.\n\nPasemos ahora a la Farmacología. ¿Toma ${pName} actualmente algún medicamento recetado por un médico?`
                    : "Entendido. Perfil clínico actualizado.\n\nPasemos ahora a la Farmacología. ¿Toma usted actualmente algún medicamento recetado por un médico?";
                
                if (typeof setMessages === 'function') {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: initialMsg,
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                } else {
                    console.error("❌ setMessages is not a function in Fase6_Farmacologia!", { setMessages });
                }
            }
        }
    }, [messages, isMinor, pName, setMessages, step]);

    // Update parent state (fase6State) when patientData changes
    useEffect(() => {
        if (onStateChange) {
            onStateChange({
                medications: patientData?.history?.medications || [],
                supplements: patientData?.history?.supplements || []
            });
        }
    }, [patientData?.history?.medications, patientData?.history?.supplements, onStateChange]);

    const triggerClinicalIntegrations = (medicationName) => {
        const med = String(medicationName).toUpperCase();

        // 1. ANÁLISIS DE INTERACCIÓN SINFÓNICA CRÍTICA (Insulina + Glibenclamida)
        const existingMeds = (patientData?.history?.medications || []).map(m => String(m.name).toUpperCase());
        const registeringMed = med;
        
        const hasInsulin = existingMeds.some(m => m.includes("INSULINA")) || registeringMed.includes("INSULINA");
        const hasGlibenclamida = existingMeds.some(m => m.includes("GLIBENCLAMIDA")) || registeringMed.includes("GLIBENCLAMIDA");
        
        if (hasInsulin && hasGlibenclamida) {
            addAlert({
                type: 'INTERACCIÓN SINFÓNICA CRÍTICA - HIPOGLUCEMIA SEVERA NOCTURNA',
                message: `Riesgo crítico de hipoglucemia severa, particularmente nocturna, por terapia combinada de Insulina y Sulfonilurea (Glibenclamida). Se aconseja monitoreo estricto de glucemia capilar y ajuste de colación nocturna amortiguadora con proteínas de liberación lenta y carbohidratos complejos.`
            });
            updateAxis('metabolicAxis', { glucoseRisk: true });
        }

        // 2. ALERTAS ESPECÍFICAS DE FÁRMACOS
        if (med.includes("METFORMINA")) {
            addAlert({
                type: 'EVALUACIÓN DE ABSORCIÓN - RIESGO DE DÉFICIT DE VITAMINA B12',
                message: `Paciente en tratamiento con Metformina. Se recomienda monitorear niveles de vitamina B12 y considerar suplementación profiláctica para evitar anemia megaloblástica o neuropatía.`
            });
            addAlert({
                type: 'SEGURIDAD METABÓLICA / INTERACCIÓN ETANOL',
                message: `Alerta de seguridad: La Metformina presenta riesgo de hipoglucemia y acidosis láctica. Evitar el consumo de alcohol en ayuno y restringir preparaciones con alta carga de carbohidratos simples sin amortiguación lipídica.`
            });
            updateAxis('metabolicAxis', { glucoseRisk: true, insulinResistance: true });

            // VALIDACIÓN CRUZADA: Metformina en Paciente Renal (Riesgo de Acidosis Láctica)
            const goalText = String(patientData?.clinical_context?.goal || "").toUpperCase();
            const primaryMotive = String(patientData?.clinical_context?.primary_motive || "").toUpperCase();
            const isRenalPatient = goalText.includes("RENAL") || goalText.includes("NEFRO") || primaryMotive.includes("RENAL") || primaryMotive.includes("NEFRO") || patientData?.history?.personal_structured?.some(p => p.specific_condition?.toUpperCase().includes("RENAL") || p.specific_condition?.toUpperCase().includes("NEFRO"));
            
            if (isRenalPatient) {
                addAlert({
                    type: 'CONTRAINDICACIÓN POR INSUFICIENCIA RENAL - RIESGO DE ACIDOSIS LÁCTICA',
                    message: `Atención: El uso de Metformina en pacientes con función renal comprometida (Nefropatía / TFG < 30 ml/min) está contraindicado debido al riesgo crítico de acumulación de fármaco y Acidosis Láctica. Se aconseja suspender Metformina o ajustar de inmediato con base en la Depuración de Creatinina.`
                });
            }
        }
        else if (med.includes("GLIBENCLAMIDA")) {
            addAlert({
                type: 'FARMACOVIGILANCIA DE SULFONILUREAS - RIESGO DE HIPOGLUCEMIA',
                message: `Glibenclamida activa. Estimula la secreción endógena de insulina independientemente de los niveles de glucosa. Es imperativo evitar el ayuno prolongado y programar tomas de alimentos precisas para prevenir eventos de hipoglucemia aguda.`
            });
            updateAxis('metabolicAxis', { glucoseRisk: true });
        }
        else if (med.includes("INSULINA")) {
            addAlert({
                type: 'TERAPIA EXÓGENA DE INSULINA - SINERGISMO METABÓLICO',
                message: `Uso activo de Insulina exógena. Requiere sincronización exacta entre la aplicación de la dosis y la ingesta de hidratos de carbono. Monitorear síntomas de neuroglucopenia y educar en el uso de carbohidratos de rápida absorción en caso de rescate.`
            });
            updateAxis('metabolicAxis', { glucoseRisk: true });
        }
        else if (med.includes("ASPIRINA") || med.includes("ACIDO ACETILSALICILICO")) {
            addAlert({
                type: 'PREVENCIÓN GASTROLESIVA / INTEGRIDAD DE MUCOSA',
                message: `Paciente consume Ácido Acetilsalicílico (Aspirina). Evitar prescripción de irritantes térmicos o químicos de alto impacto, y valorar recubrimiento con glutamina o sábila en ayunas.`
            });
        }
        else if (med.includes("TYLENOL") || med.includes("TEMPRA") || med.includes("PARACETAMOL")) {
            addAlert({
                type: 'FARMACOVIGILANCIA HEPÁTICA',
                message: `Uso activo de Paracetamol. Evitar suplementación termogénica con alta carga hepática y vigilar ingesta calórica y consumo de alcohol para prevenir estrés oxidativo hepático.`
            });
        }
        else if (med.includes("ADVIL") || med.includes("IBUPROFENO")) {
            addAlert({
                type: 'RIESGO NEFROTÓXICO Y GASTROINTEGINAL',
                message: `Uso de Ibuprofeno. Monitorear hidratación celular activa para proteger la función renal y modular fibra insoluble para evitar irritación mecánica intestinal.`
            });
        }
        else if (med.includes("PLAVIX") || med.includes("CLOPIDOGREL")) {
            addAlert({
                type: 'RIESGO DE HEMORRAGIA / ANTICOAGULANTE',
                message: `Terapia con Clopidogrel. Se prohíbe la suplementación paralela con Omega 3 en dosis elevadas (>2g/día) o extracto de ajo concentrado debido al sinergismo anticoagulante.`
            });
        }
        else if (
            med.includes("DIANE") || 
            med.includes("YASMIN") || 
            med.includes("ANTICONCEPTIVO") || 
            med.includes("ETINILESTRADIOL") || 
            med.includes("DROSPIRENONA") || 
            med.includes("CIPROTERONA")
        ) {
            addAlert({
                type: 'DEPLETACIÓN DE MICRONUTRIENTES POR ANTICONCEPTIVOS ORALES',
                message: `El uso crónico de anticonceptivos hormonales combinados (como Diane) induce depletación biológica de vitaminas clave del complejo B (especialmente B6, B9/Ácido Fólico, B12), Vitamina C, Zinc y Magnesio. Se recomienda asegurar fuentes dietéticas densas en estos micronutrientes o considerar suplementación correctiva.`
            });
            addAlert({
                type: 'EVALUACIÓN CARDIOVASCULAR Y VASCULAR - COAGULACIÓN',
                message: `Terapia hormonal activa (estrógenos/progestágenos). Aumenta la síntesis hepática de factores de coagulación. Es prioritario evitar la inflamación endotelial sistémica, asegurar una óptima hidratación celular y modular grasas trans/saturadas en la dieta diaria.`
            });
            updateAxis('hormonalAxis', { estrogenRatio: true, hormonalCycleRegulated: true });
        }
    };

    const handleSend = (val, label) => {
        const isGeneric = label === 'text' || label === 'select' || label === 'number' || label === 'tel' || label === 'button';
        let userLabel = (label && !isGeneric) ? label : val;
        
        if (val === "ADD_MED") userLabel = "➕ Registrar otro medicamento";
        if (val === "ADD_SUPP") userLabel = "➕ Registrar otro suplemento";
        if (val === "MODIFY_SELECT") userLabel = "✏️ Modificar registro existente";
        if (val === "DELETE_SELECT") userLabel = "🗑️ Eliminar registro de la lista";
        if (val === "CLEAR_ALL") userLabel = "🔄 Limpiar lista completa (Reiniciar)";
        if (val === "FINISH") userLabel = "❌ Cancelar (Volver al resumen)";
        if (val === "BACK_TO_CORRECT") userLabel = "⬅️ Volver al menú anterior";
        if (typeof val === 'string') {
            if (val.startsWith("DELETE_MED_INDEX_")) {
                const idx = parseInt(val.replace("DELETE_MED_INDEX_", ""), 10);
                const med = patientData.history?.medications?.[idx];
                userLabel = med ? `🗑️ Eliminar Medicamento: ${med.name}` : "Eliminar medicamento";
            }
            else if (val.startsWith("DELETE_SUPP_INDEX_")) {
                const idx = parseInt(val.replace("DELETE_SUPP_INDEX_", ""), 10);
                const supp = patientData.history?.supplements?.[idx];
                userLabel = supp ? `🗑️ Eliminar Suplemento: ${supp.name}` : "Eliminar suplemento";
            }
            else if (val.startsWith("MODIFY_MED_INDEX_")) {
                const idx = parseInt(val.replace("MODIFY_MED_INDEX_", ""), 10);
                const med = patientData.history?.medications?.[idx];
                userLabel = med ? `✏️ Modificar Medicamento: ${med.name}` : "Modificar medicamento";
            }
            else if (val.startsWith("MODIFY_SUPP_INDEX_")) {
                const idx = parseInt(val.replace("MODIFY_SUPP_INDEX_", ""), 10);
                const supp = patientData.history?.supplements?.[idx];
                userLabel = supp ? `✏️ Modificar Suplemento: ${supp.name}` : "Modificar suplemento";
            }
        }
        
        const inputToSave = userLabel;
        if (!inputToSave) return;

        // Limpiar opciones previas al mandar mensaje del usuario
        setMessages(prev => {
            const newMsgs = [...prev];
            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') {
                newMsgs[newMsgs.length - 1].options = undefined;
            }
            if (label === 'button') {
                // El padre (App.jsx) ya agregó la respuesta visual del botón, no la duplicamos
                return newMsgs;
            }
            return [...newMsgs, { role: 'user', content: toSentenceCase(inputToSave) }];
        });

        setTimeout(() => processStep(val), 100);
    };

    const processStep = async (input) => {
        switch (step) {
            case 'pharma_correct_menu': {
                if (input === "ADD_MED") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? "Alineando Vademécum PLM. Por favor, selecciona el medicamento de la lista interactiva o escribe su nombre:" 
                            : "Alineando Vademécum PLM. Por favor, seleccione el medicamento de la lista interactiva o escriba su nombre:",
                        options: plmOptionsList
                    }]);
                    setStep('meds_select');
                } else if (input === "ADD_SUPP") {
                    setStep('supp_name');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor
                            ? `¿Qué vitaminas, proteínas, tés o suplementos consume **${pName}**? Por favor escribe el nombre comercial o principio activo:`
                            : "¿Qué vitaminas, proteínas, tés o suplementos consume usted? Por favor escriba el nombre comercial o principio activo:"
                    }]);
                } else if (input === "MODIFY_SELECT") {
                    const meds = patientData.history?.medications || [];
                    const supps = patientData.history?.supplements || [];
                    
                    if (meds.length > 0 || supps.length > 0) {
                        setStep('SELECT_MODIFY_ITEM');
                        const opts = [];
                        meds.forEach((m, idx) => {
                            opts.push({ label: `💊 Med: ${m.name}`, value: `MODIFY_MED_INDEX_${idx}` });
                        });
                        supps.forEach((s, idx) => {
                            opts.push({ label: `🥛 Supp: ${s.name}`, value: `MODIFY_SUPP_INDEX_${idx}` });
                        });
                        opts.push({ label: "⬅️ Volver al menú anterior", value: "BACK_TO_CORRECT" });

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "¿Qué registro desea modificar? Seleccione de la lista:",
                            options: opts
                        }]);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "No existen registros para modificar.",
                            options: [
                                { label: "➕ Registrar otro medicamento", value: "ADD_MED" },
                                { label: "❌ Cancelar (Volver)", value: "FINISH" }
                            ]
                        }]);
                    }
                } else if (input === "DELETE_SELECT") {
                    const meds = patientData.history?.medications || [];
                    const supps = patientData.history?.supplements || [];
                    
                    if (meds.length > 0 || supps.length > 0) {
                        setStep('SELECT_DELETE_ITEM');
                        const opts = [];
                        meds.forEach((m, idx) => {
                            opts.push({ label: `💊 Med: ${m.name}`, value: `DELETE_MED_INDEX_${idx}` });
                        });
                        supps.forEach((s, idx) => {
                            opts.push({ label: `🥛 Supp: ${s.name}`, value: `DELETE_SUPP_INDEX_${idx}` });
                        });
                        opts.push({ label: "⬅️ Volver al menú anterior", value: "BACK_TO_CORRECT" });

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "¿Qué registro desea eliminar de su expediente? Seleccione de la lista:",
                            options: opts
                        }]);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "No existen registros para eliminar.",
                            options: [
                                { label: "➕ Registrar otro medicamento", value: "ADD_MED" },
                                { label: "❌ Cancelar (Volver)", value: "FINISH" }
                            ]
                        }]);
                    }
                } else if (input === "CLEAR_ALL") {
                    setPatientData(prev => ({
                        ...prev,
                        history: {
                            ...(prev.history || {}),
                            medications: [],
                            supplements: []
                        }
                    }));
                    setStep('meds_gate');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: makeP1P2(
                            "Sistemas clínicos de historial farmacológico y suplementación reiniciados.",
                            isMinor
                                ? `¿Toma ${pName} actualmente algún medicamento recetado por un médico?`
                                : "¿Toma usted actualmente algún medicamento recetado por un médico?"
                        ),
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                } else if (input === "FINISH") {
                    const meds = patientData.history?.medications || [];
                    const supps = patientData.history?.supplements || [];
                    if (onPhaseComplete) {
                        onPhaseComplete({ medications: meds, supplements: supps });
                    }
                }
                break;
            }

            case 'SELECT_MODIFY_ITEM': {
                if (input === "BACK_TO_CORRECT") {
                    setStep('pharma_correct_menu');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "De acuerdo. ¿Qué cambio o acción desea realizar?",
                        options: [
                            { label: "➕ Registrar otro medicamento", value: "ADD_MED" },
                            { label: "➕ Registrar otro suplemento", value: "ADD_SUPP" },
                            { label: "✏️ Modificar registro existente", value: "MODIFY_SELECT" },
                            { label: "🗑️ Eliminar registro de la lista", value: "DELETE_SELECT" },
                            { label: "🔄 Limpiar lista completa (Reiniciar)", value: "CLEAR_ALL" },
                            { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                        ]
                    }]);
                    setIsAnalyzing(false);
                    return;
                }
                if (input.startsWith("MODIFY_MED_INDEX_")) {
                    const idx = parseInt(input.replace("MODIFY_MED_INDEX_", ""), 10);
                    const meds = patientData.history?.medications || [];
                    if (meds[idx]) {
                        const target = meds[idx];
                        const updated = meds.filter((_, i) => i !== idx);

                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...(prev.history || {}),
                                medications: updated
                            }
                        }));

                        setTempItem({ name: target.name, details: '', duration: '', type: 'MED' });
                        setStep('meds_select');

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Modificando medicamento. Por favor vuelva a seleccionar el medicamento o confirme si es: **${target.name}**`,
                            options: [
                                { label: `✅ Sí, es ${target.name}`, value: target.name },
                                { label: "❌ No, buscar otro", value: "MANUAL" }
                            ]
                        }]);
                    }
                }
                else if (input.startsWith("MODIFY_SUPP_INDEX_")) {
                    const idx = parseInt(input.replace("MODIFY_SUPP_INDEX_", ""), 10);
                    const supps = patientData.history?.supplements || [];
                    if (supps[idx]) {
                        const target = supps[idx];
                        const updated = supps.filter((_, i) => i !== idx);

                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...(prev.history || {}),
                                supplements: updated
                            }
                        }));

                        setTempItem({ name: target.name, details: '', duration: '', type: 'SUPP' });
                        setStep('supp_name');

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Modificando suplemento. Por favor escriba el nombre o confirme si es: **${target.name}**`
                        }]);
                    }
                }
                break;
            }

            case 'SELECT_DELETE_ITEM': {
                if (input === "BACK_TO_CORRECT") {
                    setStep('pharma_correct_menu');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "De acuerdo. ¿Qué cambio o acción desea realizar?",
                        options: [
                            { label: "➕ Registrar otro medicamento", value: "ADD_MED" },
                            { label: "➕ Registrar otro suplemento", value: "ADD_SUPP" },
                            { label: "✏️ Modificar registro existente", value: "MODIFY_SELECT" },
                            { label: "🗑️ Eliminar registro de la lista", value: "DELETE_SELECT" },
                            { label: "🔄 Limpiar lista completa (Reiniciar)", value: "CLEAR_ALL" },
                            { label: "❌ Cancelar (Volver al resumen)", value: "FINISH" }
                        ]
                    }]);
                    setIsAnalyzing(false);
                    return;
                }
                if (input.startsWith("DELETE_MED_INDEX_")) {
                    const idx = parseInt(input.replace("DELETE_MED_INDEX_", ""), 10);
                    const meds = patientData.history?.medications || [];
                    if (meds[idx]) {
                        const updated = meds.filter((_, i) => i !== idx);

                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...(prev.history || {}),
                                medications: updated
                            }
                        }));

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Medicamento eliminado con éxito."
                        }]);

                        setTimeout(() => {
                            if (onPhaseComplete) {
                                onPhaseComplete({ medications: updated, supplements: patientData.history?.supplements || [] });
                            }
                        }, 500);
                    }
                }
                else if (input.startsWith("DELETE_SUPP_INDEX_")) {
                    const idx = parseInt(input.replace("DELETE_SUPP_INDEX_", ""), 10);
                    const supps = patientData.history?.supplements || [];
                    if (supps[idx]) {
                        const updated = supps.filter((_, i) => i !== idx);

                        setPatientData(prev => ({
                            ...prev,
                            history: {
                                ...(prev.history || {}),
                                supplements: updated
                            }
                        }));

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Suplemento eliminado con éxito."
                        }]);

                        setTimeout(() => {
                            if (onPhaseComplete) {
                                onPhaseComplete({ medications: patientData.history?.medications || [], supplements: updated });
                            }
                        }, 500);
                    }
                }
                break;
            }

            // ================= MEDICAMENTOS =================
            case 'meds_gate': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor
                            ? "Alineando Vademécum PLM. Por favor, selecciona el medicamento de la lista interactiva o escribe su nombre:"
                            : "Alineando Vademécum PLM. Por favor, seleccione el medicamento de la lista interactiva o escriba su nombre:",
                        options: plmOptionsList
                    }]);
                    setStep('meds_select');
                } else if (input === "No") {
                    transitionToSupps();
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No.",
                        options: [
                            { label: "✅ Sí", value: "Sí" },
                            { label: "❌ No", value: "No" },
                        ]
                    }]);
                }
                break;
            }

            case 'meds_select': {
                if (input === "CAJA_VERDE") {
                    // Atajo de Contexto Clínico Inteligente: Diabetes
                    const hasDiabetes = patientData?.history?.personal_structured?.some(p => p.condition_category === 'Diabetes' || p.specific_condition?.toUpperCase().includes('DIABETES'));
                    
                    if (hasDiabetes) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `🧠 **Sugerencia T.I.L.O. Cortex**: Detectamos que **${pName || 'el paciente'}** tiene registrado antecedentes de **Diabetes** en su expediente clínico.\n\nEl medicamento más común en empaque verde/blanco para el control glucémico es la **Metformina (850 mg)**. ¿Es este el medicamento que toma?`,
                            options: [
                                { label: "✅ Sí, es Metformina", value: "Metformina" },
                                { label: "❌ No, es otro / Escribir", value: "MANUAL" }
                            ]
                        }]);
                        setStep('meds_confirm_diabetes_shortcut');
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "¿Recuerda alguna parte del nombre, la sustancia activa o para qué le recetaron este medicamento de la caja verde?",
                            options: [
                                { label: "✍️ Escribir lo que recuerdo", value: "MANUAL" },
                                { label: "💡 Ver lista completa de fármacos", value: "RETRY_VADEMECUM" }
                            ]
                        }]);
                        setStep('meds_caja_verde_no_diabetes');
                    }
                } else if (input === "NO_RECUERDO") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "No se preocupe, salvaguardaremos su salud integral. Por favor describa lo que recuerde (ej: color de pastilla, tamaño, o para qué síntoma lo toma):"
                    }]);
                    setStep('meds_manual_type');
                } else if (input === "MANUAL") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Por favor escriba el nombre o principio activo del medicamento:"
                    }]);
                    setStep('meds_manual_type');
                } else {
                    // Selección directa del Vademécum
                    setTempItem(prev => ({ ...prev, name: input, type: 'MED' }));
                    triggerClinicalIntegrations(input);
                    const contextualDose = await analyzeMedicationAsync(input);
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Entendido (${input}). ¿Cuál es la dosis exacta y con qué frecuencia la toma? (${contextualDose}).`
                    }]);
                    setStep('meds_dose');
                }
                break;
            }

            case 'meds_confirm_diabetes_shortcut': {
                if (input === "Metformina") {
                    setTempItem(prev => ({ ...prev, name: "Metformina (850 mg)", type: 'MED' }));
                    triggerClinicalIntegrations("Metformina");
                    const contextualDose = await analyzeMedicationAsync("Metformina");
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `Entendido (Metformina 850 mg). ¿Cuál es la dosis exacta y con qué frecuencia la toma? (${contextualDose}).`
                    }]);
                    setStep('meds_dose');
                } else {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Entendido. Por favor escriba el nombre o lo que recuerde del medicamento:"
                    }]);
                    setStep('meds_manual_type');
                }
                break;
            }

            case 'meds_caja_verde_no_diabetes': {
                if (input === "RETRY_VADEMECUM") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Seleccione el medicamento del Vademécum PLM:",
                        options: plmOptionsList
                    }]);
                    setStep('meds_select');
                } else {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Por favor describa el medicamento o lo que recuerde:"
                    }]);
                    setStep('meds_manual_type');
                }
                break;
            }

            case 'meds_manual_type': {
                const cleanName = toSentenceCase(input.trim());
                setTempItem(prev => ({ ...prev, name: cleanName, type: 'MED' }));
                triggerClinicalIntegrations(cleanName);
                const contextualDose = await analyzeMedicationAsync(cleanName);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Entendido (${cleanName}). ¿Cuál es la dosis exacta y con qué frecuencia la toma? (${contextualDose}).`
                }]);
                setStep('meds_dose');
                break;
            }

            case 'meds_dose': {
                const cleanDetails = toSentenceCase(input.trim());
                setTempItem(prev => ({ ...prev, details: cleanDetails }));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor
                        ? `¿Desde hace cuánto tiempo toma este medicamento? (Ej. 1 semana, 3 años).\n\nEsto es importante para calcular los riesgos nutricionales de ${pName}.`
                        : `¿Desde hace cuánto tiempo toma este medicamento? (Ej. 1 semana, 3 años).\n\nEsto es importante para calcular sus riesgos nutricionales.`
                }]);
                setStep('meds_time');
                break;
            }

            case 'meds_time': {
                const cleanDuration = toSentenceCase(input.trim());
                const newMedication = {
                    name: tempItem.name,
                    dose_frequency: tempItem.details,
                    duration: cleanDuration,
                    status: 'ACTIVE'
                };

                setPatientData(prev => ({
                    ...prev,
                    history: { ...(prev.history || {}), medications: [...(prev.history?.medications || []), newMedication] }
                }));

                setTempItem({ name: '', details: '', duration: '', type: '' });

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor ? `Registrado. ¿Toma ${pName} algún otro medicamento prescrito?` : "Registrado. ¿Toma usted algún otro medicamento prescrito?",
                    options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }]
                }]);
                setStep('meds_next');
                break;
            }

            case 'meds_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: isMinor 
                            ? "Alineando Vademécum PLM. Por favor, selecciona el medicamento de la lista interactiva o escribe su nombre:" 
                            : "Alineando Vademécum PLM. Por favor, seleccione el medicamento de la lista interactiva o escriba su nombre:",
                        options: plmOptionsList
                    }]);
                    setStep('meds_select');
                } else if (input === "No") {
                    transitionToSupps();
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No.",
                        options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }]
                    }]);
                }
                break;
            }

            // ================= SUPLEMENTOS =================
            case 'supp_start': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "¿Cuál es el nombre del producto o ingrediente principal?"
                    }]);
                    setStep('supp_name');
                } else if (input === "No") {
                    handleFinish();
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: isMinor ? "Por favor selecciona Sí o No." : "Por favor seleccione Sí o No.",
                        options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }]
                    }]);
                }
                break;
            }
            case 'supp_name': {
                const cleanName = toSentenceCase(input.trim());
                setTempItem(prev => ({ ...prev, name: cleanName, type: 'SUPP' }));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "¿Cuál es la dosis y frecuencia? (Ej. 1 scoop en la mañana)."
                }]);
                setStep('supp_details');
                break;
            }
            case 'supp_details': {
                const cleanDetails = toSentenceCase(input.trim());
                setTempItem(prev => ({ ...prev, details: cleanDetails }));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "¿Desde hace cuánto tiempo consume este producto? (Ej. Recién empecé, Llevo 6 meses)."
                }]);
                setStep('supp_duration');
                break;
            }
            case 'supp_duration': {
                const cleanDuration = toSentenceCase(input.trim());
                const newSupplement = {
                    name: tempItem.name,
                    frequency: tempItem.details,
                    duration: cleanDuration,
                    type: 'OTHER'
                };

                setPatientData(prev => ({
                    ...prev,
                    history: { ...(prev.history || {}), supplements: [...(prev.history?.supplements || []), newSupplement] }
                }));

                setTempItem({ name: '', details: '', duration: '', type: '' });

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isMinor 
                        ? `Registrado ✅.\n\n¿Consume ${pName} algún otro producto natural o vitamina?` 
                        : "Registrado ✅.\n\n¿Consume usted algún otro producto natural o vitamina?",
                    options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }]
                }]);
                setStep('supp_next');
                break;
            }
            case 'supp_next': {
                if (input === "Sí") {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "¿Cuál es el nombre del producto?"
                    }]);
                    setStep('supp_name');
                } else if (input === "No") {
                    handleFinish();
                } else {
                    setMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: isMinor ? "Responde SÍ o NO." : "Responda SÍ o NO.",
                        options: [{ label: "✅ Sí", value: "Sí" }, { label: "❌ No", value: "No" }]
                    }]);
                }
                break;
            }

            default:
                break;
        }
    };

    const transitionToSupps = () => {
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: isMinor 
                ? `Entendido. Pasemos a los productos de venta libre.\n\n¿Consume ${pName} vitaminas, proteínas, tés o suplementos 'naturistas'?`
                : "Entendido. Pasemos a los productos de venta libre.\n\n¿Consume usted vitaminas, proteínas, tés o suplementos 'naturistas'?",
            options: [
                { label: "✅ Sí", value: "Sí" },
                { label: "❌ No", value: "No" },
            ]
        }]);
        setStep('supp_start');
    };

    const handleFinish = () => {
        onPhaseComplete(null);
    };

    // Register Handler
    useEffect(() => {
        if (registerInputHandler) {
            registerInputHandler(() => (text, val) => handleSend(text, val));
        }
    }, [registerInputHandler, step]);

    useEffect(() => {
        if (setIsGlobalTyping) {
            setIsGlobalTyping(false);
        }
    }, [setIsGlobalTyping]);

    // Headless UI: Phase 6 runs fully interactively in background, leveraging App.jsx SearchableVerticalMenu options!
    return null;
};

export default Fase6_Farmacologia;
