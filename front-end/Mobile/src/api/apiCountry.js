import i18n from '../utils/i18n';
const COUNTRIES_API = 'https://countriesnow.space/api/v0.1';

export const apiCountry = {
  getAllCountries: async () => {
    try {
      const response = await fetch(`${COUNTRIES_API}/countries/codes`);
      const data = await response.json();

      if (!data.error && data.data) {
        return { success: true, data: data.data };
      }
      return { success: false, error: i18n.t('countries.loadError') };
    } catch {
      return { success: false, error: i18n.t('countries.connectionError') };
    }
  },

  getCitiesByCountry: async (countryName) => {
    try {
      const response = await fetch(`${COUNTRIES_API}/countries/cities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryName }),
      });
      const data = await response.json();

      if (!data.error && data.data) {
        return { success: true, data: data.data };
      }
      return { success: false, error: i18n.t('countries.citiesLoadError') };
    } catch {
      return { success: false, error: i18n.t('countries.citiesConnectionError') };
    }
  },
};
