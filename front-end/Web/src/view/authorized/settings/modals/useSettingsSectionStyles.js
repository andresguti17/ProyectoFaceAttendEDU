// ============================================================
//  FaceAttend EDU — useSettingsSectionStyles
//
//  Hook de estilos compartidos para todas las secciones de
//  configuración. Centraliza labelStyle, descStyle, inputStyle
//  y sectionTitle que antes estaban triplicados en cada archivo.
// ============================================================

import { useTheme } from "../../../components/hooks/useTheme";

export function useSettingsSectionStyles() {
    const { theme } = useTheme();
    const c = theme.colors;

    return {
        c,
        labelStyle: {
            fontSize: 14,
            fontWeight: "600",
            color: c.text.primary,
            marginBottom: 6,
        },
        descStyle: {
            fontSize: 13,
            color: c.text.secondary,
            marginTop: 0,
            lineHeight: 10,
        },
        inputStyle: {
            height: 40,
            borderWidth: 1.5,
            borderColor: c.border.primary,
            borderRadius: 14,
            paddingHorizontal: 16,
            fontSize: 14,
            color: c.text.primary,
            backgroundColor: c.background.surface,
        },
        sectionTitle: {
            fontSize: 16,
            fontWeight: "600",
            color: c.text.primary,
        },
    };
}
