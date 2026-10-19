import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Tabs component para navegación horizontal
 * 
 * Sistema de pestañas/tabs con múltiples variants de estilo y soporte
 * para navegación por contenido. Incluye scroll horizontal automático
 * para muchos tabs.
 * 
 * @param {Array} items - Array de tabs: [{ key, label, icon?, badge? }]
 * @param {string} activeTab - Key del tab activo
 * @param {function} onChange - Callback al cambiar tab (recibe key)
 * @param {('underline'|'pills'|'contained')} variant - Estilo de tabs
 * @param {('sm'|'md'|'lg')} size - Tamaño de tabs
 * @param {boolean} scrollable - Si debe hacer scroll horizontal
 * @param {object} style - Estilos adicionales del contenedor
 * 
 * @example
 * // Tabs básicos
 * const [activeTab, setActiveTab] = useState('tab1');
 * <Tabs
 *   items={[
 *     { key: 'tab1', label: 'General' },
 *     { key: 'tab2', label: 'Perfil' },
 *     { key: 'tab3', label: 'Configuración' }
 *   ]}
 *   activeTab={activeTab}
 *   onChange={setActiveTab}
 * />
 * 
 * @example
 * // Tabs con variant pills
 * <Tabs
 *   variant="pills"
 *   items={tabs}
 *   activeTab={active}
 *   onChange={setActive}
 * />
 * 
 * @example
 * // Tabs con iconos y badges
 * <Tabs
 *   items={[
 *     { key: 'home', label: 'Inicio', icon: 'home' },
 *     { key: 'notif', label: 'Notificaciones', icon: 'bell', badge: 5 },
 *     { key: 'profile', label: 'Perfil', icon: 'user' }
 *   ]}
 *   activeTab={activeTab}
 *   onChange={setActiveTab}
 * />
 * 
 * @example
 * // Con contenido (usando Tabs.Panel)
 * <View>
 *   <Tabs
 *     items={tabs}
 *     activeTab={activeTab}
 *     onChange={setActiveTab}
 *   />
 *   <Tabs.Panel active={activeTab === 'tab1'}>
 *     <Text>Contenido Tab 1</Text>
 *   </Tabs.Panel>
 *   <Tabs.Panel active={activeTab === 'tab2'}>
 *     <Text>Contenido Tab 2</Text>
 *   </Tabs.Panel>
 * </View>
 */
export function Tabs({
  items = [],
  activeTab,
  onChange,
  variant = "underline",
  size = "md",
  scrollable = true,
  style,
}) {
  const { theme } = useTheme();

  const sizeStyles = {
    sm: { paddingVertical: DESIGN_TOKENS.spacing.xs, fontSize: 13 },
    md: { paddingVertical: DESIGN_TOKENS.spacing.sm, fontSize: 14 },
    lg: { paddingVertical: DESIGN_TOKENS.spacing.md, fontSize: 15 },
  };

  const TabButton = ({ item }) => {
    const isActive = activeTab === item.key;

    const getTabStyles = () => {
      const base = {
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        ...sizeStyles[size],
      };

      switch (variant) {
        case "pills":
          return {
            ...base,
            borderRadius: DESIGN_TOKENS.borderRadius.round,
            backgroundColor: isActive
              ? theme.colors.brand.primary
              : "transparent",
            marginRight: DESIGN_TOKENS.spacing.xs,
          };
        case "contained":
          return {
            ...base,
            backgroundColor: isActive
              ? theme.colors.brand.primary
              : theme.colors.background.hover,
            marginRight: 2,
          };
        case "underline":
        default:
          return {
            ...base,
            borderBottomWidth: 2,
            borderBottomColor: isActive
              ? theme.colors.brand.primary
              : "transparent",
            marginRight: DESIGN_TOKENS.spacing.sm,
          };
      }
    };

    const getTextColor = () => {
      if (variant === "pills" && isActive) {
        return theme.colors.text.inverse;
      }
      if (variant === "contained" && isActive) {
        return theme.colors.text.inverse;
      }
      return isActive ? theme.colors.brand.primary : theme.colors.text.secondary;
    };

    return (
      <TouchableOpacity
        onPress={() => onChange(item.key)}
        style={[styles.tab, getTabStyles()]}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={item.label}
      >
        <View style={styles.tabContent}>
          <Text
            style={[
              styles.tabText,
              { fontSize: sizeStyles[size].fontSize, color: getTextColor() },
              isActive && styles.tabTextActive,
            ]}
          >
            {item.label}
          </Text>
          {item.badge !== undefined && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    variant === "pills" && isActive
                      ? theme.colors.text.inverse
                      : theme.colors.status.error,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      variant === "pills" && isActive
                        ? theme.colors.brand.primary
                        : theme.colors.text.inverse,
                  },
                ]}
              >
                {item.badge}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const containerStyle = [
    styles.container,
    variant !== "underline" && styles.containerNoUnderline,
    { borderBottomColor: theme.colors.border.primary },
    style,
  ];

  const TabsContainer = scrollable ? ScrollView : View;

  return (
    <TabsContainer
      horizontal={scrollable}
      showsHorizontalScrollIndicator={false}
      style={containerStyle}
      contentContainerStyle={styles.contentContainer}
      accessibilityRole="tablist"
    >
      {items.map((item) => (
        <TabButton key={item.key} item={item} />
      ))}
    </TabsContainer>
  );
}

/**
 * Tabs.Panel - Contenedor de contenido para un tab
 * 
 * @example
 * <Tabs.Panel active={activeTab === 'home'}>
 *   <Text>Contenido del home</Text>
 * </Tabs.Panel>
 */
Tabs.Panel = function TabPanel({ active, children, style }) {
  if (!active) return null;

  return (
    <View style={[styles.panel, style]} accessibilityRole="tabpanel">
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  containerNoUnderline: {
    borderBottomWidth: 0,
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabText: {
    fontWeight: "500",
  },
  tabTextActive: {
    fontWeight: "700",
  },
  badge: {
    marginLeft: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: DESIGN_TOKENS.borderRadius.round,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  panel: {
    padding: DESIGN_TOKENS.spacing.md,
  },
});

export default Tabs;
