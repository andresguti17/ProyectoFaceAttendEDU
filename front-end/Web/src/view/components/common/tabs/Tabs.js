import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Sistema de tabs reutilizable
 * 
 * @param {Array} tabs - Array de tabs: [{ key, label, icon, content }]
 * @param {string} activeTab - Key del tab activo
 * @param {function} onTabChange - Callback al cambiar tab
 * @param {string} variant - Estilo: 'default' | 'pills' | 'underline'
 */
export function Tabs({
  tabs = [],
  activeTab: controlledActiveTab,
  onTabChange,
  variant = "default",
  style,
}) {
  const { theme } = useTheme();
  const [internalActiveTab, setInternalActiveTab] = useState(tabs[0]?.key);

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;

  const handleTabChange = (key) => {
    if (controlledActiveTab === undefined) {
      setInternalActiveTab(key);
    }
    onTabChange?.(key);
  };

  const activeTabData = tabs.find(tab => tab.key === activeTab);

  const renderTab = (tab) => {
    const isActive = tab.key === activeTab;

    const tabStyles = {
      default: [
        styles.tab,
        {
          backgroundColor: isActive
            ? theme.colors.brand.primaryLight
            : "transparent",
          borderBottomWidth: 2,
          borderBottomColor: isActive
            ? theme.colors.brand.primary
            : "transparent",
        },
      ],
      pills: [
        styles.tab,
        {
          backgroundColor: isActive
            ? theme.colors.brand.primary
            : theme.colors.background.hover,
          borderRadius: DESIGN_TOKENS.borderRadius.round,
          paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        },
      ],
      underline: [
        styles.tab,
        {
          backgroundColor: "transparent",
          borderBottomWidth: 2,
          borderBottomColor: isActive
            ? theme.colors.brand.primary
            : "transparent",
        },
      ],
    };

    const textColor = variant === "pills" && isActive
      ? theme.colors.text.inverse
      : isActive
      ? theme.colors.brand.primary
      : theme.colors.text.secondary;

    return (
      <TouchableOpacity
        key={tab.key}
        onPress={() => handleTabChange(tab.key)}
        style={tabStyles[variant]}
      >
        {tab.icon && (
          <View style={styles.icon}>{tab.icon}</View>
        )}
        <Text
          style={[
            styles.tabText,
            {
              color: textColor,
              fontWeight: isActive ? "700" : "500",
            },
          ]}
        >
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[
          styles.tabsContainer,
          { borderBottomColor: theme.colors.border.primary },
        ]}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map(renderTab)}
      </ScrollView>

      <View style={styles.contentContainer}>
        {activeTabData?.content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    flexGrow: 0,
  },
  tabsContent: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  icon: {
    marginRight: DESIGN_TOKENS.spacing.xs,
  },
  tabText: {
    fontSize: 14,
  },
  contentContainer: {
    flex: 1,
    padding: DESIGN_TOKENS.spacing.lg,
  },
});

export default Tabs;
