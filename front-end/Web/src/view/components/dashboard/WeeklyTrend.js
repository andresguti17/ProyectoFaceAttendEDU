// ============================================================
//  WeeklyTrend — Selector de tendencia semanal de asistencia
// ============================================================
//  Componente específico del Dashboard que muestra tendencia
//  de asistencia semanal con barras de progreso clickeables
//
//  Funcionalidad:
//  - Muestra últimas N semanas con su tasa de asistencia
//  - Permite seleccionar una semana para ver detalles diarios
//  - Calcula y muestra tendencia general
//  - Colores dinámicos según rendimiento
//  - Genérico: funciona para admin, teacher y student
//  - Adaptado a períodos académicos (Anual, Semestral, Cuatrimestral, Trimestral)
// ============================================================

import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ProgressBar } from "../common/charts/ProgressBar";
import { AnimatedDropdown } from "../common/animation/AnimatedDropdown";
import { useTheme } from "../hooks/useTheme";
import { 
    ACADEMIC_PERIOD_TYPES, 
    getAcademicPeriodConfig,
    DEFAULT_ACADEMIC_PERIOD,
    getYearAcademicPeriodsByMonth,
    getCurrentPeriod,
    formatPeriodLabel,
    getCurrentAcademicWeek,
} from "../../../core/constants/academicPeriods";

/**
 * Selector de tendencia semanal de asistencia (genérico, adaptable por rol)
 * 
 * @param {Array} data - Datos semanales: [{ week, rate, dailyData: [{ day, present, late, absent }] }]
 * @param {number} maxWeeks - Número máximo de semanas a mostrar (default: 5)
 * @param {boolean} showTrend - Mostrar indicador de tendencia (default: true)
 * @param {boolean} colorByPerformance - Colorear según rendimiento (default: false)
 * @param {Function} onWeekSelect - Callback al seleccionar una semana (recibe weekData)
 * @param {string} selectedWeek - Semana actualmente seleccionada
 * @param {string} academicPeriod - Tipo de período académico (annual, semestral, quarterly, trimestral)
 *                                   TODO: Esto vendrá de Settings en el futuro
 * @param {Function} onPeriodChange - Callback cuando cambia el período seleccionado (recibe period object)
 * @param {string} title - Título del componente (default: "Tendencia semanal")
 * @param {Function} t - Función de traducción (opcional)
 */
export function WeeklyTrend({ 
    data = [], 
    maxWeeks = 5, 
    showTrend = true,
    colorByPerformance = false,
    onWeekSelect,
    selectedWeek,
    academicPeriod = DEFAULT_ACADEMIC_PERIOD, // TODO: Obtener de Settings
    onPeriodChange,
    title,
    t = (key) => key, // Fallback si no se pasa traducción
}) {
    const { theme } = useTheme();
    const c = theme.colors;
    
    // Obtener año actual
    const currentYear = new Date().getFullYear();
    
    // Obtener todos los períodos del año vigente
    const yearPeriods = getYearAcademicPeriodsByMonth(academicPeriod, currentYear);
    
    // Encontrar el período actual dentro de yearPeriods
    const currentPeriodFromList = React.useMemo(() => {
        return yearPeriods.find(p => p.isCurrent) || yearPeriods[0];
    }, [yearPeriods]);
    
    // Período seleccionado (default: período actual de la lista)
    const [selectedPeriod, setSelectedPeriod] = useState(currentPeriodFromList);
    
    // Ref para trackear el tipo de período anterior
    const prevAcademicPeriodRef = React.useRef(academicPeriod);
    
    // Estado para el offset de paginación (cuántas semanas hacia atrás mostrar)
    const [weekOffset, setWeekOffset] = useState(0);

    // Calcular semana actual del AÑO (no del período)
    const currentWeekOfYear = React.useMemo(() => {
        const today = new Date();
        const yearStart = new Date(today.getFullYear(), 0, 1);
        return getCurrentAcademicWeek(yearStart, today);
    }, []);

    // Generar todas las semanas del período con datos mockeados o reales
    const fullPeriodData = React.useMemo(() => {
        if (!selectedPeriod) return [];
        
        const weeks = [];
        const isPast = selectedPeriod.isPast;
        const isCurrent = selectedPeriod.isCurrent;
        
        // Determinar hasta qué semana mostrar
        let maxWeekToShow;
        if (isPast) {
            // Período pasado: mostrar todas las semanas
            maxWeekToShow = selectedPeriod.endWeek;
        } else if (isCurrent) {
            // Período actual: solo hasta la semana actual del año
            maxWeekToShow = currentWeekOfYear;
        } else {
            // Período futuro: no mostrar nada
            maxWeekToShow = 0;
        }
        
        // Días de la semana laborables
        const daysOfWeek = ["Lun", "Mar", "Mié", "Jue", "Vie"];
        
        // Generar array de semanas con datos del backend o placeholders
        for (let weekNumber = selectedPeriod.startWeek; weekNumber <= maxWeekToShow && weekNumber <= selectedPeriod.endWeek; weekNumber++) {
            const weekLabel = `Sem ${weekNumber}`;
            
            // Buscar si hay datos reales para esta semana
            const realData = data.find(d => d.week === weekLabel);
            
            if (realData) {
                // Usar datos reales del backend
                weeks.push(realData);
            } else {
                // Crear placeholder con valores vacíos/cero pero con dailyData correcto
                weeks.push({
                    week: weekLabel,
                    rate: 0,
                    dailyData: daysOfWeek.map(day => ({
                        day,
                        present: 0,
                        late: 0,
                        absent: 0,
                    })),
                    isEmpty: true, // Flag para identificar datos vacíos
                });
            }
        }
        
        return weeks;
    }, [selectedPeriod, data, currentWeekOfYear]);

    // Calcular rango de semanas disponibles
    const availableWeeksCount = fullPeriodData.length;
    
    // Calcular índices para el slice de datos
    const endIndex = availableWeeksCount - weekOffset;
    const startIndex = Math.max(0, endIndex - maxWeeks);
    
    // Datos visibles actuales
    const visibleData = fullPeriodData.slice(startIndex, endIndex);
    
    // Calcular el número final de semana visible (para el contador)
    const lastVisibleWeekIndex = endIndex;
    
    // Verificar si hay más semanas disponibles para navegar
    const canGoBack = startIndex > 0;
    const canGoForward = weekOffset > 0;

    // Actualizar el período seleccionado SOLO cuando cambia el tipo de período académico
    React.useEffect(() => {
        // Solo actualizar si el tipo de período realmente cambió
        if (prevAcademicPeriodRef.current !== academicPeriod) {
            const newCurrentPeriod = yearPeriods.find(p => p.isCurrent) || yearPeriods[0];
            if (newCurrentPeriod) {
                setSelectedPeriod(newCurrentPeriod);
                setWeekOffset(0); // Resetear a las semanas más recientes
            }
            prevAcademicPeriodRef.current = academicPeriod;
        }
    }, [academicPeriod, yearPeriods]);
    
    // Resetear offset cuando cambia el período seleccionado
    React.useEffect(() => {
        setWeekOffset(0);
    }, [selectedPeriod]);
    
    // Handlers de navegación
    const handlePrevious = () => {
        if (canGoBack) {
            setWeekOffset(prev => Math.min(prev + maxWeeks, availableWeeksCount - maxWeeks));
        }
    };
    
    const handleNext = () => {
        if (canGoForward) {
            setWeekOffset(prev => Math.max(0, prev - maxWeeks));
        }
    };

    // Obtener configuración del período académico
    const periodConfig = getAcademicPeriodConfig(academicPeriod);

    // Calcular tendencia (comparación última vs primera semana visible)
    const trendDirection = visibleData.length >= 2 
        ? visibleData[visibleData.length - 1].rate - visibleData[0].rate
        : 0;

    // Función para obtener color según rendimiento
    const getColorByRate = (rate) => {
        if (!colorByPerformance) return c.brand.primary;
        if (rate >= 90) return c.status.success;
        if (rate >= 75) return c.status.warning;
        return c.status.danger;
    };

    // Determinar si es interactivo
    const isInteractive = !!onWeekSelect;

    // Handler para cambio de período
    const handlePeriodSelect = (periodId) => {
        const period = yearPeriods.find(p => p.id === periodId);
        if (period) {
            setSelectedPeriod(period);
            if (onPeriodChange) {
                onPeriodChange(period);
            }
        }
    };

    // Preparar items del dropdown con descripción de semanas e indicador de período actual
    const dropdownItems = yearPeriods.map(period => ({
        value: period.id,
        label: period.isCurrent 
            ? `${formatPeriodLabel(period, academicPeriod)} • Actual`
            : formatPeriodLabel(period, academicPeriod),
        description: `Semanas ${period.startWeek}-${period.endWeek}`,
    }));

    // Generar subtítulo dinámico: "Por periodo academico (Primer Semestre)"
    const dynamicSubtitle = periodConfig && selectedPeriod 
        ? `Por periodo academico (${selectedPeriod.label})`
        : "";

    return (
        <View style={{ gap: 8 }}>
            {/* Header con título y dropdown */}
            <View style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 8,
                gap: 12,
            }}>
                {/* Título y subtítulo dinámico (izquierda) */}
                <View style={{ flex: 1 }}>
                    {title && (
                        <Text style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: c.text.primary,
                            marginBottom: 4,
                        }}>
                            {title}
                        </Text>
                    )}
                    {/* Subtítulo dinámico: "Primer Semestre (Semestral) • Selecciona para ver detalles" */}
                    <Text style={{
                        fontSize: 12,
                        color: c.text.secondary,
                    }}>
                        {dynamicSubtitle}
                    </Text>
                </View>

                {/* Dropdown de período (derecha) */}
                {periodConfig && selectedPeriod && (
                    <View style={{ width: 200, marginTop: -2 }}>
                        <AnimatedDropdown
                            items={dropdownItems}
                            value={selectedPeriod.id}
                            onSelect={handlePeriodSelect}
                            placeholder="Selecciona período"
                            triggerHeight={36}
                            maxVisible={6}
                        />
                    </View>
                )}
            </View>

            {/* Info dinámica del período seleccionado */}
            {periodConfig && selectedPeriod && (
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: c.border.default + "40",
                }}>
                    <Text style={{
                        fontSize: 10,
                        color: c.text.tertiary,
                    }}>
                        {periodConfig.label} • {selectedPeriod.startWeek}-{selectedPeriod.endWeek} semanas
                    </Text>
                    <Text style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: selectedPeriod.isCurrent ? c.brand.primary : c.text.secondary,
                    }}>
                        {lastVisibleWeekIndex} / {availableWeeksCount}
                    </Text>
                </View>
            )}

            {/* Lista de semanas */}
            {visibleData.map((item, index) => {
                const isSelected = selectedWeek === item.week;
                const isEmpty = item.isEmpty; // Flag para semanas sin datos
                const barColor = isEmpty ? c.border.primary : getColorByRate(item.rate);

                const WeekContainer = isInteractive ? TouchableOpacity : View;

                return (
                    <WeekContainer
                        key={`${item.week}-${index}`}
                        onPress={isInteractive ? () => onWeekSelect(item) : undefined}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            paddingVertical: 4,
                            paddingHorizontal: 8,
                            marginHorizontal: -8,
                            borderRadius: 6,
                            backgroundColor: isSelected 
                                ? c.brand.primary + "10" 
                                : "transparent",
                            borderLeftWidth: isSelected ? 3 : 0,
                            borderLeftColor: c.brand.primary,
                            cursor: isInteractive ? "pointer" : "default",
                        }}
                    >
                        {/* Etiqueta de semana */}
                        <Text style={{
                            fontSize: 11,
                            fontWeight: isSelected ? "700" : "600",
                            color: isSelected 
                                ? c.brand.primary 
                                : c.text.primary,
                            width: 50,
                            textAlign: "right",
                        }}>
                            {item.week}
                        </Text>

                        {/* Barra de progreso */}
                        <View style={{ flex: 1 }}>
                            <ProgressBar
                                value={item.rate}
                                color={barColor}
                                size="sm"
                            />
                        </View>

                        {/* Porcentaje o indicador de sin datos */}
                        <Text style={{
                            fontSize: 11,
                            fontWeight: isSelected ? "700" : "600",
                            color: isEmpty ? c.text.disabled : colorByPerformance ? barColor : c.text.primary,
                            width: 40,
                            textAlign: "right",
                        }}>
                            {isEmpty ? "—" : `${item.rate}%`}
                        </Text>

                        {/* Indicador de selección */}
                        {isSelected && (
                            <View style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: c.brand.primary,
                            }} />
                        )}
                    </WeekContainer>
                );
            })}

            {/* Indicador de tendencia con botones de navegación */}
            {showTrend && visibleData.length >= 2 && (
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 8,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: c.border.default,
                }}>
                    {/* Botón anterior */}
                    <TouchableOpacity
                        onPress={handlePrevious}
                        disabled={!canGoBack}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: canGoBack ? c.brand.primaryLight : c.background.secondary,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: canGoBack ? 1 : 0.4,
                        }}
                    >
                        <Feather
                            name="chevron-left"
                            size={16}
                            color={canGoBack ? c.brand.primary : c.text.disabled}
                        />
                    </TouchableOpacity>

                    {/* Tendencia central */}
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                    }}>
                        <Text style={{
                            fontSize: 11,
                            color: c.text.secondary,
                            marginRight: 6,
                        }}>
                            Tendencia:
                        </Text>
                        <Text style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: trendDirection > 0 
                                ? c.status.success 
                                : trendDirection < 0 
                                ? c.status.danger 
                                : c.text.secondary,
                        }}>
                            {trendDirection > 0 ? "↑" : trendDirection < 0 ? "↓" : "→"} {Math.abs(trendDirection).toFixed(1)}%
                        </Text>
                    </View>

                    {/* Botón siguiente */}
                    <TouchableOpacity
                        onPress={handleNext}
                        disabled={!canGoForward}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: canGoForward ? c.brand.primaryLight : c.background.secondary,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: canGoForward ? 1 : 0.4,
                        }}
                    >
                        <Feather
                            name="chevron-right"
                            size={16}
                            color={canGoForward ? c.brand.primary : c.text.disabled}
                        />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

export default WeeklyTrend;
