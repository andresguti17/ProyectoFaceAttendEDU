import React, { useMemo } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../common/ThemeContext';
import { createAuthStyles } from "./style/Style";

export default function PrimaryButton({
  title,
  onPress = () => { },
  disabled = false,
}) {
  const { colors } = useTheme();
  const styleAuth = useMemo(() => createAuthStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[
        styleAuth.buttonPrimary,
        { backgroundColor: colors.primary, borderColor: colors.primary },
        disabled && styleAuth.buttonDisabledPrimary,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styleAuth.textPrimaryButton, { color: colors.onPrimary }]}>{title}</Text>
    </TouchableOpacity>
  );
}
