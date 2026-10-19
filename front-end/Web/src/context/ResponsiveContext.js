// ============================================================
//  FaceAttend EDU — Responsive Context
// ============================================================
//  RESPONSABILIDAD: Gestión centralizada de dimensiones responsivas
//
//  Este contexto evita re-renders masivos al:
//  1. Debounce de dimensiones (150ms)
//  2. Memoización agresiva de valores calculados
//  3. Solo notificar cambios cuando cambian los breakpoints, no en cada pixel
// ============================================================

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useWindowDimensions, PixelRatio } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ResponsiveContext = createContext(null);

// ── Constantes ────────────────────────────────────────────────
const NAVBAR_H = 68;
const FOOTER_H = 52;
const BASE_W = 1280;
const BASE_H = 720;

// Breakpoints
const BREAKPOINTS = {
    SMALL: 768,
    MEDIUM: 1024,
    LARGE: 1280,
};

// ── Helper: Calcular categoría de breakpoint ─────────────────
function getBreakpointCategory(width) {
    if (width < BREAKPOINTS.SMALL) return "small";
    if (width < BREAKPOINTS.MEDIUM) return "medium";
    if (width < BREAKPOINTS.LARGE) return "large";
    return "xlarge";
}

// ── Provider ──────────────────────────────────────────────────
export function ResponsiveProvider({ children }) {
    const rawDimensions = useWindowDimensions();
    const insets = useSafeAreaInsets();
    
    // Estado para dimensiones estabilizadas
    const [stableDimensions, setStableDimensions] = useState(rawDimensions);
    const [breakpointCategory, setBreakpointCategory] = useState(getBreakpointCategory(rawDimensions.width));
    
    // Refs para debounce
    const debounceTimerRef = useRef(null);
    const lastDimensionsRef = useRef(rawDimensions);
    
    // Debounce de dimensiones - solo actualiza después de 150ms de inactividad
    useEffect(() => {
        // Si las dimensiones no han cambiado significativamente, ignorar
        const widthDiff = Math.abs(rawDimensions.width - lastDimensionsRef.current.width);
        const heightDiff = Math.abs(rawDimensions.height - lastDimensionsRef.current.height);
        
        // Calcular nuevo breakpoint
        const newCategory = getBreakpointCategory(rawDimensions.width);
        const oldCategory = breakpointCategory;
        
        // Si cambia el breakpoint, actualizar INMEDIATAMENTE sin debounce
        if (newCategory !== oldCategory) {
            setStableDimensions(rawDimensions);
            setBreakpointCategory(newCategory);
            lastDimensionsRef.current = rawDimensions;
            
            // Cancelar cualquier timer pendiente
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            return;
        }
        
        // Ignorar cambios menores a 10px (ruido del navegador)
        if (widthDiff < 10 && heightDiff < 10) {
            return;
        }
        
        // Cancelar timer anterior
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        
        // Para cambios dentro del mismo breakpoint, aplicar debounce
        debounceTimerRef.current = setTimeout(() => {
            if (widthDiff > 20 || heightDiff > 20) {
                setStableDimensions(rawDimensions);
                lastDimensionsRef.current = rawDimensions;
            }
        }, 150); // 150ms debounce solo para cambios menores
        
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [rawDimensions.width, rawDimensions.height, breakpointCategory]);
    
    // ── Valores memoizados ────────────────────────────────────
    const responsiveValues = useMemo(() => {
        const { width, height } = stableDimensions;
        
        // Safe area real
        const safeHeight = height - insets.top - insets.bottom;
        const usableHeight = safeHeight - NAVBAR_H - FOOTER_H;
        
        // Breakpoint flags
        const isSmall = width < BREAKPOINTS.SMALL;
        const isMedium = width >= BREAKPOINTS.SMALL && width < BREAKPOINTS.MEDIUM;
        const isLarge = width >= BREAKPOINTS.LARGE;
        
        // Scales
        const widthScale = width / BASE_W;
        const heightScale = usableHeight / BASE_H;
        
        // Mezcla progresiva
        let scale = (widthScale * 0.72) + (heightScale * 0.28);
        
        // Móvil conserva más el diseño original
        if (isSmall) {
            scale *= 0.98;
        }
        
        // Límites suaves
        scale = Math.max(0.82, Math.min(scale, 1.22));
        
        // Font scale calculation
        let fontScale;
        if (width <= 320) {
            fontScale = 0.88;
        } else if (width < BREAKPOINTS.SMALL) {
            const t = (width - 320) / (BREAKPOINTS.SMALL - 320);
            fontScale = 0.88 + (t * (1.0 - 0.88));
        } else if (width < BREAKPOINTS.MEDIUM) {
            const t = (width - BREAKPOINTS.SMALL) / (BREAKPOINTS.MEDIUM - BREAKPOINTS.SMALL);
            fontScale = 1.0 + (t * (1.05 - 1.0));
        } else {
            const t = Math.min((width - BREAKPOINTS.MEDIUM) / (1440 - BREAKPOINTS.MEDIUM), 1);
            fontScale = 1.05 + (t * (1.1 - 1.05));
        }
        
        fontScale *= Math.min(scale * 1.02, 1.05);
        fontScale = Math.max(0.88, Math.min(fontScale, 1.12));
        
        return {
            width,
            height,
            usableHeight,
            insets,
            scale,
            fontScale,
            isSmall,
            isMedium,
            isLarge,
            isPortrait: height >= width,
            isLandscape: width > height,
            breakpointCategory,
        };
    }, [stableDimensions, insets, breakpointCategory]);
    
    // ── Helper functions (memoizadas) ─────────────────────────
    const fs = useCallback((base) => {
        return Math.round(PixelRatio.roundToNearestPixel(base * responsiveValues.fontScale));
    }, [responsiveValues.fontScale]);
    
    const sp = useCallback((base) => {
        return Math.round(PixelRatio.roundToNearestPixel(base * responsiveValues.scale));
    }, [responsiveValues.scale]);
    
    const vp = useCallback((percent) => {
        return Math.round((responsiveValues.usableHeight * percent) / 100);
    }, [responsiveValues.usableHeight]);
    
    // ── Context value (memoizado) ─────────────────────────────
    const contextValue = useMemo(() => ({
        ...responsiveValues,
        fs,
        sp,
        vp,
    }), [responsiveValues, fs, sp, vp]);
    
    return (
        <ResponsiveContext.Provider value={contextValue}>
            {children}
        </ResponsiveContext.Provider>
    );
}

// ── Hook para consumir el contexto ────────────────────────────
export function useResponsive() {
    const context = useContext(ResponsiveContext);
    
    if (!context) {
        throw new Error("useResponsive debe usarse dentro de un ResponsiveProvider");
    }
    
    return context;
}
