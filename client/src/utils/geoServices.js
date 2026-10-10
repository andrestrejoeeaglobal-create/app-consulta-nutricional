/**
 * geoServices.js - Servicio unificado de geolocalización y códigos postales T.I.L.O.
 */

export const sanitizeMexicanStreet = (streetStr) => {
    if (!streetStr) return '';
    return streetStr
        .replace(/\b(rt|ret)\.?\b/gi, 'Retorno')
        .replace(/\b(av|avd)\.?\b/gi, 'Avenida')
        .replace(/\b(cll|clle)\.?\b/gi, 'Calle')
        .replace(/\b(cjon)\.?\b/gi, 'Callejón')
        .replace(/\b(calz|czda)\.?\b/gi, 'Calzada')
        .replace(/\b(blvd|bv)\.?\b/gi, 'Bulevar')
        .replace(/\b(eje)\.?\b/gi, 'Eje')
        .replace(/\b(mz|mza)\.?\b/gi, 'Manzana')
        .replace(/\b(lt|lte)\.?\b/gi, 'Lote')
        .replace(/\b(col)\.?\b/gi, 'Colonia')
        .trim();
};

export const fetchMexicanCoordinates = async ({ calle, colonia, municipio, estado, cp }) => {
    const cleanStreet = sanitizeMexicanStreet(calle || '');
    const cleanColonia = (colonia || '').trim();
    const cleanMuni = (municipio || '').trim();
    const cleanEstado = (estado || '').replace(/Distrito Federal/i, 'Ciudad de México').trim();

    // SINTAXIS DE ANCLAJE ABSOLUTO (Siempre combina Calle, Colonia, CP, Municipio y Estado)
    const anchorParts = [
        cleanStreet,
        cleanColonia ? `Col. ${cleanColonia}` : '',
        cp && cleanMuni ? `${cp} ${cleanMuni}` : (cleanMuni || cp),
        cleanEstado,
        'México'
    ].filter(Boolean);

    const anchorQuery = anchorParts.join(', ');

    // 1. CAPA PRIMARIA: ArcGIS World Geocoder REST API (Geocodificación Milimétrica a Nivel Predio/Puerta)
    try {
        const arcUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(anchorQuery)}&maxLocations=1`;
        const resArc = await fetch(arcUrl);
        if (resArc.ok) {
            const dataArc = await resArc.json();
            if (dataArc && dataArc.candidates && dataArc.candidates.length > 0 && dataArc.candidates[0].score > 50) {
                const candidate = dataArc.candidates[0];
                console.log("📍 [ArcGIS Geocoder] Coordenadas prediales encontradas con éxito:", candidate.address, candidate.location);
                return {
                    lat: parseFloat(candidate.location.y),
                    lng: parseFloat(candidate.location.x),
                    formattedAddress: candidate.address
                };
            }
        }
    } catch (e) {
        console.warn("📌 [ArcGIS Geocoder] Fallback activado a Nominatim:", e.message);
    }

    // 2. CAPA SECUNDARIA: Nominatim con Anclaje Obligatorio de Municipio y Estado
    const queries = [];
    if (cleanStreet && cleanColonia) {
        queries.push(`${cleanStreet}, ${cleanColonia}, ${cleanMuni || cleanEstado}, ${cleanEstado}, México`);
    } else if (cleanStreet) {
        queries.push(`${cleanStreet}, ${cleanMuni || cleanEstado}, ${cleanEstado}, México`);
    }
    if (cleanColonia) {
        if (cp) queries.push(`${cleanColonia}, ${cp} ${cleanMuni}, ${cleanEstado}, México`);
        queries.push(`${cleanColonia}, ${cleanMuni || cleanEstado}, ${cleanEstado}, México`);
    }

    for (const q of queries) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=mx`, {
                headers: { 'User-Agent': 'TILO-NutriApp/1.0' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    return {
                        lat: parseFloat(data[0].lat),
                        lng: parseFloat(data[0].lon),
                        formattedAddress: data[0].display_name
                    };
                }
            }
        } catch (e) {
            console.warn("Intento de geocodificación libre omitido:", q);
        }
    }

    // Fallback por defecto: Centro de México
    return { lat: 19.4326, lng: -99.1332, formattedAddress: "Ciudad de México, México" };
};

export const fetchZipData = async (zipCode) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    let data = null;

    // Detector biológico de entorno y destino de API
    const isLocalServerTarget = apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1');
    const isCloudEnvironment = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const skipPrimaryFetch = isCloudEnvironment && isLocalServerTarget;

    // 1. VÍA PRIMARIA: Intento a Servidor Local / Proxy
    if (!skipPrimaryFetch) {
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
    } else {
        console.log("⚡ Entorno Nube Standalone detectado (GitHub Pages). Redirigiendo CP a Zippopotam...");
    }

    // 2. VÍA SECUNDARIA: Fallback Standalone Directo a Zippopotam
    if (!data || !data.colonias || data.colonias.length === 0) {
        try {
            const publicRes = await fetch(`https://api.zippopotam.us/MX/${zipCode}`);
            if (publicRes.ok) {
                const publicData = await publicRes.json();
                if (publicData.places && publicData.places.length > 0) {
                    const coloniasList = Array.from(new Set(publicData.places.map(p => p['place name'] || p.place_name).filter(Boolean)));
                    const firstPlace = publicData.places[0];

                    data = {
                        municipio: firstPlace['place name'] || 'Municipio N/A',
                        estado: firstPlace.state || 'México',
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
