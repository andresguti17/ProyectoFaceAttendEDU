import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { generateTheme } from "../../../../core/theme/generateTheme";
import { 
    DEFAULT_VISION_MODE, 
    getInitialCustomColors,
    getDefaultColorsForVision,
    SEMANTIC_SLOTS,
    DEFAULT_MODE,
} from "../../../../core/theme/presets";
import { evaluateColor } from "../../../../core/utils/colorUtils";
import { Divider } from "../../common";
import { VisionModeTabs } from "./VisionModeTabs";
import { ColorPresetSelector } from "./ColorPresetSelector";
import { ColorPickerPanel } from "./ColorPickerPanel";
import { ThemePreview } from "./ThemePreview";
import { ModeSelector } from "./ModeSelector";

/**
 * AccentColorSelector
 * 
 * Editor de paleta de colores con preview aislado:
 * - Lee estado inicial desde ThemeContext (appliedColors, visionMode, mode)
 * - Cambios solo afectan el PREVIEW (no la UI global)
 * - Padre llama saveChanges() registrado para aplicar colores, modo y visión a toda la UI
 * - Reset completo/individual y descarte funcionan solo en estado local
 * - Edición con picker de color basado 100% en HEX/RGB - NO usa HSL
 * 
 * Props opcionales:
 * - onColorsExport: (customColors) => void - [DEPRECADO] Callback para exportar
 * - onHasChanges: (hasChanges: boolean) => void - Notifica cambios sin guardar
 * - onDiscardRegister: (discardFn) => void - Registra función de descarte
 * - onSaveSuccessRegister: (saveFn) => void - Registra función de guardado
 */
export function AccentColorSelector({ onColorsExport, onHasChanges, onDiscardRegister, onSaveSuccessRegister }) {
    const { t } = useTranslation();
    const { 
        theme, 
        mode: contextMode,
        appliedColors, 
        visionMode: contextVisionMode, 
        clearPreview,
        applyColors,
        setMode: setContextMode,
        setVisionMode: setContextVisionMode 
    } = useTheme();
    const c = theme.colors;

    // ── Estado local para edición (NO afecta la UI global hasta guardar) ──
    const [customColors, setCustomColors] = useState(() => appliedColors || getInitialCustomColors());
    const [initialColors, setInitialColors] = useState(() => appliedColors || getInitialCustomColors()); // Para "Descartar cambios"
    const [visionMode, setVisionMode] = useState(() => contextVisionMode || DEFAULT_VISION_MODE);
    const [initialVisionMode, setInitialVisionMode] = useState(() => contextVisionMode || DEFAULT_VISION_MODE);
    const [mode, setMode] = useState(() => contextMode || "light");
    const [initialMode, setInitialMode] = useState(() => contextMode || "light");
    const [selectedSemantic, setSelectedSemantic] = useState("primary");

    // ── Sincronizar con ThemeContext al montar ──
    useEffect(() => {
        if (appliedColors) {
            setCustomColors(appliedColors);
            setInitialColors(appliedColors);
        }
        if (contextVisionMode) {
            setVisionMode(contextVisionMode);
            setInitialVisionMode(contextVisionMode);
        }
        if (contextMode) {
            setMode(contextMode);
            setInitialMode(contextMode);
        }
    }, []);

    // ── Color actualmente en edición (NO se sincroniza automáticamente con customColors) ──
    const currentColor = customColors[visionMode]?.[selectedSemantic] || "#286FE2";
    
    const verdict = evaluateColor(currentColor, t);

    // ── Sincronizar cuando el usuario cambia de slot/visión manualmente ─────────
    // NO incluir customColors para evitar sincronización automática innecesaria
    useEffect(() => {
        // Este efecto solo sirve para forzar re-render cuando cambia el slot
        // El ColorPickerPanel extrae sus valores directamente desde currentColor
    }, [visionMode, selectedSemantic]);

    // ── Generar tema de preview COMPLETAMENTE local (sin tocar ThemeContext) ──
    const localPreviewTheme = useMemo(() => {
        const currentColors = customColors[visionMode] || {};
        return generateTheme(currentColors, mode);
    }, [customColors, visionMode, mode]);

    // Usar SOLO el tema local para el preview (ignorar previewTheme del contexto)
    const effectivePreviewTheme = localPreviewTheme;

    // NO sincronizar con ThemeContext - el preview es completamente local

    // ── Exportar cambios al padre cuando se actualizan ────────
    useEffect(() => {
        if (onColorsExport) {
            onColorsExport(customColors);
        }
    }, [customColors, onColorsExport]);

    // ── Detectar si hay cambios sin guardar (incluye modo y visión) ───────────────────
    const hasChanges = useMemo(() => {
        const colorsChanged = JSON.stringify(customColors) !== JSON.stringify(initialColors);
        const visionChanged = visionMode !== initialVisionMode;
        const modeChanged = mode !== initialMode;
        return colorsChanged || visionChanged || modeChanged;
    }, [customColors, initialColors, visionMode, initialVisionMode, mode, initialMode]);

    // ── Detectar si el slot actual difiere del último guardado ─
    const currentSlotHasChanges = useMemo(() => {
        const currentValue = customColors[visionMode]?.[selectedSemantic];
        const savedValue = initialColors[visionMode]?.[selectedSemantic];
        return currentValue !== savedValue;
    }, [customColors, initialColors, visionMode, selectedSemantic]);

    // ── Detectar si la paleta actual difiere de los valores originales/default ─
    const isDifferentFromDefault = useMemo(() => {
        const defaultColors = getDefaultColorsForVision(visionMode);
        const currentVisionColors = customColors[visionMode] || {};
        return JSON.stringify(currentVisionColors) !== JSON.stringify(defaultColors);
    }, [customColors, visionMode]);

    // ── Notificar al padre sobre cambios ──────────────────────
    useEffect(() => {
        if (onHasChanges) {
            onHasChanges(hasChanges);
        }
    }, [hasChanges, onHasChanges]);

    // ── Registrar función de descarte en el padre ─────────────
    useEffect(() => {
        if (onDiscardRegister) {
            onDiscardRegister(discardChanges);
        }
    }, [onDiscardRegister, initialColors, initialVisionMode, initialMode]);

    // ── Registrar función de commit (actualizar initialColors, initialMode, initialVisionMode) ─
    useEffect(() => {
        if (onSaveSuccessRegister) {
            onSaveSuccessRegister(saveChanges());
        }
    }, [onSaveSuccessRegister, customColors, mode, visionMode, applyColors, setContextMode, setContextVisionMode]);

    // ── Handlers ──────────────────────────────────────────────
    function handleColorChange(newHex) {
        const updatedColors = {
            ...customColors,
            [visionMode]: {
                ...customColors[visionMode],
                [selectedSemantic]: newHex,
            },
        };
        setCustomColors(updatedColors);
        // NO sincronizar con ThemeContext aquí - solo actualizar preview via useEffect
    }

    function handleVisionModeChange(newVisionMode) {
        setVisionMode(newVisionMode);
        // NO actualizar en ThemeContext - solo cambiar el estado local para el preview
    }

    function handleModeChange(newMode) {
        setMode(newMode);
        // NO actualizar en ThemeContext - solo cambiar el estado local para el preview
    }

    function applyPreset(preset) {
        // Al hacer clic en un slot de la barra, seleccionarlo para edición
        setSelectedSemantic(preset.semantic);
    }

    function resetCurrentSlot() {
        // Restaurar al último valor guardado (initialColors), no al default
        const savedColor = initialColors[visionMode]?.[selectedSemantic];
        if (!savedColor) return;
        
        handleColorChange(savedColor);
    }

    function resetAllPalette() {
        // Resetear TODA la paleta a valores originales/default
        const updatedColors = {
            ...customColors,
            [visionMode]: getDefaultColorsForVision(visionMode),
        };
        setCustomColors(updatedColors);
    }

    function discardChanges() {
        setCustomColors({ ...initialColors });
        setVisionMode(initialVisionMode);
        setMode(initialMode);
        // Restaurar en ThemeContext
        setContextVisionMode(initialVisionMode);
        setContextMode(initialMode);
        clearPreview(); // Limpiar preview en ThemeContext
    }

    // ── Función para guardar (se registra en el padre) ──
    function saveChanges() {
        // Esta función será llamada por el padre cuando se presione "Guardar cambios"
        return async () => {
            await applyColors(customColors);
            await setContextMode(mode);
            await setContextVisionMode(visionMode);
            setInitialColors({ ...customColors });
            setInitialMode(mode);
            setInitialVisionMode(visionMode);
        };
    }

    // Obtener info del slot actual
    const currentSlot = SEMANTIC_SLOTS.find(s => s.key === selectedSemantic);

    return (
        <View style={{ gap: 16 }}>
            {/* Selector de modo claro/oscuro */}
            <View style={{ gap: 8 }}>
                <Text style={{ 
                    fontSize: 14, 
                    fontWeight: "600", 
                    color: c.text.secondary 
                }}>
                    {t("Modo de visualización")}
                </Text>
                <ModeSelector 
                    mode={mode} 
                    onModeChange={handleModeChange}
                />
            </View>

            {/* Tabs de visión */}
            <VisionModeTabs 
                visionMode={visionMode} 
                onVisionModeChange={handleVisionModeChange} 
            />

            {/* Selector de presets (barra de colores) */}
            <ColorPresetSelector 
                visionMode={visionMode} 
                customColors={customColors[visionMode] || {}}
                selectedSemantic={selectedSemantic}
                onPresetSelect={applyPreset} 
            />

            {/* Vista previa en vivo */}
            {effectivePreviewTheme && (
                <View style={{ gap: 8, marginBottom: -2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ 
                            fontSize: 13, 
                            fontWeight: "600", 
                            color: c.text.secondary 
                        }}>
                            {t("Vista previa en vivo")}
                        </Text>
                        {isDifferentFromDefault && (
                            <TouchableOpacity
                                onPress={resetAllPalette}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    paddingHorizontal: 10,
                                    borderRadius: 8,
                                    backgroundColor: c.background.tertiary,
                                }}
                            >
                                <Feather name="refresh-cw" size={14} color={c.text.secondary} />
                                <Text style={{ fontSize: 13, color: c.text.secondary, fontWeight: "500" }}>
                                    {t("Restablecer paleta")}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <ThemePreview previewTheme={effectivePreviewTheme} hasChanges={hasChanges} />
                </View>
            )}

            <Divider />

            {/* Información del slot actual */}
            <View style={{ gap: 6, marginTop: -8, marginBottom: -4}}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ 
                        fontSize: 14, 
                        fontWeight: "600", 
                        color: c.text.primary 
                    }}>
                        {t(currentSlot?.label || "Slot")}
                    </Text>
                    {currentSlotHasChanges && (
                        <TouchableOpacity
                            onPress={resetCurrentSlot}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                paddingHorizontal: 8,
                                borderRadius: 6,
                                backgroundColor: c.background.tertiary,
                            }}
                        >
                            <Feather name="rotate-ccw" size={14} color={c.text.secondary} />
                            <Text style={{ fontSize: 13, color: c.text.secondary }}>
                                {t("Restablecer")}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                <Text style={{ 
                    fontSize: 13, 
                    color: c.text.tertiary,
                    lineHeight: 20,
                }}>
                    {t(currentSlot?.description || "")}
                </Text>
            </View>

            {/* Panel de selector de color completo (incluye input HEX y evaluador) */}
            <ColorPickerPanel 
                currentHex={currentColor}
                onColorChange={handleColorChange}
                verdict={verdict}
            />
        </View>
    );
}
