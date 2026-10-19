// ============================================================
//  FaceAttend EDU — PreparedScreen
//
//  Wrapper que prepara traducciones antes de mostrar una Screen.
//
//  FLUJO:
//    1. PreparedScreen monta
//    2. tracker.reset()
//    3. Screen real renderiza (invisible)
//    4. t() registra textos
//    5. React commit completo
//    6. useLayoutEffect lee tracker
//    7. prepareViewTranslations()
//    8. LoadingView durante preparación
//    9. Screen visible cuando termina
//
//  NO usa setTimeout.
//  NO usa useFocusEffect.
//  Usa el lifecycle real de React.
// ============================================================

import React, { useState, useLayoutEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { translationTracker } from '../tracker/TranslationTracker';
import { translationService } from '../services/TranslationService';
import { useLanguageContext } from '../context/LanguageContext';
import LoadingView from '../../../view/LoadingView';

export function PreparedScreen({ component: Component, ...props }) {
    const { language } = useLanguageContext();
    const [isReady, setIsReady] = useState(false);
    const preparationIdRef = useRef(0);
    const languageRef = useRef(language);

    // Detectar cambio de idioma
    if (languageRef.current !== language) {
        languageRef.current = language;
        // Resetear estado para re-preparar
        if (isReady) {
            setIsReady(false);
        }
    }

    // Reset tracker ANTES del primer render
    if (!isReady) {
        translationTracker.reset();
    }

    // useLayoutEffect se ejecuta DESPUÉS del commit, ANTES de paint
    // Garantiza que Component ya ejecutó todos sus t()
    useLayoutEffect(() => {
        if (isReady) return;

        const preparationId = ++preparationIdRef.current;

        // Función async para preparar
        (async () => {
            // Obtener textos registrados durante el render
            const texts = translationTracker.getTexts();

            console.log(`[PreparedScreen] Textos recopilados: ${texts.length}`);

            if (texts.length > 0) {
                try {
                    await translationService.prepareViewTranslations(texts, language);
                } catch (error) {
                    console.error('[PreparedScreen] Error preparando:', error);
                }
            }

            // Verificar que no fue invalidado
            if (preparationId === preparationIdRef.current) {
                setIsReady(true);
            }
        })();
    }, [isReady, language]);

    if (!isReady) {
        return (
            <View style={styles.container}>
                {/* Renderizar Component invisible para que ejecute t() */}
                <View style={styles.hidden}>
                    <Component {...props} />
                </View>
                {/* LoadingView visible */}
                <View style={styles.loadingContainer}>
                    <LoadingView message="Cargando traducciones..." />
                </View>
            </View>
        );
    }

    // Component listo y visible
    return <Component {...props} />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    hidden: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        opacity: 0,
        pointerEvents: 'none',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999999,
    },
});
