// ============================================================
//  SessionWarningModal — Modal de advertencia de expiración de sesión
// ============================================================
//
//  Componente que muestra una advertencia cuando la sesión está por expirar.
//  Permite al usuario extender la sesión o cerrar sesión manualmente.
//
//  Props:
//   - visible: boolean - Si el modal está visible
//   - timeRemaining: number - Segundos restantes
//   - onExtendSession: () => void - Función para extender la sesión
//   - onLogout: () => void - Función para cerrar sesión
// ============================================================

import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../../../core/utils/i18n/hooks/useTranslation';
import { formatTime } from '../../../../core/constants/dateFormats';
import BaseModal from '../modals/BaseModal';
import Button from '../buttons/Button';

export default function SessionWarningModal({
    visible,
    timeRemaining,
    onExtendSession,
    onLogout
}) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.colors;

    // Usar utilitario global en lugar de función local
    const formatTimeRemaining = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    // Determinar urgencia para colores dinámicos
    const isUrgent = timeRemaining <= 60; // Menos de 1 minuto
    const isCritical = timeRemaining <= 30; // Menos de 30 segundos
    
    // Colores dinámicos basados en tiempo restante
    const timeColor = isCritical ? c.status.error : 
                     isUrgent ? c.status.warning : 
                     c.status.warning;
    
    const timeBgColor = isCritical ? c.status.errorLight : 
                       isUrgent ? c.status.warningLight : 
                       c.status.warningLight;

    return (
        <BaseModal
            visible={visible}
            onClose={() => {}} // Sin función = no se puede cerrar
            closeOnBackdrop={false} // No permitir cerrar tocando fuera
            showCloseButton={false} // No mostrar botón X
            title={t("Sesión por expirar")}
            size="sm"
        >
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                {/* Icono de advertencia */}
                <View style={{
                    backgroundColor: c.status.warningLight,
                    borderRadius: 50,
                    width: 80,
                    height: 80,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 24
                }}>
                    <Feather name="clock" size={36} color={c.status.warning} />
                </View>

                {/* Mensaje principal */}
                <Text style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: c.text.primary,
                    textAlign: 'center',
                    marginBottom: 8
                }}>
                    {t("Tu sesión expirará pronto")}
                </Text>

                {/* Tiempo restante con colores dinámicos */}
                <View style={{
                    backgroundColor: timeBgColor,
                    borderRadius: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    marginBottom: 16,
                    // Animación de parpadeo para casos críticos
                    opacity: isCritical ? 0.8 : 1.0
                }}>
                    <Text style={{
                        fontSize: 24,
                        fontWeight: '700',
                        color: timeColor,
                        textAlign: 'center'
                    }}>
                        {formatTimeRemaining(timeRemaining)}
                    </Text>
                </View>

                {/* Descripción */}
                <Text style={{
                    fontSize: 14,
                    color: c.text.secondary,
                    textAlign: 'center',
                    lineHeight: 20,
                    marginBottom: 24
                }}>
                    {t("Por seguridad, tu sesión se cerrará automáticamente por inactividad. ¿Deseas continuar?")}
                </Text>

                {/* Botones */}
                <View style={{ 
                    flexDirection: 'row', 
                    gap: 12, 
                    width: '100%',
                    justifyContent: 'center'
                }}>
                    <Button
                        variant="outline"
                        size="sm"
                        onPress={onLogout}
                        style={{ flex: 1, maxWidth: 120 }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text.secondary }}>
                            {t("Cerrar sesión")}
                        </Text>
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        onPress={onExtendSession}
                        style={{ flex: 1, maxWidth: 120 }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                            {t("Continuar")}
                        </Text>
                    </Button>
                </View>
            </View>
        </BaseModal>
    );
}