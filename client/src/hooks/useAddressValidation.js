import usePlacesAutocomplete, {
    getGeocode,
    getLatLng,
} from "use-places-autocomplete";

// Principio Healthspan: Una función, una responsabilidad.
export const useAddressValidation = (zipCode) => {
    const {
        ready,
        value,
        suggestions: { status, data },
        setValue,
        clearSuggestions,
    } = usePlacesAutocomplete({
        requestOptions: {
            // Tensegridad: Restringimos la búsqueda al área ya validada
            locationBias: "IP",
            componentRestrictions: { country: "mx", postalCode: zipCode },
        },
        debounce: 300, // Metabolismo: No sobrecargamos el sistema
    });

    const handleSelect = async (description) => {
        setValue(description, false);
        clearSuggestions();

        try {
            const results = await getGeocode({ address: description });
            const { lat, lng } = await getLatLng(results[0]);

            // Extracción quirúrgica de componentes (Calle, Números)
            const addressComponents = results[0].address_components;
            const streetNumber = addressComponents.find(c => c.types.includes("street_number"))?.long_name;
            const route = addressComponents.find(c => c.types.includes("route"))?.long_name;
            const postalCode = addressComponents.find(c => c.types.includes("postal_code"))?.long_name;

            return {
                fullAddress: description,
                street: route,
                number: streetNumber,
                coords: { lat, lng },
                postalCode: postalCode,
                isValid: results[0].types.includes("street_address") || results[0].types.includes("premise")
            };
        } catch (error) {
            console.error("Error en el metabolismo de dirección:", error);
            return null;
        }
    };

    return { ready, value, setValue, status, data, handleSelect };
};
