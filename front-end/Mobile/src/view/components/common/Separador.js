import React, {useMemo} from 'react';
import {View} from 'react-native';
import {useTheme} from './ThemeContext';
import {createCommonStyles} from './style/Style';

const Separador = () => {
  const {colors} = useTheme();
  const stylescommon = useMemo(() => createCommonStyles(colors), [colors]);
  return <View style={stylescommon.separador} />;
};

export default Separador;
