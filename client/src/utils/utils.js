/**
 * Utility functions for SAFE-ID Module
 */

/**
 * Convierte "Palenque ,May 31 2023" en "31 de Mayo, 2023 — Palenque"
 * @param {string} rawString 
 * @returns {string} Formatted date string
 */
export const cleanServerInfo = (rawString) => {
    // Default fallback object
    const fallback = { display: "Fecha desconocida", fecha: "N/A", sede: "N/A", patientName: null };

    if (!rawString) return fallback;

    try {
        // Expected format: "Location ,Month Day Year" OR "Location ,Name ,Month Day Year"
        const parts = rawString.split(',');

        if (parts.length < 2) return { ...fallback, display: rawString, raw: rawString };

        const location = parts[0].trim();
        // Take the last part as date, filtering out empty strings first just in case
        const validParts = parts.map(p => p.trim()).filter(p => p.length > 0);
        const datePartRaw = validParts[validParts.length - 1]; // "May 31 2023 12:00AM" or just "May 31 2023"

        // Extract patient name if there's a middle segment
        let extractedName = null;
        if (validParts.length >= 3) {
            extractedName = validParts[1];
        }

        // Fix: Remove time if present, or format correctly for Date constructor
        // Regex for "Month Day Year" (e.g. May 31 2023)
        const dateMatch = datePartRaw.match(/^([A-Za-z]+ \d{1,2} \d{4})/);
        const dateString = dateMatch ? dateMatch[0] : datePartRaw;

        // Parse date using native Date object
        const dateObj = new Date(dateString);

        if (isNaN(dateObj.getTime())) return { ...fallback, display: rawString, raw: rawString, patientName: extractedName }; // Invalid date

        // Custom formatting to match requirement: "31 de Mayo, 2023 — Palenque"
        const day = dateObj.getDate();
        const year = dateObj.getFullYear();
        const month = dateObj.toLocaleString('es-ES', { month: 'long' });
        const monthCap = month.charAt(0).toUpperCase() + month.slice(1);

        const formattedDate = `${day} de ${monthCap}, ${year}`;

        return {
            display: formattedDate,
            fecha: formattedDate,
            sede: location,
            raw: rawString,
            patientName: extractedName
        };

    } catch (e) {
        console.error("Date parsing error:", e);
        return { ...fallback, display: rawString };
    }
};

/**
 * Formatea texto a Title Case (Primera mayúscula, resto minúscula)
 * @param {string} text 
 * @returns {string}
 */
export const formatText = (text) => {
    if (!text) return "";
    return text
        .toLocaleLowerCase('es-ES')
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

/**
 * Infiere el género del contacto basado en su primer nombre
 * @param {string} name 
 * @returns {string} 'MALE' | 'FEMALE'
 */
export const inferGenderFromName = (name) => {
    if (!name || typeof name !== 'string') return 'MALE'; // Default fallback

    // Usar solo el primer nombre, en minúsculas y sin acentos para la evaluación
    const cleanName = name.trim().split(' ')[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // Nombres excepcionales (mujeres que no terminan en A, hombres que terminan en A)
    const exceptions = {
        'carmen': 'FEMALE', 'guadalupe': 'FEMALE', 'rosario': 'FEMALE', 'belen': 'FEMALE',
        'luz': 'FEMALE', 'pilar': 'FEMALE', 'sol': 'FEMALE', 'mar': 'FEMALE', 'fe': 'FEMALE',
        'paz': 'FEMALE', 'cruz': 'FEMALE', 'chloe': 'FEMALE', 'zoe': 'FEMALE', 'irene': 'FEMALE',
        'beatriz': 'FEMALE', 'ines': 'FEMALE', 'ruth': 'FEMALE', 'esther': 'FEMALE',
        'ester': 'FEMALE', 'raquel': 'FEMALE', 'isabel': 'FEMALE', 'leonor': 'FEMALE',
        'socorro': 'FEMALE', 'concepcion': 'FEMALE', 'asuncion': 'FEMALE', 'encarnacion': 'FEMALE',
        'purificacion': 'FEMALE', 'consolacion': 'FEMALE', 'abigail': 'FEMALE', 'miriam': 'FEMALE',

        'bautista': 'MALE', 'borja': 'MALE', 'luca': 'MALE', 'ezra': 'MALE', 'chema': 'MALE',
        'josiah': 'MALE', 'noa': 'MALE', 'andrea': 'MALE' // Andrea en Italia es Hombre, pero en latam mujer. Default a FEMALE via regla 'A' si no está en exp
    };

    if (exceptions[cleanName]) {
        return exceptions[cleanName];
    }

    // Regla general de la 'A' en español
    if (cleanName.endsWith('a')) {
        return 'FEMALE';
    }

    return 'MALE';
};

/**
 * Calcula la distancia de Levenshtein entre dos cadenas de texto.
 * @param {string} a 
 * @param {string} b 
 * @returns {number} Distancia
 */
export const calculateLevenshteinDistance = (a, b) => {
    const matrix = [];
    let i, j;

    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    for (i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
};

/**
 * Calcula la similitud entre dos cadenas y determina si es un "match"
 * @param {string} inputName Input manual
 * @param {string} apiName Nombre en el payload API
 * @param {number} threshold Umbral de coincidencia (0-1). Ej: 0.6 = 60%
 * @returns {boolean}
 */
export const fuzzyMatch = (inputName, apiName, threshold = 0.6) => {
    if (!inputName || !apiName) return false;

    // Normalize string (remove accents, to lowercase, remove commas)
    const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,/g, " ").replace(/\s+/g, " ").toLowerCase().trim();

    const s1 = normalize(inputName);
    const s2 = normalize(apiName);

    // Si el nombre ingresado está contenido exactamente dentro del nombre completo de la API
    if (s2.includes(s1)) return true;

    // Check similarity against the full string
    const distanceFull = calculateLevenshteinDistance(s1, s2);
    const maxLengthFull = Math.max(s1.length, s2.length);
    const similarityFull = 1 - (distanceFull / maxLengthFull);

    if (similarityFull >= threshold) return true;

    // Si la validación contra el string completo falla, validar palabra por palabra
    // Esto es crucial porque inputName puede ser solo el "Nombre de pila" ("Rossa") 
    // mientras apiName es el nombre completo ("Rosa Mendez Padron")
    const apiWords = s2.split(" ");
    const inputWords = s1.split(" ");

    let allWordsMatched = true;
    for (const iWord of inputWords) {
        if (iWord.length === 0) continue;
        let wordMatched = false;

        for (const aWord of apiWords) {
            if (aWord.length === 0) continue;
            const dist = calculateLevenshteinDistance(iWord, aWord);
            const maxLen = Math.max(iWord.length, aWord.length);
            const sim = 1 - (dist / maxLen);

            if (sim >= threshold) {
                wordMatched = true;
                break; // Found a match for this input word in the API name
            }
        }

        // If at least one word from the input has no fuzzy match in the API name, fail
        if (!wordMatched) {
            allWordsMatched = false;
            break;
        }
    }

    if (allWordsMatched && inputWords.length > 0) return true;

    return false;
};

/**
 * Calculadora básica de CURP (Concierge)
 * @param {string} name Nombres
 * @param {string} lastNamePat Apellido Paterno
 * @param {string} lastNameMat Apellido Materno
 * @param {string} dob DD/MM/YYYY
 * @param {string} sex "Masculino" o "Femenino"
 * @param {string} stateCode Código de estado de 2 letras (ej. DF, MC)
 * @returns {string} CURP aproximada (Sin homoclave verificada)
 */
export const calculateCurp = (name, lastNamePat, lastNameMat, dob, sex, stateCode = 'CM') => {
    // 1. Initial 4 letters
    const getFirstVowel = (str) => {
        const match = str.slice(1).match(/[AEIOU]/i);
        return match ? match[0] : 'X';
    };

    const cleanStr = (s) => (s || 'X').toUpperCase().trim().replace(/[^A-Z]/g, '');

    const lnp = cleanStr(lastNamePat);
    const lnm = cleanStr(lastNameMat);
    const n = cleanStr(name);

    let c1 = lnp.charAt(0) || 'X';
    let c2 = getFirstVowel(lnp);
    let c3 = lnm.charAt(0) || 'X';
    let c4 = n.charAt(0) || 'X';

    // Manejo especial de "Jose" o "Maria" como primer nombre compuesto (simplificado aquí)
    if ((n.startsWith('JOSE') || n.startsWith('MARIA')) && n.length > 5) {
        c4 = cleanStr(n.split(' ')[1] || n).charAt(0);
    }

    const initials = `${c1}${c2}${c3}${c4}`;

    // 2. Date of birth (YYMMDD)
    const [day, month, year] = (dob || "01/01/1900").split('/');
    const yy = (year || "00").slice(-2);
    const mm = (month || "00").padStart(2, '0');
    const dd = (day || "00").padStart(2, '0');
    const datePart = `${yy}${mm}${dd}`;

    // 3. Sex
    const s = sex.toLowerCase().startsWith('m') ? 'H' : 'M';

    // 4. State
    const st = stateCode.toUpperCase();

    // 5. Consonants
    const getFirstInternalConsonant = (str) => {
        const match = str.slice(1).match(/[BCDFGHJKLMNÑPQRSTVWXYZ]/i);
        return match ? match[0] : 'X';
    };

    const c5 = getFirstInternalConsonant(lnp);
    const c6 = getFirstInternalConsonant(lnm);
    const c7 = getFirstInternalConsonant(n);

    const consonants = `${c5}${c6}${c7}`;

    // Concatenate to 16 chars + add 2 dummy homoclave chars
    // This is an approximation for UI completeness, actual CURP calculation is more complex + verifiable
    return `${initials}${datePart}${s}${st}${consonants}00`.substring(0, 18);
};

/**
 * Validador Booleano Estricto (NLP-Light)
 * @param {string} input 
 * @returns {boolean|null} true (Sí), false (No), null (Indeterminado)
 */
export const strictBooleanValidator = (input) => {
    if (!input) return null;
    const lower = input.trim().toLowerCase();

    // Positive Triggers
    if (['si', 'sí', 'claro', 'por supuesto', 'correcto', 'asi es', 'así es', 'confirmar', '1'].includes(lower)) return true;

    // Negative Triggers
    if (['no', 'nunca', 'jamás', 'jamas', 'negativo', 'nel', 'ninguno', '0'].includes(lower)) return false;

    return null;
};

/**
 * Calcula Edad Exacta
 * @param {string} dateString DD/MM/YYYY
 * @returns {number} Edad en años
 */
export const calculateAge = (dateString) => {
    if (!dateString) return 0;
    const parts = dateString.split('/');
    if (parts.length !== 3) return 0;

    const birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

/**
 * Genera el contexto pediátrico basado en la edad
 * @param {string} dateString DD/MM/YYYY
 * @returns {object} Pediatric context object
 */
export const buildPediatricContext = (dateString) => {
    if (!dateString) return null;

    const parts = dateString.split('/');
    if (parts.length !== 3) return null;

    const birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
    const today = new Date();

    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();

    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += (months < 0 ? 12 : 11);
    }

    const totalMonths = (years * 12) + months;

    let context = {
        category: "ADULTO",
        is_minor: false,
        tutor_present: false,
        tone_modifier: "ADULT_DIRECT",
        growth_charts: null,
        ui_controls: {
            show_marital_status: true,
            occupation_label: "Ocupación",
            tone_key: null,
            auto_fill_marital: null
        }
    };

    if (totalMonths < 24) {
        context.category = "LACTANTE";
        context.is_minor = true;
        context.tutor_present = true;
        context.tone_modifier = "PARENT_DIRECTED";
        context.growth_charts = "WHO_0_5";
        context.ui_controls = {
            show_marital_status: false,
            occupation_label: "Guardería / Kínder",
            tone_key: null,
            auto_fill_marital: "LACTANTE"
        };
    } else if (years >= 2 && years <= 5) {
        context.category = "PREESCOLAR";
        context.is_minor = true;
        context.tutor_present = true;
        context.tone_modifier = "PARENT_DIRECTED";
        context.growth_charts = "WHO_0_5";
        context.ui_controls = {
            show_marital_status: false,
            occupation_label: "Guardería / Kínder",
            tone_key: null,
            auto_fill_marital: "PREESCOLAR"
        };
    } else if (years >= 6 && years <= 11) {
        context.category = "ESCOLAR";
        context.is_minor = true;
        context.tutor_present = true;
        context.tone_modifier = "MIXED";
        context.growth_charts = "CDC_5_19";
        context.ui_controls = {
            show_marital_status: false,
            occupation_label: "Grado Escolar",
            tone_key: null,
            auto_fill_marital: "ESCOLAR"
        };
    } else if (years >= 12 && years <= 17) {
        context.category = "ADOLESCENTE";
        context.is_minor = true;
        context.tutor_present = false;
        context.tone_modifier = "ADULT_DIRECT";
        context.growth_charts = "CDC_5_19";
        context.ui_controls = {
            show_marital_status: false,
            occupation_label: "Grado Escolar",
            tone_key: "YOUTH_EMP_TONE",
            auto_fill_marital: "ADOLESCENTE"
        };
    }

    return context;
};

/**
 * Calcula IMC
 * @param {number} weight kg
 * @param {number} height cm
 * @returns {string} IMC con 1 decimal
 */
export const calculateBMI = (weight, height) => {
    if (!weight || !height) return "0.0";
    const hM = height / 100;
    return (weight / (hM * hM)).toFixed(1);
};

/**
 * Formato Fecha Larga V10 (Protocolo Humanización)
 * Output: "2 de mayo de 1965"
 * @param {string} dateString DD/MM/YYYY
 * @returns {string} Fecha humanizada
 */
export const formatDateLong = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split('/');
    if (parts.length !== 3) return dateString; // Fallback

    const date = new Date(parts[2], parts[1] - 1, parts[0]);

    const day = date.getDate();
    const year = date.getFullYear();
    const month = date.toLocaleDateString('es-ES', { month: 'long' });
    const monthCap = month.charAt(0).toUpperCase() + month.slice(1);

    return `${day} de ${monthCap} de ${year}`;
};

/**
 * Formato Fecha Corta
 * Output: "12 Dic 1969"
 * @param {string} dateString DD/MM/YYYY
 * @returns {string} Fecha corta capitalizada
 */
export const formatDateShort = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split('/');
    if (parts.length !== 3) return dateString;

    const date = new Date(parts[2], parts[1] - 1, parts[0]);

    const day = date.getDate();
    const year = date.getFullYear();
    // Use short month format
    let monthShort = date.toLocaleDateString('es-ES', { month: 'short' });
    // Handle case where some browsers append a period (e.g., "dic.")
    monthShort = monthShort.replace('.', '');
    const monthCap = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);

    return `${day} ${monthCap} ${year}`;
};

/**
 * Validador de Frecuencia Alimentaria (FFQ)
 * @param {string} msg 
 * @param {string} type 'risk', 'protective', 'optimal'
 * @returns {boolean}
 */
export const checkFreq = (msg, type) => {
    if (!msg) return false;
    const m = msg.toLowerCase();
    const val = parseInt(m);
    const isNum = !isNaN(val);

    if (type === 'risk') {
        if (m.includes('diario') || m.includes('siempre') || m.includes('todos')) return true;
        if (isNum && val >= 5) return true;
    }
    if (type === 'protective') {
        if (m.includes('nunca') || m.includes('jamás') || m.includes('0') || m.includes('cero') || m.includes('nad')) return true;
        if (isNum && val === 0) return true;
    }
    if (type === 'optimal') {
        if (m.includes('diario') || m.includes('siempre')) return true;
        if (isNum && val >= 6) return true;
    }
    return false;
};

// V10.5 HELPER: GENDER AGREEMENT ENGINE
// Returns the correct term based on biological sex
export const getGenderedTerm = (term, sex) => {
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
        'tranquilo': isFemale ? 'Tranquila' : 'Tranquilo',
        'soltero': isFemale ? 'Soltera' : 'Soltero',
        'casado': isFemale ? 'Casada' : 'Casado',
        'divorciado': isFemale ? 'Divorciada' : 'Divorciado',
        'viudo': isFemale ? 'Viuda' : 'Viudo'
    };

    return dic[term.toLowerCase()] || term;
};
