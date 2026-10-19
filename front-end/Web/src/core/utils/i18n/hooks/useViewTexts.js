// ============================================================
//  FaceAttend EDU — useViewTexts (i18n · Hook)
//
//  Hook helper para registrar textos de una View automáticamente.
//  Las Views usan este hook para declarar qué textos necesitan traducir.
//
//  Cuando el usuario cambia de idioma, el LanguageContext:
//    1. Muestra LoadingView global
//    2. Obtiene todos los textos registrados
//    3. Prepara las traducciones faltantes
//    4. Oculta LoadingView
//    5. Las Views se renderizan con t() devolviendo traducciones
//
//  Uso en una View:
//    function MyView() {
//        const { t } = useTranslation();
//        
//        // Registrar textos de esta View
//        useViewTexts("MyView", [
//            "Título de la View",
//            "Botón guardar",
//            "Mensaje de confirmación",
//        ]);
//        
//        return <Text>{t("Título de la View")}</Text>;
//    }
// ============================================================

import { useEffect } from "react";
import { useTranslation } from "./useTranslation";

/**
 * Registra los textos que utiliza una View para preparación automática.
 * 
 * @param {string} viewId - Identificador único de la View
 * @param {string[]} texts - Array de textos en español que usa la View
 */
export function useViewTexts(viewId, texts) {
    const { registerViewTexts } = useTranslation();
    
    useEffect(() => {
        if (!texts || texts.length === 0) return;
        
        // Registrar textos y retornar cleanup
        return registerViewTexts(viewId, texts);
    }, [viewId, texts, registerViewTexts]);
}
