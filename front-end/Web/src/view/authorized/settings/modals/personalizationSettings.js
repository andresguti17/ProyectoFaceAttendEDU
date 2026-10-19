// ============================================================
//  PersonalizationSettings — modal contenedor de personalización
//
//  Recibe sections[] y las renderiza en orden.
//  Placeholder para funcionalidad futura.
//
//  Props:
//   - sections : ReactNode[]  — bloques a mostrar en orden
//   - title    : string       — título de la sección (opcional)
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { Divider } from "../../../components/common";
import { useSettingsSectionStyles } from "./useSettingsSectionStyles";

export function PersonalizationSettings({ sections = [], title }) {
    const { sectionTitle } = useSettingsSectionStyles();

    return (
        <View style={{ gap: 18 }}>
            {title && <Text style={sectionTitle}>{title}</Text>}
            {sections.map((section, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <Divider />}
                    {section}
                </React.Fragment>
            ))}
        </View>
    );
}
