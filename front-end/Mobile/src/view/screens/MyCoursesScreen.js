import React from "react";
import { Text, View } from "react-native";
import ListScreen from '../components/common/ListScreen';
import { myCoursesStyles as styles } from "./Styles/MyCoursesScreen/Style";
import { useMyCoursesViewModel } from "../../viewmodels/useMyCoursesViewModel";

function FichaCard({ ficha, colors, t }) {
  return (
    <View
      style={[
        styles.fichaCard,
        { backgroundColor: colors.card, borderColor: colors.separator },
      ]}
    >
      <Text style={[styles.fichaCode, { color: colors.text }]}>{ficha.cohortCode}</Text>
      <Text style={[styles.fichaMeta, { color: colors.textSecondary }]}>
        {t("courses.program")}: {ficha.programName}
      </Text>
      {ficha.enrolledOn ? (
        <Text style={[styles.fichaMeta, { color: colors.textSecondary }]}>
          {t("courses.enrolledOn")}: {String(ficha.enrolledOn).split("T")[0]}
        </Text>
      ) : null}
      {typeof ficha.studentsCount === "number" ? (
        <Text style={[styles.fichaMeta, { color: colors.textSecondary }]}>
          {t("courses.students")}: {ficha.studentsCount}
        </Text>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t("courses.courses")} ({ficha.courses.length})
      </Text>
      {ficha.courses.length === 0 ? (
        <Text style={[styles.fichaMeta, { color: colors.textSecondary }]}>
          {t("courses.noCourses")}
        </Text>
      ) : (
        ficha.courses.map((course, i) => (
          <View
            key={course.courseId ?? `${course.code}-${i}`}
            style={[styles.courseRow, { borderTopColor: colors.separator }]}
          >
            <Text style={[styles.courseName, { color: colors.text }]} numberOfLines={1}>
              {course.name || "—"}
            </Text>
            <Text style={[styles.courseCode, { color: colors.textSecondary }]}>
              {course.code || ""}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

export default function MyCoursesScreen({ navigation }) {
  const { role, loading, error, fichas, reload, colors, t } = useMyCoursesViewModel();

  const title = t("courses.title");
  const subtitle =
    role === "teacher" ? t("teacher.myCoursesDesc") : t("student.myCoursesDesc");

  return (
    <ListScreen
      title={title}
      subtitle={subtitle}
      colors={colors}
      loading={loading}
      error={error}
      onRetry={reload}
      retryLabel={t("courses.retry")}
      isEmpty={fichas.length === 0}
      emptyLabel={t("courses.empty")}
      onBack={() => navigation?.navigate("DashboardScreen")}
    >
      {fichas.map((ficha) => (
        <FichaCard
          key={ficha.cohortId ?? ficha.cohortCode}
          ficha={ficha}
          colors={colors}
          t={t}
        />
      ))}
    </ListScreen>
  );
}
