import { create } from 'zustand';

// Genoma Clínico (Estado Asíncrono de la Terminal A)
export const useClinicalGenome = create((set, get) => ({
    // 1. BLOQUE I: ANCLAJE LEGAL (Safety Locks)
    identityLock: {
        verified: false,
        privacySigned: false,
        serverName: null, // Guarded name from Appointments API
        patientInfo: { age: null, sex: null, curp: null, name: null, apellidoPaterno: null, apellidoMaterno: null },
        emergencyContact: { name: "", relation: "", phone: "" },
    },

    // 1.5. BLOQUE I: PERFIL SOCIOCULTURAL (Fase 1)
    socioculturalProfile: {
        civilStatus: null,
        religion: null,
        occupation: null,
        educationLevel: null,
        lifeStage: null // Lactante, Escolar, Adolescente, Adulto, Geriátrico
    },

    // 2. BLOQUE II & V: CERO RIESGO (Hardware & Biometry Blocks)
    vitalSigns: {
        bloodPressure: { systolic: null, diastolic: null },
        heartRate: null,
        respiratoryRate: null,
        temperature: null,
        spo2: null,
        glucose: null,
        glucoseContext: null,
    },
    allergies: {
        food: [],
        medication: [],
        verified: false // Must be true to pass Phase 7
    },

    // 3. EJES ASÍNCRONOS (El Cerebro Multinúcleo)
    metabolicAxis: {
        glucoseRisk: false,
        insulinResistance: false,
    },
    hormonalAxis: {
        cyclePhase: null, // Female only
        stressLevel: 0,
    },
    psychiatricAxis: {
        sleepQuality: 0,
        anxietyMarkers: false,
    },
    biomechanicalAxis: {
        activityLevel: 'sedentary', // NEAT
        exerciseRoutine: false,
    },

    // 4. INTERFAZ DE AUTORIDAD (Human in the Loop)
    pendingAlerts: [], // Sugerencias de la IA (ej. "Déficit B12 por Metformina")
    medicalOverrides: [], // Decisiones del Sherpa (Aprobar/Descartar)

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
        // Evitar duplicados del mismo tipo
        if (state.pendingAlerts.some(a => a.type === alert.type)) return state;
        return {
            pendingAlerts: [...state.pendingAlerts, { id: Date.now(), ...alert }]
        };
    }),

    // Aprobar/Descartar Alerta (El Sherpa llama esto)
    resolveAlert: (alertId, resolution) => set((state) => ({
        pendingAlerts: state.pendingAlerts.filter(a => a.id !== alertId),
        medicalOverrides: [...state.medicalOverrides, { alertId, resolution, timestamp: new Date() }]
    })),

    // Remover alerta por su tipo
    removeAlertByType: (type) => set((state) => ({
        pendingAlerts: state.pendingAlerts.filter(a => a.type !== type)
    })),

    // Resetear completamente el Genoma Clínico
    resetGenome: () => set({
        identityLock: {
            verified: false,
            privacySigned: false,
            serverName: null,
            patientInfo: { age: null, sex: null, curp: null, name: null, apellidoPaterno: null, apellidoMaterno: null },
            emergencyContact: { name: "", relation: "", phone: "" },
        },
        socioculturalProfile: {
            civilStatus: null,
            religion: null,
            occupation: null,
            educationLevel: null,
            lifeStage: null
        },
        vitalSigns: {
            bloodPressure: { systolic: null, diastolic: null },
            heartRate: null,
            respiratoryRate: null,
            temperature: null,
            spo2: null,
            glucose: null,
            glucoseContext: null,
        },
        allergies: {
            food: [],
            medication: [],
            verified: false
        },
        metabolicAxis: {
            glucoseRisk: false,
            insulinResistance: false,
        },
        hormonalAxis: {
            cyclePhase: null,
            stressLevel: 0,
        },
        psychiatricAxis: {
            sleepQuality: 0,
            anxietyMarkers: false,
        },
        biomechanicalAxis: {
            activityLevel: 'sedentary',
            exerciseRoutine: false,
        },
        pendingAlerts: [],
        medicalOverrides: []
    }),

    // Evaluador de Integridad Legal (El Daemon consulta esto)
    isLegallyCompliant: () => {
        const { identityLock, allergies } = get();
        return identityLock.privacySigned &&
            identityLock.emergencyContact.phone !== "" &&
            allergies.verified;
    }
}));
