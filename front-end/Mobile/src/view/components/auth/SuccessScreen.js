import React, { useMemo } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity } from 'react-native';
import { createAuthStyles } from './style/Style';

export function SuccessScreen({ colors, t, onNavigateToLogin }) {
    const styleAuth = useMemo(() => createAuthStyles(colors), [colors]);
    return (
        <SafeAreaView style={[styleAuth.safeAreaWhite, { backgroundColor: colors.backgroundWhite }]}>
            <View style={styleAuth.successContainer}>
                <Text style={[styleAuth.successTitle, { color: colors.text }]}>
                    {t('passwordUpdate.successTitle')}
                </Text>
                <Text style={[styleAuth.successMessage, { color: colors.textSecondary }]}>
                    {t('passwordUpdate.successMessage')}
                </Text>
                <TouchableOpacity
                    style={[styleAuth.recoveryPrimaryButton, {
                        backgroundColor: colors.primary,
                        marginTop: 32,
                        padding: 10,
                    }]}
                    onPress={onNavigateToLogin}
                    activeOpacity={0.8}
                    accessibilityLabel={t('passwordUpdate.goToLogin')}
                    accessibilityRole="button"
                >
                    <Text style={styleAuth.recoveryPrimaryButtonText}>
                        {t('passwordUpdate.goToLogin')}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
