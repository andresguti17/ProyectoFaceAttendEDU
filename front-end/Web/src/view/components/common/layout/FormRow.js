// ============================================================
//  FaceAttend EDU — FormRow
//  Contenedor responsive para campos de formulario en filas.
//  Adapta automáticamente entre layout horizontal y vertical.
// ============================================================

import React from "react";
import { View } from "react-native";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * FormRow - Contenedor responsive para campos de formulario
 * 
 * Componente que maneja el layout responsive de campos en formularios.
 * En pantallas grandes muestra los campos en fila horizontal, en pantallas
 * pequeñas los apila verticalmente.
 * 
 * @param {ReactNode} children - Campos del formulario (TextInput, Dropdown, etc.)
 * @param {boolean} isSmall - Si la pantalla es pequeña (viene de useResponsive)
 * @param {number} gap - Espacio entre campos (default: 12px horizontal, 0px vertical)
 * @param {object} style - Estilos adicionales del contenedor
 * 
 * @example
 * // Uso básico con useResponsive
 * const { isSmall } = useResponsive();
 * 
 * <FormRow isSmall={isSmall}>
 *   <View style={{ flex: 1 }}>
 *     <TextInput label="Nombre" />
 *   </View>
 *   <View style={{ flex: 1 }}>
 *     <TextInput label="Apellido" />
 *   </View>
 * </FormRow>
 * 
 * @example
 * // Con campo de ancho fijo
 * <FormRow isSmall={isSmall}>
 *   <View style={{ flex: 1 }}>
 *     <TextInput label="Nombre del curso" />
 *   </View>
 *   <View style={{ width: isSmall ? "100%" : 115 }}>
 *     <TextInput label="Código" />
 *   </View>
 * </FormRow>
 * 
 * @example
 * // Con gap personalizado
 * <FormRow isSmall={isSmall} gap={16}>
 *   <View style={{ flex: 1 }}>
 *     <DatePicker label="Fecha inicio" />
 *   </View>
 *   <View style={{ flex: 1 }}>
 *     <DatePicker label="Fecha fin" />
 *   </View>
 * </FormRow>
 */
export function FormRow({ 
    children, 
    isSmall, 
    gap,
    style,
}) {
    const horizontalGap = gap ?? DESIGN_TOKENS.spacing.md;
    const verticalGap = 0; // En vertical no hay gap, los componentes tienen su propio marginBottom

    return (
        <View
            style={[
                {
                    flexDirection: isSmall ? "column" : "row",
                    gap: isSmall ? verticalGap : horizontalGap,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

export default FormRow;
