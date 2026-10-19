import React from "react";
import { TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TextInput } from "./TextInput";
import { useTheme } from "../../hooks/useTheme";

/**
 * SearchInput - Input de búsqueda con icono y botón de limpiar
 * 
 * Preset especializado de TextInput para búsquedas. Incluye icono de búsqueda
 * automático y botón X para limpiar cuando hay texto.
 * 
 * @param {string} value - Valor del input
 * @param {function} onChangeText - Callback al cambiar texto
 * @param {function} onClear - Callback al limpiar (opcional)
 * @param {string} placeholder - Placeholder (default: "Buscar...")
 * @param {boolean} showClearButton - Mostrar botón X cuando hay texto (default: true)
 * @param {ReactNode} leftIcon - Icono izquierdo custom (default: search icon)
 * @param {object} ...props - Todas las props de TextInput
 * 
 * @example
 * // SearchInput básico
 * const [query, setQuery] = useState("");
 * <SearchInput
 *   value={query}
 *   onChangeText={setQuery}
 *   placeholder="Buscar estudiantes..."
 * />
 * 
 * @example
 * // Con callback onClear
 * <SearchInput
 *   value={searchQuery}
 *   onChangeText={setSearchQuery}
 *   onClear={() => {
 *     setSearchQuery("");
 *     refetch();
 *   }}
 * />
 * 
 * @example
 * // En header de lista
 * <View>
 *   <SearchInput
 *     value={filter}
 *     onChangeText={setFilter}
 *     placeholder="Filtrar por nombre..."
 *   />
 *   <FlatList
 *     data={filteredData}
 *     renderItem={...}
 *   />
 * </View>
 * 
 * @example
 * // Sin botón clear
 * <SearchInput
 *   value={query}
 *   onChangeText={setQuery}
 *   showClearButton={false}
 * />
 */
export function SearchInput({
  value,
  onChangeText,
  onClear,
  placeholder = "Buscar...",
  showClearButton = true,
  leftIcon,
  ...props
}) {
  const { theme } = useTheme();

  const handleClear = () => {
    onChangeText("");
    if (onClear) onClear();
  };

  const defaultLeftIcon = (
    <Feather name="search" size={18} color={theme.colors.text.secondary} />
  );

  const clearButton = value && showClearButton && (
    <TouchableOpacity onPress={handleClear}>
      <Feather name="x" size={18} color={theme.colors.text.secondary} />
    </TouchableOpacity>
  );

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      leftIcon={leftIcon || defaultLeftIcon}
      rightIcon={clearButton}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
      {...props}
    />
  );
}

export default SearchInput;
