import React, {useMemo} from "react";
import {ActivityIndicator, RefreshControl, ScrollView, View,} from "react-native";
import {useTheme} from "./ThemeContext";
import {createCommonStyles} from "./style/Style";

export default function ScrollViews({
  children,
  showVerticalScroll = true,
  showHorizontalScroll = false,
  refreshing = false,
  onRefresh,
  loading = false,
  bottomSpace = 80,
  contentContainerStyle = {},
  style = {},
  keyboardShouldPersistTaps = "handled"
}) {
  const {colors} = useTheme();
  const stylescommon = useMemo(() => createCommonStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={[stylescommon.loadingContainer, contentContainerStyle]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[colors.primary, colors.info, colors.warning]}
      tintColor={colors.primary}
    />
  ) : undefined;

  return (
    <ScrollView
      style={[stylescommon.ScrollViewWrapper]}
      contentContainerStyle={[
        stylescommon.contentContainerScroll,
        contentContainerStyle,
        { paddingBottom: bottomSpace }
      ]}
      showsVerticalScrollIndicator={showVerticalScroll}
      showsHorizontalScrollIndicator={showHorizontalScroll}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      {children}
    </ScrollView>
  );
}
