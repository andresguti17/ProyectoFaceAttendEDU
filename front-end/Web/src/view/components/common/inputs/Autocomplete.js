import React from "react";
import { Select } from "./Select";

/**
 * Autocomplete - Select con búsqueda habilitada por defecto
 * 
 * Preset de Select optimizado para búsqueda y selección de elementos
 * en listas grandes. Alias conveniente de Select con searchable=true.
 * 
 * @param {object} ...props - Todas las props de Select
 * 
 * @example
 * // Autocomplete básico
 * <Autocomplete
 *   label="Estudiante"
 *   value={studentId}
 *   onValueChange={setStudentId}
 *   options={students}
 *   placeholder="Buscar estudiante..."
 * />
 * 
 * @example
 * // Con render custom
 * <Autocomplete
 *   label="Usuario"
 *   value={userId}
 *   onValueChange={setUserId}
 *   options={users}
 *   renderOption={(option, isSelected) => (
 *     <View style={{ flexDirection: 'row', alignItems: 'center' }}>
 *       <Avatar source={option.avatar} />
 *       <Text>{option.label}</Text>
 *     </View>
 *   )}
 * />
 * 
 * @example
 * // Multi-select con búsqueda
 * <Autocomplete
 *   label="Cursos"
 *   value={selectedCourses}
 *   onValueChange={setSelectedCourses}
 *   options={courses}
 *   multiple
 * />
 */
export function Autocomplete(props) {
  return <Select searchable {...props} />;
}

export default Autocomplete;
