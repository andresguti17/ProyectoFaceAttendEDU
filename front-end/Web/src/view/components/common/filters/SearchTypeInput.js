import React, { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";
import { AnimatedDropdown } from "../animation";

/**
 * SearchTypeInput - Input de búsqueda con selector de tipo integrado
 * 
 * Permite seleccionar entre "Buscar por Estudiante" o "Buscar por Docente"
 * y escribir el término de búsqueda en el mismo componente.
 * 
 * @param {object} value - Valor actual: { searchType, searchText }
 *   - searchType: "student" | "teacher"
 *   - searchText: string
 * @param {function} onChange - Callback cuando cambia: ({ searchType, searchText }) => void
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * <SearchTypeInput
 *   value={{ searchType: "student", searchText: "" }}
 *   onChange={({ searchType, searchText }) => {...}}
 * />
 */
export function SearchTypeInput({
    value = { searchType: "student", searchText: "" },
    onChange,
    style,
}) {
    const { theme } = useTheme();
    const c = theme.colors;
    
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [allowDropdownOpen, setAllowDropdownOpen] = useState(false);
    const inputRef = useRef(null);

    // Opciones de tipo de búsqueda
    const searchTypeItems = [
        { 
            value: "student", 
            label: "Buscar por Estudiante...", 
            icon: "user",
            placeholder: "Buscar por nombre de estudiante..."
        },
        { 
            value: "teacher", 
            label: "Buscar por Docente...", 
            icon: "user-check",
            placeholder: "Buscar por docente..."
        },
    ];

    const handleSearchTypeChange = (searchType) => {
        onChange({
            searchType,
            searchText: "", // Limpiar texto al cambiar tipo
        });
        setAllowDropdownOpen(false);
        // Enfocar el input en el siguiente frame
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleTextChange = (text) => {
        // Filtrar para permitir solo letras y espacios manteniendo acentos
        const filtered = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑç\s]/g, '');
        
        // Capitalizar usando titleCase básico
        const formatted = filtered.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        
        onChange({
            searchType: value.searchType,
            searchText: formatted,
        });
    };

    // Obtener el placeholder según el tipo de búsqueda
    const currentOption = searchTypeItems.find(item => item.value === value.searchType);
    const placeholder = currentOption?.placeholder || "Buscar...";
    const icon = currentOption?.icon || "user";

    // Render custom para el trigger con input integrado
    const renderCustomTrigger = ({ open, handleToggle, dropdownAnim }) => {
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                    // Si el dropdown está permitido para abrirse, hacer toggle
                    if (allowDropdownOpen) {
                        handleToggle(true);
                        // Resetear después de abrir para que el ciclo se repita
                        if (!open) {
                            setTimeout(() => setAllowDropdownOpen(false), 100);
                        }
                    } else {
                        // Primera vez: solo enfocar input
                        inputRef.current?.focus();
                        setAllowDropdownOpen(true);
                    }
                }}
            >
                <View 
                    style={[
                        styles.customTrigger,
                        {
                            height: 42,
                            borderWidth: 1.5,
                            borderColor: isInputFocused || open 
                                ? c.brand.primary 
                                : c.border.primary,
                            backgroundColor: c.background.surface,
                            borderBottomLeftRadius: open ? 0 : DESIGN_TOKENS.borderRadius.lg,
                            borderBottomRightRadius: open ? 0 : DESIGN_TOKENS.borderRadius.lg,
                        }
                    ]}
                >
                    {/* Icono según tipo */}
                    <View style={{ paddingLeft: 4 }}>
                        <Feather 
                            name={icon} 
                            size={16} 
                            color={isInputFocused || open ? c.brand.primary : c.text.secondary} 
                        />
                    </View>
                    
                    {/* Input de búsqueda */}
                    <TextInput
                        ref={inputRef}
                        value={value.searchText}
                        onChangeText={handleTextChange}
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        placeholder={placeholder}
                        style={[
                            styles.customInput,
                            { color: c.text.primary }
                        ]}
                        placeholderTextColor={c.text.secondary}
                    />
                    
                    {/* Chevron para abrir dropdown */}
                    <TouchableOpacity 
                        onPress={() => handleToggle(true)}
                        style={{ paddingRight: 4 }}
                    >
                        <Animated.View
                            style={{
                                transform: [
                                    {
                                        rotate: dropdownAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ["0deg", "180deg"],
                                        }),
                                    },
                                ],
                            }}
                        >
                            <Feather
                                name="chevron-down"
                                size={14}
                                color={open ? c.brand.primary : c.text.secondary}
                            />
                        </Animated.View>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, style]}>
            <AnimatedDropdown
                value={value.searchType}
                onSelect={handleSearchTypeChange}
                items={searchTypeItems}
                placeholder={placeholder}
                triggerIcon={null}
                triggerHeight={42}
                renderTrigger={renderCustomTrigger}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    customTrigger: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 8,
        borderRadius: DESIGN_TOKENS.borderRadius.lg,
    },
    customInput: {
        fontSize: 14,
        fontWeight: "400",
        padding: 0,
        flex: 1,
        // @ts-ignore — válido en web
        outlineStyle: "none",
    },
});

export default SearchTypeInput;
