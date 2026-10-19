import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput as RNTextInput, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Select/Dropdown reutilizable con búsqueda y multi-selección
 * 
 * Componente mejorado de Select con soporte para búsqueda en tiempo real,
 * selección múltiple, render custom de opciones y más.
 * 
 * @param {string} label - Etiqueta
 * @param {*} value - Valor seleccionado (string/number) o array si multiple=true
 * @param {function} onValueChange - Callback al cambiar valor
 * @param {Array} options - Opciones: [{ label, value, ...custom }]
 * @param {string} placeholder - Placeholder
 * @param {boolean} error - Si hay error
 * @param {string} errorMessage - Mensaje de error
 * @param {boolean} required - Si es requerido
 * @param {boolean} disabled - Si está deshabilitado
 * @param {boolean} searchable - Habilitar búsqueda de opciones (default: false)
 * @param {string} searchPlaceholder - Placeholder del input de búsqueda
 * @param {boolean} multiple - Permitir selección múltiple (default: false)
 * @param {function} renderOption - Función custom para renderizar opciones
 * @param {ReactNode} customIcon - Icono custom para el dropdown
 * @param {string} noResultsText - Texto cuando no hay resultados (default: "Sin resultados")
 * @param {object} style - Estilos adicionales del contenedor
 * 
 * @example
 * // Select básico (backward compatible)
 * <Select
 *   label="Categoría"
 *   value={category}
 *   onValueChange={setCategory}
 *   options={[
 *     { label: "Opción 1", value: "1" },
 *     { label: "Opción 2", value: "2" }
 *   ]}
 * />
 * 
 * @example
 * // Select con búsqueda
 * <Select
 *   label="Estudiante"
 *   value={studentId}
 *   onValueChange={setStudentId}
 *   options={students}
 *   searchable
 *   searchPlaceholder="Buscar estudiante..."
 * />
 * 
 * @example
 * // Select múltiple
 * const [selectedIds, setSelectedIds] = useState([]);
 * <Select
 *   label="Permisos"
 *   value={selectedIds}
 *   onValueChange={setSelectedIds}
 *   options={permissions}
 *   multiple
 *   placeholder="Seleccionar permisos..."
 * />
 * 
 * @example
 * // Con render custom
 * <Select
 *   label="Usuario"
 *   value={userId}
 *   onValueChange={setUserId}
 *   options={users}
 *   searchable
 *   renderOption={(option, isSelected) => (
 *     <View style={{ flexDirection: 'row', alignItems: 'center' }}>
 *       <Avatar source={option.avatar} size={32} />
 *       <Text style={{ marginLeft: 8 }}>{option.label}</Text>
 *       {isSelected && <Feather name="check" size={16} />}
 *     </View>
 *   )}
 * />
 */
export function Select({
  label,
  value,
  onValueChange,
  options = [],
  placeholder = "Seleccionar...",
  error = false,
  errorMessage,
  required = false,
  disabled = false,
  searchable = false,
  searchPlaceholder = "Buscar...",
  multiple = false,
  renderOption,
  customIcon,
  noResultsText = "Sin resultados",
  style,
  buttonStyle,
}) {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Normalizar value a array si es multiple
  const selectedValues = multiple 
    ? (Array.isArray(value) ? value : [])
    : (value !== undefined && value !== null ? [value] : []);

  // Filtrar opciones por búsqueda
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    
    const query = searchQuery.toLowerCase();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery, searchable]);

  // Obtener texto a mostrar
  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    
    if (multiple) {
      const selectedOptions = options.filter(opt => 
        selectedValues.includes(opt.value)
      );
      if (selectedOptions.length === 0) return placeholder;
      if (selectedOptions.length === 1) return selectedOptions[0].label;
      return `${selectedOptions.length} seleccionados`;
    }
    
    const selectedOption = options.find(opt => opt.value === value);
    return selectedOption ? selectedOption.label : placeholder;
  };

  const displayText = getDisplayText();

  const handleSelect = (optionValue) => {
    if (multiple) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue];
      onValueChange(newValues);
    } else {
      onValueChange(optionValue);
      setModalVisible(false);
      setSearchQuery("");
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSearchQuery("");
  };

  const isSelected = (optionValue) => selectedValues.includes(optionValue);

  const dropdownIcon = customIcon || (
    <Feather name="chevron-down" size={18} color={theme.colors.text.secondary} />
  );

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: error ? theme.colors.status.error : theme.colors.text.secondary },
          ]}
        >
          {label}
          {required && <Text style={{ color: theme.colors.status.error }}> *</Text>}
        </Text>
      )}

      <TouchableOpacity
        onPress={() => !disabled && setModalVisible(true)}
        style={[
          styles.selectButton,
          {
            borderColor: error
              ? theme.colors.status.error
              : theme.colors.border.primary,
            backgroundColor: disabled
              ? theme.colors.background.hover
              : theme.colors.background.surface,
          },
          buttonStyle, // Permite sobrescribir height desde fuera
        ]}
        disabled={disabled}
      >
        <Text
          style={[
            styles.selectText,
            {
              color: selectedValues.length > 0
                ? theme.colors.text.primary
                : theme.colors.text.disabled,
            },
          ]}
        >
          {displayText}
        </Text>
        {dropdownIcon}
      </TouchableOpacity>

      {error && errorMessage && (
        <Text style={[styles.message, { color: theme.colors.status.error }]}>
          {errorMessage}
        </Text>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseModal}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.colors.background.surface,
                ...DESIGN_TOKENS.shadows.lg,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* Search input */}
            {searchable && (
              <View
                style={[
                  styles.searchContainer,
                  { borderBottomColor: theme.colors.border.primary },
                ]}
              >
                <Feather
                  name="search"
                  size={18}
                  color={theme.colors.text.secondary}
                  style={styles.searchIcon}
                />
                <RNTextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={theme.colors.text.disabled}
                  style={[
                    styles.searchInput,
                    { color: theme.colors.text.primary },
                  ]}
                  autoFocus
                />
                {searchQuery !== "" && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Feather
                      name="x"
                      size={18}
                      color={theme.colors.text.secondary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Options list */}
            {filteredOptions.length > 0 ? (
              <FlatList
                data={filteredOptions}
                keyExtractor={(item) => item.value.toString()}
                renderItem={({ item }) => {
                  const selected = isSelected(item.value);
                  
                  return (
                    <TouchableOpacity
                      style={[
                        styles.option,
                        {
                          backgroundColor: selected
                            ? theme.colors.brand.primaryLight
                            : "transparent",
                        },
                      ]}
                      onPress={() => handleSelect(item.value)}
                    >
                      {renderOption ? (
                        renderOption(item, selected)
                      ) : (
                        <View style={styles.optionContent}>
                          <Text
                            style={[
                              styles.optionText,
                              {
                                color: selected
                                  ? theme.colors.brand.primary
                                  : theme.colors.text.primary,
                                fontWeight: selected ? "600" : "400",
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                          {selected && (
                            <Feather
                              name={multiple ? "check-square" : "check"}
                              size={18}
                              color={theme.colors.brand.primary}
                            />
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            ) : (
              <View style={styles.noResults}>
                <Feather name="search" size={32} color={theme.colors.text.disabled} />
                <Text
                  style={[
                    styles.noResultsText,
                    { color: theme.colors.text.secondary },
                  ]}
                >
                  {noResultsText}
                </Text>
              </View>
            )}

            {/* Close button for multiple */}
            {multiple && (
              <View
                style={[
                  styles.footer,
                  { borderTopColor: theme.colors.border.primary },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.doneButton,
                    { backgroundColor: theme.colors.brand.primary },
                  ]}
                  onPress={handleCloseModal}
                >
                  <Text style={[styles.doneButtonText, { color: theme.colors.text.inverse }]}>
                    Listo ({selectedValues.length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    minHeight: 40,
  },
  selectText: {
    fontSize: 14,
    flex: 1,
  },
  message: {
    fontSize: 12,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    maxHeight: "70%",
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
    overflow: "hidden",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    borderBottomWidth: 1,
  },
  searchIcon: {
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
  },
  option: {
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionText: {
    fontSize: 14,
    flex: 1,
  },
  noResults: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: DESIGN_TOKENS.spacing.xxl,
  },
  noResultsText: {
    fontSize: 14,
    marginTop: DESIGN_TOKENS.spacing.sm,
  },
  footer: {
    borderTopWidth: 1,
    padding: DESIGN_TOKENS.spacing.md,
  },
  doneButton: {
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.borderRadius.md,
    alignItems: "center",
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default Select;
