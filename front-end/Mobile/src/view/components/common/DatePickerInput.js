import React, {useState} from 'react';
import {Platform, StyleSheet, Text, TouchableOpacity, View,} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useTranslation} from 'react-i18next';
import {useTheme} from './ThemeContext';
import {normalizeTypography} from '../../../utils/typography';

export const DatePickerInput = ({ value, onChange, placeholder, hint }) => {
    const { colors } = useTheme();
    const { t } = useTranslation();

    const parseValue = () => {
        if (value && value.length === 10) {
            const [day, month, year] = value.split('/');
            const d = new Date(Number(year), Number(month) - 1, Number(day));
            if (!isNaN(d.getTime())) return d;
        }
        return new Date();
    };

    const [date, setDate] = useState(parseValue);
    const [showPicker, setShowPicker] = useState(false);

    const formatDate = (d) =>
        `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    const handleChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowPicker(false);
            if (event.type === 'dismissed') return;
        }
        if (selectedDate) {
            setDate(selectedDate);
            onChange(formatDate(selectedDate));
        }
    };

    const confirmIOS = () => setShowPicker(false);

    return (
        <View style={styles.wrapper}>

            <TouchableOpacity
                style={[
                    styles.triggerButton,
                    {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                    },
                ]}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.7}
            >
                <Text style={[styles.triggerIcon, { color: colors.textSecondary }]}>📅</Text>
                <Text
                    style={[
                        styles.triggerText,
                        { color: value ? colors.text : colors.textSecondary },
                    ]}
                >
                    {value || placeholder || t('datePicker.selectDate')}
                </Text>
            </TouchableOpacity>

            {hint ? (
                <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text>
            ) : null}

            {Platform.OS === 'android' && showPicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={handleChange}
                    maximumDate={new Date()}
                />
            )}
            {Platform.OS === 'ios' && showPicker && (
                <View
                    style={[
                        styles.iosCard,
                        {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <DateTimePicker
                        value={date}
                        mode="date"
                        display="spinner"
                        onChange={handleChange}
                        maximumDate={new Date()}
                        style={styles.iosPicker}
                        textColor={colors.text}
                        locale="es-CO"
                    />
                    <TouchableOpacity
                        style={[styles.iosConfirmButton, { backgroundColor: colors.primary }]}
                        onPress={confirmIOS}
                    >
                        <Text style={[styles.iosConfirmText, { color: colors.onPrimary }]}>
                            {t('common.confirm')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create(normalizeTypography({
    wrapper: {
        width: '100%',
        marginTop: 8,
    },
    triggerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 13,
        gap: 10,
    },
    triggerIcon: {
        fontSize: 18,
    },
    triggerText: {
        fontSize: 15,
        flex: 1,
    },
    hint: {
        fontSize: 12,
        marginTop: 5,
        marginLeft: 4,
        fontStyle: 'italic',
    },
    iosCard: {
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 12,
        overflow: 'hidden',
        paddingBottom: 8,
    },
    iosPicker: {
        height: 180,
    },
    iosConfirmButton: {
        marginHorizontal: 16,
        marginTop: 4,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    iosConfirmText: {
        fontWeight: '600',
        fontSize: 15,
    },
}));