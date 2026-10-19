import React, {useEffect, useMemo, useState} from 'react';
import {Text, TouchableOpacity, View,} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from './ThemeContext';
import {BloodTypeService, DEFAULT_BLOOD_TYPES} from '../../../services/BloodTypeService';
import {createCommonStyles} from './style/Style';

export const RHSelector = ({ selectedRH, onSelect }) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const stylescommon = useMemo(() => createCommonStyles(colors), [colors]);
    const [bloodTypes, setBloodTypes] = useState(DEFAULT_BLOOD_TYPES);

    useEffect(() => {
        let active = true;
        BloodTypeService.getAll().then((types) => {
            if (active) setBloodTypes(types);
        });
        return () => { active = false; };
    }, []);

    return (
        <View style={stylescommon.rhSelectorContainer}>
            <View style={stylescommon.rhGridContainer}>
                {bloodTypes.map((rh) => (
                    <TouchableOpacity
                        key={rh.id}
                        style={[
                            stylescommon.rhOption,
                            selectedRH?.id === rh.id && stylescommon.rhOptionSelected,
                            { backgroundColor: selectedRH?.id === rh.id ? colors.modalButton : colors.modalInputBackground, borderColor: colors.modalBorder }
                        ]}
                        onPress={() => onSelect(rh)}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            stylescommon.rhOptionText,
                            selectedRH?.id === rh.id && stylescommon.rhOptionTextSelected,
                            { color: selectedRH?.id === rh.id ? colors.modalButtonText : colors.modalInputText }
                        ]}>
                            {rh.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};