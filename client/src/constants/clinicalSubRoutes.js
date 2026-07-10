export const getPhase3SubRoutesConfig = (patientFirstName, diagLabel = 'sometido') => ({
    'PHASE_3_SUB_ROUTE_WEIGHTLOSS': {
        questions: [
            `✅ Ruta metabólica de reducción registrada.\n\nPara calcular su punto de ajuste termogénico bajo mayor precisión clínica: **${patientFirstName}**, por favor **indique**, ¿cuál es el peso máximo que ha alcanzado en su vida (sin contar embarazos)?`,
                        `Entendido.\n\nPara detectar posible daño periférico a receptores insulínicos: **Especifique**, ¿dónde percibe que acumula mayor tejido adiposo (ej. Cintura, cadera, espalda)?`,
                        `Registrado.\n\nFinalmente para esta ruta: Del 1 al 10, ¿qué nivel de ansiedad por carbohidratos o comida dulce presenta por las tardes/noches?`
        ],
        keys: [
            'max_weight', 'adipose_zone', 'carb_anxiety'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
    'PHASE_3_SUB_ROUTE_ONCOLOGY': {
        questions: [
            `placeholder`, // idx 0 was asked in CONVERSATIONAL_SELECTION
                        `He registrado la presencia de **hiporexia severa** y alteraciones en la percepción olfativa, indicadores que mi sistema utiliza para mitigar el deterioro del estado nutricional.\n\nRespecto a la debilidad que menciona, ¿presenta Usted dificultad para realizar sus actividades básicas de la vida diaria (como bañarse o vestirse) de forma independiente?`,
                        `La necesidad de asistencia para el autocuidado reportada sitúa su escala de funcionalidad en un nivel que requiere un ajuste inmediato en la densidad de nutrientes de su plan de alimentación.\n\nPor favor, especifique Usted detalladamente si ha notado una pérdida de masa muscular evidente en sus brazos o piernas durante el último mes.`,
                        `La confirmación de **atrofia muscular** visible y la pérdida ponderal acelerada activan una alerta de caquexia en fase de intervención en su expediente clínico.\n\nPara precisar su tolerancia gastrointestinal, ¿ha experimentado Usted episodios de vómito persistente tras la ingesta de alimentos sólidos?`
        ],
        keys: [
            'oncology_primary_symptom', 'oncology_functionality', 'oncology_muscle_atrophy', 'oncology_gi_tolerance'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
    'PHASE_3_SUB_ROUTE_MUSCLE': {
        questions: [
            `✅ Ruta de Rendimiento y Ganancia Muscular activada.\n\nPara calcular su gasto calórico vía Cunningham-Katch: **${patientFirstName}**, por favor **indique**, ¿cuántos días a la semana entrena fuerza y cuánto dura su sesión en promedio?`,
                        `Excelente.\n\nPara el monitoreo de carga hepática y renal: ¿Actualmente consume alguna suplementación (Creatina, Proteína Whey, Pre-entrenos) o compuestos de índole androgénica? (De ser así, por favor **detalle** la dosis).`,
                        `Capturado.\n\nPara sincronizar el superávit/déficit calórico: ¿En qué ciclo nutricional se encuentra actualmente? (Ej. Volumen sucio, Volumen limpio, Recomposición, Mantenimiento).`
        ],
        keys: [
            'training_freq', 'supplementation', 'current_cycle'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
    'PHASE_3_SUB_ROUTE_BIOHACKING': {
        questions: [
            `✅ Protocolo Longevity iniciado. Nivel de acceso: Dark Clinical.\n\nPara ajustar el ángulo de fase celular: **${patientFirstName}**, por favor **indique**, ¿cuántas horas de ayuno profundo promedia regularmente?`,
                        `Registrado.\n\nPreparando algoritmos de termogénesis y VFC. **Especifique**, ¿utiliza actualmente anillos inteligentes (ej. Oura) o sensores continuos de glucosa?`,
                        `Capturado. El entorno de hardware biométrico ha sido calibrado.\n\nFinalmente: Del 1 al 10, evalúe su claridad y enfoque mental al despertar.`
        ],
        keys: [
            'fasting_hours', 'biometric_hardware', 'morning_focus'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
    'PHASE_3_SUB_ROUTE_MENTAL_HEALTH': {
        questions: [
            `placeholder`, // idx 0 was asked in CONVERSATIONAL_SELECTION
                        `He registrado la presencia de ansiedad persistente vinculada al monitoreo constante de su **volumen corporal**, un indicador que mi sistema prioriza para estabilizar su percepción biológica.\n\nRespecto a esos momentos donde siente que pierde el control, ¿ha experimentado Usted la necesidad de realizar alguna conducta compensatoria (como ejercicio excesivo o restricción extrema) inmediatamente después?`,
                        `El registro de respuestas compensatorias es esencial para calcular el umbral de su carga alostática.\n\nPor favor, **especifique** cuál es la conducta principal que realiza (ej. cardio prolongado, ayunos) y con qué frecuencia o duración la lleva a cabo a la semana.`,
                        `La identificación de **ejercicio compulsivo** es un factor de riesgo que el sistema debe monitorear para prevenir el desgaste tisular y proteger su reserva funcional.\n\nPara evaluar su equilibrio hormonal, ¿ha notado Usted cambios o la ausencia de su ciclo menstrual en los últimos meses?`,
                        `He registrado la presencia de **amenorrea secundaria**, un indicador crítico que mi sistema integra para ajustar su densidad nutricional de forma prioritaria.\n\n¿Ha experimentado Usted también una sensación de frío constante en las extremidades o en el cuerpo, independientemente de la temperatura ambiental?`,
                        `La alteración de la **termorregulación** metabólica es una señal de alerta clínica que requiere un abordaje multidisciplinario prioritario.\n\nEntendiendo este contexto de exigencia física, ¿cuál es el pensamiento o temor principal que aparece en su mente cuando intenta reducir la intensidad de su actividad física?`
        ],
        keys: [
            'initial_concern', 'compensatory_behaviors_presence', 'compensatory_behaviors_detail', 'endocrine_risk', 'thermoregulation_risk', 'underlying_fears'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
    'PHASE_3_SUB_ROUTE_PREGNANCY': {
        questions: [
            `✅ Protocolo Materno-Fetal activo.\n\nPara el cálculo exacto del incremento calórico trimestral requerido por la NOM-007: **${patientFirstName}**, por favor **indique**, ¿en qué semana exacta de gestación se encuentra actualmente?`,
                        `Anotado. He bloqueado las vías metabólicas cetogénicas por seguridad neurológica del feto.\n\nComo filtro de alerta para preeclampsia temprana: **Especifique** si ha presentado dolores de cabeza severos, hinchazón repentina o presión arterial alta confirmada recientemente.`,
                        `Esquema de contención vital configurado.\n\nFinalmente para este bloque: ¿Presenta usted náuseas matutinas severas, vómitos repetitivos o acidez profunda en esta etapa de su embarazo?`
        ],
        keys: [
            'gestational_week', 'preeclampsia_symptoms', 'gastric_distress'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
    'PHASE_3_SUB_ROUTE_MENOPAUSE': {
        questions: [
            `✅ Arquitectura Endocrina Femenina iniciada.\n\nPara fijar el estatus de estrógenos de **${patientFirstName}**: Por favor **indique**, ¿aún tiene ciclos menstruales, son irregulares, o han cesado por completo y hace cuánto tiempo?`,
                        `Anotado. Sistema óseo en observación profunda.\n\n¿Ha presentado sintomatología vasomotora severa (bochornos nocturnos intensos) o alteraciones marcadas en la calidad del sueño recientemente?`,
                        `Entendido.\n\nPara descartar transición de riesgo cruzado: ¿Tiene laboratorios recientes de perfil lipídico o tiroideo que presenten ya una irregularidad oficial?`
        ],
        keys: [
            'cycle_status', 'vasomotor_sleep_symptoms', 'recent_labs'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
    'PHASE_3_SUB_ROUTE_BARIATRICS': {
        questions: [
            `✅ Protocolo Bariátrico Post-Quirúrgico iniciado. Motor de texturas activo.\n\nPara sincronizar las fases de dieta (líquida, puré, blanda, normal): **${patientFirstName}**, por favor **indique**, ¿cuál es la fecha exacta en la que fue ${diagLabel} a la cirugía (Día/Mes/Año)?`,
                        `Registrado. Se ha calculado la ventana post-operatoria.\n\nPara el protocolo de prevención de desnutrición (Hierro, Complejo B, D3): ¿Se encuentra usted tomando suplementación bariátrica especializada en este momento?`,
                        `Documentado. Restricción preventiva de carbohidratos simples activada.\n\n¿Ha presentado sintomatología de 'Dumping Syndrome' (mareos bruscos, sudoración y taquicardia inmediatamente tras comer)?`
        ],
        keys: [
            'surgery_date', 'bariatric_supplements', 'dumping_syndrome'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
    'PHASE_3_SUB_ROUTE_CARDIOVASCULAR': {
        questions: [
            `placeholder`, // idx 0 was asked in CONVERSATIONAL_SELECTION
                        `He registrado el antecedente de hipertensión arterial sistémica y la sospecha de **cardiomegalia** para ajustar su densidad de micronutrientes y proteger su reserva muscular.\n\nRespecto a su cansancio, ¿ha experimentado Usted algún episodio de dolor o presión en el pecho durante la última semana?`,
                        `La presencia de **opresión torácica** ante el esfuerzo físico es un indicador de alerta que mi sistema integra para establecer medidas de seguridad hemodinámica inmediatas.\n\nPor favor, **especifique** Usted detalladamente cuánto tiempo suele durar esta sensación de presión en el pecho cuando aparece.`,
                        `El alivio de la sintomatología mediante el reposo es un dato de trazabilidad clínica fundamental para determinar su tolerancia al ejercicio y la restricción de solutos.\n\nPara precisar su estado actual, ¿conoce Usted su cifra más reciente de **presión arterial** registrada en su último chequeo?`,
                        `Las cifras de tensión arterial reportadas indican un descontrol que el sistema debe abordar mediante la optimización del plan alimentario y el monitoreo de líquidos.\n\nImagine que mañana su presión se mantiene perfectamente estable y Usted recupera su energía: ¿cuál sería la primera actividad física que Usted retomaría con seguridad y confianza?`
        ],
        keys: [
            'cardio_primary_symptom', 'cardio_angina_presence', 'cardio_angina_duration', 'cardio_bp_reading', 'emotional_anchor'
        ],
        nextPhase: 'PHASE_3_INFERENCE_CONFIRM'
    },
    'PHASE_3_SUB_ROUTE_DIABETES': {
        questions: [
            `placeholder`, // idx 0
                        `He registrado la presencia de sed excesiva (**polidipsia**) y mareos, indicadores que el sistema asocia con una posible fluctuación en sus niveles de glucosa en sangre.\n\nRespecto a esta sensación de sed, ¿ha notado Usted un aumento en la frecuencia o cantidad de orina durante el día o la noche?`,
                        `La confirmación de poliuria nocturna es un dato de alta relevancia clínica que mi sistema integra para evaluar su estado de hidratación y el control de la carga osmótica.\n\nPor favor, **especifique** Usted si ha experimentado alguna sensación de hormigueo o entumecimiento en las plantas de sus pies recientemente.`,
                        `La presencia de parestesias (hormigueo) en extremidades inferiores activa una alerta de tamizaje para **neuropatía** diabética en su expediente clínico prioritario.\n\nPara precisar su control metabólico reciente, ¿conoce Usted su valor más actual de hemoglobina glucosilada (**HbA1c**) o su última lectura de glucosa en ayunas?`,
                        `**${patientFirstName}**, su Avatar Clínico presenta una interferencia estructural crítica denominada **glicación** del colágeno. Con una HbA1c de **8.5%**, el exceso de glucosa en su sistema actúa como un agente que "carameliza" sus proteínas, endureciendo sus vasos sanguíneos y degradando la calidad del colágeno, que es el pegamento biológico de su cuerpo. Al perder esta elasticidad interna, su capacidad de regeneración disminuye, comprometiendo no solo su piel, sino la protección de sus nervios y órganos vitales.\n\nPara evaluar el impacto de este endurecimiento tisular en su capacidad de reparación, ¿ha notado Usted que sus heridas o rasguños tardan significativamente más tiempo de lo normal en cerrar y sanar por completo?`,
                        `Ese estancamiento en la cicatrización es la evidencia física de que la glicación está bloqueando el flujo de nutrientes y oxígeno hacia sus tejidos periféricos. Sin una intervención para estabilizar su curva glucémica, su cuerpo seguirá careciendo de la "infraestructura" necesaria para realizar reparaciones básicas, elevando el riesgo de infecciones o lesiones crónicas.\n\nPor favor, **especifique** Usted si ha notado cambios en la textura de su piel, como una resequedad extrema o la aparición de manchas oscuras en zonas de pliegues como el cuello o las axilas.`,
                        `Imagine que mañana despierta y sus niveles de azúcar están perfectamente estables, sintiéndose con energía plena y sin molestias: ¿cuál sería el primer cambio positivo que Usted notaría en su ánimo o vitalidad al comenzar el día?`
        ],
        keys: [
            'diabetes_primary_symptom', 'diabetes_polyuria_presence', 'diabetes_neuropathy_presence', 'diabetes_hba1c_latest', 'diabetes_wound_healing', 'diabetes_acanthosis_nigricans', 'emotional_anchor'
        ],
        nextPhase: 'PHASE_3_INFERENCE_CONFIRM'
    },
    'PHASE_3_SUB_ROUTE_GASTROINTESTINAL': {
        questions: [
            `placeholder`, // idx 0
                        `He registrado la presencia de distensión abdominal (inflamación) y ardor en la región epigástrica, indicadores que el sistema asocia con procesos de irritación gástrica.\n\nRespecto al dolor que menciona, ¿ha notado Usted si este síntoma se presenta principalmente con el estómago vacío o inmediatamente después de ingerir alimentos?`,
                        `La confirmación de dolor en ayuno es un dato clínico que mi sistema integra para diferenciar entre cuadros de gastritis o posibles erosiones en la mucosa.\n\nPor favor, **especifique** Usted detalladamente si consume habitualmente alimentos irritantes (como picante, grasas o café) o medicamentos analgésicos de forma frecuente.`,
                        `La ingesta regular de sustancias irritantes actúa como un factor agresor directo sobre su mucosa gástrica que debemos regular prioritariamente en su plan de intervención.\n\nPara descartar complicaciones mayores, ¿ha observado Usted algún cambio en el color de sus evacuaciones, específicamente si son de color negro o con presencia de sangre?`
        ],
        keys: [
            'gi_primary_symptom', 'gi_pain_timing', 'gi_irritants_presence', 'gi_alarm_signs'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
    'PHASE_3_SUB_ROUTE_ALLERGY': {
        questions: [
            `placeholder`, // idx 0
                        `He registrado su sensibilidad extrema a los **frutos secos** (nueces y cacahuates). Esta información queda anclada como restricción absoluta en el motor de ingredientes de su expediente clínico.\n\nDada la gravedad del episodio anterior, ¿cuenta Usted actualmente con un dispositivo de **epinefrina** autoinyectable para casos de emergencia?`,
                        `La posesión de epinefrina es un componente crítico de su red de seguridad institucional que el sistema debe validar para su soporte vital.\n\nPor favor, **especifique** Usted si ha tenido que utilizar este dispositivo en los últimos seis meses debido a una exposición accidental.`,
                        `El temor a la exposición por trazas es una barrera que mi sistema abordará mediante la generación de guías de etiquetado de advertencia y sustitución segura de insumos.\n\n¿Ha experimentado Usted alguna vez síntomas de alergia al entrar en contacto con productos cosméticos o aceites de cuidado personal?`,
                        `Se ha descartado la reactividad por contacto tópico, centrando el control en la ingesta oral y el filtrado estricto de la cadena de suministro alimentaria.\n\nImagine que hoy logramos diseñar un plan donde Usted puede comer con absoluta libertad y seguridad total, sin miedo a las etiquetas: ¿cuál sería el primer alimento que le gustaría disfrutar sabiendo que está protegida por el sistema?`
        ],
        keys: [
            'allergy_primary_symptom', 'allergy_epinephrine_presence', 'allergy_epinephrine_usage', 'allergy_topical_reaction', 'emotional_anchor'
        ],
        nextPhase: 'PHASE_3_INFERENCE_CONFIRM'
    },
    'PHASE_3_SUB_ROUTE_ADDICTION': {
        questions: [
            `placeholder`, // idx 0
                        `He registrado el antecedente de tabaquismo remitido y la presencia de consumo de alcohol en su perfil de hábitos actuales. El alcohol actúa como un depresor del sistema nervioso y puede alterar la biodisponibilidad de sus fármacos para la presión arterial.\n\nRespecto a este hábito, ¿consume Usted alcohol con una frecuencia superior a tres veces por semana?`,
                        `La identificación de episodios de consumo agudo (binge drinking) es un indicador de riesgo que el sistema integra para prevenir crisis de hipertensión reactiva o sobrecarga hepática.\n\nPor favor, **especifique** Usted detalladamente la cantidad promedio de copas que consume en uno de esos eventos de fin de semana.`,
                        `El reporte de cinco a seis unidades de alcohol por evento sitúa su consumo en un nivel que requiere un monitoreo estrecho de sus cifras tensionales posteriores a la ingesta.\n\nPara completar su red de seguridad, ¿consume Usted actualmente alguna otra sustancia, como suplementos herbales o remedios naturales, sin prescripción médica?`
        ],
        keys: [
            'addiction_tobacco_status', 'addiction_alcohol_frequency', 'addiction_alcohol_binge_qty', 'addiction_other_substances'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
    'PHASE_3_SUB_ROUTE_DISABILITY': {
        questions: [
            `placeholder`, // idx 0
                        `He registrado su respuesta de estrés cardiovascular ante esfuerzo leve, lo que confirma que su sistema requiere un techo operativo de seguridad estricto para evitar tensiones mecánicas en la zona quirúrgica.\n\nPor favor, **especifique** Usted si ese episodio de latidos acelerados fue acompañado de algún tipo de dolor o punzada focalizada en el sitio de la cirugía.`,
                        `Se ha procesado la variable mecánica aislada, centrando el ajuste en el control de su frecuencia cardiaca para optimizar la perfusión tisular sin hiperalgesia.\n\nPara asegurar que su reconstrucción sea monitoreada exitosamente, ¿cuenta Usted con un dispositivo de monitoreo (reloj inteligente o banda de pecho) para medir su frecuencia cardiaca en tiempo real al reanudar la marcha?`,
                        `Esta precisión es clínicamente crítica para su proceso de recuperación. Al no existir una malla sintética (prótesis), la integridad de su pared abdominal depende exclusivamente de su capacidad endógena de síntesis de tejido conectivo; su Arquitectura Biológica no cuenta con refuerzo externo, por lo que **Usted** es su propio soporte. Esto eleva la urgencia de corregir su hipogonadismo funcional (**1.90 ng/dL**) y la deficiencia de colágeno, ya que sin la densidad tisular adecuada, el riesgo de **recidiva** (que la herida se vuelva a abrir) es significativamente mayor.\n\nPara evaluar su capacidad actual de reparación, ¿ha percibido Usted que la cicatrización de su herida externa ha sido inusualmente lenta en las últimas semanas?`,
                        `La cicatrización retardada es una manifestación directa de su bajo nivel de testosterona total, lo que compromete la formación de nuevas fibras de colágeno necesarias para sellar su pared abdominal. Sin este soporte hormonal, su cuerpo carece de las "instrucciones químicas" para construir un tejido resistente.\n\nPor favor, **especifique** Usted si ha notado la aparición de algún pequeño bulto o deformidad en la zona de la cirugía al realizar un esfuerzo mínimo como toser o reír.`
        ],
        keys: [
            'post_op_tachycardia', 'post_op_surgical_pain', 'post_op_monitoring_device', 'post_op_healing_speed', 'post_op_hernia_lumps'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
    'PHASE_3_SUB_ROUTE_PALLIATIVE': {
        questions: [
            `✅ Para calibrar la ruta de soporte especializado en su expediente: **${patientFirstName}**, por favor **describa** brevemente el diagnóstico exacto o condición primaria que debemos considerar prioritariamente en su intervención dietética.`,
                        `Anotado.\n\n¿Qué medicamentos críticos, tratamientos farmacológicos o limitantes clave dictan el día a día para el manejo de esta condición?`,
                        `Registrado.\n\nFinalmente para este bloque: ¿Existen alimentos o rutinas que estén completamente contraindicados o debamos evitar a toda costa por su seguridad?`
        ],
        keys: [
            'primary_condition', 'key_treatments', 'strict_avoidance'
        ],
        nextPhase: 'PHASE_3_DETECTIVE_PROBE'
    },
});
