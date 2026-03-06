-- TABLA I: Datos Generales (Paciente)
CREATE TABLE IF NOT EXISTS patients (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    paternal_lastname TEXT NOT NULL,
    maternal_lastname TEXT,
    birth_date TEXT NOT NULL,
    -- Formato YYYY-MM-DD
    gender TEXT,
    -- 'Masculino' o 'Femenino'
    weight_kg REAL,
    height_cm REAL,
    occupation TEXT,
    phone_number TEXT,
    -- V8.0 Fields
    nationality_type TEXT DEFAULT 'MX',
    curp TEXT,
    passport_id TEXT,
    civil_status TEXT,
    religion_has BOOLEAN,
    religion_name TEXT,
    religion_diet_flags TEXT,
    -- Phase 2 Fields (Security)
    emergency_fullname TEXT,
    emergency_relationship TEXT,
    emergency_phone TEXT,
    -- Phase 3A Fields (Cortex Triage)
    triage_motive TEXT,
    triage_risk_level TEXT,
    triage_avatar TEXT,
    triage_ai_tags TEXT,
    triage_secondary_symptoms TEXT
);
-- TABLA II: Antecedentes Heredofamiliares
CREATE TABLE IF NOT EXISTS family_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    condition_name TEXT NOT NULL,
    -- Ej: Diabetes, Hipertensión
    relative_type TEXT NOT NULL,
    -- Ej: Padre, Madre, Abuelo
    FOREIGN KEY(user_id) REFERENCES patients(user_id)
);
-- TABLA III: Antecedentes Patológicos (Personales)
CREATE TABLE IF NOT EXISTS pathological_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    condition_name TEXT NOT NULL,
    status TEXT NOT NULL,
    -- Ej: "Diagnosticado hace 5 años" o "Negativo"
    FOREIGN KEY(user_id) REFERENCES patients(user_id)
);
-- TABLA IV: Motivos de Consulta
CREATE TABLE IF NOT EXISTS consultation_reasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    reason_description TEXT NOT NULL,
    date_recorded DATE DEFAULT CURRENT_DATE,
    FOREIGN KEY(user_id) REFERENCES patients(user_id)
);
-- TABLA V: Antecedentes No Patológicos (Hábitos)
CREATE TABLE IF NOT EXISTS lifestyle_habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    habit_type TEXT NOT NULL,
    -- Alcohol, Tabaco, Actividad Física
    frequency TEXT,
    -- Ej: "3 veces por semana", "Diario"
    quantity TEXT,
    -- Ej: "2 copas", "30 min"
    activity_factor REAL,
    -- Factor numérico para Harris-Benedict (ej. 1.2, 1.55)
    FOREIGN KEY(user_id) REFERENCES patients(user_id)
);
-- TABLA VI: Frecuencia de Alimentos
CREATE TABLE IF NOT EXISTS food_frequency (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    food_group TEXT NOT NULL,
    -- Cereales, Animal, Verduras
    weekly_frequency INTEGER,
    -- 0 a 7 días
    preferences TEXT,
    -- "Le gusta", "Intolerante", "No le gusta"
    FOREIGN KEY(user_id) REFERENCES patients(user_id)
);
-- TABLA VII: Frecuencia de Líquidos
CREATE TABLE IF NOT EXISTS liquid_consumption (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    liquid_type TEXT NOT NULL,
    -- Agua, Refresco, Café
    weekly_frequency INTEGER,
    FOREIGN KEY(user_id) REFERENCES patients(user_id)
);
-- TABLA VIII: Estudios Externos (Modelo EAV para Laboratorio e Imagenología)
CREATE TABLE IF NOT EXISTS external_studies (
    id_registro INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    study_date DATE,
    study_type TEXT NOT NULL,
    -- "Química Sanguínea", "MRI", "ECG"
    parameter_name TEXT NOT NULL,
    -- "Glucosa" o "Impresión Diagnóstica"
    measured_value TEXT,
    -- Puede ser número ("98") o texto largo ("Bloqueo de rama...")
    reference_range TEXT,
    -- "70-100"
    status TEXT,
    -- "Normal", "Alto", "Bajo", "Alerta"
    FOREIGN KEY(user_id) REFERENCES patients(user_id)
);
-- TABLA IX: Códigos Postales (CP) - Estructura Oficial SEPOMEX
DROP TABLE IF EXISTS codigos_postales;
CREATE TABLE IF NOT EXISTS codigos_postales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    d_codigo TEXT NOT NULL,
    -- Código Postal (5 dígitos)
    d_asenta TEXT NOT NULL,
    -- Nombre del Asentamiento (Colonia)
    d_tipo_asenta TEXT NOT NULL,
    -- Tipo (Colonia, Ejido, Barrio)
    D_mnpio TEXT NOT NULL,
    -- Municipio
    d_estado TEXT NOT NULL,
    -- Estado
    d_ciudad TEXT,
    -- Ciudad (Opcional)
    d_CP TEXT,
    -- CP Administración Postal
    c_estado TEXT,
    -- Clave Estado (INEGI)
    c_oficina TEXT,
    -- Clave Oficina
    c_CP TEXT,
    -- Campo vacío (según manual)
    c_tipo_asenta TEXT,
    -- Clave Tipo Asentamiento
    c_mnpio TEXT,
    -- Clave Municipio
    id_asenta_cpcons TEXT,
    -- ID Único Asentamiento
    d_zona TEXT,
    -- Zona (Urbano/Rural)
    c_cve_ciudad TEXT -- Clave Ciudad
);
-- Índices de Alta Velocidad
CREATE INDEX IF NOT EXISTS idx_codigo ON codigos_postales(d_codigo);
CREATE INDEX IF NOT EXISTS idx_estado_mnpio ON codigos_postales(d_estado, D_mnpio);
-- TABLA X: Persistencia de Sesión (Auto-Save & Recovery)
CREATE TABLE IF NOT EXISTS session_persistence (
    citation_id TEXT PRIMARY KEY,
    last_active_phase INTEGER,
    last_active_block TEXT,
    is_completed BOOLEAN DEFAULT 0,
    patient_data_snapshot TEXT,
    -- Full JSON state
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);