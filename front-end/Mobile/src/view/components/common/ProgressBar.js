import React, {useMemo} from 'react';
import {Text, View,} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from './ThemeContext';
import {createCommonStyles} from './style/Style';

export const ProgressBar = ({ currentStep, totalSteps }) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const stylescommon = useMemo(() => createCommonStyles(colors), [colors]);
    const progress = (currentStep / totalSteps) * 100;

    return (
        <View style={stylescommon.progressContainer}>
            <Text style={[stylescommon.progressText, { color: colors.modalTextSecondary }]}>{t('progressBar.question', { currentStep, totalSteps })}</Text>
            <View style={[stylescommon.progressBar, { backgroundColor: colors.progressBackground }]}>
                <View style={[stylescommon.progressFill, { width: `${progress}%`, backgroundColor: colors.modalButton }]} />
            </View>
        </View>
    );
};