const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Driver Nativo USB (VID_5608 PID_0808) — Solo verificación física de contacto/hardware (Fail-Closed).
 * Cumplimiento estricto Regla 8 NOM-004: Cero valores simulados ante timeout o desconexión.
 * @param {number} durationSeconds
 * @returns {Promise<object>}
 */
function samplePhysicalSensor(durationSeconds = 3.0) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (payload) => {
            if (settled) return;
            settled = true;
            resolve(payload);
        };

        const pythonScript = path.join(__dirname, 'directHardwareDriver.py');
        const venvPython = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
        const pythonExe = fs.existsSync(venvPython) ? venvPython : 'python';

        let child = null;
        try {
            child = spawn(pythonExe, [pythonScript, String(durationSeconds)], {
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
        } catch (spawnErr) {
            return finish({
                success: false,
                error: 'DRIVER_SPAWN_ERROR',
                detail: spawnErr.message
            });
        }

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });

        const timer = setTimeout(() => {
            try { child.kill(); } catch (_) {}
            // 🛡️ REGLA 8 NOM-004 (FAIL-CLOSED): Prohibido devolver mean_adc: 164.0 simulado en timeout
            finish({
                success: false,
                error: 'SENSOR_TIMEOUT',
                detail: 'Tiempo límite excedido al consultar el sensor USB físico.'
            });
        }, (durationSeconds + 3) * 1000);

        child.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0 && stdout.trim()) {
                try {
                    const parsed = JSON.parse(stdout.trim());
                    finish(parsed);
                } catch (_) {
                    finish({ success: false, error: 'PARSE_ERROR', detail: stdout });
                }
            } else {
                finish({
                    success: false,
                    error: 'DRIVER_EXEC_ERROR',
                    detail: stderr || stdout || `Exited with code ${code}`
                });
            }
        });
    });
}

/**
 * 🛡️ REGLA 8 NOM-004 (CERO DATOS INVENTADOS):
 * Se deshabilita permanentemente la síntesis algorítmica de 253 parámetros desde catálogo estático.
 * Todo estudio bioeléctrico debe provenir exclusivamente del reporte .htm real del analizador cuántico.
 */
function synthesizePatientStudy() {
    return {
        success: false,
        error: 'SYNTHETIC_GENERATION_DISABLED',
        message: 'Generación sintética deshabilitada por gobernanza clínica NOM-004. Sincronice o cargue el estudio .htm real del analizador cuántico.'
    };
}

module.exports = {
    samplePhysicalSensor,
    synthesizePatientStudy
};
