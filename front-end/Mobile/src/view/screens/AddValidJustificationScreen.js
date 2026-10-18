import React, {useEffect, useMemo, useState} from "react";
import {
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {useTranslation} from "react-i18next";
import {useNavigation} from "@react-navigation/native";
import PrimaryButton from "../components/auth/PrimaryButton";
import BackButton from "../components/common/BackButton";
import {useTheme} from "../components/common/ThemeContext";
import {createAddValidJustificationStyles} from "./Styles/AddValidJustificationScreen/Style";
import {useAddValidJustificationViewModel} from "../../viewmodels/useAddValidJustificationViewModel";
import CustomAlert from "../components/common/CustomAlert";
import {useCustomAlert} from "../components/common/useCustomAlert";

// ─── Selector desplegable reutilizable (sin cambios) ─────────────────────────────
function DropdownSelector({ label, placeholder, value, options, onSelect, colors }) {
    const styles = useMemo(() => createAddValidJustificationStyles(colors), [colors]);
    const [visible, setVisible] = useState(false);

    return (
        <>
            {/* Campo selector */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setVisible(true)}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: colors.inputBackground,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderWidth: 1.5,
                    borderColor: value ? colors.primary : colors.border,
                    marginBottom: 4,
                }}
            >
                <Text
                    style={{
                        fontSize: 15,
                        color: value ? colors.text : colors.textMuted,
                        flex: 1,
                    }}
                >
                    {value || placeholder}
                </Text>
                <Text style={{ fontSize: 18, color: colors.primary }}>›</Text>
            </TouchableOpacity>

            {/* Modal bottom-sheet */}
            <Modal
                visible={visible}
                transparent
                animationType="slide"
                onRequestClose={() => setVisible(false)}
            >
                {/* Overlay oscuro */}
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setVisible(false)}
                    style={{ flex: 1, backgroundColor: colors.overlay }}
                />

                {/* Panel inferior */}
                <View
                    style={{
                        backgroundColor: colors.background,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingTop: 12,
                        paddingBottom: Platform.OS === "ios" ? 36 : 24,
                        maxHeight: "70%",
                        // Posición fija en la parte inferior
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                    }}
                >
                    {/* Handle bar */}
                    <View
                        style={{
                            width: 40,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: colors.border,
                            alignSelf: "center",
                            marginBottom: 16,
                        }}
                    />

                    {/* Título del panel */}
                    <Text
                        style={{
                            fontSize: 17,
                            fontWeight: "700",
                            color: colors.text,
                            paddingHorizontal: 24,
                            marginBottom: 16,
                        }}
                    >
                        {label}
                    </Text>

                    {/* Lista de opciones */}
                    <FlatList
                        data={options}
                        keyExtractor={(item) => item.id}
                        ItemSeparatorComponent={() => (
                            <View
                                style={{
                                    height: 1,
                                    backgroundColor: colors.border,
                                    marginHorizontal: 24,
                                }}
                            />
                        )}
                        renderItem={({ item }) => {
                            const isSelected = value === item.label;
                            return (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        onSelect(item.label);
                                        setVisible(false);
                                    }}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingHorizontal: 24,
                                        paddingVertical: 16,
                                        backgroundColor: isSelected
                                            ? colors.primary + "15"
                                            : "transparent",
                                    }}
                                >
                                    {/* Ícono de la opción */}
                                    <View
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            backgroundColor: isSelected
                                                ? colors.primary
                                                : colors.card,
                                            justifyContent: "center",
                                            alignItems: "center",
                                            marginRight: 14,
                                        }}
                                    >
                                        <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                                    </View>

                                    {/* Texto */}
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            style={{
                                                fontSize: 15,
                                                fontWeight: isSelected ? "700" : "500",
                                                color: isSelected ? colors.primary : colors.text,
                                            }}
                                        >
                                            {item.label}
                                        </Text>
                                        {item.description ? (
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    color: colors.textMuted,
                                                    marginTop: 2,
                                                }}
                                            >
                                                {item.description}
                                            </Text>
                                        ) : null}
                                    </View>

                                    {/* Checkmark */}
                                    {isSelected && (
                                        <Text
                                            style={{
                                                fontSize: 18,
                                                color: colors.primary,
                                                fontWeight: "700",
                                            }}
                                        >
                                            ✓
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                    />
                </View>
            </Modal>
        </>
    );
}

// ─── Pantalla principal ─────────────────────────────────────────────────────────
export default function AddValidJustificationScreen() {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = useMemo(() => createAddValidJustificationStyles(colors), [colors]);

    // Hook de alerta personalizada
    const {
        alertConfig,
        hideAlert,
        showError,
        showWarning,
        showConfirm,
    } = useCustomAlert();

    const {
        // Estados
        type, setType,
        description, setDescription,
        category, setCategory,
        requiresDocument, setRequiresDocument,
        isSaving,
        updateKey,

        // Datos
        categories,
        types,
        selectedCategory,
        selectedType,

        // Acciones
        handleBack,
        handleSave,

        // Manejo de errores (asumimos que el ViewModel expone 'error' y 'clearError')
        error,
        clearError,
        isEditing,
    } = useAddValidJustificationViewModel();

    // Mostrar errores automáticamente desde el ViewModel
    useEffect(() => {
        if (error) {
            showError(
                t("common.error"),
                error,
                hideAlert
            );
        }
    }, [error]);

    // Validación + confirmación antes de guardar
    const handleSaveWithValidation = () => {
        // Limpiar errores previos del ViewModel
        clearError?.();

        // Validar campos obligatorios
        if (!category || !type) {
            showWarning(
                t("validation.title"),
                t("validation.selectCategoryAndType"),
                [{ text: "OK", onPress: hideAlert }]
            );
            return;
        }
        if (!description.trim()) {
            showWarning(
                t("validation.title"),
                t("validation.descriptionRequired"),
                [{ text: "OK", onPress: hideAlert }]
            );
            return;
        }

        // Confirmación antes de guardar
        showConfirm(
            t("justify.confirmTitle"),
            t("justify.confirmMessage"),
            () => {
                // Confirmado: ejecutar guardado
                handleSave();
            },
            () => {
                // Cancelado
                console.log("Guardado cancelado por el usuario");
            }
        );
    };

    return (
        <>
            <SafeAreaView
                style={[styles.safeAreaWhite, { backgroundColor: colors.background }]}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.keyboardview}
                >
                    <ScrollView
                        style={styles.ScrollView}
                        contentContainerStyle={styles.ScrollViewContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.containerAddValidJustification}>
                            {/* ── Encabezado ───────────────────────────────────────── */}
                            <BackButton onPress={handleBack} />
                            <Text style={[styles.mainTitle, { color: colors.text, marginTop: Platform.OS === "ios" ? 0 : 15 }]}>
                                {t(isEditing ? "admin.editJustificationType" : "admin.newJustificationType")}
                            </Text>

                            {/* ── Tarjeta de resumen (aparece cuando ambos están seleccionados) ── */}
                            {selectedCategory && selectedType && (
                                <View
                                    style={{
                                        backgroundColor: colors.primary + "12",
                                        borderRadius: 14,
                                        padding: 16,
                                        marginTop: 16,
                                        marginBottom: 8,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 12,
                                        borderWidth: 1,
                                        borderColor: colors.primary + "30",
                                    }}
                                >
                                    <Text style={{ fontSize: 32 }}>{selectedType.icon}</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            style={{
                                                fontSize: 13,
                                                color: colors.textMuted,
                                                marginBottom: 2,
                                            }}
                                        >
                                            {selectedCategory.icon} {selectedCategory.label}
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 15,
                                                fontWeight: "700",
                                                color: colors.primary,
                                            }}
                                        >
                                            {selectedType.label}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* ── Selector de categoría ────────────────────────────── */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    { color: colors.text, marginTop: 24 },
                                ]}
                            >
                                {t("admin.category")} *
                            </Text>
                            <DropdownSelector
                                label={t("admin.category")}
                                placeholder={t("admin.selectCategory")}
                                value={category}
                                options={categories}
                                onSelect={setCategory}
                                colors={colors}
                            />

                            {/* ── Selector de tipo ─────────────────────────────────── */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    { color: colors.text, marginTop: 20 },
                                ]}
                            >
                                {t("admin.justificationType")} *
                            </Text>
                            <DropdownSelector
                                label={t("admin.justificationType")}
                                placeholder={t("admin.selectType")}
                                value={type}
                                options={types}
                                onSelect={setType}
                                colors={colors}
                            />

                            {/* ── Descripción ──────────────────────────────────────── */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    { color: colors.text, marginTop: 20 },
                                ]}
                            >
                                {t("admin.description")} *
                            </Text>
                            <TextInput
                                style={[
                                    styles.textInput,
                                    styles.textArea,
                                    {
                                        backgroundColor: colors.inputBackground,
                                        color: colors.text,
                                        borderColor: description
                                            ? colors.primary
                                            : colors.border,
                                        borderWidth: 1.5,
                                    },
                                ]}
                                placeholder={t("admin.descriptionPlaceholder")}
                                placeholderTextColor={colors.textMuted}
                                value={description}
                                onChangeText={setDescription}
                                multiline
                            />

                            {/* ── Toggle ¿Requiere documento? ──────────────────────── */}
                            <Text
                                style={[
                                    styles.inputLabel,
                                    { color: colors.text, marginTop: 4 },
                                ]}
                            >
                                {t("admin.requiresDocument")}
                            </Text>

                            <View
                                style={{
                                    flexDirection: "row",
                                    gap: 10,
                                    marginBottom: 8,
                                }}
                            >
                                {/* Opción SÍ */}
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setRequiresDocument(true)}
                                    style={{
                                        flex: 1,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                        paddingVertical: 14,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        borderColor: requiresDocument
                                            ? colors.primary
                                            : colors.border,
                                        backgroundColor: requiresDocument
                                            ? colors.primary
                                            : colors.inputBackground,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontWeight: "600",
                                            color: requiresDocument
                                                ? colors.onPrimary
                                                : colors.text,
                                        }}
                                    >
                                        {t("common.yes")}
                                    </Text>
                                </TouchableOpacity>

                                {/* Opción NO */}
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setRequiresDocument(false)}
                                    style={{
                                        flex: 1,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                        paddingVertical: 14,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        borderColor: !requiresDocument
                                            ? colors.primary
                                            : colors.border,
                                        backgroundColor: !requiresDocument
                                            ? colors.primary
                                            : colors.inputBackground,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontWeight: "600",
                                            color: !requiresDocument
                                                ? colors.onPrimary
                                                : colors.text,
                                        }}
                                    >
                                        {t("common.no")}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* ── Botones de acción ────────────────────────────────── */}
                            <View style={styles.actionButtonsContainer}>
                                <PrimaryButton
                                    title={
                                        isSaving
                                            ? t("common.saving")
                                            : t(isEditing ? "admin.updateJustification" : "admin.saveJustification")
                                    }
                                    onPress={handleSaveWithValidation}
                                    disabled={isSaving}
                                />
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                type={alertConfig.type}
                onClose={hideAlert}
            />
        </>
    );
}
