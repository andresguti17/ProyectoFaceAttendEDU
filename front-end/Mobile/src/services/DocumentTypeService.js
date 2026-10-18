// Catálogo fijo: no existe en el backend (persona guarda el código como texto)
// y la petición respondía siempre 404.
export const DEFAULT_DOCUMENT_TYPES = [
  // label es el valor que se guarda (QuestionnaireModal); labelKey es solo para mostrarlo.
  { id: 'cc', label: 'Cédula de Ciudadanía (CC)', labelKey: 'documentTypes.cc', abreviatura: 'CC' },
  { id: 'ti', label: 'Tarjeta de Identidad (TI)', labelKey: 'documentTypes.ti', abreviatura: 'TI' },
  { id: 'ce', label: 'Cédula de Extranjería (CE)', labelKey: 'documentTypes.ce', abreviatura: 'CE' },
];

export const DocumentTypeService = {
  getAll: async () => DEFAULT_DOCUMENT_TYPES,
};
