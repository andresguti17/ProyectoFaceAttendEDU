import { Platform, StyleSheet } from "react-native";

export const createSchoolsStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    // Estándar MenuScreen: en Android el SafeAreaView nativo no inseta y el
    // header quedaba pegado a la barra de notificaciones.
    marginTop: Platform.OS === "ios" ? 0 : 15,
  },
  backIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  backIconImage: {
    width: 22,
    height: 22,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginLeft: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    marginLeft: 48,
    marginTop: -6,
    marginBottom: 12,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  centerText: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 22,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  schoolCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: "800",
  },
  schoolMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
