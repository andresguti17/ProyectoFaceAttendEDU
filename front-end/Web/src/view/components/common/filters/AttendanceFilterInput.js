import React, { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";
import { AnimatedDropdown } from "../animation";

/**
 * AttendanceFilterInput - Filtro especializado para porcentajes de asistencia
 * 
 * Permite filtrar por valores predefinidos (100%, 75%, 50%, 25%) con comparadores
 * (>, <, =) o ingresar un valor personalizado.
 * 
 * @param {object} value - Valor del filtro: { mode, comparator, percentage }
 *   - mode: "preset" | "custom"
 *   - comparator: "gt" (>) | "lt" (<) | "eq" (=)
 *   - percentage: número 0-100
 * @param {function} onChange - Callback cuando cambia: (filterValue) => void
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * <AttendanceFilterInput
 *   value={{ mode: "preset", comparator: "gt", percentage: 75 }}
 *   onChange={setAttendanceFilter}
 * />
 */
export function AttendanceFilterInput({
    value = { mode: "preset", comparator: "eq", percentage: null },
    onChange,
    style,
}) {
    const { theme } = useTheme();
    const c = theme.colors;
    
    const [inputValue, setInputValue] = useState("");
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [allowDropdownOpen, setAllowDropdownOpen] = useState(false);
    const inputRef = useRef(null);

    // Opciones de porcentajes predefinidos
    const presetItems = [
        { value: 100, label: "100%", icon: "check-circle" },
        { value: 75, label: "75%", icon: "trending-up" },
        { value: 50, label: "50%", icon: "minus-circle" },
        { value: 25, label: "25%", icon: "trending-down" },
        { value: "custom", label: "Otro", icon: "edit-3" },
    ];

    // Opciones de comparadores (símbolos grandes como prefix)
    const comparatorItems = [
        { value: "gt", prefix: ">" },
        { value: "lt", prefix: "<" },
        { value: "eq", prefix: "=" },
    ];

    const handlePresetChange = (preset) => {
        if (preset === "custom") {
            // Cambiar a modo custom y enfocar el input
            onChange({
                mode: "custom",
                comparator: value.comparator,
                percentage: null,
            });
            setInputValue("");
            setAllowDropdownOpen(false);
            // Enfocar el input en el siguiente frame
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            onChange({
                mode: "preset",
                comparator: value.comparator,
                percentage: preset,
            });
            setAllowDropdownOpen(false);
        }
    };

    const handleComparatorChange = (comp) => {
        onChange({
            ...value,
            comparator: comp,
        });
    };

    const handleInputSubmit = () => {
        const parsed = parseFloat(inputValue);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            onChange({
                mode: "custom",
                comparator: value.comparator,
                percentage: parsed,
            });
            setInputValue("");
        }
    };

    // Determinar el valor actual para mostrar
    const currentValue = value.mode === "custom" 
        ? "custom"
        : value.percentage;

    // Render custom para el trigger cuando está en modo custom
    const renderCustomTrigger = ({ open, handleToggle, dropdownAnim }) => {
        // Siempre mostrar el input cuando está en modo custom
        if (value.mode === "custom") {
            // Si ya tiene un valor confirmado, mostrarlo en el input
            const displayValue = value.percentage !== null 
                ? value.percentage.toString() 
                : inputValue;
            
            return (
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        // Si el dropdown está permitido para abrirse, hacer toggle
                        if (allowDropdownOpen) {
                            handleToggle(true); // ¡Pasar true para forzar el toggle!
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
                                height: 48,
                                borderWidth: 1.5, // Siempre 2 para evitar el "baile"
                                borderColor: open 
                                    ? c.brand.primary 
                                    : c.border.primary,
                                backgroundColor: open
                                    ? c.brand.primaryLight
                                    : c.background.surface,
                                borderBottomLeftRadius: open ? 0 : DESIGN_TOKENS.borderRadius.lg,
                                borderBottomRightRadius: open ? 0 : DESIGN_TOKENS.borderRadius.lg,
                            }
                        ]}
                    >
                        <TextInput
                            ref={inputRef}
                            value={displayValue}
                            onChangeText={(text) => {
                                // Solo permitir números
                                const numericText = text.replace(/[^0-9]/g, "");
                                
                                // Si el número es mayor a 100, eliminar el último dígito
                                let finalValue = numericText;
                                if (numericText.length > 0) {
                                    const numValue = parseInt(numericText, 10);
                                    if (numValue > 100) {
                                        // Eliminar el último dígito
                                        finalValue = numericText.slice(0, -1);
                                    }
                                }
                                
                                setInputValue(finalValue);
                                // Si estaba confirmado, limpiar el valor al editar
                                if (value.percentage !== null) {
                                    onChange({
                                        mode: "custom",
                                        comparator: value.comparator,
                                        percentage: null,
                                    });
                                }
                            }}
                            onSubmitEditing={handleInputSubmit}
                            onFocus={() => {
                                setIsInputFocused(true);
                            }}
                            onBlur={() => {
                                setIsInputFocused(false);
                            }}
                            placeholder="qué..?"
                            keyboardType="numeric"
                            maxLength={3}
                            style={[
                                styles.customInput,
                                { color: c.text.primary }
                            ]}
                            placeholderTextColor={c.text.secondary}
                        />
                        <TouchableOpacity onPress={() => handleToggle(true)}>
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
        }
        // Si no está en modo custom, resetear el estado cuando salimos de custom
        setAllowDropdownOpen(false);
        return undefined;
    };

    return (
        <View style={[styles.container, style]}>
            <View style={styles.row}>
                {/* Selector de comparador */}
                <View style={styles.comparatorContainer}>
                    <AnimatedDropdown
                        value={value.comparator}
                        onSelect={handleComparatorChange}
                        items={comparatorItems}
                        placeholder="="
                        triggerIcon={null}
                        triggerHeight={48}
                        triggerPadding={10}
                    />
                </View>

                {/* Selector de porcentaje predefinido */}
                <View style={styles.presetContainer}>
                    <AnimatedDropdown
                        value={currentValue}
                        onSelect={handlePresetChange}
                        items={presetItems}
                        placeholder="qué..?"
                        triggerIcon={null}
                        triggerHeight={48}
                        triggerPadding={8}
                        {...(value.mode === "custom" 
                            ? { renderTrigger: renderCustomTrigger } 
                            : {}
                        )}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: DESIGN_TOKENS.spacing.xs,
    },
    row: {
        flexDirection: "row",
        gap: DESIGN_TOKENS.spacing.xs,
        alignItems: "center",
    },
    comparatorContainer: {
        width: 60,
    },
    presetContainer: {
        minWidth: 90,
        flex: 1,
    },
    customTrigger: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        borderRadius: DESIGN_TOKENS.borderRadius.lg,
    },
    customInput: {
        fontSize: 13,
        fontWeight: "600",
        padding: 0,
        width: 50,
        // @ts-ignore — válido en web
        outlineStyle: "none",
    },
    activeFilterContainer: {
        position: "absolute",
        right: 0,
        top: "50%",
        transform: [{ translateY: -12 }],
        zIndex: 10,
    },
    activeFilterBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: DESIGN_TOKENS.spacing.xs,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: 4,
        borderRadius: DESIGN_TOKENS.borderRadius.md,
    },
    activeFilterText: {
        fontSize: 12,
        fontWeight: "600",
    },
});

export default AttendanceFilterInput;


/**
 * AttendanceFilterBadge - Badge que muestra el filtro activo de asistencia
 * Debe renderizarse en la navbar padre
 */
export function AttendanceFilterBadge({ value, onChange }) {
    const { theme } = useTheme();
    const c = theme.colors;

    if (!value?.percentage) return null;

    return (
        <View style={[badgeStyles.badge, { backgroundColor: c.brand.primaryLight }]}>
            <Text style={[badgeStyles.text, { color: c.brand.primary }]}>
                {value.comparator === "gt" ? ">" : value.comparator === "lt" ? "<" : "="}{" "}
                {value.percentage}%
            </Text>
            <TouchableOpacity
                onPress={() => onChange({ mode: "preset", comparator: "eq", percentage: null })}
            >
                <Feather name="x" size={14} color={c.brand.primary} />
            </TouchableOpacity>
        </View>
    );
}

const badgeStyles = StyleSheet.create({
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: DESIGN_TOKENS.spacing.xs,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: 4,
        borderRadius: DESIGN_TOKENS.borderRadius.md,
    },
    text: {
        fontSize: 12,
        fontWeight: "600",
    },
});
