import React, {useMemo} from 'react';
import {ActivityIndicator, SafeAreaView, Text, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import BottomBar from '../components/common/NavigationBar';
import ScrollViewWrapper from '../components/common/ScrollView';
import CustomTabs from '../components/common/CustomTabs';
import {createNewsStyles} from './Styles/NewsScreen/Style';
import {useTheme} from '../components/common/ThemeContext';
import {useNewsViewModel} from '../../viewmodels/useNewsViewModel';

export default function NewsScreen() {
    const {t, i18n} = useTranslation();
    const {colors} = useTheme();
    const styles = useMemo(() => createNewsStyles(colors), [colors]);
    const {userRole, updateKey, alerts, loading, error, resolvingId, canResolve, resolve, reload, canOpen, openAlert} = useNewsViewModel();

    const formatDate = (iso) => (iso ? new Date(iso).toLocaleString(i18n.language) : '—');

    return (
        <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.background}]} key={`${updateKey}`}>
            <ScrollViewWrapper>
                <View style={[styles.container, {marginHorizontal: 10}]}>
                    <CustomTabs userRole={userRole}/>

                    <Text style={{fontSize: 20, fontWeight: 'bold', marginTop: 24, marginHorizontal: 15, color: colors.text}}>
                        {t('news.alertsTitle')}
                    </Text>

                    {loading ? (
                        <ActivityIndicator style={{marginTop: 30}} size="large" color={colors.primary}/>
                    ) : (
                        <View style={{marginHorizontal: 15, marginTop: 12}}>
                            {!!error && (
                                <TouchableOpacity onPress={reload} accessibilityRole="button">
                                    <Text style={{color: colors.danger, marginBottom: 10}}>{error}</Text>
                                </TouchableOpacity>
                            )}
                            {alerts.length === 0 && !error && (
                                <Text style={{color: colors.textSecondary, textAlign: 'center', marginTop: 30}}>{t('news.empty')}</Text>
                            )}
                            {alerts.map((alert) => (
                                <TouchableOpacity key={alert.id} disabled={!canOpen(alert)} onPress={() => openAlert(alert)} activeOpacity={0.8}
                                                  accessibilityRole={canOpen(alert) ? 'button' : undefined}
                                                  accessibilityHint={canOpen(alert) ? t('consultJustify.viewDetail') : undefined} style={{
                                    backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10,
                                    borderLeftWidth: 4, borderLeftColor: alert.resolved ? colors.success : colors.warning,
                                }}>
                                    <Text style={{color: colors.text, fontWeight: 'bold'}}>{alert.title}</Text>
                                    {!!alert.person && <Text style={{color: colors.text, marginTop: 4}}>{alert.person}</Text>}
                                    <Text style={{color: colors.textSecondary, marginTop: 4}}>{formatDate(alert.raisedAt)}</Text>
                                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8}}>
                                        <Text style={{color: alert.resolved ? colors.success : colors.warning, fontWeight: '600'}}>
                                            {alert.resolved ? t('news.resolved') : t('news.open')}
                                        </Text>
                                        {canResolve && !alert.resolved && (
                                            resolvingId === alert.id
                                                ? <ActivityIndicator color={colors.primary}/>
                                                : (
                                                    <TouchableOpacity onPress={() => resolve(alert.id)} accessibilityRole="button"
                                                                      style={{paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.primary}}>
                                                        <Text style={{color: colors.primary}}>{t('news.resolve')}</Text>
                                                    </TouchableOpacity>
                                                )
                                        )}
                                    </View>
                                    {canOpen(alert) && (
                                        <Text style={{color: colors.primary, marginTop: 6, fontWeight: '600'}}>{t('consultJustify.viewDetail')}</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <View style={styles.bottomSpace}/>
                </View>
            </ScrollViewWrapper>

            <BottomBar/>
        </SafeAreaView>
    );
}
