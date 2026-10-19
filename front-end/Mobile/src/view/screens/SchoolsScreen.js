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
import {createSchoolsStyles} from "./Styles/SchoolsScreen/Style";
import { useSchoolsViewModel } from "../../viewmodels/useSchoolsViewModel";

function SchoolCard({ school, colors, t }) {
  const styles = useMemo(() => createSchoolsStyles(colors), [colors]);
  const active = school.status !== false;
  return (
    <View
      style={[
        styles.schoolCard,
        { backgroundColor: colors.card, borderColor: colors.separator },
      ]}
    >
      <Text style={[styles.schoolName, { color: colors.text }]}>{school.name}</Text>
      <Text style={[styles.schoolMeta, { color: colors.textSecondary }]}>
        {school.code}
        {school.address ? ` · ${school.address}` : ""}
      </Text>
      {school.phone ? (
        <Text style={[styles.schoolMeta, { color: colors.textSecondary }]}>
          {school.phone}
        </Text>
      ) : null}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: active ? colors.statusPresente : colors.statusTarde }]}>
          <Text style={[styles.badgeText, { color: active ? colors.statusTextPresente : colors.statusTextTarde }]}>
            {active ? t("schools.active") : t("schools.inactive")}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>
            {t("schools.programs")}: {school.programsCount}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function SchoolsScreen({ navigation }) {
  const { loading, error, schools, reload, colors, t } = useSchoolsViewModel();
  const styles = useMemo(() => createSchoolsStyles(colors), [colors]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.backgroundWhite }]}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <BackButton onPress={() => navigation?.navigate("DashboardScreen")} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("schools.title")}</Text>
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {t("schools.subtitle")}
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
              <Text style={styles.retryText}>{t("schools.retry")}</Text>
            </TouchableOpacity>
          </View>
        ) : schools.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={[styles.centerText, { color: colors.text }]}>{t("schools.empty")}</Text>
          </View>
        ) : (
          <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
          >
            {schools.map((school) => (
              <SchoolCard key={school.schoolId} school={school} colors={colors} t={t} />
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
