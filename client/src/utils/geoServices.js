/**
 * geoServices.js - Servicio unificado de geolocalización y códigos postales T.I.L.O.
 */

export const fetchZipData = async (zipCode) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    let data = null;

    // 1. VÍA PRIMARIA: Intento a Servidor Local / Proxy
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    
    try {
        const res = await fetch(`${apiUrl}/api/cp/${zipCode}`, { signal: controller.signal });
        if (res.ok) {
            data = await res.json();
        }
    } catch (e) {
        console.warn("Isquemia local detectada (CP). Activando bypass Zippopotam...");
    } finally {
        clearTimeout(timeoutId); 
    }

    // 2. VÍA SECUNDARIA: Fallback Standalone Directo a Zippopotam
    if (!data || !data.colonias || data.colonias.length === 0) {
        try {
            const publicRes = await fetch(`https://api.zippopotam.us/MX/${zipCode}`);
            if (publicRes.ok) {
                const publicData = await publicRes.json();
                if (publicData.places && publicData.places.length > 0) {
                    const coloniasList = Array.from(new Set(publicData.places.map(p => p['place name'] || p.place_name).filter(Boolean)));
                    
                    data = {
                        municipio: publicData.places[0]['place name'] || 'Municipio N/A',
                        estado: publicData.places[0].state || 'México',
                        colonias: coloniasList
                    };
                }
            }
        } catch (pubErr) {
            console.error("Fallo multiorgánico en consulta CP:", pubErr);
        }
    }

    return data;
};
