import React, {useMemo} from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import {createSchoolConfigStyles} from './Styles/SchoolConfigurationScreen/Style';
import BackButton from '../components/common/BackButton';
import {useSchoolConfigurationViewModel} from "../../viewmodels/useSchoolConfigurationViewModel";
import {useTheme} from '../../view/components/common/ThemeContext';
import {useUser} from '../../utils/UserContext';
import {useTranslation} from 'react-i18next';

// ─────────────────────────────────────────────
// Sub-componentes FUERA del componente principal
// (llaman a useTheme() por su cuenta, siguen dentro del ThemeProvider)
// ─────────────────────────────────────────────

const FormField = ({
                       label,
                       value,
                       onChangeText,
                       placeholder,
                       multiline = false,
                       required = false,
                       editable = true,
                       validationErrors = {},
                       validationKey,
                   }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createSchoolConfigStyles(colors), [colors]);
    const {t} = useTranslation();
    const fieldKey = validationKey || label.toLowerCase().replace(/\s+/g, '_');
    const hasError = validationErrors[fieldKey];

    return (
        <View style={styles.formGroupSchoolConfig}>
            <Text style={[styles.inputLabelSchoolConfig, { color: colors.text }]}>
                {label}
                {required && (
                    <Text style={[styles.inputLabelRequiredSchoolConfig, { color: colors.danger }]}>
                        *
                    </Text>
                )}
            </Text>
            <View style={{ position: 'relative' }}>
                <TextInput
                    style={[
                        styles.inputFieldSchoolConfig,
                        {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.border,
                            color: colors.text,
                        },
                        multiline && styles.textAreaSchoolConfig,
                        hasError && [
                            styles.inputFieldErrorSchoolConfig,
                            { borderColor: colors.danger },
                        ],
                        !editable && [
                            styles.inputFieldDisabledSchoolConfig,
                            { backgroundColor: colors.background, color: colors.textMuted },
                        ],
                    ]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    multiline={multiline}
                    numberOfLines={multiline ? 4 : 1}
                    editable={editable}
                />
                {!hasError && value && editable && (
                    <Text style={[ styles.validationCheckmarkSchoolConfig, { color: colors.novedadSuccess },]}>✓</Text>
                )}
                {hasError && (
                    <Text style={[ styles.validationErrorIconSchoolConfig, { color: colors.danger },]}>✗</Text>
                )}
            </View>
            {hasError && (
                <Text style={[styles.inputErrorMessageSchoolConfig, { color: colors.danger }]}>
                    {hasError}
                </Text>
            )}
        </View>
    );
};

const ToggleRow = ({ label, description, value, onValueChange }) => {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createSchoolConfigStyles(colors), [colors]);

    return (
        <View style={styles.toggleRowSchoolConfig}>
            <View style={styles.toggleLabelContainerSchoolConfig}>
                <Text style={[styles.toggleLabelSchoolConfig, { color: colors.text }]}>
                    {label}
                </Text>
                {description && (
                    <Text
                        style={[
                            styles.toggleDescriptionSchoolConfig,
                            { color: colors.textSecondary },
                        ]}
                    >
                        {description}
                    </Text>
                )}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: colors.tabInactive, true: colors.primary }}
                thumbColor={Platform.OS === 'android' ? colors.tabActive : undefined}
                ios_backgroundColor={colors.tabInactive}
            />
        </View>
    );
};

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

const SchoolConfigurationScreen = ({ navigation }) => {
    const { colors, isDark, toggleTheme } = useTheme();
    const styles = useMemo(() => createSchoolConfigStyles(colors), [colors]);
    const { t } = useTranslation();

    const { isAdmin, isStudent, isTeacher } = useUser();
    const isAdminUser = isAdmin;

    const {
        activeTab,
        isLoading,
        showConfirmModal,
        showAdvanced,
        hasChanges,
        generalInfo,
        contactInfo,
        academicConfig,
        attendanceConfig,
        validationErrors,
        handleGeneralInfoChange,
        handleContactInfoChange,
        handleAcademicConfigChange,
        handleAttendanceConfigChange,
        handleSaveChanges,
        handleDiscardChanges,
        countryModalVisible,
        cityModalVisible,
        loadingCountries,
        loadingCities,
        filteredCountries,
        displayedCities,
        isCityListLimited,
        handleCountryChange,
        handleCityChange,
        countrySearch,
        setCountrySearch,
        citySearch,
        setCitySearch,
        CITY_LIMIT,
        citiesOptions,
        setActiveTab,
        setCountryModalVisible,
        setCityModalVisible,
        setShowConfirmModal
    } = useSchoolConfigurationViewModel({isAdmin: isAdminUser, t});

    // ─────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────

    return (
        <SafeAreaView style={[styles.safeAreaSchoolConfig, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={[styles.containerSchoolConfig, { backgroundColor: colors.background }]}
            >
                {/* ── Header ── */}
                <View style={[styles.headerSchoolConfig, { backgroundColor: colors.navBar, borderBottomColor: colors.border }]}>
                    <BackButton onPress={() => navigation?.goBack()} />
                    <Text style={[styles.headerTitleSchoolConfig, { color: colors.text }]}>
                        {t('schoolConfig.title')}
                    </Text>

                    {/* Switch de tema claro/oscuro */}
                    <TouchableOpacity
                        onPress={toggleTheme}
                        style={{ marginLeft: 'auto', paddingHorizontal: 8 }}
                    >
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContentSchoolConfig}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.mainContentSchoolConfig}>

                        {/* ── Tarjeta resumen ── */}
                        <View style={[styles.schoolInfoCardSchoolConfig, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                            <View style={styles.schoolLogoContainerSchoolConfig}>
                                <Text style={{ color: colors.textSecondary }}>{t('common.logoPlaceholder')}</Text>
                            </View>
                            <Text style={[styles.schoolNameSchoolConfig, { color: colors.text }]}>
                                {generalInfo?.name}
                            </Text>
                            <View style={styles.quickInfoRowSchoolConfig}>
                                <View style={styles.quickInfoItemSchoolConfig}>
                                    <Text style={[styles.quickInfoValueSchoolConfig, { color: colors.primary }]}>
                                        {academicConfig?.totalStudents}
                                    </Text>
                                    <Text style={[styles.quickInfoLabelSchoolConfig, { color: colors.textSecondary }]}>
                                        {t('schoolConfig.labels.students')}
                                    </Text>
                                </View>
                                <View style={styles.quickInfoItemSchoolConfig}>
                                    <Text style={[styles.quickInfoValueSchoolConfig, { color: colors.primary }]}>
                                        {academicConfig?.totalTeachers}
                                    </Text>
                                    <Text style={[styles.quickInfoLabelSchoolConfig, { color: colors.textSecondary }]}>
                                        {t('schoolConfig.labels.teachers')}
                                    </Text>
                                </View>
                                <View style={styles.quickInfoItemSchoolConfig}>
                                    <Text style={[styles.quickInfoValueSchoolConfig, { color: colors.primary }]}>
                                        {academicConfig?.totalCourses}
                                    </Text>
                                    <Text style={[styles.quickInfoLabelSchoolConfig, { color: colors.textSecondary }]}>
                                        {t('schoolConfig.labels.courses')}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* ── Tabs ── */}
                        <View style={[styles.sectionTabsSchoolConfig, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            {['general', 'contacto', 'academica', 'asistencia'].map((tab) => (
                                <TouchableOpacity
                                    key={tab}
                                    style={[
                                        styles.sectionTabSchoolConfig,
                                        activeTab === tab && [
                                            styles.sectionTabActiveSchoolConfig,
                                            { backgroundColor: colors.primary },
                                        ],
                                    ]}
                                    onPress={() => setActiveTab(tab)}
                                >
                                    <Text
                                        style={[
                                            styles.sectionTabTextSchoolConfig,
                                            { color: colors.textSecondary },
                                            activeTab === tab && [
                                                styles.sectionTabTextActiveSchoolConfig,
                                                { color: colors.modalButtonText },
                                            ],
                                        ]}
                                    >
                                        {tab === 'general'    && t('schoolConfig.tabs.general')}
                                        {tab === 'contacto'   && t('schoolConfig.tabs.contact')}
                                        {tab === 'academica'  && t('schoolConfig.tabs.academic')}
                                        {tab === 'asistencia' && t('schoolConfig.tabs.attendance')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* ════════════════════════════════
                            TAB: INFORMACIÓN GENERAL
                        ════════════════════════════════ */}
                        {activeTab === 'general' && (
                            <View style={[styles.formSectionSchoolConfig, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                                <Text style={[styles.formSectionTitleSchoolConfig, { color: colors.text }]}>
                                    {t('schoolConfig.sections.generalInfo')}
                                </Text>

                                <FormField
                                    label={t('schoolConfig.fields.schoolName')}
                                    value={generalInfo?.name}
                                    onChangeText={(value) => handleGeneralInfoChange('schoolName', value)}
                                    placeholder={t('schoolConfig.fields.schoolNamePlaceholder')}
                                    validationKey="schoolName"
                                    required
                                    validationErrors={validationErrors}
                                    editable={isAdminUser}
                                />

                                <FormField
                                    label={t('schoolConfig.fields.schoolCode')}
                                    value={generalInfo?.code}
                                    onChangeText={(value) => handleGeneralInfoChange('schoolCode', value)}
                                    placeholder={t('schoolConfig.fields.schoolCodePlaceholder')}
                                    validationKey="schoolCode"
                                    editable={false}
                                    validationErrors={validationErrors}
                                />

                                <FormField
                                    label={t('schoolConfig.fields.district')}
                                    value={generalInfo?.district}
                                    onChangeText={(value) => handleGeneralInfoChange('district', value)}
                                    placeholder={t('schoolConfig.fields.districtPlaceholder')}
                                    validationKey="district"
                                    required
                                    validationErrors={validationErrors}
                                    editable={isAdminUser}
                                />
                            </View>
                        )}

                        {/* ════════════════════════════════
                            TAB: CONTACTO
                        ════════════════════════════════ */}
                        {activeTab === 'contacto' && (
                            <View style={[styles.formSectionSchoolConfig, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                                <Text style={[styles.formSectionTitleSchoolConfig, { color: colors.text }]}>
                                    {t('schoolConfig.sections.contactInfo')}
                                </Text>

                                {/* Teléfono con prefijo estático */}
                                <View style={styles.formGroupSchoolConfig}>
                                    <Text style={[styles.inputLabelSchoolConfig, { color: colors.text }]}>
                                        {t('schoolConfig.fields.phone')}
                                        <Text style={{ color: colors.danger }}>*</Text>
                                    </Text>
                                    <View
                                        style={[
                                            styles.inputFieldSchoolConfig,
                                            {
                                                flexDirection:     'row',
                                                alignItems:        'center',
                                                paddingHorizontal: 0,
                                                overflow:          'hidden',
                                                backgroundColor:   colors.inputBackground,
                                                borderColor:       colors.border,
                                            },
                                        ]}
                                    >
                                        {/* Prefijo — no editable */}
                                        <View
                                            style={{
                                                paddingHorizontal: 12,
                                                borderRightWidth:  1,
                                                borderRightColor:  colors.border,
                                                justifyContent:    'center',
                                                minWidth:          55,
                                                alignItems:        'center',
                                            }}
                                        >
                                            <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '500' }}>
                                                {contactInfo.dialCode || '---'}
                                            </Text>
                                        </View>
                                        {/* Solo los números */}
                                        <TextInput
                                            style={{
                                                flex:              1,
                                                paddingHorizontal: 12,
                                                fontSize:          14,
                                                color:             colors.text,
                                            }}
                                            value={contactInfo.phone}
                                            onChangeText={(value) =>
                                                handleContactInfoChange('phone', value)
                                            }
                                            placeholder={t('schoolConfig.fields.phonePlaceholder')}
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="phone-pad"
                                            editable={isAdminUser}
                                        />
                                    </View>
                                    {validationErrors['phone'] && (
                                        <Text style={[styles.inputErrorMessageSchoolConfig, { color: colors.danger }]}>
                                            {validationErrors['phone']}
                                        </Text>
                                    )}
                                </View>

                                {/* Dirección */}
                                <FormField
                                    label={t('schoolConfig.fields.address')}
                                    value={contactInfo.address}
                                    onChangeText={(value) => handleContactInfoChange('address', value)}
                                    placeholder={t('schoolConfig.fields.addressPlaceholder')}
                                    validationKey="address"
                                    required
                                    validationErrors={validationErrors}
                                    editable={isAdminUser}
                                />

                                {/* Ciudad — selector desplegable */}
                                <View style={styles.formGroupSchoolConfig}>
                                    <Text style={[styles.inputLabelSchoolConfig, { color: colors.text }]}>
                                        {t('schoolConfig.fields.city')}
                                        <Text style={{ color: colors.danger }}>*</Text>
                                    </Text>
                                    <TouchableOpacity
                                        style={[
                                            styles.inputFieldSchoolConfig,
                                            styles.pickerContainerSchoolConfig,
                                            styles.countryPickerSchoolConfig,
                                            {
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                backgroundColor: colors.inputBackground,
                                                borderColor: colors.border,
                                                opacity: isAdminUser ? 1 : 0.6,
                                            },
                                        ]}
                                        onPress={() => {
                                            if (!isAdminUser) return;
                                            if (!contactInfo.country) {
                                                Alert.alert(t('schoolConfig.modals.selectCountryFirst'));
                                                return;
                                            }
                                            setCitySearch('');
                                            setCityModalVisible(true);
                                        }}
                                        disabled={!isAdminUser} // 👈 Bloqueo táctil
                                    >
                                        {loadingCities ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Text style={[styles.countryPickerTextSchoolConfig, { color: colors.text }]}>
                                                {contactInfo.city || t('schoolConfig.fields.selectCity')}
                                            </Text>
                                        )}
                                        <Image
                                            source={require('../../assets/images/flecha.png')}
                                            style={{
                                                width: 16,
                                                height: 16,
                                                resizeMode: 'contain',
                                                tintColor: colors.textSecondary,
                                            }}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* ════════════════════════════════
                            TAB: CONFIGURACIÓN ACADÉMICA
                        ════════════════════════════════ */}
                        {activeTab === 'academica' && (
                            <View style={[styles.formSectionSchoolConfig, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                                <Text style={[styles.formSectionTitleSchoolConfig, { color: colors.text }]}>
                                    {t('schoolConfig.sections.academicConfig')}
                                </Text>
                                <FormField
                                    label={t('schoolConfig.fields.academicYear')}
                                    value={academicConfig.academicYear}
                                    onChangeText={(value) => handleAcademicConfigChange('academicYear', value)}
                                    placeholder={t('schoolConfig.fields.academicYearPlaceholder')}
                                    validationKey="academicYear"
                                    editable={false}
                                    validationErrors={validationErrors}
                                />
                                <FormField
                                    label={t('schoolConfig.fields.startDate')}
                                    value={academicConfig.startDate}
                                    onChangeText={(value) => handleAcademicConfigChange('startDate', value)}
                                    placeholder={t('schoolConfig.fields.startDatePlaceholder')}
                                    validationKey="startDate"
                                    validationErrors={validationErrors}
                                    editable={isAdminUser}
                                />
                                <FormField
                                    label={t('schoolConfig.fields.endDate')}
                                    value={academicConfig.endDate}
                                    onChangeText={(value) => handleAcademicConfigChange('endDate', value)}
                                    placeholder={t('schoolConfig.fields.endDatePlaceholder')}
                                    validationKey="endDate"
                                    validationErrors={validationErrors}
                                    editable={isAdminUser}
                                />
                            </View>
                        )}

                        {/* ════════════════════════════════
                            TAB: CONFIGURACIÓN DE ASISTENCIA
                        ════════════════════════════════ */}
                        {activeTab === 'asistencia' && (
                            <View style={[styles.formSectionSchoolConfig, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                                <Text style={[styles.formSectionTitleSchoolConfig, { color: colors.text }]}>
                                    {t('schoolConfig.sections.attendanceConfig')}
                                </Text>
                                <FormField
                                    label={t('schoolConfig.fields.tolerance')}
                                    value={attendanceConfig.toleranceMinutes}
                                    onChangeText={(value) => handleAttendanceConfigChange('toleranceMinutes', value)}
                                    placeholder={t('schoolConfig.fields.tolerancePlaceholder')}
                                    validationKey="toleranceMinutes"
                                    validationErrors={validationErrors}
                                    editable={isAdminUser}
                                />
                                <FormField
                                    label={t('schoolConfig.fields.maxAbsences')}
                                    value={attendanceConfig.maxAbsences}
                                    onChangeText={(value) => handleAttendanceConfigChange('maxAbsences', value)}
                                    placeholder={t('schoolConfig.fields.maxAbsencesPlaceholder')}
                                    validationKey="maxAbsences"
                                    validationErrors={validationErrors}
                                    editable={isAdminUser}
                                />
                                <FormField
                                    label={t('schoolConfig.fields.maxLateness')}
                                    value={attendanceConfig.maxLatenesses}
                                    onChangeText={(value) => handleAttendanceConfigChange('maxLatenesses', value)}
                                    placeholder={t('schoolConfig.fields.maxLatenessPlaceholder')}
                                    validationKey="maxLatenesses"
                                    validationErrors={validationErrors}
                                    editable={isAdminUser}
                                />
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* ── Botones de Acción ── */}
                {hasChanges && isAdminUser && (
                    <View style={[styles.actionButtonsContainerSchoolConfig, { marginHorizontal: 20 }]}>
                        <TouchableOpacity
                            style={[styles.saveButtonSchoolConfig, { backgroundColor: colors.primary }]}
                            onPress={() => setShowConfirmModal(true)}
                        >
                            <Text style={[styles.saveButtonTextSchoolConfig, { color: colors.modalButtonText }]}>
                                {t('schoolConfig.modals.saveChanges')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.cancelButtonSchoolConfig, { backgroundColor: colors.modalButtonSecondary }]}
                            onPress={handleDiscardChanges}
                        >
                            <Text style={[styles.cancelButtonTextSchoolConfig, { color: colors.modalButtonSecondaryText }]}>
                                {t('common.discard')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>

            {/* ════════════════════════════════
                MODAL: Selección de País
            ════════════════════════════════ */}
            <Modal
                visible={countryModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCountryModalVisible(false)}
            >
                <View style={[styles.modalOverlaySchoolConfig, { backgroundColor: colors.modalOverlay }]}>
                    <View style={[styles.modalSheetSchoolConfig, { width: '90%', maxHeight: '80%', backgroundColor: colors.modalBackground }]}>
                        <Text style={[styles.modalTitleSchoolConfig, { color: colors.modalText }]}>
                            {t('schoolConfig.modals.selectCountry')}
                        </Text>

                        {/* Buscador */}
                        <View style={{
                            flexDirection:    'row',
                            alignItems:       'center',
                            borderWidth:      1,
                            borderColor:      colors.modalBorder,
                            borderRadius:     8,
                            marginBottom:     10,
                            overflow:         'hidden',
                            backgroundColor:  colors.modalInputBackground,
                        }}>
                            <TextInput
                                style={{
                                    flex:              1,
                                    paddingHorizontal: 12,
                                    paddingVertical:   8,
                                    fontSize:          14,
                                    color:             colors.modalInputText,
                                }}
                                placeholder={t('schoolConfig.modals.searchCountry')}
                                placeholderTextColor={colors.modalInputPlaceholder}
                                value={countrySearch}
                                onChangeText={setCountrySearch}
                                autoCorrect={false}
                                keyboardType="default"
                            />
                            <TouchableOpacity
                                style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                                onPress={() => {
                                    setCountrySearch('');
                                    Keyboard.dismiss();
                                }}
                            >
                                <Text style={{ fontSize: 16, color: colors.modalTextSecondary }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {loadingCountries ? (
                            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={{ marginTop: 10, color: colors.modalTextSecondary, fontSize: 13 }}>
                                    {t('schoolConfig.modals.loadingCountries')}
                                </Text>
                            </View>
                        ) : (
                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator
                            >
                                {filteredCountries.length === 0 ? (
                                    <Text style={{ textAlign: 'center', color: colors.textMuted, padding: 20 }}>
                                        {t('schoolConfig.modals.noCountries')}
                                    </Text>
                                ) : (
                                    filteredCountries.map((option, index) => (
                                        <TouchableOpacity
                                            key={`${option.name}-${index}`}
                                            style={[styles.countryOptionSchoolConfig, { borderBottomColor: colors.modalBorder }]}
                                            onPress={() => handleCountryChange(option)}
                                        >
                                            <Text style={[styles.countryOptionTextSchoolConfig, { color: colors.modalText }]}>
                                                {option.name}
                                            </Text>
                                            <Text style={[styles.countryDialCodeSchoolConfig, { color: colors.modalTextSecondary }]}>
                                                {option.dialCode}
                                            </Text>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        )}

                        <TouchableOpacity
                            style={[styles.modalCancelButtonSchoolConfig, { backgroundColor: colors.modalButtonSecondary }]}
                            onPress={() => setCountryModalVisible(false)}
                        >
                            <Text style={[styles.modalCancelButtonTextSchoolConfig, { color: colors.modalButtonSecondaryText }]}>
                                {t('common.cancel')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ════════════════════════════════
                MODAL: Selección de Ciudad
            ════════════════════════════════ */}
            <Modal
                visible={cityModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCityModalVisible(false)}
            >
                <View style={[styles.modalOverlaySchoolConfig, { backgroundColor: colors.modalOverlay }]}>
                    <View style={[styles.modalSheetSchoolConfig, { width: '90%', maxHeight: '80%', backgroundColor: colors.modalBackground }]}>
                        <Text style={[styles.modalTitleSchoolConfig, { color: colors.modalText }]}>
                            {t('schoolConfig.modals.selectCity')}
                        </Text>
                        <Text style={[styles.modalSubtitleSchoolConfig, { color: colors.modalTextSecondary }]}>
                            {t('schoolConfig.modals.cityAvailableFor', {country: contactInfo?.country})}
                        </Text>

                        {/* Buscador */}
                        <View style={{
                            flexDirection:    'row',
                            alignItems:       'center',
                            borderWidth:      1,
                            borderColor:      colors.modalBorder,
                            borderRadius:     8,
                            marginBottom:     10,
                            overflow:         'hidden',
                            backgroundColor:  colors.modalInputBackground,
                        }}>
                            <TextInput
                                style={{
                                    flex:              1,
                                    paddingHorizontal: 12,
                                    paddingVertical:   8,
                                    fontSize:          14,
                                    color:             colors.modalInputText,
                                }}
                                placeholder={t('schoolConfig.modals.searchCity')}
                                placeholderTextColor={colors.modalInputPlaceholder}
                                value={citySearch}
                                onChangeText={setCitySearch}
                                autoCorrect={false}
                                keyboardType="default"
                            />
                            <TouchableOpacity
                                style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                                onPress={() => {
                                    setCitySearch('');
                                    Keyboard.dismiss();
                                }}
                            >
                                <Text style={{ fontSize: 16, color: colors.modalTextSecondary }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {loadingCities ? (
                            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={{ marginTop: 10, color: colors.modalTextSecondary, fontSize: 13 }}>
                                    {t('schoolConfig.modals.loadingCities')}
                                </Text>
                            </View>
                        ) : (
                            <>
                                {isCityListLimited && (
                                    <Text style={{
                                        textAlign: 'center',
                                        color: colors.modalTextSecondary,
                                        paddingVertical: 10,
                                        fontSize: 13,
                                    }}>
                                        {t('schoolConfig.modals.showingCities', {
                                            shown: CITY_LIMIT,
                                            total: citiesOptions.length
                                        })}
                                    </Text>
                                )}
                                <ScrollView
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator
                                >
                                    {displayedCities.length === 0 ? (
                                        <Text style={{ textAlign: 'center', color: colors.textMuted, padding: 20 }}>
                                            {t('schoolConfig.modals.noCities')}
                                        </Text>
                                    ) : (
                                        displayedCities.map((city, index) => (
                                            <TouchableOpacity
                                                key={`${city}-${index}`}
                                                style={[styles.countryOptionSchoolConfig, { borderBottomColor: colors.modalBorder }]}
                                                onPress={() => handleCityChange(city)}
                                            >
                                                <Text style={[styles.countryOptionTextSchoolConfig, { color: colors.modalText }]}>
                                                    {city}
                                                </Text>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </ScrollView>
                            </>
                        )}

                        <TouchableOpacity
                            style={[styles.modalCancelButtonSchoolConfig, { backgroundColor: colors.modalButtonSecondary }]}
                            onPress={() => setCityModalVisible(false)}
                        >
                            <Text style={[styles.modalCancelButtonTextSchoolConfig, { color: colors.modalButtonSecondaryText }]}>
                                {t('common.cancel')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ════════════════════════════════
                MODAL: Confirmación de Guardado
            ════════════════════════════════ */}
            <Modal
                visible={showConfirmModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowConfirmModal(false)}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={[styles.modalOverlaySchoolConfig, { backgroundColor: colors.modalOverlay }]}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.modalSheetSchoolConfig, { backgroundColor: colors.modalBackground }]}>
                                <Text style={[styles.modalTitleSchoolConfig, { color: colors.modalText }]}>
                                    {t('schoolConfig.modals.confirmSave')}
                                </Text>
                                <Text style={[styles.modalSubtitleSchoolConfig, { color: colors.modalTextSecondary }]}>
                                    {t('schoolConfig.modals.confirmSaveMessage')}
                                </Text>
                                <View style={styles.modalMessageSchoolConfig}>
                                    <Text style={{ fontSize: 13, color: colors.modalTextSecondary }}>
                                        {t('schoolConfig.modals.changesImpact')}
                                    </Text>
                                </View>
                                {isLoading ? (
                                    <View style={styles.loadingOverlaySchoolConfig}>
                                        <ActivityIndicator size="large" color={colors.modalButtonText} />
                                        <Text style={[styles.loadingTextSchoolConfig, { color: colors.modalButtonText }]}>
                                            {t('schoolConfig.modals.savingChanges')}
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={styles.modalActionsSchoolConfig}>
                                        <TouchableOpacity
                                            style={[styles.modalConfirmButtonSchoolConfig, { backgroundColor: colors.modalButton }]}
                                            onPress={handleSaveChanges}
                                            disabled={isLoading}
                                        >
                                            <Text style={[styles.modalConfirmButtonTextSchoolConfig, { color: colors.modalButtonText }]}>
                                                {t('schoolConfig.modals.confirmAndSave')}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modalCancelButtonSchoolConfig, { backgroundColor: colors.modalButtonSecondary }]}
                                            onPress={() => setShowConfirmModal(false)}
                                            disabled={isLoading}
                                        >
                                            <Text style={[styles.modalCancelButtonTextSchoolConfig, { color: colors.modalButtonSecondaryText }]}>
                                                {t('common.cancel')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
};

export default SchoolConfigurationScreen;