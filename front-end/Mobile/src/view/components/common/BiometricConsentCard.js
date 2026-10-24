import React, {useCallback, useEffect, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from './ThemeContext';
import {useCustomAlert} from './useCustomAlert';
import CustomAlert from './CustomAlert';
import {ConsentService} from '../../../services/consentService';

// Perfil: estado de la autorización biométrica propia y su revocación (Ley 1581,
// art. 8-e). Revocar suprime las plantillas de rostro y huella en el servidor.
export default function BiometricConsentCard({personId}) {
    const {t} = useTranslation();
    const {colors} = useTheme();
    const {alertConfig, hideAlert, showConfirm, showSuccess, showError} = useCustomAlert();
    const [authorized, setAuthorized] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!personId) return undefined;
        let active = true;
        ConsentService.get(personId)
            .then((consent) => { if (active) setAuthorized(consent?.biometricAuthorized === true); })
            .catch(() => { if (active) setAuthorized(null); });
        return () => { active = false; };
    }, [personId]);

    const revoke = useCallback(async () => {
        setBusy(true);
        try {
            await ConsentService.revokeBiometric(personId);
            setAuthorized(false);
            showSuccess(t('privacyConsent.title'), t('privacyConsent.revoked'));
        } catch (e) {
            showError(t('privacyConsent.title'), e?.message || t('privacyConsent.saveError'));
        } finally {
            setBusy(false);
        }
    }, [personId, showSuccess, showError, t]);

    if (!personId || authorized === null) return null;

    return (
        <View style={{padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 8}}>
            <Text style={{fontWeight: '700', color: colors.text}}>{t('privacyConsent.biometricTitle')}</Text>
            <Text style={{color: colors.textSecondary}}>
                {authorized ? t('privacyConsent.biometricAuthorized') : t('privacyConsent.biometricNotAuthorized')}
            </Text>
            {authorized && (
                <TouchableOpacity
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => showConfirm(t('privacyConsent.revokeTitle'), t('privacyConsent.revokeConfirm'), revoke)}
                    style={{alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.danger, opacity: busy ? 0.6 : 1}}
                >
                    <Text style={{color: colors.danger, fontWeight: '600'}}>{t('privacyConsent.revokeButton')}</Text>
                </TouchableOpacity>
            )}
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                type={alertConfig.type}
                onClose={hideAlert}
            />
        </View>
    );
}
