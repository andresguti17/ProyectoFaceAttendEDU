import React from "react";
import { FlatList, View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * Lista reutilizable con estados de loading, empty y error
 * 
 * @param {Array} data - Array de datos
 * @param {function} renderItem - Función para renderizar cada item
 * @param {function} keyExtractor - Función para extraer key
 * @param {boolean} loading - Estado de carga
 * @param {string} emptyMessage - Mensaje cuando no hay datos
 * @param {ReactNode} emptyComponent - Componente custom para estado vacío
 * @param {boolean} refreshing - Estado de refresh
 * @param {function} onRefresh - Callback para pull to refresh
 * @param {function} onEndReached - Callback para scroll infinito
 */
export function List({
  data = [],
  renderItem,
  keyExtractor,
  loading = false,
  emptyMessage = "No hay datos disponibles",
  emptyComponent,
  refreshing = false,
  onRefresh,
  onEndReached,
  style,
  contentContainerStyle,
  ...props
}) {
  const { theme } = useTheme();

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.brand.primary} />
      </View>
    );
  }

  // Empty state
  if (!loading && data.length === 0) {
    if (emptyComponent) {
      return emptyComponent;
    }
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor || ((item, index) => index.toString())}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      style={style}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: DESIGN_TOKENS.spacing.xxl,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  contentContainer: {
    paddingBottom: DESIGN_TOKENS.spacing.lg,
  },
});

export default List;
