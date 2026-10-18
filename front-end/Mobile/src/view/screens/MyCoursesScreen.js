import BackButton from '../components/common/BackButton';
import React, {useMemo} from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {createMyCoursesStyles} from "./Styles/MyCoursesScreen/Style";
import { useMyCoursesViewModel } from "../../viewmodels/useMyCoursesViewModel";

function FichaCard({ ficha, colors, t }) {
  const styles = useMemo(() => createMyCoursesStyles(colors), [colors]);
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
  const styles = useMemo(() => createMyCoursesStyles(colors), [colors]);

  const title = t("courses.title");
  const subtitle =
    role === "teacher" ? t("teacher.myCoursesDesc") : t("student.myCoursesDesc");

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.backgroundWhite }]}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <BackButton onPress={() => navigation?.navigate("DashboardScreen")} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={[styles.centerText, { color: colors.text }]}>{error}</Text>
            <TouchableOpacity
              onPress={reload}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.retryText}>{t("courses.retry")}</Text>
            </TouchableOpacity>
          </View>
        ) : fichas.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={[styles.centerText, { color: colors.text }]}>{t("courses.empty")}</Text>
          </View>
        ) : (
          <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
          >
            {fichas.map((ficha) => (
              <FichaCard
                key={ficha.cohortId ?? ficha.cohortCode}
                ficha={ficha}
                colors={colors}
                t={t}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
