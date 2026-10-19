// ============================================================
//  SecuritySettings — modal contenedor de seguridad
//
//  Recibe sections[] y las renderiza en orden dentro de un
//  layout vertical con separadores.
//  No sabe nada del rol ni de qué bloques contiene.
//
//  Props:
//   - sections : ReactNode[]  — bloques a mostrar en orden
//   - title    : string       — título de la sección (opcional)
//   - header   : ReactNode    — bloque de cabecera (ej: SecurityMeter)
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { Divider } from "../../../components/common";
import { useSettingsSectionStyles } from "./useSettingsSectionStyles";

export function SecuritySettings({ sections = [], title, header }) {
    const { sectionTitle } = useSettingsSectionStyles();

    return (
        <View style={{ gap: 18 }}>
            {title && <Text style={sectionTitle}>{title}</Text>}
            {header && (
                <>
                    {header}
                    <Divider />
                </>
            )}
            {sections.map((section, i) => (
                <React.Fragment key={i}>
                    {section}
                </React.Fragment>
            ))}
        </View>
    );
}
