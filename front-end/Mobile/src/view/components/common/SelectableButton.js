import React, {useMemo, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from './ThemeContext';
import {createCommonStyles} from './style/Style';

export default function SelectableButton({
    title,
    onPress = () => { },
    disabled = false,
    checked = false,
    onCheckChange = null,
}) {
    const {colors} = useTheme();
    const styleAuth = useMemo(() => createCommonStyles(colors), [colors]);
    const [isChecked, setIsChecked] = useState(checked);

    const handlePress = () => {
        if (disabled) return;

        const newCheckedState = !isChecked;
        setIsChecked(newCheckedState);

        if (onCheckChange) {
            onCheckChange(newCheckedState);
        }

        onPress();
    };

    return (
        <TouchableOpacity
            style={[
                styleAuth.containerSelectable,
                disabled && styleAuth.containerDisabledSelectable,
            ]}
            onPress={handlePress}
            disabled={disabled}
            activeOpacity={0.7}
        >
            <View style={[
                styleAuth.checkboxSelectable,
                isChecked && styleAuth.checkboxCheckedSelectable,
                disabled && styleAuth.checkboxDisabledSelectable
            ]}>
                {isChecked && <Text style={styleAuth.checkmarkSelectable}>✓</Text>}
            </View>
            <Text style={[
                styleAuth.textSelectable,
                disabled && styleAuth.textDisabledSelectable
            ]}>
                {title}
            </Text>
        </TouchableOpacity>
    );
}