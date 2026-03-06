const axios = require('axios');

const login = async (req, res) => {
    const { user, password } = req.body;

    try {
        // Validación de EA
        const response = await axios.get(`https://equipoenaccion.app/ea_lab_login.asp?action=SINGIN&User=${user}&Password=${password}`);

        // Verificación de seguridad: ¿Viene el dataSet?
        if (!response.data || !response.data.dataSet || response.data.dataSet.length === 0) {
            return res.status(401).json({ message: "Respuesta inválida del servidor central." });
        }

        const data = response.data.dataSet[0];

        // Lógica de estatus según tus requerimientos
        if (data.status === 0) {
            // Nota: Aquí se podría agregar la persistencia SQL si se requiere en el futuro.
            res.json({ success: true, user: data });
        } else if (data.status === 2) {
            res.status(401).json({ message: "Contraseña incorrecta." });
        } else if (data.status === 3) {
            res.status(404).json({ message: "Usuario no existente." });
        } else {
            res.status(401).json({ message: "Acceso denegado." });
        }
    } catch (error) {
        console.error("Error en el Bridge:", error.message);
        res.status(500).json({ message: "Error de conexión con Equipo en Acción." });
    }
};

module.exports = { login };
