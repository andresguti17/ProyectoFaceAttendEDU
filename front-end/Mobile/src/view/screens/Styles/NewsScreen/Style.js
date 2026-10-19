import {StyleSheet} from 'react-native';
import {normalizeTypography} from '../../../../utils/typography';

export const createNewsStyles = (colors) => StyleSheet.create(normalizeTypography({
bottomSpace: {
        height: 90,
    },

container: {
        flex: 1,
        paddingTop: 15,
        marginHorizontal: 20
    },

safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
}));

