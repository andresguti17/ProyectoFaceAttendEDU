// ============================================================
//  FaceAttend EDU — TranslationGate
//
//  Muestra LoadingView durante la preparación de traducciones.
//  
//  RESPONSABILIDAD ÚNICA:
//    - Mostrar LoadingView cuando isPreparingTranslations === true
//    - Mostrar children cuando isPreparingTranslations === false
//
//  NO intercepta navegación.
//  NO wrappea Screens.
//  NO controla lifecycle.
// ============================================================

import React from "react";
import LoadingView from "../../view/LoadingView";

export function TranslationGate({ isPreparingTranslations, children }) {
    if (isPreparingTranslations) {
        return <LoadingView message="Cargando traducciones..." />;
    }

    return children;
}
