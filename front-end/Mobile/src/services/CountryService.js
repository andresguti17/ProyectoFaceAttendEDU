import {apiCountry} from '../api/apiCountry';

export const CountryService = {
    fetchAllCountries: async () => {
        const result = await apiCountry.getAllCountries();

        if (!result.success) {
            throw new Error(result.error);
        }

        // Filtrar datos inválidos, mapear y ordenar
        const parsed = result.data
            .filter((item) => item.name && item.dial_code)
            .map((item) => ({
                name: item.name,
                dialCode: item.dial_code,
                code: item.code || '',
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return parsed;
    },

    fetchCities: async (countryName) => {
        const result = await apiCountry.getCitiesByCountry(countryName);

        if (!result.success) {
            throw new Error(result.error);
        }

        return result.data; // Array de strings (nombres de ciudades)
    },

    findCountryByName: (countryList, name) => {
        return countryList.find(
            (c) => c.name.toLowerCase() === name.toLowerCase()
        ) || null;
    },
};