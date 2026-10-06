import React, { useMemo, useState, useEffect } from 'react';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { fetchMexicanCoordinates } from '../../utils/geoServices';

const mapContainerStyle = {
  width: '100%',
  height: '250px',
  borderRadius: '12px', // Estética orgánica
};

export const AddressMap = ({ coordinates, domicilio, setPatientData }) => {
  const [localCoords, setLocalCoords] = useState(coordinates);

  // Sync con coordenadas prop o calcular via motor mexicano
  useEffect(() => {
    if (coordinates) {
      setLocalCoords(coordinates);
    } else if (domicilio) {
      if (domicilio.coordinates) {
        setLocalCoords(domicilio.coordinates);
      } else if (domicilio.estado || domicilio.municipio || domicilio.colonia || domicilio.calle) {
        fetchMexicanCoordinates(domicilio).then(res => {
          if (res && res.lat && res.lng) {
            setLocalCoords({ lat: res.lat, lng: res.lng });
          }
        }).catch(err => {
          console.warn("Error en fetchMexicanCoordinates:", err);
          setLocalCoords({ lat: 19.4326, lng: -99.1332 });
        });
      }
    } else {
      setLocalCoords(null);
    }
  }, [coordinates, domicilio]);

  // Metabolismo: Memorizamos las opciones para no estresar el CPU
  const options = useMemo(() => ({
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
        {
            "elementType": "geometry",
            "stylers": [
                { "color": "#f5f5f5" }
            ]
        },
        {
            "elementType": "labels.icon",
            "stylers": [
                { "visibility": "off" }
            ]
        },
        {
            "elementType": "labels.text.fill",
            "stylers": [
                { "color": "#616161" }
            ]
        },
        {
            "elementType": "labels.text.stroke",
            "stylers": [
                { "color": "#f5f5f5" }
            ]
        },
        {
            "featureType": "administrative.land_parcel",
            "elementType": "labels.text.fill",
            "stylers": [
                { "color": "#bdbdbd" }
            ]
        },
        {
            "featureType": "poi",
            "elementType": "geometry",
            "stylers": [
                { "color": "#eeeeee" }
            ]
        },
        {
            "featureType": "poi",
            "elementType": "labels.text.fill",
            "stylers": [
                { "color": "#757575" }
            ]
        },
        {
            "featureType": "poi.park",
            "elementType": "geometry",
            "stylers": [
                { "color": "#e5e5e5" }
            ]
        },
        {
            "featureType": "poi.park",
            "elementType": "labels.text.fill",
            "stylers": [
                { "color": "#9e9e9e" }
            ]
        },
        {
            "featureType": "road",
            "elementType": "geometry",
            "stylers": [
                { "color": "#ffffff" }
            ]
        },
        {
            "featureType": "road.arterial",
            "elementType": "labels.text.fill",
            "stylers": [
                { "color": "#757575" }
            ]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry",
            "stylers": [
                { "color": "#dadada" }
            ]
        },
        {
            "featureType": "road.highway",
            "elementType": "labels.text.fill",
            "stylers": [
                { "color": "#616161" }
            ]
        },
        {
            "featureType": "road.local",
            "elementType": "labels.text.fill",
            "stylers": [
                { "color": "#9e9e9e" }
            ]
        },
        {
            "featureType": "transit.line",
            "elementType": "geometry",
            "stylers": [
                { "color": "#e5e5e5" }
            ]
        },
        {
            "featureType": "transit.station",
            "elementType": "geometry",
            "stylers": [
                { "color": "#eeeeee" }
            ]
        },
        {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [
                { "color": "#c9c9c9" }
            ]
        },
        {
            "featureType": "water",
            "elementType": "labels.text.fill",
            "stylers": [
                { "color": "#9e9e9e" }
            ]
        }
    ],
  }), []);

  const onMarkerDragEnd = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const newCoords = { lat, lng };
    setLocalCoords(newCoords);
    if (setPatientData) {
      setPatientData(prev => ({
        ...prev,
        domicilio: {
          ...prev.domicilio,
          coordinates: newCoords,
          addressStatus: 'VERIFIED'
        }
      }));
    }
  };

  if (!localCoords) {
    return (
      <div className="w-full h-[250px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center">
        <p className="text-slate-400 text-sm font-medium uppercase tracking-widest text-center px-4">
          ESPERANDO VALIDACIÓN CARTOGRÁFICA <br/> PARA PROYECTAR MARCADOR
        </p>
      </div>
    );
  }

  const zoomLevel = coordinates ? 18 : 14;

  const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const hasValidGoogleKey = Boolean(GOOGLE_MAPS_KEY && GOOGLE_MAPS_KEY.trim().length > 5);

  if (!hasValidGoogleKey) {
    const bboxDelta = 0.008;
    const bbox = `${localCoords.lng - bboxDelta},${localCoords.lat - bboxDelta},${localCoords.lng + bboxDelta},${localCoords.lat + bboxDelta}`;
    const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${localCoords.lat},${localCoords.lng}`;

    return (
      <div className="w-full rounded-xl overflow-hidden border border-emerald-100 shadow-sm relative">
        <iframe
          title="Mapa Cartográfico Standalone"
          width="100%"
          height="250"
          frameBorder="0"
          scrolling="no"
          marginHeight="0"
          marginWidth="0"
          src={osmUrl}
          className="rounded-xl w-full h-[250px]"
        />
        <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-emerald-100/50 flex flex-col items-end gap-0.5 pointer-events-none z-10">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
            Precisión Cartográfica (Nube Standalone)
          </span>
          <span className="text-xs font-mono font-medium text-emerald-600 leading-none">
            {localCoords.lat.toFixed(5)}, {localCoords.lng.toFixed(5)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl overflow-hidden border border-emerald-100 shadow-sm relative">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={zoomLevel}
        center={localCoords}
        options={options}
      >
        <MarkerF 
          position={localCoords} 
          draggable={true}
          onDragEnd={onMarkerDragEnd}
          animation={window.google?.maps?.Animation?.DROP}
          icon={window.google?.maps?.SymbolPath ? {
             path: window.google.maps.SymbolPath.CIRCLE,
             fillColor: '#10b981',
             fillOpacity: 1,
             strokeColor: '#059669',
             strokeWeight: 2,
             scale: 8
          } : undefined}
        />
      </GoogleMap>
      <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-emerald-100/50 flex flex-col items-end gap-0.5 pointer-events-none">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
          {coordinates ? "Precisión Cartográfica" : "Validación Manual (Arrastre)"}
        </span>
        <span className="text-xs font-mono font-medium text-emerald-600 leading-none">
          {localCoords.lat.toFixed(5)}, {localCoords.lng.toFixed(5)}
        </span>
      </div>
    </div>
  );
};
