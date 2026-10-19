// Catálogo fijo: no existe en el backend (persona guarda el código como texto)
// y la petición respondía siempre 404.
export const DEFAULT_LANGUAGES = [
  { code: 'es', name: '🇪🇸 Español' },
  { code: 'en', name: '🇬🇧 English' },
  { code: 'fr', name: '🇫🇷 Français' },
  { code: 'pt', name: '🇵🇹 Português' },
];

export const LanguageService = {
  getAll: async () => DEFAULT_LANGUAGES,
};
