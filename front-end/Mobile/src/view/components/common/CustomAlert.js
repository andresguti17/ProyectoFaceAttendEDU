import React, {useMemo} from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
} from "react-native";
import {useTheme} from "./ThemeContext";

const {width} = Dimensions.get("window");

// Colores de cada tipo de alerta, tomados de los tokens del tema.
const typePalette = (colors, type) => {
    switch (type) {
        case "success": return {background: colors.success, text: colors.onSuccess};
        case "error":   return {background: colors.danger, text: colors.onDanger};
        case "warning": return {background: colors.warning, text: colors.onWarning};
        case "confirm": return {background: colors.primary, text: colors.onPrimary};
        default:        return {background: colors.modalBackground, text: colors.modalText};
    }
};

export default function CustomAlert({
                                        visible,
                                        title,
                                        message,
                                        buttons = [],
                                        onClose,
                                        type = "default",
                                    }) {
    const {colors} = useTheme();
    const styles = useMemo(() => createAlertStyles(colors), [colors]);
    const palette = typePalette(colors, type);

    const alertButtons =
        buttons.length > 0
            ? buttons
            : [
                {
                    text: "OK",
                    onPress: onClose,
                    style: "default",
                },
            ];

    const getButtonStyle = (style) => {
        switch (style) {
            case "cancel":
                return {
                    backgroundColor: colors.backButtonBackground,
                    textColor: colors.text,
                };
            case "destructive":
                return {
                    backgroundColor: colors.danger,
                    textColor: colors.onDanger,
                };
            default:
                return {
                    backgroundColor: type !== "default" ? palette.background : colors.primary,
                    textColor: type !== "default" ? palette.text : colors.onPrimary,
                };
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.alertContainer}>
                    {type !== "default" && (
                        <View style={[styles.header, {backgroundColor: palette.background}]}>
                            <Text style={[styles.headerText, {color: palette.text}]}>
                                {title}
                            </Text>
                        </View>
                    )}

                    {type === "default" && title && (
                        <Text style={styles.defaultTitle}>{title}</Text>
                    )}

                    <View style={styles.messageContainer}>
                        <Text style={styles.message}>{message}</Text>
                    </View>

                    <View style={styles.buttonContainer}>
                        {alertButtons.map((button, index) => {
                            const buttonStyle = getButtonStyle(button.style);
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.button,
                                        {backgroundColor: buttonStyle.backgroundColor},
                                        alertButtons.length > 1 && styles.buttonFlex,
                                    ]}
                                    onPress={() => {
                                        button.onPress && button.onPress();
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text
                                        style={[
                                            styles.buttonText,
                                            {color: buttonStyle.textColor},
                                            button.style === "cancel" && styles.cancelButtonText,
                                        ]}
                                    >
                                        {button.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const createAlertStyles = (colors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 20,
    },
    alertContainer: {
        width: width * 0.88,
        backgroundColor: colors.modalBackground,
        borderRadius: 20,
        paddingTop: 28,
        paddingBottom: 24,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        paddingVertical: 18,
        paddingHorizontal: 24,
        alignItems: "center",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -28,
        marginBottom: 8,
    },
    headerText: {
        fontSize: 19,
        fontWeight: "700",
        letterSpacing: 0.3,
    },
    defaultTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: colors.modalText,
        textAlign: "center",
        paddingTop: 8,
        paddingHorizontal: 24,
        marginBottom: 10,
    },
    messageContainer: {
        paddingVertical: 20,
        paddingHorizontal: 24,
    },
    message: {
        fontSize: 16,
        color: colors.modalTextSecondary,
        textAlign: "justify",
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: colors.border,
        marginTop: 4,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        marginHorizontal: 6,
        marginTop: 8,
        marginBottom: 4,
    },
    buttonFlex: {
        flex: 1,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: "600",
    },
    cancelButtonText: {
        fontWeight: "500",
    },
});
