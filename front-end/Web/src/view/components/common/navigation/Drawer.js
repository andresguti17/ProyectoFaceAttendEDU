import React from "react";
import { View, Modal, TouchableOpacity, Animated, Dimensions, StyleSheet, Platform , Text } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

// Fix for missing import
import { Feather } from "@expo/vector-icons";


const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * Drawer component - Side menu/panel deslizable
 * 
 * Panel lateral que se desliza desde el borde de la pantalla. Ideal para
 * menús de navegación, filtros, o paneles de configuración.
 * 
 * @param {boolean} visible - Si el drawer está visible
 * @param {function} onClose - Callback al cerrar drawer
 * @param {('left'|'right')} position - Posición del drawer
 * @param {number|string} width - Ancho del drawer (number o porcentaje)
 * @param {ReactNode} children - Contenido del drawer
 * @param {boolean} closeOnBackdrop - Cerrar al tocar backdrop
 * @param {object} style - Estilos adicionales del drawer
 * 
 * @example
 * // Drawer básico (menú lateral)
 * const [drawerVisible, setDrawerVisible] = useState(false);
 * <Drawer
 *   visible={drawerVisible}
 *   onClose={() => setDrawerVisible(false)}
 *   position="left"
 * >
 *   <View style={{ padding: 20 }}>
 *     <Text>Menu Items</Text>
 *     <TouchableOpacity onPress={() => navigation.navigate('Home')}>
 *       <Text>Home</Text>
 *     </TouchableOpacity>
 *   </View>
 * </Drawer>
 * 
 * @example
 * // Drawer de filtros (derecha)
 * <Drawer
 *   visible={filtersVisible}
 *   onClose={() => setFiltersVisible(false)}
 *   position="right"
 *   width={300}
 * >
 *   <View style={{ padding: 16 }}>
 *     <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Filtros</Text>
 *     <Select label="Categoría" {...} />
 *     <DatePicker label="Fecha" {...} />
 *     <Button onPress={applyFilters}>Aplicar</Button>
 *   </View>
 * </Drawer>
 * 
 * @example
 * // Drawer ancho completo
 * <Drawer
 *   visible={menuVisible}
 *   onClose={() => setMenuVisible(false)}
 *   width="100%"
 * >
 *   <FullScreenMenu />
 * </Drawer>
 * 
 * @example
 * // Con botón de apertura
 * <View>
 *   <IconButton
 *     icon="menu"
 *     onPress={() => setDrawerVisible(true)}
 *   />
 *   <Drawer
 *     visible={drawerVisible}
 *     onClose={() => setDrawerVisible(false)}
 *   >
 *     <NavigationMenu />
 *   </Drawer>
 * </View>
 */
export function Drawer({
  visible,
  onClose,
  position = "left",
  width = SCREEN_WIDTH * 0.8,
  children,
  closeOnBackdrop = true,
  style,
}) {
  const { theme } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, animatedValue]);

  const drawerWidth = typeof width === "string" ? SCREEN_WIDTH : width;

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange:
      position === "left"
        ? [-drawerWidth, 0]
        : [drawerWidth, 0],
  });

  const backdropOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={closeOnBackdrop ? onClose : undefined}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "#000",
              opacity: backdropOpacity,
            },
          ]}
        />
      </TouchableOpacity>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            [position]: 0,
            width: width,
            backgroundColor: theme.colors.background.surface,
            transform: [{ translateX }],
            ...DESIGN_TOKENS.shadows.xl,
          },
          style,
        ]}
        onStartShouldSetResponder={() => true}
      >
        {children}
      </Animated.View>
    </Modal>
  );
}

/**
 * Drawer.Header - Header opcional para drawer
 * 
 * @example
 * <Drawer visible={visible} onClose={onClose}>
 *   <Drawer.Header title="Menu" onClose={onClose} />
 *   <View>{ content }</View>
 * </Drawer>
 */
Drawer.Header = function DrawerHeader({ title, onClose, style }) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: theme.colors.border.primary,
          backgroundColor: theme.colors.background.surface,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.headerTitle,
          { color: theme.colors.text.primary },
        ]}
      >
        {title}
      </Text>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Feather name="x" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Drawer.Content - Wrapper de contenido con padding
 * 
 * @example
 * <Drawer visible={visible} onClose={onClose}>
 *   <Drawer.Header title="Configuración" />
 *   <Drawer.Content>
 *     <Text>Opciones de configuración</Text>
 *   </Drawer.Content>
 * </Drawer>
 */
Drawer.Content = function DrawerContent({ children, style }) {
  return <View style={[styles.content, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    zIndex: 1000,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        paddingTop: 50, // Status bar height
      },
      android: {
        paddingTop: DESIGN_TOKENS.spacing.lg,
      },
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    padding: DESIGN_TOKENS.spacing.xs,
  },
  content: {
    padding: DESIGN_TOKENS.spacing.lg,
  },
});

export default Drawer;
