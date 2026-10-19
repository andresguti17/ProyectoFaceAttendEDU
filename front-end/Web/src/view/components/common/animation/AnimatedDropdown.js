import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

const ITEM_HEIGHT = 40;
const SEARCH_HEIGHT = 56;

/**
 * Dropdown animado reutilizable
 * Se posiciona debajo del trigger; si no cabe en el viewport se
 * despliega hacia arriba (dropUp).
 * 
 * @param {Array} items - Items: [{ value, label, icon?, description?, prefix? }]
 * @param {*} value - Valor seleccionado
 * @param {function} onSelect - Callback al seleccionar
 * @param {string} label - Label/título del campo
 * @param {string} placeholder - Placeholder cuando no hay selección
 * @param {string} triggerIcon - Icono del trigger
 * @param {boolean} disabled - Si está deshabilitado
 * @param {boolean} error - Si hay error
 * @param {number} triggerHeight - Altura del trigger
 * @param {number} maxVisible - Máximo de items visibles
 * @param {boolean} searchable - Si permite búsqueda (default: false)
 * @param {string} searchPlaceholder - Placeholder del buscador
 * @param {function} renderTrigger - Custom render para el trigger (opcional)
 * @param {boolean} controlledOpen - Control externo del estado abierto/cerrado
 * @param {function} onOpenChange - Callback cuando cambia el estado abierto/cerrado
 */
export function AnimatedDropdown({
  items,
  value,
  onSelect,
  placeholder = "Seleccionar...",
  triggerIcon,
  disabled = false,
  error = false,
  triggerHeight = 40,
  triggerPadding,
  maxVisible = 6,
  searchable = false,
  searchPlaceholder = "Buscar...",
  renderTrigger,
  style,
  controlledOpen,
  onOpenChange,
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState(null);
  const [dropUp, setDropUp] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  // Si controlledOpen está presente, usar ese valor en lugar del estado interno
  const isOpen = controlledOpen !== undefined ? controlledOpen : open;

  // Sincronizar animación cuando controlledOpen cambia
  useEffect(() => {
    if (controlledOpen === true && !open) {
      // Cambió a controlado y abierto, necesitamos animar
      animateOpen();
    } else if (controlledOpen === false && open) {
      // Cambió a controlado y cerrado, necesitamos cerrar
      animateClose();
    }
  }, [controlledOpen]);

  // Filtrar items según búsqueda
  const filteredItems = searchable && searchQuery.trim()
    ? items.filter(item => {
        const q = searchQuery.toLowerCase();
        return (
          item.label?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.value?.toString().toLowerCase().includes(q)
        );
      })
    : items;

  const PANEL_HEIGHT = Math.min(filteredItems.length, maxVisible) * ITEM_HEIGHT + 
    (searchable && !(controlledOpen !== undefined && controlledOpen) ? SEARCH_HEIGHT : 0);

  const animateOpen = useCallback(() => {
    setSearchQuery("");
    
    // Primero medir ANTES de cambiar los estilos
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      // Si el panel no cabe debajo del trigger, se despliega hacia arriba.
      // Sin esto, dropdowns al final de un modal (p. ej. ficha/curso al
      // registrar docente) abrían su panel fuera del viewport y el usuario
      // no veía nada que seleccionar.
      const openHeight =
        Math.min(items.length, maxVisible) * ITEM_HEIGHT +
        (searchable && !(controlledOpen !== undefined && controlledOpen) ? SEARCH_HEIGHT : 0);
      const winHeight = Dimensions.get("window").height || 0;
      const fitsBelow = !winHeight || y + height + openHeight <= winHeight;
      const fitsAbove = !winHeight || y >= openHeight;
      setDropUp(!fitsBelow && fitsAbove);
      setTriggerRect({ x, y, width, height });
      
      // Luego cambiar estado y animar
      if (controlledOpen === undefined) {
        setOpen(true);
      } else if (onOpenChange) {
        onOpenChange(true);
      }
      
      Animated.timing(dropdownAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start(() => {
        // Auto-focus en el buscador SOLO si NO está controlado externamente como abierto
        if (searchable && !(controlledOpen !== undefined && controlledOpen)) {
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }
      });
    });
  }, [dropdownAnim, searchable, controlledOpen, onOpenChange, items.length, maxVisible]);

  const animateClose = useCallback(() => {
    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: false,
    }).start(() => {
      if (controlledOpen === undefined) {
        setOpen(false);
      } else if (onOpenChange) {
        onOpenChange(false);
      }
      setSearchQuery("");
    });
  }, [dropdownAnim, controlledOpen, onOpenChange]);

  const handleToggle = useCallback((force = false) => {
    if (disabled) return;
    
    // Si renderTrigger está presente y no es forzado, delegar la decisión
    if (renderTrigger && !force) {
      // renderTrigger decidirá si llamar handleToggle(true) o no
      return;
    }
    
    isOpen ? animateClose() : animateOpen();
  }, [isOpen, disabled, animateOpen, animateClose, renderTrigger]);

  const handleSelect = useCallback(
    (v) => {
      // Primero cerrar con animación
      animateClose();
      
      // Luego ejecutar onSelect después de que termine la animación
      setTimeout(() => {
        onSelect(v);
      }, 200); // Debe coincidir con la duración de animateClose
    },
    [onSelect, animateClose]
  );

  const panelHeight = dropdownAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, PANEL_HEIGHT],
  });

  const panelOpacity = dropdownAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 1, 1],
  });

  const selected = items.find((i) => i.value === value);
  const label = selected?.label ?? placeholder;

  const borderColor = error
    ? theme.colors.status.error
    : isOpen
    ? theme.colors.brand.primary
    : theme.colors.border.primary + '80'; // 50% opacidad en reposo

  // Función para renderizar el contenido del panel (reutilizable)
  const renderPanelContent = () => (
    <TouchableOpacity activeOpacity={1} style={{ width: '100%', flex: 1 }}>
      {/* Campo de búsqueda (opcional) - NO mostrar si es controlado externamente Y está abierto */}
      {searchable && !(controlledOpen !== undefined && controlledOpen) && (
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          margin: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border.primary,
          backgroundColor: theme.colors.background.app,
          width: 'auto',
        }}>
          <Feather name="search" size={13} color={theme.colors.text.secondary} />
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={theme.colors.text.secondary}
            style={{
              flex: 1,
              fontSize: 14,
              color: theme.colors.text.primary,
              paddingVertical: 0,
              paddingHorizontal: 0,
              minWidth: 0,
              // @ts-ignore — válido en web
              outlineStyle: "none",
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ padding: 2 }}
            >
              <Feather name="x" size={13} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ 
          maxHeight: Math.min(filteredItems.length, maxVisible) * ITEM_HEIGHT,
          width: '100%',
        }}
        contentContainerStyle={{ width: '100%' }}
      >
        {filteredItems.length === 0 && searchable ? (
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>
              Sin resultados
            </Text>
          </View>
        ) : (
          filteredItems.map((item, i) => {
            const active = value === item.value;
            const isLast = i === filteredItems.length - 1;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => handleSelect(item.value)}
                activeOpacity={0.7}
                style={[
                  styles.item,
                  {
                    backgroundColor: active
                      ? theme.colors.brand.primaryLight
                      : "transparent",
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: theme.colors.border.primary,
                    width: '100%',
                  },
                ]}
              >
                {item.prefix && (
                  <Text style={{ fontSize: 18, fontWeight: "600", flex: 1, textAlign: "center" }}>
                    {item.prefix}
                  </Text>
                )}
                {item.icon && !item.prefix && (
                  <Feather
                    name={item.icon}
                    size={13}
                    color={
                      active
                        ? theme.colors.brand.primary
                        : theme.colors.text.secondary
                    }
                  />
                )}
                {item.label && !item.prefix && (
                  <View style={[styles.itemLabel, { paddingRight: active ? 20 : 0, flex: 1, minWidth: 0 }]}>
                    <Text
                      style={[
                        styles.itemText,
                        {
                          fontWeight: active ? "600" : "400",
                          color: active
                            ? theme.colors.brand.primary
                            : theme.colors.text.primary,
                        },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.label}
                    </Text>
                    {item.description && (
                      <Text
                        style={[
                          styles.itemDescription,
                          { color: theme.colors.text.secondary },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.description}
                      </Text>
                    )}
                  </View>
                )}
                {active && (
                  <Feather
                    name="check"
                    size={14}
                    color={theme.colors.brand.primary}
                    style={{ position: "absolute", right: 8 }}
                  />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </TouchableOpacity>
  );

  return (
    <View style={[style, { position: 'relative', zIndex: controlledOpen !== undefined ? 10000 : 1 }]}>
      {/* Trigger */}
      <View ref={triggerRef} collapsable={false}>
        {renderTrigger ? (
          // Trigger personalizado - maneja su propia interacción
          renderTrigger({ selected, open, disabled, handleToggle, dropdownAnim })
        ) : (
          // Trigger por defecto
          <TouchableOpacity
            onPress={handleToggle}
            activeOpacity={0.8}
            style={[
              styles.trigger,
              {
                height: triggerHeight,
                borderWidth: 2, // SIEMPRE 2px para evitar "baile"
                borderColor,
                backgroundColor: isOpen
                  ? theme.colors.brand.primaryLight
                  : error
                  ? theme.colors.status.errorLight
                  : theme.colors.background.surface,
                borderBottomLeftRadius: isOpen ? 0 : DESIGN_TOKENS.borderRadius.lg,
                borderBottomRightRadius: isOpen ? 0 : DESIGN_TOKENS.borderRadius.lg,
                opacity: disabled ? 0.5 : 1,
                paddingHorizontal: triggerPadding ?? DESIGN_TOKENS.spacing.md,
              },
            ]}
          >
            {(triggerIcon || selected?.icon) && (
              <Feather
                name={triggerIcon ?? selected?.icon}
                size={14}
                color={
                  isOpen
                    ? theme.colors.brand.primary
                    : theme.colors.text.secondary
                }
              />
            )}
            {selected?.prefix && (
              <Text style={{ fontSize: 18, fontWeight: "600" }}>{selected.prefix}</Text>
            )}
            {!selected?.prefix && (
              <View style={styles.labelContainer}>
                <Text
                  style={[
                    styles.label,
                    {
                      fontWeight: selected ? "600" : "400",
                      color: isOpen
                        ? theme.colors.brand.primary
                        : selected
                        ? theme.colors.text.primary
                        : theme.colors.text.secondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            )}
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: dropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "180deg"],
                    }),
                  },
                ],
              }}
            >
              <Feather
                name="chevron-down"
                size={14}
                color={
                  isOpen
                    ? theme.colors.brand.primary
                    : theme.colors.text.secondary
                }
              />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>

      {/* Panel - Usando Modal cuando NO está controlado externamente como abierto */}
      {isOpen && triggerRect && !(controlledOpen !== undefined && controlledOpen) && (
        <Modal
          transparent
          animationType="none"
          visible={isOpen}
          onRequestClose={animateClose}
          statusBarTranslucent
        >
          {/* Overlay transparente para cerrar al hacer clic fuera */}
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={animateClose}
            pointerEvents="auto"
          >
            {/* Panel flotante - posicionado absolutamente */}
            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.panel,
                {
                  top: dropUp
                    ? dropdownAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [triggerRect.y, triggerRect.y - PANEL_HEIGHT],
                      })
                    : triggerRect.y + triggerRect.height,
                  left: triggerRect.x,
                  width: triggerRect.width, // Ancho fijo del trigger
                  minWidth: triggerRect.width, // Prevenir que se encoja
                  maxWidth: triggerRect.width, // Prevenir que se expanda
                  height: panelHeight,
                  opacity: panelOpacity,
                  borderTopWidth: dropUp ? 2 : 0,
                  borderBottomWidth: dropUp ? 0 : 2,
                  borderTopLeftRadius: dropUp ? DESIGN_TOKENS.borderRadius.lg : 0,
                  borderTopRightRadius: dropUp ? DESIGN_TOKENS.borderRadius.lg : 0,
                  borderBottomLeftRadius: dropUp ? 0 : DESIGN_TOKENS.borderRadius.lg,
                  borderBottomRightRadius: dropUp ? 0 : DESIGN_TOKENS.borderRadius.lg,
                  borderColor: theme.colors.brand.primary,
                  backgroundColor: theme.colors.background.surface,
                  ...DESIGN_TOKENS.shadows.lg,
                },
              ]}
            >
              {renderPanelContent()}
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Panel sin Modal - para uso controlado externamente (cuando controlledOpen es true) */}
      {isOpen && controlledOpen !== undefined && controlledOpen && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              overflow: 'hidden',
              borderWidth: 2,
              borderTopWidth: 0,
              borderBottomLeftRadius: DESIGN_TOKENS.borderRadius.lg,
              borderBottomRightRadius: DESIGN_TOKENS.borderRadius.lg,
              zIndex: 9999, // Z-index alto para superponerse a todo
              height: panelHeight,
              opacity: panelOpacity,
              borderColor: theme.colors.brand.primary,
              backgroundColor: theme.colors.background.surface,
              ...DESIGN_TOKENS.shadows.lg,
            },
          ]}
        >
          {renderPanelContent()}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
  },
  panel: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: DESIGN_TOKENS.borderRadius.lg,
    borderBottomRightRadius: DESIGN_TOKENS.borderRadius.lg,
    zIndex: DESIGN_TOKENS.zIndex.dropdown,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.sm,
    paddingLeft: 8,
    paddingRight: 8,
    height: ITEM_HEIGHT,
    position: "relative",
  },
  itemLabel: {
    flex: 1,
  },
  itemText: {
    fontSize: 14,
  },
  itemDescription: {
    fontSize: 12,
  },
});

export default AnimatedDropdown;
