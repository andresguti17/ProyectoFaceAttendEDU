import { useRef, useCallback } from "react";

/**
 * usePersistentScroll - Hook para mantener la posición del scroll entre re-renders
 * 
 * Este hook guarda la posición del scroll en una ref que persiste entre
 * montajes y desmontajes del componente.
 * 
 * @returns {Object} - scrollRef, scrollPosition, handlers
 */

// Estado global compartido para la posición del scroll
// Esto persiste incluso cuando el componente se desmonta
const globalScrollState = {
    position: 0,
};

export function usePersistentScroll() {
    const scrollViewRef = useRef(null);
    const isRestoringRef = useRef(false);
    
    // Handler para guardar la posición al hacer scroll
    const handleScroll = useCallback((event) => {
        if (!isRestoringRef.current) {
            globalScrollState.position = event.nativeEvent.contentOffset.y;
        }
    }, []);
    
    // Handler para restaurar la posición cuando el contenido cambia
    const handleContentSizeChange = useCallback(() => {
        if (scrollViewRef.current && globalScrollState.position > 0) {
            isRestoringRef.current = true;
            
            // Usar requestAnimationFrame para asegurar que el layout esté completo
            requestAnimationFrame(() => {
                scrollViewRef.current?.scrollTo({
                    y: globalScrollState.position,
                    animated: false,
                });
                
                // Resetear flag después de un frame
                setTimeout(() => {
                    isRestoringRef.current = false;
                }, 50);
            });
        }
    }, []);
    
    // Handler cuando se monta el componente - restaurar posición inmediatamente
    const handleLayout = useCallback(() => {
        if (scrollViewRef.current && globalScrollState.position > 0 && !isRestoringRef.current) {
            isRestoringRef.current = true;
            
            requestAnimationFrame(() => {
                scrollViewRef.current?.scrollTo({
                    y: globalScrollState.position,
                    animated: false,
                });
                
                setTimeout(() => {
                    isRestoringRef.current = false;
                }, 50);
            });
        }
    }, []);
    
    return {
        scrollViewRef,
        scrollPosition: globalScrollState.position,
        handleScroll,
        handleContentSizeChange,
        handleLayout,
    };
}
