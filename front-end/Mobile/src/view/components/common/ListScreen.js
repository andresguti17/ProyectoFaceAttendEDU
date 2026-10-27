import React, {useMemo} from "react";
import {ActivityIndicator, ScrollView, Text, TouchableOpacity, View} from "react-native";
import ReturnButton from "../auth/ReturnButton";
import ScreenSafeArea from "./ScreenSafeArea";
import {createListScreenStyles} from "../../screens/Styles/ListScreen/Style";

/**
 * Pantalla de lista con título, subtítulo y los estados de carga, error
 * (con reintento) y vacío. `children` son las tarjetas de la lista.
 */
export default function ListScreen({
  title,
  subtitle,
  colors,
  loading,
  error,
  onRetry,
  retryLabel,
  isEmpty,
  emptyLabel,
  onBack,
  children,
}) {
  const styles = useMemo(() => createListScreenStyles(colors), [colors]);

  let content;
  if (loading) {
    content = (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  } else if (error) {
    content = (
      <View style={styles.centerBox}>
        <Text style={[styles.centerText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.retryText}>{retryLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (isEmpty) {
    content = (
      <View style={styles.centerBox}>
        <Text style={[styles.centerText, { color: colors.text }]}>{emptyLabel}</Text>
      </View>
    );
  } else {
    content = (
      <ScrollView persistentScrollbar
          showsVerticalScrollIndicator
          contentContainerStyle={{ paddingBottom: 24 }}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <ScreenSafeArea style={[styles.safeArea, { backgroundColor: colors.backgroundWhite }]}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
        {content}
      </View>
        <ReturnButton onPress={onBack} />
    </ScreenSafeArea>
  );
}
