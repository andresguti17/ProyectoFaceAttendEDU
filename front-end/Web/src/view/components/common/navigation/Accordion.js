import React, { useState } from "react";
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Accordion/Collapsible component para mostrar/ocultar contenido
 * 
 * Componente de acordeón con expansión/colapso animado. Soporta
 * expansión simple (solo uno abierto) o múltiple (varios abiertos).
 * 
 * @param {Array} items - Array de items: [{ key, title, content, icon? }]
 * @param {string|Array} expanded - Key(s) del/los item(s) expandido(s)
 * @param {function} onChange - Callback al cambiar expansión
 * @param {boolean} multiple - Permitir múltiples items expandidos
 * @param {('default'|'bordered'|'separated')} variant - Estilo visual
 * @param {ReactNode} icon - Icono de expand/collapse (default: chevron)
 * @param {boolean} disabled - Si está deshabilitado
 * @param {object} style - Estilos adicionales
 * 
 * @example
 * // Accordion básico (single expansion)
 * const [expanded, setExpanded] = useState(null);
 * <Accordion
 *   items={[
 *     { key: '1', title: 'Sección 1', content: <Text>Contenido 1</Text> },
 *     { key: '2', title: 'Sección 2', content: <Text>Contenido 2</Text> },
 *   ]}
 *   expanded={expanded}
 *   onChange={setExpanded}
 * />
 * 
 * @example
 * // Accordion con múltiple expansión
 * const [expanded, setExpanded] = useState([]);
 * <Accordion
 *   items={items}
 *   expanded={expanded}
 *   onChange={setExpanded}
 *   multiple
 * />
 * 
 * @example
 * // FAQ Accordion
 * <Accordion
 *   variant="bordered"
 *   items={[
 *     {
 *       key: 'faq1',
 *       title: '¿Cómo registro asistencia?',
 *       content: <Text>Instrucciones detalladas...</Text>
 *     },
 *     {
 *       key: 'faq2',
 *       title: '¿Cómo genero reportes?',
 *       content: <Text>Pasos para generar reportes...</Text>
 *     }
 *   ]}
 *   expanded={expandedFaq}
 *   onChange={setExpandedFaq}
 * />
 * 
 * @example
 * // Con iconos custom
 * <Accordion
 *   items={[
 *     { key: '1', title: 'General', icon: 'settings', content: <Settings /> },
 *     { key: '2', title: 'Notificaciones', icon: 'bell', content: <Notifications /> }
 *   ]}
 *   expanded={expanded}
 *   onChange={setExpanded}
 * />
 */
export function Accordion({
  items = [],
  expanded,
  onChange,
  multiple = false,
  variant = "default",
  icon,
  disabled = false,
  style,
}) {
  const { theme } = useTheme();

  const isExpanded = (key) => {
    if (multiple) {
      return Array.isArray(expanded) && expanded.includes(key);
    }
    return expanded === key;
  };

  const handleToggle = (key) => {
    if (disabled) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (multiple) {
      const currentExpanded = Array.isArray(expanded) ? expanded : [];
      const newExpanded = currentExpanded.includes(key)
        ? currentExpanded.filter((k) => k !== key)
        : [...currentExpanded, key];
      onChange(newExpanded);
    } else {
      onChange(expanded === key ? null : key);
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "bordered":
        return {
          container: {
            borderWidth: 1,
            borderColor: theme.colors.border.primary,
            borderRadius: DESIGN_TOKENS.borderRadius.lg,
            overflow: "hidden",
          },
          item: {
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border.primary,
          },
        };
      case "separated":
        return {
          container: {},
          item: {
            marginBottom: DESIGN_TOKENS.spacing.sm,
            borderWidth: 1,
            borderColor: theme.colors.border.primary,
            borderRadius: DESIGN_TOKENS.borderRadius.lg,
            overflow: "hidden",
          },
        };
      case "default":
      default:
        return {
          container: {},
          item: {
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border.primary,
          },
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <View style={[styles.accordion, variantStyles.container, style]}>
      {items.map((item, index) => {
        const itemExpanded = isExpanded(item.key);
        const isLast = index === items.length - 1;

        return (
          <View
            key={item.key}
            style={[
              variantStyles.item,
              isLast && variant === "default" && styles.lastItem,
            ]}
          >
            {/* Header */}
            <TouchableOpacity
              onPress={() => handleToggle(item.key)}
              disabled={disabled}
              style={[
                styles.header,
                {
                  backgroundColor: itemExpanded
                    ? theme.colors.background.hover
                    : "transparent",
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ expanded: itemExpanded }}
              accessibilityLabel={item.title}
            >
              {item.icon && (
                <Feather
                  name={item.icon}
                  size={20}
                  color={theme.colors.text.primary}
                  style={styles.itemIcon}
                />
              )}
              <Text
                style={[
                  styles.title,
                  { color: theme.colors.text.primary },
                  itemExpanded && styles.titleExpanded,
                ]}
              >
                {item.title}
              </Text>
              <Feather
                name={itemExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={theme.colors.text.secondary}
              />
            </TouchableOpacity>

            {/* Content */}
            {itemExpanded && (
              <View
                style={[
                  styles.content,
                  { backgroundColor: theme.colors.background.surface },
                ]}
              >
                {typeof item.content === "string" ? (
                  <Text style={{ color: theme.colors.text.secondary }}>
                    {item.content}
                  </Text>
                ) : (
                  item.content
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Accordion.Item - Item individual de accordion (para uso avanzado)
 * 
 * @example
 * <Accordion.Item
 *   title="Custom Item"
 *   expanded={isExpanded}
 *   onToggle={() => setExpanded(!isExpanded)}
 * >
 *   <Text>Contenido custom</Text>
 * </Accordion.Item>
 */
Accordion.Item = function AccordionItem({
  title,
  expanded,
  onToggle,
  icon,
  disabled = false,
  children,
  style,
}) {
  const { theme } = useTheme();

  const handleToggle = () => {
    if (disabled) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  return (
    <View style={[styles.singleItem, style]}>
      <TouchableOpacity
        onPress={handleToggle}
        disabled={disabled}
        style={[
          styles.header,
          {
            backgroundColor: expanded
              ? theme.colors.background.hover
              : "transparent",
          },
        ]}
      >
        {icon && (
          <Feather
            name={icon}
            size={20}
            color={theme.colors.text.primary}
            style={styles.itemIcon}
          />
        )}
        <Text
          style={[
            styles.title,
            { color: theme.colors.text.primary },
            expanded && styles.titleExpanded,
          ]}
        >
          {title}
        </Text>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.colors.text.secondary}
        />
      </TouchableOpacity>

      {expanded && (
        <View
          style={[
            styles.content,
            { backgroundColor: theme.colors.background.surface },
          ]}
        >
          {children}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  accordion: {
    width: "100%",
  },
  singleItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: DESIGN_TOKENS.spacing.md,
  },
  itemIcon: {
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  titleExpanded: {
    fontWeight: "700",
  },
  content: {
    padding: DESIGN_TOKENS.spacing.md,
    paddingTop: 0,
  },
});

export default Accordion;
