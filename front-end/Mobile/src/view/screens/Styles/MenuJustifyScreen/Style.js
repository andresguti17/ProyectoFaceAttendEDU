import {StyleSheet} from 'react-native';
import {appFontFamily, normalizeTypography} from '../../../../utils/typography';

// Estilos del menú de justificaciones. Todo color sale de los tokens del tema; usar con createMenuJustifyStyles(colors).
export const createMenuJustifyStyles = (colors) => StyleSheet.create(normalizeTypography({
ScrollView: {
        flex: 1,
    },

ScrollViewContent: {
        flexGrow: 1,
        paddingBottom: 30,
    },

arrowImage: {
        transform: [{rotate: '180deg'}],
        width: 26,
        height: 26,
        marginLeft: "auto",
        opacity: 0.5,
    },

containerMenuJustify: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 20,
        marginTop: 40,
    },

headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        marginTop: 10,
    },

keyboardview: {
        flex: 1,
    },

mainContent: {
        flex: 1,
    },

mainTitle: {
        fontSize: 28,
        fontWeight: "800",
        flex: 1,
        textAlign: "left",
    },

menuItem: {
        justifyContent: "space-between",
        alignItems: "center",
        flexDirection: "row",
        paddingVertical: 5,
    },

safeAreaWhite: {
        flex: 1,
        backgroundColor: colors.backgroundWhite,
    },

sectionTitleMenu: {
        fontSize: 18,
        fontFamily: appFontFamily,
        textAlign: "justify",
        marginBottom: 15,
        color: colors.text,
        fontWeight: '600',
        marginTop: 15,
        alignSelf: "left",
    },
}));
