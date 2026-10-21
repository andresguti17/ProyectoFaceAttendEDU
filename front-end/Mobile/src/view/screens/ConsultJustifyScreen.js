import BackButton from '../components/common/BackButton';
import React, {useMemo} from 'react';
import {
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import PrimaryButton from '../components/auth/PrimaryButton';
import Separador from '../components/common/Separador';
import {createConsultJustifyStyles} from './Styles/ConsultJustifyScreen/Style';
import {useTheme} from '../components/common/ThemeContext';
import {useValidJustificationsViewModel} from '../../viewmodels/useConsultJustifyViewModel';

export default function ValidJustificationsScreen() {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = useMemo(() => createConsultJustifyStyles(colors), [colors]);

    const {
        activeSection,
        setActiveSection,
        updateKey,
        inasistenciasData,
        retardosData,
        currentData,
        isLoading,
        error,
        retry,
        handleBack,
        getEstadoColor,
        getEstadoLabel,
        selectedItem,
        openDetail,
        closeDetail,
    } = useValidJustificationsViewModel();

    // Tarjeta con borde propio: evita que "flote" sin definición cuando
    // colors.card y colors.background son tonos muy parecidos en modo oscuro.
    const cardStyle = [
        styles.justificationCard,
        {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
        },
    ];

    const cardA11y = (item) => ({
        onPress: () => openDetail(item),
        activeOpacity: 0.8,
        accessibilityRole: 'button',
        accessibilityLabel: `${item.fecha} · ${item.motivo} · ${getEstadoLabel(item.estado)}`,
        accessibilityHint: t('consultJustify.viewDetail'),
    });

    const renderInasistenciaItem = ({ item }) => (
        <TouchableOpacity style={cardStyle} {...cardA11y(item)}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardDate, { color: colors.text }]}>{item.fecha}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getEstadoColor(item.estado) }]}>
                    <Text style={[styles.statusText, { color: colors.onPrimary }]}>{getEstadoLabel(item.estado)}</Text>
                </View>
            </View>
            <Text style={[styles.cardReason, { color: colors.textSecondary }]}>{item.motivo}</Text>
        </TouchableOpacity>
    );

    const renderRetardoItem = ({ item }) => (
        <TouchableOpacity style={cardStyle} {...cardA11y(item)}>
            <View style={styles.cardHeader}>
                <View style={styles.dateTimeContainer}>
                    <Text style={[styles.cardDate, { color: colors.text }]}>{item.fecha}</Text>
                    <Text style={[styles.cardTime, { color: colors.textSecondary }]}>{item.hora}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getEstadoColor(item.estado) }]}>
                    <Text style={[styles.statusText, { color: colors.onPrimary }]}>{getEstadoLabel(item.estado)}</Text>
                </View>
            </View>
            <Text style={[styles.cardReason, { color: colors.textSecondary }]}>{item.motivo}</Text>
        </TouchableOpacity>
    );

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
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.containerValidJustifications}>
                        <View style={styles.headerTopRowValidJustifications}>
                            <BackButton onPress={handleBack} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.mainTitleValidJustifications, { color: colors.text }]}>
                                    {t('consultJustify.mainTitle')}
                                </Text>

                                <Text style={[styles.subTitleValidJustifications, { color: colors.textSecondary }]}>
                                    {t('consultJustify.subtitle')}
                                </Text>
                            </View>
                        </View>

                        <Separador />

                        <View
                            style={[
                                styles.sectionSelector,
                                {
                                    backgroundColor: colors.card,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    borderRadius: 12,
                                    padding: 4,
                                },
                            ]}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.sectionTab,
                                    {
                                        backgroundColor:
                                            activeSection === 'inasistencias' ? colors.primary : 'transparent',
                                        borderRadius: 9,
                                    },
                                    activeSection === 'inasistencias' && styles.activeSectionTab,
                                ]}
                                onPress={() => setActiveSection('inasistencias')}
                            >
                                <Text
                                    style={[
                                        styles.sectionTabText,
                                        {
                                            color:
                                                activeSection === 'inasistencias' ? colors.onPrimary : colors.textSecondary,
                                            fontWeight: activeSection === 'inasistencias' ? '700' : '500',
                                        },
                                    ]}
                                >
                                    {t('consultJustify.absences')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.sectionTab,
                                    {
                                        backgroundColor:
                                            activeSection === 'retardos' ? colors.primary : 'transparent',
                                        borderRadius: 9,
                                    },
                                    activeSection === 'retardos' && styles.activeSectionTab,
                                ]}
                                onPress={() => setActiveSection('retardos')}
                            >
                                <Text
                                    style={[
                                        styles.sectionTabText,
                                        {
                                            color:
                                                activeSection === 'retardos' ? colors.onPrimary : colors.textSecondary,
                                            fontWeight: activeSection === 'retardos' ? '700' : '500',
                                        },
                                    ]}
                                >
                                    {t('consultJustify.delays')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {error ? (
                            <View
                                style={[
                                    styles.emptyContainer,
                                    {
                                        backgroundColor: colors.card,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        borderStyle: 'dashed',
                                    },
                                ]}
                            >
                                <Text style={[styles.emptyText, { color: colors.text }]}>
                                    {error}
                                </Text>
                                <View style={{ marginTop: 12, alignSelf: 'stretch' }}>
                                    <PrimaryButton title={t('common.retry')} onPress={retry} />
                                </View>
                            </View>
                        ) : null}

                        {!error && activeSection === 'inasistencias' && (
                            <View style={styles.listContainer}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                    {t('consultJustify.justifiedAbsences')}
                                </Text>
                                {inasistenciasData.length > 0 ? (
                                    <FlatList
                                        data={inasistenciasData}
                                        keyExtractor={(item) => item.id.toString()}
                                        renderItem={renderInasistenciaItem}
                                        scrollEnabled={false}
                                    />
                                ) : (
                                    <View
                                        style={[
                                            styles.emptyContainer,
                                            {
                                                backgroundColor: colors.card,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                borderStyle: 'dashed',
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                            {t('consultJustify.noAbsencesRegistered')}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {!error && activeSection === 'retardos' && (
                            <View style={styles.listContainer}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                    {t('consultJustify.justifiedDelays')}
                                </Text>
                                {retardosData.length > 0 ? (
                                    <FlatList
                                        data={retardosData}
                                        keyExtractor={(item) => item.id.toString()}
                                        renderItem={renderRetardoItem}
                                        scrollEnabled={false}
                                    />
                                ) : (
                                    <View
                                        style={[
                                            styles.emptyContainer,
                                            {
                                                backgroundColor: colors.card,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                borderStyle: 'dashed',
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                            {t('consultJustify.noDelaysRegistered')}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Detalle: el aprendiz ve el resultado y el comentario del revisor (ERF 6.2 / 6.3) */}
            <Modal visible={!!selectedItem} transparent animationType="slide" onRequestClose={closeDetail}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <Pressable style={{ flex: 1 }} onPress={closeDetail} accessibilityLabel={t('common.close')} />
                    {!!selectedItem && (
                        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 }} accessibilityRole="header">
                                {t('consultJustify.detailTitle')}
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: getEstadoColor(selectedItem.estado), alignSelf: 'flex-start', marginBottom: 12 }]}>
                                <Text style={[styles.statusText, { color: colors.onPrimary }]}>{getEstadoLabel(selectedItem.estado)}</Text>
                            </View>
                            <Text style={{ color: colors.textSecondary }}>{t('consultJustify.case')}</Text>
                            <Text style={{ color: colors.text, marginBottom: 10 }}>{selectedItem.motivo}</Text>
                            <Text style={{ color: colors.textSecondary }}>{t('consultJustify.submittedAt')}</Text>
                            <Text style={{ color: colors.text, marginBottom: 10 }}>{selectedItem.fecha}</Text>
                            <Text style={{ color: colors.textSecondary }}>{t('consultJustify.descriptionTitle')}</Text>
                            <Text style={{ color: colors.text, marginBottom: 10 }}>{selectedItem.description || '—'}</Text>
                            {selectedItem.estado !== 'pending' && (
                                <>
                                    <Text style={{ color: colors.textSecondary }}>
                                        {selectedItem.estado === 'rejected' ? t('consultJustify.rejectionReason') : t('consultJustify.reviewerNotes')}
                                    </Text>
                                    <Text style={{ color: selectedItem.estado === 'rejected' ? colors.danger : colors.text, marginBottom: 16 }}>
                                        {selectedItem.reviewerNotes || t('consultJustify.noReviewerNotes')}
                                    </Text>
                                </>
                            )}
                            <PrimaryButton title={t('common.close')} onPress={closeDetail} />
                        </View>
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}