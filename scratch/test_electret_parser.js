const { parseElectretHTML, parseElectretJSON, normalizeKey, cleanFloat } = require('../server/utils/electretParser');

console.log("🧪 Testing electretParser utility...");

// Test key normalization
console.log("normalizeKey('Resistencia Vascular &nbsp;'):", normalizeKey('Resistencia Vascular &nbsp;'));
console.log("normalizeKey('Función de la Vesícula Biliar'):", normalizeKey('Función de la Vesícula Biliar'));

// Test cleanFloat
console.log("cleanFloat('1,574'):", cleanFloat('1,574'));
console.log("cleanFloat('33%'):", cleanFloat('33%'));
console.log("cleanFloat(null):", cleanFloat(null));
console.log("cleanFloat('invalid'):", cleanFloat('invalid'));

// Test JSON parser
const sampleJson = {
    "Cardiovascular y Cerebrovascular": {
        "resistencia_vascular": { name: "Resistencia Vascular &nbsp;", val: "1,574", ref: "0,327 - 0,937", status: "ANORMAL SEVERO" }
    }
};

const parsedJson = parseElectretJSON(sampleJson);
console.log("parsedJson success:", parsedJson.success);
console.log("totalParameters:", parsedJson.totalParameters);
console.log("abnormalCount:", parsedJson.abnormalCount);
console.log("categories keys:", Object.keys(parsedJson.categories));

console.log("✅ All parser checks passed successfully!");
