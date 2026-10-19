// ============================================================
//  FaceAttend EDU — useViewTracker (i18n · Hook)
//
//  Hook para indicar que una View se montó.
//  Resetea el tracking de textos para que solo se traduzcan
//  los textos de la View actual.
//
//  USO OBLIGATORIO EN CADA VIEW/SCREEN:
//
//    function LoginView() {
//        useViewTracker();  // ← Agregar al inicio
//        const { t } = useTranslation();
//        ...
//    }
//
//  Al montar la View, resetea el tracking automáticamente.
// ============================================================

import { useEffect } from "react";
import { translationService } from "../services/TranslationService";

/**
 * Hook para indicar que una View se montó
 * Resetea el tracking de textos automáticamente
 */
export function useViewTracker() {
    useEffect(() => {
        // Resetear tracking al montar View
        translationService.resetTracking();
    }, []); // Solo al montar
}

