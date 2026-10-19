import React, {useEffect, useMemo, useState} from "react";
import {Image, TouchableOpacity, View} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useNavigation, useRoute} from "@react-navigation/native";
import {useTheme} from './ThemeContext';
import {createCommonStyles} from "./style/Style";

export default function BottomBar({ onPressSettings, onPressProfile, onPressSearch, screenNames = {} }) {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, theme, loadThemeForRole } = useTheme();
  const stylescommon = useMemo(() => createCommonStyles(colors), [colors]);

  const [selected, setSelected] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const loadUserRole = async () => {
      const role = await AsyncStorage.getItem('userRole');
      setUserRole(role);
      if (role) await loadThemeForRole(role);
    };
    loadUserRole();
  }, []);

  const defaultscreens = {
    menu: "Menu",
    photo: "UpdatePhoto",
    profile: "Profile",
  };

  const {
    menu: menuScreen = defaultscreens.menu,
    photo: photoScreen = defaultscreens.photo,
    profile: profileScreen = defaultscreens.profile,
  } = screenNames;

  const handleMenu = () => onPressSettings ? onPressSettings() : navigation.navigate(menuScreen);
  const handleFoto = () => onPressProfile ? onPressProfile() : navigation.navigate(photoScreen);
  const handleBusqueda = () => onPressSearch ? onPressSearch() : navigation.navigate(profileScreen);

  const getSelectedButton = (routeName) => {
    switch (routeName) {
      case "Menu": return "menu";
      case "UpdatePhoto": return "photo";
      case "Profile": return "profile";
      default: return null;
    }
  };

  useEffect(() => {
    setSelected(getSelectedButton(route?.name));
  }, [route?.name]);

  // ✅ FIX BORDE: sin borderWidth ni borderColor en el botón,
  // solo el backgroundColor activo/inactivo sin bordes extra.
  const getButtonStyle = (key) => [
    stylescommon.navButton,
    {
      backgroundColor: selected === key ? colors.tabActive : 'transparent',
      // Se elimina borderColor que en modo oscuro podía
      // generar bordes visibles no deseados.
      borderWidth: 0,
    }
  ];

  // Íconos inactivos en colors.text (claro en oscuro, oscuro en claro).
  // El activo usa colors.primary en ambos temas.
  const getIconTint = (key) => {
    if (selected === key) return colors.primary;
    return colors.text;
  };

  return (
      <View
          style={[
            stylescommon.navBarContainer,
            {
              backgroundColor: colors.navBar,
              // ✅ FIX BORDE: se fuerza borderTopWidth a 0.
              // colors.border en oscuro puede tener un valor visible
              // que genera la línea/borde superior no deseada.
              borderTopWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
            }
          ]}
      >
        <TouchableOpacity onPress={handleMenu} style={getButtonStyle("menu")}>
          <Image
              source={require("../../../assets/images/configuraciones.png")}
              style={[stylescommon.navIcon, { tintColor: getIconTint("menu") }]}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleFoto} style={getButtonStyle("profile")}>
          <Image
              source={require("../../../assets/images/perfil-del-usuario.png")}
              style={[stylescommon.navIconCenter, { tintColor: getIconTint("profile") }]}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleBusqueda} style={getButtonStyle("search")}>
          <Image
              source={require("../../../assets/images/avatar.png")}
              style={[
                stylescommon.navIcon,
                { tintColor: getIconTint("search"), width: 35, height: 35 }
              ]}
          />
        </TouchableOpacity>
      </View>
  );
}