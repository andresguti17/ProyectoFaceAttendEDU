import React from "react";
import { View, Text, StyleSheet } from "react-native";

/**
 * Pieces shared by the choice inputs (Checkbox, Radio, Switch): the active color of a
 * variant, the label + description block next to the control and the error line.
 */

/** Theme color of a variant, or danger when the input is in error. */
export function choiceActiveColor(c, variant, error) {
    if (error) return c.status.danger;
    const variantColors = {
        default: c.brand.primary,
        primary: c.brand.primary,
        success: c.status.success,
        warning: c.status.warning,
        danger: c.status.danger,
    };
    return variantColors[variant] || variantColors.default;
}

/** Label and description to the right of the control (nothing when both are empty). */
export function ChoiceText({ c, label, description, labelSize, disabled, error, labelStyle, containerStyle }) {
    if (!label && !description) return null;
    return (
        <View style={containerStyle}>
            {label && (
                <Text
                    style={[
                        styles.label,
                        {
                            fontSize: labelSize,
                            color: disabled ? c.text.disabled : error ? c.status.danger : c.text.primary,
                            fontWeight: "500",
                        },
                        labelStyle,
                    ]}
                >
                    {label}
                </Text>
            )}
            {description && (
                <Text
                    style={[
                        styles.description,
                        {
                            fontSize: labelSize - 1,
                            color: disabled ? c.text.disabled : c.text.secondary,
                            marginTop: 2,
                        },
                    ]}
                >
                    {description}
                </Text>
            )}
        </View>
    );
}

/** Translated error line under the control, aligned with the label (`offset` = control width + gap). */
export function ChoiceError({ c, message, labelSize, offset, t }) {
    if (!message) return null;
    return (
        <Text
            style={[
                styles.errorMessage,
                {
                    fontSize: labelSize - 1,
                    color: c.status.danger,
                    marginTop: 4,
                    marginLeft: offset,
                },
            ]}
        >
            {t(message)}
        </Text>
    );
}

const styles = StyleSheet.create({
    label: {
        lineHeight: 20,
    },
    description: {
        lineHeight: 18,
    },
    errorMessage: {
        lineHeight: 16,
    },
});
