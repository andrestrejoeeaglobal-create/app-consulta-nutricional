/* eslint-disable no-unused-vars */
import React from 'react';
import { AlertTriangle, XCircle, Heart, Utensils, ShoppingBag, Users, AlertCircle } from 'lucide-react';

export const TabNutrition = ({
    patientData,
    setPatientData,
    isEditing,
    onTriggerEdit,
    onEditToggle,
    renderEditableField,
    CardHeader,
    Accordion,
    openSections,
    toggleSection,
    currentStep
}) => {
    // --- DERIVACIÓN SEGURA DE PREFERENCIAS CON FALLBACK ---
    const filterNoneValues = (item) => {
        const clean = item.toLowerCase().trim();
        return clean !== 'ninguno' && clean !== 'ninguna' && clean !== 'no' && clean !== 'no tiene' && clean !== 'niega' && clean !== 'n/a';
    };

    // 1. Aversiones (Excluir)
    let excludedIngredients = [];
    if (patientData.nutrition?.preferences?.excluded_ingredients?.length > 0) {
        excludedIngredients = patientData.nutrition.preferences.excluded_ingredients;
    } else {
        const aversionesStr = patientData.evaluacionDietetica?.preferencias?.aversiones;
        if (aversionesStr) {
            excludedIngredients = aversionesStr.split(',')
                .map(item => item.trim())
                .filter(item => item && filterNoneValues(item));
        }
    }

    // 2. Favoritos (Incluir)
    let favoriteFoods = [];
    if (patientData.nutrition?.preferences?.favorite_foods?.length > 0) {
        favoriteFoods = patientData.nutrition.preferences.favorite_foods;
    } else {
        const favoritosStr = patientData.evaluacionDietetica?.preferencias?.favoritos;
        if (favoritosStr) {
            favoriteFoods = favoritosStr.split(',')
                .map(item => item.trim())
                .filter(item => item && filterNoneValues(item));
        }
    }

    // --- DERIVACIÓN SEGURA DE CRONONUTRICIÓN (R24H) ---
    let feedingWindow = '--';
    let fastingWindow = '--';
    let lateDinnerRisk = false;
    let firstBite = '--:--';
    let lastBite = null;
    let r24hEntries = [];

    const rawR24h = patientData.nutrition?.current_diet_r24h;
    
    if (rawR24h && Object.keys(rawR24h).length > 0) {
        feedingWindow = rawR24h.feeding_window_hours !== undefined ? `${rawR24h.feeding_window_hours}` : '--';
        fastingWindow = rawR24h.fasting_window_hours !== undefined ? `${rawR24h.fasting_window_hours}` : '--';
        lateDinnerRisk = !!rawR24h.late_dinner_risk;
        firstBite = rawR24h.first_bite_time || '--:--';
        lastBite = rawR24h.last_bite_time || null;
        r24hEntries = rawR24h.entries || [];
    } else {
        const dietList = patientData.evaluacionDietetica?.r24h || [];
        if (dietList.length > 0) {
            firstBite = dietList[0].hora || '--:--';
            if (dietList.length > 1) {
                lastBite = dietList[dietList.length - 1].hora || null;
            }
            
            r24hEntries = dietList.map(item => ({
                time: item.hora,
                content_raw: item.alimento,
                hunger_level: null
            }));

            // Calcular ventanas si tenemos al menos dos bocados
            const parseTimeToMinutes = (timeStr) => {
                if (!timeStr) return null;
                let clean = timeStr.toLowerCase().replace(/\s+/g, '').trim();
                
                let isPm = clean.includes('pm') || clean.includes('tarde') || clean.includes('noche') || clean.includes('horas') && parseInt(clean, 10) >= 12;
                let isAm = clean.includes('am') || clean.includes('mañana');
                
                let timePart = clean.replace(/[^0-9:]/g, '');
                if (!timePart) return null;
                
                let hours = 0;
                let minutes = 0;
                
                if (timePart.includes(':')) {
                    let parts = timePart.split(':');
                    hours = parseInt(parts[0], 10) || 0;
                    minutes = parseInt(parts[1], 10) || 0;
                } else {
                    hours = parseInt(timePart, 10) || 0;
                }
                
                if (isPm && hours < 12) {
                    hours += 12;
                }
                if (isAm && hours === 12) {
                    hours = 0;
                }
                return hours * 60 + minutes;
            };

            const firstMin = parseTimeToMinutes(firstBite);
            const lastMin = parseTimeToMinutes(lastBite);

            if (firstMin !== null && lastMin !== null) {
                let feedingMin = 0;
                if (lastMin >= firstMin) {
                    feedingMin = lastMin - firstMin;
                } else {
                    feedingMin = (1440 - firstMin) + lastMin;
                }
                const feedingHoursVal = feedingMin / 60;
                feedingWindow = feedingHoursVal % 1 === 0 ? feedingHoursVal.toFixed(0) : feedingHoursVal.toFixed(1);
                
                const fastingHoursVal = 24 - feedingHoursVal;
                fastingWindow = fastingHoursVal % 1 === 0 ? fastingHoursVal.toFixed(0) : fastingHoursVal.toFixed(1);
                
                // Riesgo cena tardía si es después de las 8:30 PM (1230 min)
                lateDinnerRisk = lastMin >= 1230;
            }
        }
    }

    // --- DERIVACIÓN SEGURA DE LOGÍSTICA SOCIAL ---
    const socialMap = {
        ALONE: 'Solo',
        FAMILY: 'Familia / Pareja',
        CAREGIVER: 'Cuidador / Personal',
        FRIENDS: 'Amigos / Compañeros'
    };
    const socialCompanyRaw = patientData.logistics_profile?.social_company || 
                             patientData.clinical_context?.logistics?.social_company;
    const socialCompany = socialCompanyRaw ? (socialMap[socialCompanyRaw.toUpperCase()] || socialCompanyRaw) : 'Sin registrar';
    
    const isGeriatric = (patientData.profile?.age >= 60 || patientData.identificacion?.edad >= 60);
    const hasIsolationRisk = socialCompanyRaw?.toUpperCase() === 'ALONE' && isGeriatric;

    const dynamicsMap = {
        SHARED_MENU: 'Comparten mismo menú',
        SEPARATE_FOOD: 'Cada quien su comida'
    };
    const demoMap = {
        KIDS: 'Incluye niños',
        ELDERLY: 'Incluye adultos mayores',
        BOTH: 'Niños y adultos mayores',
        NONE: 'Solo adultos contemporáneos'
    };

    const sharingDynamicsRaw = patientData.logistics_profile?.sharing_dynamics;
    const sharingDynamics = sharingDynamicsRaw ? (dynamicsMap[sharingDynamicsRaw] || sharingDynamicsRaw) : null;
    const dinersCount = patientData.logistics_profile?.sharing_diners_count;
    const demographicsRaw = patientData.logistics_profile?.sharing_demographics;
    const demographics = demographicsRaw ? (demoMap[demographicsRaw] || demographicsRaw) : null;

    // Alerta de carga en cocina: Cocina él mismo (SELF) AND comparte menú con 3 o más personas (dinersCount >= 3)
    const cookTypeRaw = patientData.logistics_profile?.cook_type;
    const hasWorkloadRisk = cookTypeRaw === 'SELF' && sharingDynamicsRaw === 'SHARED_MENU' && dinersCount >= 3;

    return (
        <div className="space-y-6">
            <Accordion
                title="Nutrición y Patrones"
                id="accordion-nutrition"
                isOpen={openSections.parentNutrition}
                onToggle={() => toggleSection('parentNutrition')}
                variant="parent"
            >
                <div className="space-y-6">
                    {/* SUB-ACORDEÓN 1: LOGÍSTICA ALIMENTARIA */}
                    <Accordion
                        title="Logística Alimentaria"
                        id="accordion-logistics"
                        isOpen={openSections.childLogistics}
                        onToggle={() => toggleSection('childLogistics')}
                    >
                        <div id="card-logistics" className="space-y-4">
                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <ShoppingBag className="w-5 h-5 text-tilo-text-muted" />
                                        <div>
                                            <div className="text-sm font-bold text-tilo-text-main font-prototype">Entorno y Cocina</div>
                                            <div className="text-xs text-tilo-text-muted font-medium font-sansation">
                                                {patientData.logistics_profile?.cook_type === 'SELF' ? 'Cocina Propia' :
                                                    patientData.logistics_profile?.cook_type === 'FAMILY' ? 'Familiar Cocina' :
                                                        patientData.logistics_profile?.cook_type === 'STAFF' ? 'Personal Cocina' :
                                                            patientData.logistics_profile?.cook_type === 'BUYING' ? 'Compra Comida' : '--'}
                                                {' • '}
                                                {patientData.logistics_profile?.environment?.venue === 'HOME' ? 'Come en Casa' :
                                                    patientData.logistics_profile?.environment?.venue === 'WORK' ? 'Come en Trabajo' :
                                                        patientData.logistics_profile?.environment?.venue === 'STREET' ? 'Come en Calle' : ''}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Constraints Badges */}
                                    <div className="flex flex-col gap-1 items-end">
                                        {!patientData.logistics_profile ? (
                                            <span className="bg-tilo-text-muted/10 text-tilo-text-muted text-[10px] px-2 py-0.5 rounded font-bold border border-tilo-text-muted/20 font-prototype">SIN EVALUAR</span>
                                        ) : (
                                            <>
                                                {patientData.logistics_profile?.recipe_filters?.requires_reheating === false && (
                                                    <span className="bg-tilo-text-muted/10 text-tilo-text-muted text-[9px] px-1.5 py-0.5 rounded border border-tilo-border font-bold">NO MICROONDAS</span>
                                                )}
                                                {patientData.logistics_profile?.recipe_filters?.requires_rehydration === false && (
                                                    <span className="bg-tilo-danger/10 text-tilo-danger text-[9px] px-1.5 py-0.5 rounded border border-tilo-danger/20 font-bold">NO REFRIGERACIÓN</span>
                                                )}
                                                {patientData.logistics_profile?.cooking_time === 'LOW' && (
                                                    <span className="bg-tilo-primary/10 text-tilo-primary text-[9px] px-1.5 py-0.5 rounded border border-tilo-primary/20 font-bold">TIEMPO LIMITADO</span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* 4. COMPAÑÍA EN MESA */}
                                <div className="pt-3 border-t border-tilo-border">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-5 h-5 text-tilo-text-muted" />
                                            <div>
                                                <div className="text-sm font-bold text-tilo-text-main font-prototype">Dinámica Familiar y Social</div>
                                                <div className="text-xs text-tilo-text-muted font-medium font-sansation">
                                                    Acompañamiento: <span className="text-tilo-text-main font-semibold">{socialCompany}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 items-end">
                                            {hasIsolationRisk && (
                                                <span className="bg-tilo-danger/10 text-tilo-danger border border-tilo-danger/20 text-[10px] px-2.5 py-0.5 rounded font-bold animate-pulse font-prototype">
                                                    RIESGO AISLAMIENTO
                                                </span>
                                            )}
                                            {hasWorkloadRisk && (
                                                <span className="bg-tilo-danger/10 text-tilo-danger border border-tilo-danger/20 text-[10px] px-2.5 py-0.5 rounded font-bold animate-pulse font-prototype">
                                                    CARGA COCINA ELEVADA
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {socialCompanyRaw && socialCompanyRaw !== 'ALONE' && (
                                        <div className="pl-7 mt-1 space-y-1 text-xs text-tilo-text-muted font-medium font-sansation">
                                            {sharingDynamics && (
                                                <div>
                                                    Dinámica: <span className="text-tilo-text-main">{sharingDynamics}</span>
                                                </div>
                                            )}
                                            {sharingDynamicsRaw === 'SHARED_MENU' && (
                                                <>
                                                    {dinersCount && (
                                                        <div>
                                                            Porciones/Comensales: <span className="text-tilo-text-main">{dinersCount} personas</span>
                                                        </div>
                                                    )}
                                                    {demographics && (
                                                        <div>
                                                            Demografía: <span className="text-tilo-text-main">{demographics}</span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Accordion>

                    {/* SUB-ACORDEÓN 2: PREFERENCIAS Y SEGURIDAD */}
                    <Accordion
                        title="Preferencias y Seguridad"
                        id="accordion-preferences"
                        isOpen={openSections.childPreferences}
                        onToggle={() => toggleSection('childPreferences')}
                    >
                        <div id="card-preferences" className="space-y-4">
                            <div className="space-y-4">
                                {/* 1. DIET STYLE & OVERRIDE STATUS */}
                                <div className="flex justify-between items-start border-b border-tilo-border pb-3">
                                    <div className="flex items-center gap-2">
                                        <Utensils className="w-5 h-5 text-tilo-text-muted" />
                                        <div>
                                            <div className="text-sm font-bold text-tilo-text-main font-prototype">Estrategia Nutricional</div>
                                            <div className="text-xs text-tilo-text-muted font-sansation">
                                                Solicitado: <span className="italic">{patientData.nutrition?.preferences?.user_selected_diet || '--'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                            !patientData.nutrition?.preferences?.assigned_diet
                                                ? 'bg-tilo-text-muted/10 text-tilo-text-muted border-tilo-text-muted/20'
                                                : patientData.nutrition?.preferences?.safety_lock?.override_applied 
                                                    ? 'bg-tilo-warning/10 text-tilo-warning border-tilo-warning/20' 
                                                    : 'bg-tilo-primary/10 text-tilo-primary border-tilo-primary/20'
                                            }`}>
                                            {patientData.nutrition?.preferences?.assigned_diet || 'PENDIENTE'}
                                        </span>
                                        {patientData.nutrition?.preferences?.safety_lock?.override_applied && (
                                            <div className="text-[9px] text-tilo-warning font-semibold mt-1 flex items-center justify-end gap-1 font-prototype uppercase">
                                                <AlertTriangle size={10} />
                                                Autorización Clínica
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 2. HEDONICS (LIKES & DISLIKES) */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Dislikes */}
                                    <div className="bg-tilo-danger/5 p-3 rounded-2xl border border-tilo-danger/10">
                                        <div className="text-[10px] font-bold text-tilo-danger uppercase tracking-wider mb-2 flex items-center gap-1 font-prototype">
                                            <XCircle size={10} /> Aversiones (Excluir)
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {excludedIngredients.length > 0 ? (
                                                excludedIngredients.map((item, i) => (
                                                    <span key={i} className="text-[10px] bg-tilo-bg-panel px-1.5 rounded text-tilo-danger border border-tilo-danger/20 shadow-sm font-semibold">{item}</span>
                                                ))
                                            ) : <span className="text-[10px] text-tilo-text-muted/60 italic font-sansation">Ninguna</span>}
                                        </div>
                                    </div>
                                    {/* Likes */}
                                    <div className="bg-tilo-success/5 p-3 rounded-2xl border border-tilo-success/15">
                                        <div className="text-[10px] font-bold text-tilo-success uppercase tracking-wider mb-2 flex items-center gap-1 font-prototype">
                                            <Heart size={10} /> Favoritos (Incluir)
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {favoriteFoods.length > 0 ? (
                                                favoriteFoods.map((item, i) => (
                                                    <span key={i} className="text-[10px] bg-tilo-bg-panel px-1.5 rounded text-tilo-success border border-tilo-success/25 shadow-sm font-semibold">{item}</span>
                                                ))
                                            ) : <span className="text-[10px] text-tilo-text-muted/60 italic font-sansation">Sin datos</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Accordion>

                    {/* SUB-ACORDEÓN 3: CRONONUTRICIÓN (R24H) */}
                    <Accordion
                        title="Crononutrición (R24H)"
                        id="accordion-chrononutrition"
                        isOpen={openSections.childChrononutrition}
                        onToggle={() => toggleSection('childChrononutrition')}
                    >
                        <div id="card-chrononutrition" className="space-y-4">
                            {/* METRICS ROW */}
                            <div className="flex justify-between items-center mb-6 bg-tilo-bg-base/30 p-4 rounded-2xl border border-tilo-border">
                                <div className="text-center">
                                    <div className="text-[10px] uppercase text-tilo-text-muted font-bold tracking-wider font-prototype">Ventana Comida</div>
                                    <div className="text-xl font-bold text-tilo-text-main font-prototype">
                                        {feedingWindow}{feedingWindow !== '--' ? 'h' : ''}
                                    </div>
                                </div>
                                <div className="h-8 w-px bg-tilo-border"></div>
                                <div className="text-center">
                                    <div className="text-[10px] uppercase text-tilo-text-muted font-bold tracking-wider font-prototype">Ayuno Nocturno</div>
                                    <div className="text-xl font-bold text-tilo-text-main font-prototype">
                                        {fastingWindow}{fastingWindow !== '--' ? 'h' : ''}
                                    </div>
                                </div>
                                <div className="h-8 w-px bg-tilo-border"></div>
                                <div className="text-center">
                                    <div className="text-[10px] uppercase text-tilo-text-muted font-bold tracking-wider font-prototype mb-0.5">Cena Tardía</div>
                                    {lateDinnerRisk ? (
                                        <span className="text-[10px] bg-tilo-danger/10 text-tilo-danger px-2 py-0.5 rounded font-bold border border-tilo-danger/20 font-prototype">RIESGO</span>
                                    ) : (
                                        <span className="text-[10px] bg-tilo-success/15 text-tilo-success px-2 py-0.5 rounded font-bold border border-tilo-success/20 font-prototype">OK</span>
                                    )}
                                </div>
                            </div>

                            {/* TIMELINE VISUALIZATION */}
                            <div className="relative pl-4 space-y-4 before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-tilo-border/60">
                                {/* FIRST BITE */}
                                <div className="relative">
                                    <div className="absolute -left-[19px] bg-tilo-success w-2.5 h-2.5 rounded-full border-2 border-tilo-bg-panel ring-1 ring-tilo-success/25 mt-1.5"></div>
                                    <div className="text-xs font-bold text-tilo-success font-sansation font-semibold">
                                        {firstBite} <span className="text-tilo-text-muted font-normal font-sansation">- Primer Bocado</span>
                                    </div>
                                </div>

                                {/* ENTRIES LOOP */}
                                {r24hEntries?.map((entry, idx) => (
                                    <div key={idx} className="relative animate-fade-in">
                                        <div className="absolute -left-[19px] bg-tilo-text-muted/40 w-2 h-2 rounded-full border-2 border-tilo-bg-panel mt-1.5"></div>
                                        <div className="bg-tilo-bg-base/30 p-2.5 rounded-xl border border-tilo-border text-xs">
                                            <div className="flex justify-between mb-1.5 items-center">
                                                <span className="font-bold text-tilo-text-main font-prototype">{entry.time}</span>
                                                {entry.hunger_level !== null && entry.hunger_level !== undefined && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-prototype uppercase ${
                                                        entry.hunger_level >= 8 
                                                            ? 'bg-tilo-success/15 text-tilo-success border-tilo-success/20' 
                                                            : entry.hunger_level <= 3 
                                                                ? 'bg-tilo-danger/15 text-tilo-danger border-tilo-danger/25' 
                                                                : 'bg-tilo-warning/15 text-tilo-warning border-tilo-warning/20'
                                                    }`}>
                                                        Hambre: {entry.hunger_level}/10
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-tilo-text-main leading-snug font-sansation font-medium">{entry.content_raw}</div>
                                        </div>
                                    </div>
                                ))}

                                {/* LAST BITE */}
                                {lastBite && (
                                    <div className="relative">
                                        <div className="absolute -left-[19px] bg-tilo-primary w-2.5 h-2.5 rounded-full border-2 border-tilo-bg-panel ring-1 ring-tilo-primary/25 mt-1.5"></div>
                                        <div className="text-xs font-bold text-tilo-primary font-sansation font-semibold">
                                            {lastBite} <span className="text-tilo-text-muted font-normal font-sansation">- Último Bocado</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Accordion>

                    {/* SUB-ACORDEÓN 4: FRECUENCIA DE CONSUMO (FFQ) */}
                    <Accordion
                        title="Frecuencia de Consumo (FFQ)"
                        id="accordion-ffq"
                        isOpen={openSections.childFfq}
                        onToggle={() => toggleSection('childFfq')}
                    >
                        <div id="card-ffq" className="space-y-4">
                            {!patientData.evaluacionDietetica?.ffq || Object.keys(patientData.evaluacionDietetica.ffq).length === 0 ? (
                                <div className="text-xs text-tilo-text-muted/60 italic text-center py-4 font-sansation">
                                    Pendiente de evaluación
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 text-xs font-sansation">
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">🥛 Lácteos</span>
                                        <span className="bg-tilo-primary/10 text-tilo-primary px-2 py-0.5 rounded font-bold font-prototype">{patientData.evaluacionDietetica.ffq.leche || 0} d/sem</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">🥩 C. Rojas (Magra/Grasa)</span>
                                        <span className="bg-tilo-primary/10 text-tilo-primary px-2 py-0.5 rounded font-bold font-prototype">
                                            {patientData.evaluacionDietetica.ffq.carne_magra || 0}/{patientData.evaluacionDietetica.ffq.carne_grasa || 0} d
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">🥓 C. Procesadas</span>
                                        <span className={`px-2 py-0.5 rounded font-bold font-prototype ${
                                            (patientData.evaluacionDietetica.ffq.carne_procesada || 0) >= 3 
                                                ? 'bg-tilo-danger/10 text-tilo-danger' 
                                                : 'bg-tilo-success/10 text-tilo-success'
                                        }`}>{patientData.evaluacionDietetica.ffq.carne_procesada || 0} d/sem</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">🍗 C. Blancas</span>
                                        <span className="bg-tilo-primary/10 text-tilo-primary px-2 py-0.5 rounded font-bold font-prototype">{patientData.evaluacionDietetica.ffq.pollo || 0} d/sem</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">🌾 Cereales</span>
                                        <span className="bg-tilo-primary/10 text-tilo-primary px-2 py-0.5 rounded font-bold font-prototype">{patientData.evaluacionDietetica.ffq.cereales || 0} d/sem</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">🫘 Leguminosas</span>
                                        <span className="bg-tilo-primary/10 text-tilo-primary px-2 py-0.5 rounded font-bold font-prototype">{patientData.evaluacionDietetica.ffq.leguminosas || 0} d/sem</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">🥦 Verduras</span>
                                        <span className={`px-2 py-0.5 rounded font-bold font-prototype ${
                                            (patientData.evaluacionDietetica.ffq.verduras || 0) >= 5 
                                                ? 'bg-tilo-success/10 text-tilo-success' 
                                                : 'bg-tilo-warning/10 text-tilo-warning'
                                        }`}>{patientData.evaluacionDietetica.ffq.verduras || 0} d/sem</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">🍎 Frutas</span>
                                        <span className={`px-2 py-0.5 rounded font-bold font-prototype ${
                                            (patientData.evaluacionDietetica.ffq.frutas || 0) >= 5 
                                                ? 'bg-tilo-success/10 text-tilo-success' 
                                                : 'bg-tilo-warning/10 text-tilo-warning'
                                        }`}>{patientData.evaluacionDietetica.ffq.frutas || 0} d/sem</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">🥑 Grasas Saludables</span>
                                        <span className="bg-tilo-primary/10 text-tilo-primary px-2 py-0.5 rounded font-bold font-prototype">{patientData.evaluacionDietetica.ffq.grasas || 0} d/sem</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">🍬 Azúcares</span>
                                        <span className={`px-2 py-0.5 rounded font-bold font-prototype ${
                                            (patientData.evaluacionDietetica.ffq.azucares || 0) >= 3 
                                                ? 'bg-tilo-danger/10 text-tilo-danger' 
                                                : 'bg-tilo-success/10 text-tilo-success'
                                        }`}>{patientData.evaluacionDietetica.ffq.azucares || 0} d/sem</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">🍕 Comida Rápida</span>
                                        <span className={`px-2 py-0.5 rounded font-bold font-prototype ${
                                            (patientData.evaluacionDietetica.ffq.chatarra || 0) >= 3 
                                                ? 'bg-tilo-danger/10 text-tilo-danger' 
                                                : 'bg-tilo-success/10 text-tilo-success'
                                        }`}>{patientData.evaluacionDietetica.ffq.chatarra || 0} d/sem</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-tilo-bg-base/20 p-2.5 rounded-xl border border-tilo-border">
                                        <span className="font-semibold text-tilo-text-main font-prototype">💧 Agua Natural</span>
                                        <span className={`px-2 py-0.5 rounded font-bold font-prototype ${
                                            (patientData.evaluacionDietetica.ffq.agua || 0) >= 8 
                                                ? 'bg-tilo-success/10 text-tilo-success' 
                                                : (patientData.evaluacionDietetica.ffq.agua || 0) <= 4 
                                                    ? 'bg-tilo-danger/10 text-tilo-danger' 
                                                    : 'bg-tilo-warning/10 text-tilo-warning'
                                        }`}>{patientData.evaluacionDietetica.ffq.agua || 0} vasos/d</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Accordion>
                </div>
            </Accordion>
        </div>
    );
};

export default TabNutrition;
