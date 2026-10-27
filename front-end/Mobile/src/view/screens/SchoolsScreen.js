import React from "react";
import { Text, View } from "react-native";
import ListScreen from '../components/common/ListScreen';
import { schoolsStyles as styles } from "./Styles/SchoolsScreen/Style";
import { useSchoolsViewModel } from "../../viewmodels/useSchoolsViewModel";

function SchoolCard({ school, colors, t }) {
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

  return (
    <ListScreen
      title={t("schools.title")}
      subtitle={t("schools.subtitle")}
      colors={colors}
      loading={loading}
      error={error}
      onRetry={reload}
      retryLabel={t("schools.retry")}
      isEmpty={schools.length === 0}
      emptyLabel={t("schools.empty")}
      onBack={() => navigation?.navigate("DashboardScreen")}
    >
      {schools.map((school) => (
        <SchoolCard key={school.schoolId} school={school} colors={colors} t={t} />
      ))}
    </ListScreen>
  );
}
