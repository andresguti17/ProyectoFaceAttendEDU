import React from 'react';
import {ActivityIndicator, FlatList, SafeAreaView, Text, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../components/common/ThemeContext';
import BackButton from '../components/common/BackButton';
import CustomAlert from '../components/common/CustomAlert';
import {useBiometricCasesViewModel} from '../../viewmodels/useBiometricCasesViewModel';

export default function BiometricCasesScreen() {
    const {t} = useTranslation();
    const {colors} = useTheme();
    const {cases, loading, busyId, reload, approve, reject, handleBack, alertConfig, hideAlert} = useBiometricCasesViewModel();

    const action = (color) => ({
        flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: color, alignItems: 'center',
    });

    const renderItem = ({item}) => (
        <View style={{backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder}}>
            <Text style={{color: colors.text, fontWeight: 'bold', fontSize: 16}}>{item.personName}</Text>
            <Text style={{color: colors.textSecondary, marginTop: 4}}>
                {t('biometricCases.requestedAt', {date: (item.requestedAt || '').slice(0, 10) || '—'})}
            </Text>
            <Text style={{color: colors.text, marginTop: 8}}>{item.reason}</Text>
            {busyId === item.caseId ? (
                <ActivityIndicator style={{marginTop: 12}} color={colors.primary}/>
            ) : (
                <View style={{flexDirection: 'row', gap: 12, marginTop: 12}}>
                    <TouchableOpacity style={action(colors.success)} onPress={() => approve(item)} accessibilityRole="button">
                        <Text style={{color: colors.success, fontWeight: '600'}}>{t('biometricCases.approve')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={action(colors.danger)} onPress={() => reject(item)} accessibilityRole="button">
                        <Text style={{color: colors.danger, fontWeight: '600'}}>{t('biometricCases.reject')}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, marginTop: 30}}>
                <BackButton onPress={handleBack}/>
                <Text style={{color: colors.text, fontSize: 20, fontWeight: 'bold', flex: 1}}>{t('biometricCases.title')}</Text>
            </View>
            {loading ? (
                <ActivityIndicator size="large" color={colors.primary}/>
            ) : (
                <FlatList
                    data={cases}
                    keyExtractor={(item) => String(item.caseId)}
                    renderItem={renderItem}
                    contentContainerStyle={{padding: 16}}
                    onRefresh={reload}
                    refreshing={false}
                    ListEmptyComponent={
                        <Text style={{color: colors.textSecondary, textAlign: 'center', marginTop: 40}}>{t('biometricCases.empty')}</Text>
                    }
                />
            )}
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
