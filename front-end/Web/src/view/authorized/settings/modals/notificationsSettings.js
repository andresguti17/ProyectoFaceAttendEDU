// ============================================================
//  NotificationsSettings — modal contenedor de notificaciones
//
//  Recibe sections[] y las renderiza en orden.
//  No sabe nada del rol ni de qué bloques contiene.
//
//  Props:
//   - sections : ReactNode[]  — bloques a mostrar en orden
//   - onSave   : (fn) => void — pasa al bloque que persiste
// ============================================================
import React from "react";
import { View } from "react-native";

export function NotificationsSettings({ sections = [] }) {
    return (
        <View style={{ gap: 4 }}>
            {sections.map((section, i) => (
                <React.Fragment key={i}>
                    {section}
                </React.Fragment>
            ))}
        </View>
    );
}
