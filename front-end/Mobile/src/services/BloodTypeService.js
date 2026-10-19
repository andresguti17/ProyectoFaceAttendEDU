// Catálogo fijo: no existe en el backend (persona guarda el código como texto)
// y la petición respondía siempre 404.
export const DEFAULT_BLOOD_TYPES = [
  { id: 'a+', label: 'A+' },
  { id: 'a-', label: 'A-' },
  { id: 'b+', label: 'B+' },
  { id: 'b-', label: 'B-' },
  { id: 'ab+', label: 'AB+' },
  { id: 'ab-', label: 'AB-' },
  { id: 'o+', label: 'O+' },
  { id: 'o-', label: 'O-' },
];

export const BloodTypeService = {
  getAll: async () => DEFAULT_BLOOD_TYPES,
};
