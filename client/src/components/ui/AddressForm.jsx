import React, { useState } from "react";
import { useAddressValidation } from "../../hooks/useAddressValidation";
import { MapPin } from 'lucide-react';

export const AddressForm = ({ zipCode, initialValue, onSave, isEditing }) => {
    const [selectedAddress, setSelectedAddress] = useState(null);
    const { ready, value, setValue, status, data, handleSelect } = useAddressValidation(zipCode);

    // Si no está editando, mostramos el valor inicial o el guardado
    if (!isEditing) {
        return (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 min-h-[50px] flex items-center">
                <span className="text-slate-700 font-medium">
                    {initialValue || "--"}
                </span>
            </div>
        );
    }

    // Inmunidad: Solo permitimos el guardado si el Córtex confirma la precisión del número
    const isAddressComplete = selectedAddress && selectedAddress.number && selectedAddress.isValid;

    const onConfirm = async (description) => {
        const detail = await handleSelect(description);
        setSelectedAddress(detail);
        
        if (!detail?.number) {
            console.warn("Alerta de Tejido: Calle detectada, pero falta el número exterior.");
        }
    };

    const handleCommit = (e) => {
        e.preventDefault();
        if (isAddressComplete) {
            // Bombeo de datos hacia Firebase/Stitch
            onSave(selectedAddress);
        }
    };

    return (
        <div className="address-node-container relative w-full pt-1">
            <div className="flex relative">
                <input
                    value={value || initialValue || ''}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setSelectedAddress(null); // Reset de estado al detectar mutación en el input
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (isAddressComplete) {
                                onSave(selectedAddress);
                            }
                        }
                    }}
                    disabled={!ready}
                    placeholder="Ej. Oriente 158 124"
                    className={`w-full p-3 rounded-xl bg-white border-2 text-slate-700 font-medium outline-none transition-all ${
                        selectedAddress && !selectedAddress.number 
                        ? "border-amber-400 focus:border-amber-500" 
                        : "border-blue-100 focus:border-blue-500"
                    }`}
                />
            </div>

            {/* Sugerencias del Metabolismo (Córtex Visual) */}
            {status === "OK" && (
                <ul className="absolute z-50 w-full bg-white mt-1 border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {data.map(({ place_id, description }) => (
                        <li 
                            key={place_id} 
                            onClick={() => onConfirm(description)}
                            className="p-3 text-sm text-slate-700 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-start gap-2"
                        >
                            <MapPin size={16} className="text-blue-500 mt-0.5 shrink-0" />
                            <span>{description}</span>
                        </li>
                    ))}
                </ul>
            )}

            {/* Feedback de Salud del Sistema */}
            {selectedAddress && !selectedAddress.number && (
                <p className="text-amber-600 text-[10px] font-bold mt-2 uppercase flex items-center gap-1">
                    ⚠️ Incompleto: Por favor selecciona una dirección con número exterior.
                </p>
            )}

            {selectedAddress && selectedAddress.number && selectedAddress.status !== 'synced' && (
                <button 
                    onClick={handleCommit} 
                    disabled={!isAddressComplete}
                    className="mt-3 w-full p-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase rounded-lg transition-colors flex justify-center items-center gap-2"
                >
                    Sincronizar Dirección
                </button>
            )}
        </div>
    );
};
