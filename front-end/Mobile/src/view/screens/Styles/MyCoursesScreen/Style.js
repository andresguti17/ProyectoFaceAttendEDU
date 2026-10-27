import { StyleSheet } from "react-native";

export const myCoursesStyles = StyleSheet.create({
  fichaCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  fichaCode: {
    fontSize: 18,
    fontWeight: "800",
  },
  fichaMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
  },
  courseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  courseName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  courseCode: {
    fontSize: 12,
    marginLeft: 8,
  },
});
