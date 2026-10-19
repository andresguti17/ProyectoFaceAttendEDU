import React, {useEffect, useMemo, useState} from 'react';
import {
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import {createManageUsersStyles} from './Styles/ManageUsersScreen/Style';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../components/common/ThemeContext';
import {useCustomAlert} from '../components/common/useCustomAlert';
import CustomAlert from '../components/common/CustomAlert';
import BackButton from '../components/common/BackButton';
import PrimaryButton from '../components/auth/PrimaryButton';
import {ROLE_OPTIONS, useManageUsersViewModel} from '../../viewmodels/useManageUsersViewModel';
import {validateEmail} from '../../utils/validators';
import {areAllRequirementsMet, validatePasswordRequirements} from '../../utils/passwordValidator';

const ROLE_LABEL_KEYS = {Aprendiz: 'userRoles.student', Instructor: 'userRoles.teacher', Administrador: 'userRoles.administrator'};

export default function ManageUsersScreen({navigation, userRole, onLogout}) {
    const {t} = useTranslation();
    const {colors, theme, toggleTheme} = useTheme();
    const styles = useMemo(() => createManageUsersStyles(colors), [colors]);
    const {alertConfig, hideAlert, showError, showConfirm} = useCustomAlert();

    const {
        allStudents,
        students,
        teachers,
        updateKey,
        createUser,
        updateStudent,
        deleteStudent,
        updateTeacher,
        deleteTeacher,
    } = useManageUsersViewModel(userRole === 'Administrador');

    const emptyForm = (role) => ({
        name: '', lastName: '', documentNumber: '', email: '', telefono: '', username: '', password: '', role,
    });
    const [tab, setTab] = useState('students');
    const [modalVisible, setModalVisible] = useState(false);
    const [modalMode, setModalMode] = useState(null);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(emptyForm('Aprendiz'));

    useEffect(() => {
        if (userRole && userRole !== 'Administrador') {
            showError(
                t('manageUsers.accessDenied'),
                t('manageUsers.onlyAdmins')
            );
            navigation.goBack();
        }
    }, [userRole, navigation, showError]);

    const openAdd = () => {
        setEditing(null);
        setForm(emptyForm(tab === 'students' ? 'Aprendiz' : 'Instructor'));
        setModalMode('add');
        setModalVisible(true);
    };

    const openEdit = (item) => {
        setEditing(item);
        setForm({...emptyForm(item.role), ...item, password: ''});
        setModalMode('edit');
        setModalVisible(true);
    };

    const closeModal = () => {
        Keyboard.dismiss();
        setModalVisible(false);
        setModalMode(null);
    };

    const handleBackdropPress = () => {
        if (Keyboard.isVisible && Keyboard.isVisible()) {
            Keyboard.dismiss();
        } else {
            closeModal();
        }
    };

    const handleSave = async () => {
        Keyboard.dismiss();
        if (!form.name.trim() || !form.lastName.trim()) {
            showError(t('manageUsers.validation'), t('manageUsers.nameRequired'));
            return;
        }
        if (!form.documentNumber.trim()) {
            showError(t('manageUsers.validation'), t('manageUsers.documentRequired'));
            return;
        }
        if (form.email && !validateEmail(form.email)) {
            showError(t('manageUsers.validation'), t('manageUsers.invalidEmail'));
            return;
        }
        if (modalMode === 'add') {
            if (!form.username.trim()) {
                showError(t('manageUsers.validation'), t('manageUsers.usernameRequired'));
                return;
            }
            if (!areAllRequirementsMet(validatePasswordRequirements(form.password))) {
                showError(t('manageUsers.validation'), t('profile.passwordModal.errorPolicy'));
                return;
            }
        }
        setSaving(true);
        try {
            if (modalMode === 'add') {
                await createUser(form);
            } else if (tab === 'students') {
                await updateStudent({...editing, ...form});
            } else {
                await updateTeacher({...editing, ...form});
            }
            closeModal();
        } catch (error) {
            showError(t('common.error'), error?.message || t('manageUsers.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const confirmToggleStatus = (id, isActive) => {
        showConfirm(
            t('manageUsers.confirm'),
            t(isActive ? 'manageUsers.deactivateQuestion' : 'manageUsers.activateQuestion'),
            () => {
                tab === 'students' ? deleteStudent(id) : deleteTeacher(id);
            }
        );
    };

    const handleBack = () => navigation.goBack();

    const renderItem = ({item}) => {
        const inactive = item.status === false;
        return (
        <View style={[styles.manageUsersItem, {backgroundColor: colors.card}, inactive && {opacity: 0.55}]}>
            <TouchableOpacity
                style={styles.manageUsersItemInfo}
                onPress={() => navigation.navigate('UserDetailScreen', {user: item})}
            >
                <Text style={[styles.manageUsersItemName, {color: colors.text}]} numberOfLines={1}>
                    {item.nombre}
                </Text>
                <Text style={[styles.manageUsersItemMeta, {color: colors.textSecondary}]} numberOfLines={1}>
                    {`${item.role || ''} • ${item.email || item.username || ''}`}
                    {inactive ? ` • ${t('manageUsers.inactive')}` : ''}
                </Text>
            </TouchableOpacity>
            <View style={styles.manageUsersItemActions}>
                <TouchableOpacity
                    style={[styles.manageUsersActionButton, {borderColor: colors.primary}]}
                    onPress={() => openEdit(item)}
                >
                    <Text style={[styles.manageUsersActionText, {color: colors.primary}]}>
                        {t('common.edit')}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.manageUsersActionButton, {borderColor: inactive ? colors.success : colors.danger}]}
                    onPress={() => confirmToggleStatus(item.id, !inactive)}
                >
                    <Text style={[styles.manageUsersActionText, {color: inactive ? colors.success : colors.danger}]}>
                        {inactive ? t('common.activate') : t('common.deactivate')}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
        );
    };

    const renderEditContent = () => (
        <>
            <View style={[styles.manageUsersSheetHandle, {backgroundColor: colors.border}]}/>

            <Text style={[styles.manageUsersModalTitle, {color: colors.text}]}>
                {editing ? t('manageUsers.editStudentInfo') : t('manageUsers.newRecord')}
            </Text>
            <View style={[styles.manageUsersDivider, {backgroundColor: colors.border}]}/>

            {[
                {key: 'name', label: t('common.name')},
                {key: 'lastName', label: t('manageUsers.lastName')},
                {key: 'documentNumber', label: t('manageUsers.documentNumber')},
                {key: 'email', label: t('common.email'), keyboardType: 'email-address'},
                {key: 'telefono', label: t('manageUsers.phone'), keyboardType: 'phone-pad'},
                ...(editing ? [] : [
                    {key: 'username', label: t('manageUsers.username')},
                    {key: 'password', label: t('manageUsers.initialPassword'), secure: true},
                ]),
            ].map((field) => (
                <View key={field.key}>
                    <Text style={[styles.manageUsersFieldLabel, {color: colors.text}]}>{field.label}</Text>
                    <TextInput
                        placeholder={field.label}
                        accessibilityLabel={field.label}
                        placeholderTextColor={colors.modalInputPlaceholder}
                        style={[styles.manageUsersInput, {
                            color: colors.text,
                            backgroundColor: colors.modalInputBackground,
                            borderColor: colors.modalBorder,
                        }]}
                        value={String(form[field.key] ?? '')}
                        onChangeText={(text) => setForm((f) => ({...f, [field.key]: text}))}
                        keyboardType={field.keyboardType || 'default'}
                        secureTextEntry={!!field.secure}
                        autoCapitalize={field.key === 'name' || field.key === 'lastName' ? 'words' : 'none'}
                    />
                </View>
            ))}

            <Text style={[styles.manageUsersFieldLabel, {color: colors.text}]}>{t('manageUsers.role')}</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}} accessibilityRole="radiogroup">
                {ROLE_OPTIONS.map((role) => {
                    const selected = form.role === role;
                    return (
                        <TouchableOpacity
                            key={role}
                            onPress={() => setForm((f) => ({...f, role}))}
                            accessibilityRole="radio"
                            accessibilityState={{selected}}
                            style={{
                                paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1,
                                borderColor: colors.primary, backgroundColor: selected ? colors.primary : 'transparent',
                            }}
                        >
                            <Text style={{color: selected ? colors.modalButtonText : colors.primary}}>{t(ROLE_LABEL_KEYS[role])}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.manageUsersModalActions}>
                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Text
                        style={[
                            styles.secondaryButtonText,
                            {color: colors.textSecondary},
                        ]}
                    >
                        {t('common.save')}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.manageUsersCancelButton, {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                    }]}
                    onPress={closeModal}
                >
                    <Text style={styles.manageUsersCancelButtonText}>
                        {t('common.cancel')}
                    </Text>
                </TouchableOpacity>
            </View>
        </>
    );

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <SafeAreaView style={[styles.manageUsersContainer, {backgroundColor: colors.background}]}>
                <View style={[styles.manageUsersHeader, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <BackButton onPress={handleBack} />
                    <Text style={[styles.manageUsersTitle, {color: colors.text, flex: 1}]}>
                        {t('manageUsers.title')}
                    </Text>
                </View>

                <View style={styles.manageUsersTabs}>
                    <TouchableOpacity
                        style={[
                            styles.manageUsersTabButton,
                            tab === 'students' && {borderBottomColor: colors.primary, borderBottomWidth: 2},
                        ]}
                        onPress={() => setTab('students')}
                    >
                        <Text style={[styles.manageUsersTabText, {
                            color: tab === 'students' ? colors.primary : colors.text
                        }]}>
                            {t('manageUsers.students')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.manageUsersTabButton,
                            tab === 'teachers' && {borderBottomColor: colors.primary, borderBottomWidth: 2},
                        ]}
                        onPress={() => setTab('teachers')}
                    >
                        <Text style={[styles.manageUsersTabText, {
                            color: tab === 'teachers' ? colors.primary : colors.text
                        }]}>
                            {t('manageUsers.teachers')}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.manageUsersActionsRow}>
                    <PrimaryButton
                        title={
                            tab === 'students'
                                ? t('manageUsers.addStudent')
                                : t('manageUsers.addTeacher')
                        }
                        onPress={openAdd}
                    />
                </View>

                <FlatList
                    data={tab === 'students' ? students : teachers}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.manageUsersList}
                    ListEmptyComponent={() => (
                        <View style={styles.manageUsersEmpty}>
                            <Text style={[styles.manageUsersEmptyText, {color: colors.textSecondary}]}>
                                {t('manageUsers.noRecords')}
                            </Text>
                        </View>
                    )}
                />

                {/* ===== MODAL ===== */}
                <Modal
                    visible={modalVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={closeModal}
                >
                    <KeyboardAvoidingView
                        style={styles.manageUsersKav}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View style={styles.manageUsersOverlay}>
                            <Pressable style={styles.manageUsersBackdrop} onPress={handleBackdropPress}/>

                            <ScrollView
                                style={[styles.manageUsersSheet, {backgroundColor: colors.card}]}
                                contentContainerStyle={styles.manageUsersSheetContent}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={true}
                                bounces={false}
                            >
                                {renderEditContent()}
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                <CustomAlert
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    buttons={alertConfig.buttons}
                    onClose={hideAlert}
                    type={alertConfig.type}
                />
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
}

