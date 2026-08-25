// client/src/utils/BiomarkerScoringEngine.js

class BiomarkerScoringEngine {
    static calculate(patientData) {
        if (!patientData) return null;

        // Extraer estilo de vida consolidado
        const lp = patientData.lifestyle_profile || patientData.lifeStyleInfo || {};
        const cc = patientData.clinical_context || {};

        const activity = lp.activity || cc.activity?.exercise || {};

        // 1. CÁLCULO DE ACTIVIDAD FÍSICA (EJERCICIO)
        let exerciseScore = null;
        let exerciseLabel = "Sin evaluar";

        if (activity.has_scheduled_exercise !== null && activity.has_scheduled_exercise !== undefined) {
            const hasEx = activity.has_scheduled_exercise === true || 
                          activity.has_scheduled_exercise === "Sí" || 
                          activity.has_scheduled_exercise === "si" ||
                          activity.has_scheduled_exercise === "si_telemetria" ||
                          activity.has_scheduled_exercise === "si_manual";

            if (!hasEx) {
                exerciseScore = 30; // Sedentario total
                exerciseLabel = "Deficiente";
            } else {
                let totalWeeklyMin = 0;
                let totalCalories = 0;
                const isTelemetry = activity.source_type === "TELEMETRY_TCX" || 
                                    (activity.log && activity.log.some(x => typeof x === 'object'));

                if (activity.log && activity.log.length > 0) {
                    activity.log.forEach(item => {
                        if (typeof item === 'object' && item !== null) {
                            totalWeeklyMin += (item.duration || item.durationMinutes || item.weekly_minutes || 0);
                            totalCalories += (item.calories_device || item.calories || 0);
                        } else if (typeof item === 'string') {
                            const daysMatch = item.match(/(\d+)\s*(?:días|dias|d\/sem|días\/sem)/i);
                            const minsMatch = item.match(/(\d+)\s*min/i);
                            if (daysMatch && minsMatch) {
                                const days = parseInt(daysMatch[1], 10);
                                const mins = parseInt(minsMatch[1], 10);
                                totalWeeklyMin += (days * mins);
                            } else if (minsMatch) {
                                totalWeeklyMin += parseInt(minsMatch[1], 10);
                            }
                        }
                    });
                }

                if (totalWeeklyMin === 0) {
                    if (activity.weekly_minutes) {
                        totalWeeklyMin = parseInt(activity.weekly_minutes, 10);
                    } else if (activity.duration_history) {
                        const minsMatch = String(activity.duration_history).match(/(\d+)\s*min/i);
                        if (minsMatch) totalWeeklyMin = parseInt(minsMatch[1], 10);
                    }
                }

                if (isTelemetry && totalCalories > 0) {
                    const minScore = (totalWeeklyMin / 150) * 80;
                    const calScore = (totalCalories / 1000) * 20;
                    exerciseScore = Math.min(100, Math.round(minScore + calScore));
                } else {
                    exerciseScore = Math.min(100, Math.round((totalWeeklyMin / 150) * 100));
                }

                if (exerciseScore < 30) exerciseScore = 30;

                if (exerciseScore >= 90) exerciseLabel = "Óptimo";
                else if (exerciseScore >= 70) exerciseLabel = "Bueno";
                else if (exerciseScore >= 50) exerciseLabel = "Regular";
                else exerciseLabel = "Deficiente";
            }
        }

        // 2. CÁLCULO DE ACTIVIDAD DIARIA (NEAT)
        let neatScore = null;
        let neatLabel = "Sin evaluar";
        const neatLevelRaw = activity.neat_level;

        if (neatLevelRaw) {
            const neatScores = {
                HEAVY: { score: 100, label: "Óptimo" },
                MODERATE: { score: 85, label: "Bueno" },
                LIGHT: { score: 60, label: "Regular" },
                SEDENTARY: { score: 35, label: "Deficiente" }
            };
            const mapped = neatScores[neatLevelRaw.toUpperCase()] || { score: 50, label: "Regular" };
            neatScore = mapped.score;
            neatLabel = mapped.label;
        }

        // 3. CÁLCULO DE SUEÑO Y DESCANSO
        let sleepScore = null;
        let sleepLabel = "Sin evaluar";
        
        const sleepHours = lp.sleep?.hours_avg || cc.habits?.sleep?.hours || 0;
        const sleepQualityRaw = lp.sleep?.quality || cc.habits?.sleep?.quality || "";
        const sleepQuality = (sleepQualityRaw.toUpperCase() === 'GOOD' || sleepQualityRaw.toLowerCase() === 'buena') ? 'GOOD' :
                             (sleepQualityRaw.toUpperCase() === 'POOR' || sleepQualityRaw.toLowerCase() === 'mala') ? 'POOR' :
                             (sleepQualityRaw.toUpperCase() === 'REGULAR' || sleepQualityRaw.toLowerCase() === 'regular') ? 'REGULAR' : null;
        const sleepIssue = lp.sleep?.issue_type || cc.habits?.sleep?.issue_type || "";

        if (sleepHours > 0) {
            let base = 40;
            if (sleepHours >= 7 && sleepHours <= 9) base = 85;
            else if (sleepHours === 6) base = 70;
            else if (sleepHours === 5) base = 55;
            else if (sleepHours > 9) base = 75;

            let mod = 0;
            if (sleepQuality === 'GOOD') mod = 15;
            else if (sleepQuality === 'POOR') mod = -15;

            const issuePenalty = (sleepIssue && sleepIssue !== 'NONE') ? -10 : 0;

            sleepScore = Math.max(0, Math.min(100, base + mod + issuePenalty));

            if (sleepScore >= 85) sleepLabel = "Óptimo";
            else if (sleepScore >= 70) sleepLabel = "Bueno";
            else if (sleepScore >= 50) sleepLabel = "Regular";
            else sleepLabel = "Deficiente";
        }

        // 4. CÁLCULO DE ESTRÉS
        let stressScore = null;
        let stressLabel = "Sin evaluar";
        
        const stressLevelRaw = lp.stress?.level || cc.habits?.stress || "";
        const stressLevel = (stressLevelRaw.toUpperCase() === 'LOW' || stressLevelRaw.toLowerCase() === 'bajo') ? 'BAJO' :
                            (stressLevelRaw.toUpperCase() === 'HIGH' || stressLevelRaw.toLowerCase() === 'alto') ? 'ALTO' :
                            (stressLevelRaw.toUpperCase() === 'MODERATE' || stressLevelRaw.toLowerCase() === 'moderado') ? 'MODERADO' : null;
        const cortisolManagement = lp.stress?.cortisol_management_needed || (stressLevelRaw.toUpperCase() === 'HIGH' || stressLevelRaw.toLowerCase() === 'alto');

        if (stressLevel) {
            let base = 70;
            if (stressLevel === 'BAJO') base = 95;
            else if (stressLevel === 'ALTO') base = 40;

            const managementPenalty = cortisolManagement ? -10 : 0;

            stressScore = Math.max(0, Math.min(100, base + managementPenalty));

            if (stressScore >= 85) stressLabel = "Óptimo";
            else if (stressScore >= 70) stressLabel = "Bueno";
            else if (stressScore >= 50) stressLabel = "Regular";
            else stressLabel = "Deficiente";
        }

        return {
            activity: { score: exerciseScore, label: exerciseLabel },
            neat: { score: neatScore, label: neatLabel },
            sleep: { score: sleepScore, label: sleepLabel },
            stress: { score: stressScore, label: stressLabel }
        };
    }
}

export default BiomarkerScoringEngine;
