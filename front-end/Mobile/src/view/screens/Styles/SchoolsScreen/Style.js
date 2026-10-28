import { StyleSheet } from "react-native";

export const schoolsStyles = StyleSheet.create({
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
