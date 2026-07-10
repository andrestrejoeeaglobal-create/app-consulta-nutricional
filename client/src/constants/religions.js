// Demographic Standard (ISO Inspired) for Religious Affiliations and Diets
export const RELIGIONS = [
    { label: "Adventismo del Séptimo Día", value: "Adventismo del Séptimo Día", category: "Cristianismo", alerts: ["Vegetarianismo estricto recomendado", "Prohibición de alimentos inmundos (cerdo, mariscos)", "Sin cafeína ni alcohol"] },
    { label: "Agnosticismo / Ateísmo", value: "Agnosticismo / Ateísmo", category: "Ninguna", alerts: [] },
    { label: "Bahaísmo", value: "Bahaísmo", category: "Bahaísmo", alerts: ["Ayuno anual de 19 días"] },
    { label: "Budismo (General)", value: "Budismo (General)", category: "Budismo", alerts: ["Vegetarianismo frecuente"] },
    { label: "Catolicismo", value: "Catolicismo", category: "Cristianismo", alerts: ["Ayuno en Cuaresma", "Sin carnes rojas los viernes de Cuaresma"] },
    { label: "Cristianismo Evangélico / Protestante", value: "Cristianismo Evangélico", category: "Cristianismo", alerts: [] },
    { label: "Cristianismo Ortodoxo", value: "Cristianismo Ortodoxo", category: "Cristianismo", alerts: ["Ayuno estricto pre-Pascua (Veganismo temporal)"] },
    { label: "Hinduismo", value: "Hinduismo", category: "Hinduismo", alerts: ["Prohibición estricta de carne de res", "Vegetarianismo mayoritario (Lacto-vegetariano)"] },
    { label: "Iglesia de Jesucristo de los Santos de los Últimos Días (Mormones)", value: "Mormonismo", category: "Cristianismo", alerts: ["Sin café", "Sin té negro", "Sin tabaco ni alcohol", "Ayuno mensual"] },
    { label: "Islam (General)", value: "Islam", category: "Islam", alerts: ["Prohibición estricta de carne de cerdo", "Prohibición de alcohol", "Dieta Halal", "Ayuno diurno en Ramadán"] },
    { label: "Jainismo", value: "Jainismo", category: "Jainismo", alerts: ["Veganismo/Vegetarianismo extremo", "Prohibición de vegetales de raíz (cebolla, ajo, papa)"] },
    { label: "Judaísmo (General)", value: "Judaísmo", category: "Judaísmo", alerts: ["Dieta Kosher", "Prohibición de carne de cerdo", "Prohibición de mariscos sin escamas/aletas", "No mezclar lácteos con carne", "Ayuno en Yom Kipur"] },
    { label: "Otra Religión no listada", value: "Otra Religión", category: "Otras", alerts: ["Posibles restricciones culturales personalizadas"] },
    { label: "Paganismo / Wicca", value: "Paganismo", category: "Otras", alerts: [] },
    { label: "Religiones Afroamericanas (Santería, Vudú, Candomblé)", value: "Religiones Afroamericanas", category: "Religiones Tradicionales", alerts: ["Restricciones dietéticas basadas en el Orisha/Santo regente"] },
    { label: "Sijismo", value: "Sijismo", category: "Sijismo", alerts: ["Prohibición de carne Halal/Kosher (solo Jhatka)", "Vegetarianismo prevalente (Langar)"] },
    { label: "Sintoísmo", value: "Sintoísmo", category: "Sintoísmo", alerts: [] },
    { label: "Testigos de Jehová", value: "Testigos de Jehová", category: "Cristianismo", alerts: ["Estricta prohibición de transfusiones de sangre", "Prohibición de consumir alimentos con sangre"] }
];

export const getReligionData = (val) => {
    return RELIGIONS.find(r => r.value.toLowerCase() === val?.toLowerCase() || r.label.toLowerCase() === val?.toLowerCase());
};
