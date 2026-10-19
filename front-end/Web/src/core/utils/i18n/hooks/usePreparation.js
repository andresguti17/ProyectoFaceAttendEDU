// ============================================================
//  FaceAttend EDU — usePreparation
//
//  Hook que wrappea la navegación para interceptarla ANTES
//  de que React Navigation cambie de View.
//
//  USO EN SCREENS (no en Views):
//    const navigation = usePreparationNavigation();
//    navigation.navigate("Students"); // ← Automáticamente preparado
//
//  El Screen debe usar este hook en lugar de useNavigation() directo.
// ============================================================

import { useNavigation as useRNNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { navigationPreparationManager } from '../navigation/NavigationPreparationManager';

export function usePreparationNavigation() {
    const reactNavigation = useRNNavigation();

    const navigate = useCallback(async (routeName, params) => {
        // Interceptar navegación
        await navigationPreparationManager.requestNavigation(
            reactNavigation,
            routeName,
            params
        );
    }, [reactNavigation]);

    // Wrappear otras funciones necesarias
    const goBack = useCallback(() => {
        reactNavigation.goBack();
    }, [reactNavigation]);

    const replace = useCallback(async (routeName, params) => {
        await navigationPreparationManager.requestNavigation(
            reactNavigation,
            routeName,
            params,
            'replace'
        );
    }, [reactNavigation]);

    return {
        navigate,
        goBack,
        replace,
        // Mantener acceso al resto si es necesario
        ...reactNavigation,
    };
}
