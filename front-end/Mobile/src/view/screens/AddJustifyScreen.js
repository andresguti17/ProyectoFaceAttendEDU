import React, {useMemo} from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import PrimaryButton from '../components/auth/PrimaryButton';
import BackButton from '../components/common/BackButton';
import Separador from '../components/common/Separador';
import CustomAlert from '../components/common/CustomAlert';
import {createAddJustifyStyles} from './Styles/AddJustifyScreen/Style';
import {useTheme} from '../components/common/ThemeContext';
import {useAddJustificationViewModel} from '../../viewmodels/useAddJustifyViewModel';
import {recordDate} from '../../utils/justificationEligibility';

export default function AddJustification() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createAddJustifyStyles(colors), [colors]);

  const {
    records,
    recordsLoading,
    selectedRecordId,
    setSelectedRecordId,
    description,
    setDescription,
    selectedFile,
    pickFile,
    isLoading,
    updateKey,
    handleBack,
    handleSubmit,
    alertConfig,
    hideAlert,
  } = useAddJustificationViewModel();

  return (
      <SafeAreaView
          style={[styles.safeAreaWhite, { backgroundColor: colors.background }]}
          key={`${updateKey}`}
      >
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardview}
        >
          <ScrollView
              style={styles.ScrollView}
              contentContainerStyle={styles.ScrollViewContent}
              showsVerticalScrollIndicator={false}
          >
            <View style={styles.containerAddJustification}>
              <BackButton onPress={handleBack} />
              <Text style={[styles.mainTitleAddJustification, { color: colors.text }]}>
                {t('justify.title')}
              </Text>

              <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                {t('justify.addAbsence')}
              </Text>

              <Separador />

              <Text style={[styles.inputLabel, { color: colors.text }]}>
                {t('justify.selectRecord')}
              </Text>

              {recordsLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginBottom: 20 }} />
              ) : records.length === 0 ? (
                  <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                    {t('justify.noEligibleRecords')}
                  </Text>
              ) : (
                  <View style={{ gap: 8, marginBottom: 20 }} accessibilityRole="radiogroup">
                    {records.map((record) => {
                      const selected = record.attendance_record_id === selectedRecordId;
                      const label = `${recordDate(record) || '—'} · ${
                          record.attendance_status === 'Late' ? t('justify.delayType') : t('justify.absenceType')}`;
                      return (
                          <TouchableOpacity
                              key={record.attendance_record_id}
                              style={[
                                styles.typeButton,
                                {
                                  backgroundColor: selected ? colors.primary : colors.card,
                                  borderColor: colors.border,
                                  borderWidth: 1,
                                },
                              ]}
                              onPress={() => setSelectedRecordId(record.attendance_record_id)}
                              accessibilityRole="radio"
                              accessibilityState={{ selected }}
                              accessibilityLabel={label}
                          >
                            <Text style={[styles.typeButtonText, { color: selected ? colors.onPrimary : colors.text }]}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                      );
                    })}
                  </View>
              )}

              <Text style={[styles.inputLabel, { color: colors.text }]}>
                {t('justify.descriptionLabel')}
              </Text>
              <TextInput
                  style={[
                    styles.textInput,
                    styles.textArea,
                    {
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder={t('justify.descriptionPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>
                {t('justify.attachDocument')}
              </Text>

              <TouchableOpacity
                  style={[styles.uploadButton, { backgroundColor: colors.primary }]}
                  onPress={pickFile}
              >
                <Text style={[styles.uploadButtonText, { color: colors.onPrimary }]}>
                  {t('justify.selectFile')}
                </Text>
              </TouchableOpacity>

              {selectedFile && (
                  <Text style={[styles.supportedFormats, { color: colors.text }]} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
              )}
              <Text style={[styles.supportedFormats, { color: colors.textMuted }]}>
                {t('justify.supportedFormats')}
              </Text>

              <View style={styles.spacer} />

              <View style={styles.buttonContainer}>
                <PrimaryButton
                    title={t('justify.upload')}
                    onPress={handleSubmit}
                    isLoading={isLoading}
                    disabled={records.length === 0}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <CustomAlert
            visible={alertConfig.visible}
            title={alertConfig.title}
            message={alertConfig.message}
            buttons={alertConfig.buttons}
            onClose={hideAlert}
            type={alertConfig.type}
        />
      </SafeAreaView>
  );
}