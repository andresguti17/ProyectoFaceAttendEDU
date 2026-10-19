import React, {useMemo} from 'react';
import {Image, View} from "react-native";
import {useTranslation} from "react-i18next";
import {useTheme} from "./ThemeContext";
import {createCommonStyles} from "./style/Style";

export default function CustomLogo({
  source,
  size = "medium",
  customSize,
  rounded = true,
  backgroundColor,
  marginBottom = 20,
}) {
  const {t} = useTranslation();
  const {colors} = useTheme();
  const styleAuth = useMemo(() => createCommonStyles(colors), [colors]);

  const getSize = () => {
    if (customSize) return customSize;

    switch (size) {
      case "small":
        return { width: 80, height: 80 };
      case "medium":
        return { width: 120, height: 120 };
      case "large":
        return { width: 160, height: 160 };
      case "xlarge":
        return { width: 200, height: 200 };
      default:
        return { width: 120, height: 120 };
    }
  };

  const dimensions = getSize();

  return (
    <View
      style={[
        styleAuth.container,
        {
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: rounded ? dimensions.width / 2 : 0,
          backgroundColor: backgroundColor ?? colors.text,
          marginBottom,
        },
      ]}
    >
      <Image
        style={styleAuth.image}
        source={source || require("../../../assets/images/logoFaceAttend.png")}
        accessibilityLabel={t('common.logoLabel')}
        resizeMode="cover"
      />
    </View>
  );
}
