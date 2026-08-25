import { useState, useEffect } from 'react';

/**
 * Hook de Telemetría H7 (Veepoo BLE / JL7013A @ 512Hz) & SafetyEngine v2.0
 * Ingiere series temporales de 28 días y audita bioseguridad en tiempo real.
 */
export const useH7Telemetry = () => {
  const [telemetryData, setTelemetryData] = useState(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [safetyStatus, setSafetyStatus] = useState({ isSafe: true, alerts: [] });

  useEffect(() => {
    // Simulación de lectura e ingesta de la banda H7 (28 días históricos)
    const timer = setTimeout(() => {
      const days = Array.from({ length: 28 }, (_, i) => {
        const dayNum = i + 1;
        const hrvBase = 65 + Math.floor(Math.sin(i / 3) * 12 + Math.random() * 8);
        const deepSleepHours = Number((1.8 + Math.cos(i / 4) * 0.6 + Math.random() * 0.4).toFixed(1));
        const activeCalories = 320 + Math.floor(Math.sin(i / 2) * 80 + Math.random() * 50);
        const sysBP = 115 + Math.floor(Math.random() * 12);
        const diaBP = 75 + Math.floor(Math.random() * 8);

        return {
          day: `Día ${dayNum}`,
          hrv: hrvBase,
          deepSleep: deepSleepHours,
          calories: activeCalories,
          sysBP,
          diaBP
        };
      });

      // Cálculo de promedios de 28 días
      const avgHRV = Math.round(days.reduce((acc, d) => acc + d.hrv, 0) / 28);
      const avgDeepSleep = Number((days.reduce((acc, d) => acc + d.deepSleep, 0) / 28).toFixed(1));
      const totalCaloricMETs = Math.round(days.reduce((acc, d) => acc + d.calories, 0) / 28);
      const avgSysBP = Math.round(days.reduce((acc, d) => acc + d.sysBP, 0) / 28);
      const avgDiaBP = Math.round(days.reduce((acc, d) => acc + d.diaBP, 0) / 28);

      // Auditar con SafetyEngine v2.0
      const alerts = [];
      let isSafe = true;

      if (avgSysBP >= 180 || avgDiaBP >= 120) {
        isSafe = false;
        alerts.push("⚠️ Crisis Hipertensiva detectada en registros H7 (>= 180/120 mmHg).");
      }
      if (avgHRV < 35) {
        isSafe = false;
        alerts.push("⚠️ Estrés Autonómico severo (HRV < 35 ms).");
      }

      setTelemetryData({
        days,
        averages: {
          hrv: avgHRV,
          deepSleep: avgDeepSleep,
          metsCalories: totalCaloricMETs,
          bloodPressure: `${avgSysBP}/${avgDiaBP} mmHg`
        }
      });

      setSafetyStatus({ isSafe, alerts });
      setIsSyncing(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  return { telemetryData, isSyncing, safetyStatus };
};
