import BackButton from '../components/common/BackButton';
import React, {useMemo} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import CustomLogo from '../components/common/logo';
import Separador from '../components/common/Separador';
import {createMenuJustifyStyles} from './Styles/MenuJustifyScreen/Style';
import {useTheme} from '../components/common/ThemeContext';
import {useMenuJustifyViewModel} from '../../viewmodels/useMenuJustifyViewModel';
import {useUser} from '../../utils/UserContext';

export default function MenuJustifyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createMenuJustifyStyles(colors), [colors]);

  const {isAdmin, isStudent, isTeacher} = useUser();

  const {
    updateKey,
    handleBack,
    handleAddOrEditJustify,
    handleValidJustifications,
    handlePendingJustificationScreen,
    handleJustificationTypes,
  } = useMenuJustifyViewModel();

  const Header = ({ title }) => (
      <View style={styles.headerContainer}>
        <Text style={[styles.mainTitle, { color: colors.text }]}>
          {title}
        </Text>
        <CustomLogo
            size="small"
            rounded={true}
            backgroundColor={colors.card}
            marginBottom={35}
        />
      </View>
  );

  const MenuItem = ({ label, onPress, showBadge = false }) => (
      <>
        <Separador />
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          <View style={styles.menuItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={[styles.sectionTitleMenu, { color: colors.text, flex: 1 }]}>
                {label}
              </Text>
            </View>
            <Image
                source={require('../../assets/images/flecha-volver.png')}
                style={[styles.arrowImage, { tintColor: colors.text }]}
            />
          </View>
        </TouchableOpacity>
      </>
  );

  return (
      <SafeAreaView style={[styles.safeAreaWhite, { backgroundColor: colors.backgroundWhite }]} key={`${updateKey}`}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardview}>

          <ScrollView
              style={styles.ScrollView}
              contentContainerStyle={[styles.ScrollViewContent, { paddingBottom: 24 }]}
              showsVerticalScrollIndicator={false}
          >
            <BackButton onPress={handleBack} />
            <View style={styles.containerMenuJustify}>
              <View style={styles.mainContent}>
                <Header title={isStudent ? t('justify.title') : t('admin.justificationManagement')} />

                {(isStudent || isTeacher) ? (
                    <>
                      {isStudent && (
                        <MenuItem label={t('teacher.newJustification')} onPress={handleAddOrEditJustify} />
                      )}
                      <MenuItem label={t('consultJustify.mainTitle')} onPress={handleValidJustifications} />
                      <MenuItem label={t('admin.pendingJustifications')} onPress={handlePendingJustificationScreen} />
                    </>
                ) : (
                    <>
                      <MenuItem label={t('admin.validJustifications')} onPress={handleValidJustifications} />
                      <MenuItem label={t('admin.pendingJustifications')} onPress={handlePendingJustificationScreen} />
                      <MenuItem label={t('admin.addNewJustification')} onPress={handleAddOrEditJustify}/>
                      <MenuItem label={t('justifications.typesTitle')} onPress={handleJustificationTypes}/>
                    </>
                )}
              </View>
            </View>
          </ScrollView>

        </KeyboardAvoidingView>
      </SafeAreaView>
  );
}