import {Platform} from 'react-native';

export const appFontFamily = Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'sans-serif',
});

export const normalizeTypography = (styleDefinitions) => Object.fromEntries(
    Object.entries(styleDefinitions).map(([styleName, style]) => {
        if (!style || style.fontSize == null) {
            return [styleName, style];
        }

        const isIconStyle = /(Icon|Image|Emoji|Arrow|Chevron|Ring|Circle|Close|Flip|Capture)/i.test(styleName);
        if (isIconStyle) {
            return [styleName, {...style, fontFamily: appFontFamily}];
        }

        const fontSize = style.fontSize >= 20
            ? 20
            : style.fontSize >= 16
                ? 16
                : style.fontSize >= 13
                    ? 14
                    : 12;

        return [styleName, {...style, fontFamily: appFontFamily, fontSize}];
    }),
);
