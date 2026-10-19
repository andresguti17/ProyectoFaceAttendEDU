// ============================================================
//  FaceAttend EDU — Authenticated Layout
// ============================================================
//  RESPONSABILIDAD: Layout wrapper para pantallas autenticadas
//
//  Este componente:
//  ✓ Proporciona sidebar persistente (desktop)
//  ✓ Proporciona bottom tabs (móvil)  
//  ✓ Maneja navegación entre pantallas
//  ✓ Mantiene estado compartido del sidebar
//
//  NO debe:
//  ✗ Crear jerarquías de rutas (Stack.Navigator)
//  ✗ Validar autenticación (eso es AuthMiddleware)
//  ✗ Renderizar NotAuthorized
//
//  Es un layout puro que wrappea el contenido de la pantalla
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
// ── Importación de Layout Components ──────────────────────────
import { 
    SidebarHeader, 
    SidebarNav, 
    SidebarItem, 
    SidebarItemCollapsible, 
    SidebarFooter,
    CollapsibleSidebar 
} from "../components/common/layout";

// ── Importación de componentes de seguridad ───────────────────
import { SessionManager } from "../components/auth";

// ── Importación de Hooks ──────────────────────────────────────
import { useTheme } from "../components/hooks/useTheme";
import { useResponsive } from "../components/hooks/useResponsive";
import { useAuth } from "../../context/AuthContext";
import { useDashboardScreenViewModel } from "../../viewmodels/useDashboardScreenViewModel";
import { useTranslation } from "../../core/utils/i18n/hooks/useTranslation";
import { roleDisplayLabel } from "../../core/utils/backendRoles";
// ── Constantes de mapeo de rutas ────────────────────────────
const ROUTE_MAP = {
    "dashboard": "Dashboard",
    "schools": "Schools",
    "users": "Users",
    "roles": "Roles",
    "alerts": "Alerts",
    "courses": "Courses",
    "environments": "Environments",
    "reports": "Reports",
    "history": "History",
    "justifications": "Justifications",
    "schoolInfo": "SchoolInfo",
    "academic": "Academic",
    "contacts": "Contacts",
    "settings": "Settings",
};

const ROUTE_TO_KEY_MAP = {
    "Dashboard": "dashboard",
    "Schools": "schools",
    "Users": "users",
    "Roles": "roles",
    "Alerts": "alerts",
    "Courses": "courses",
    "Environments": "environments",
    "Reports": "reports",
    "History": "history",
    "Justifications": "justifications",
    "SchoolInfo": "schoolInfo",
    "Academic": "academic",
    "Contacts": "contacts",
    "Settings": "settings",
};

// ── Contexto para compartir estado del sidebar ────────────────
const SidebarStateContext = React.createContext({
    sidebarSelectedTab: "dashboard",
    sidebarSelectedSubTab: null,
    setSidebarSelectedTab: () => {},
    setSidebarSelectedSubTab: () => {},
});

// ── Sidebar Persistente Component ────────────────────────────
function PersistentSidebar() {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const c = theme.colors;
    const vm = useDashboardScreenViewModel();
    const { t } = useTranslation();
    const { logout, user } = useAuth();
    
    // Usar contexto compartido para el estado del sidebar
    const { sidebarSelectedTab, sidebarSelectedSubTab, setSidebarSelectedTab, setSidebarSelectedSubTab } = React.useContext(SidebarStateContext);
    
    // Flag para indicar si la navegación viene del sidebar (evita sync loops)
    const isNavigatingFromSidebar = React.useRef(false);
    
    // Sincronizar estado del sidebar con la navegación actual SOLO al montar o cuando viene de URL
    React.useEffect(() => {
        const syncSidebarWithNavigation = () => {
            // Si la navegación viene del sidebar, NO sincronizar (evita sobrescribir el click)
            if (isNavigatingFromSidebar.current) {
                isNavigatingFromSidebar.current = false;
                return;
            }
            
            const state = navigation.getState();
            if (state?.routes && state.routes.length > 0) {
                const currentRoute = state.routes[state.index];
                const routeName = currentRoute?.name;
                const routeParams = currentRoute?.params;
                
                const tabKey = ROUTE_TO_KEY_MAP[routeName] || "dashboard";
                const subTabKey = routeParams?.section || null;
                
                setSidebarSelectedTab(tabKey);
                setSidebarSelectedSubTab(subTabKey);
            }
        };
        
        // Sincronizar al montar (navegación por URL directa)
        syncSidebarWithNavigation();
        
        // Sincronizar cuando cambie la navegación (back/forward del navegador)
        const unsubscribe = navigation.addListener('state', syncSidebarWithNavigation);
        
        return unsubscribe;
    }, [navigation, setSidebarSelectedTab, setSidebarSelectedSubTab]);
    
    // Función de navegación
    const handleNavigate = React.useCallback((tabKey, subTabKey) => {
        const routeName = ROUTE_MAP[tabKey];
        
        if (!routeName) return;
        
        // Marcar que la navegación viene del sidebar
        isNavigatingFromSidebar.current = true;
        
        setSidebarSelectedTab(tabKey);
        setSidebarSelectedSubTab(subTabKey || null);
        
        // Construir params: si hay subTabKey, usarlo; si no, y es "users", usar "all"
        let params;
        if (subTabKey) {
            params = { section: subTabKey };
        } else if (tabKey === "users") {
            // Click en el item padre "Usuarios" → mostrar todos
            params = { section: "all" };
        } else {
            params = undefined;
        }
        
        navigation.navigate(routeName, params);
    }, [navigation, setSidebarSelectedTab, setSidebarSelectedSubTab]);
    
    // Verificar si un tab está activo
    const isTabActive = React.useCallback((tabKey, subTabKey = null) => {
        if (!subTabKey) {
            return sidebarSelectedTab === tabKey;
        }
        return sidebarSelectedTab === tabKey && sidebarSelectedSubTab === subTabKey;
    }, [sidebarSelectedTab, sidebarSelectedSubTab]);
    
    // Manejo de logout
    const handleLogout = React.useCallback(async () => {
        await logout();
        navigation.navigate("FaceAttendEDU");
    }, [logout, navigation]);
    
    return (
        <CollapsibleSidebar width={240}>
            {user && (
                <SidebarHeader>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: c.text.primary,
                        marginBottom: 4,
                    }}>
                        {user.name}
                    </Text>
                    <Text
                        style={{
                            fontSize: 12,
                            color: c.text.secondary,
                        }}
                    >
                        {/* Rol "Super Administrador" explícito (007) =
                            Super Admin; "Administrador" = Admin de sede
                            (ver backendRoles). */}
                        {t(roleDisplayLabel(user))}
                    </Text>
                </SidebarHeader>
            )}
            
            <SidebarNav key="main-sidebar-nav">
                {vm.bottomTabs.map((tab) => {
                    if (tab.children && tab.children.length > 0) {
                        const isParentActive = isTabActive(tab.key);
                        const hasActiveChild = tab.children.some(child => 
                            isTabActive(tab.key, child.key)
                        );
                        const shouldShowActive = isParentActive || hasActiveChild;
                        
                        const mainItemOnPress = tab.optionalNavigation 
                            ? () => {
                                // Marcar el tab visualmente sin navegar
                                isNavigatingFromSidebar.current = true;
                                setSidebarSelectedTab(tab.key);
                                // Mantener el subtab actual si existe
                            }
                            : () => handleNavigate(tab.key);
                        
                        // Mapear children items
                        const childrenItems = tab.children.map(child => ({
                            key: child.key,
                            icon: child.icon,
                            label: child.label,
                            active: isTabActive(tab.key, child.key),
                            onPress: () => handleNavigate(tab.key, child.key),
                            badge: child.badge,
                            indicator: child.indicator,
                        }));
                        
                        return (
                            <SidebarItemCollapsible
                                key={tab.key}
                                icon={tab.icon}
                                label={tab.label}
                                active={shouldShowActive}
                                defaultExpanded={shouldShowActive}
                                onPress={mainItemOnPress}
                            >
                                {childrenItems}
                            </SidebarItemCollapsible>
                        );
                    }
                    
                    return (
                        <SidebarItem
                            key={tab.key}
                            icon={tab.icon}
                            label={tab.label}
                            active={isTabActive(tab.key)}
                            onPress={() => handleNavigate(tab.key)}
                        />
                    );
                })}
            </SidebarNav>
            
            <SidebarFooter>
                <SidebarItem
                    icon="log-out"
                    label={t("Cerrar sesión")}
                    variant="danger"
                    onPress={handleLogout}
                />
            </SidebarFooter>
        </CollapsibleSidebar>
    );
}

// ── Bottom Tabs Component (solo móvil) ───────────────────────
function BottomTabs() {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const c = theme.colors;
    const vm = useDashboardScreenViewModel();
    const { t } = useTranslation();
    
    // Usar contexto compartido
    const { setSidebarSelectedTab, setSidebarSelectedSubTab } = React.useContext(SidebarStateContext);
    
    // Estado para tracking de ruta actual derivado del navigation state
    const [navigationState, setNavigationState] = React.useState(null);
    
    // Listener para cambios de navegación
    React.useEffect(() => {
        const updateNavigationState = () => {
            setNavigationState(navigation.getState());
        };
        
        // Establecer estado inicial
        updateNavigationState();
        
        // Escuchar cambios
        const unsubscribe = navigation.addListener('state', updateNavigationState);
        
        return unsubscribe;
    }, [navigation]);
    
    // Derivar currentRouteName del navigation state
    const currentRouteName = React.useMemo(() => {
        if (navigationState?.routes && navigationState.routes.length > 0) {
            return navigationState.routes[navigationState.index]?.name || "Dashboard";
        }
        return "Dashboard";
    }, [navigationState]);
    
    const currentTabKey = ROUTE_TO_KEY_MAP[currentRouteName] || "dashboard";
    
    const handleNavigate = React.useCallback((tabKey, subTabKey) => {
        const routeName = ROUTE_MAP[tabKey];
        if (!routeName) return;
        
        setSidebarSelectedTab(tabKey);
        setSidebarSelectedSubTab(subTabKey || null);
        
        const params = subTabKey ? { section: subTabKey } : undefined;
        navigation.navigate(routeName, params);
    }, [navigation, setSidebarSelectedTab, setSidebarSelectedSubTab]);
    
    // NO usar early return - el padre decide si renderizar este componente
    // Con más tabs que pantallas fijas (Historial, Justificaciones y Sede)
    // la barra se desplaza horizontalmente.
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: c.background.surface,
                borderTopWidth: 1,
                borderTopColor: c.border.primary,
            }}
            contentContainerStyle={{
                flexDirection: "row",
                paddingTop: 8,
                paddingBottom: Math.max(8, insets.bottom),
                minHeight: 52 + insets.bottom,
            }}
        >
            {vm.bottomTabs.map((item) => {
                const active = currentTabKey === item.key;
                
                const handleBottomTabPress = () => {
                    if (item.optionalNavigation && item.children && item.children.length > 0) {
                        // Navegar al primer hijo si tiene optionalNavigation
                        const firstChild = item.children[0];
                        handleNavigate(item.key, firstChild.key);
                    } else if (!item.optionalNavigation && item.children && item.children.length > 0 && item.key === "users") {
                        // Para "users", navegar al padre con section: "all"
                        handleNavigate(item.key, "all");
                    } else {
                        // Navegar normalmente sin subTabKey
                        handleNavigate(item.key);
                    }
                };
                
                return (
                    <TouchableOpacity
                        key={item.key}
                        onPress={handleBottomTabPress}
                        style={{
                            minWidth: 72,
                            paddingHorizontal: 6,
                            alignItems: "center",
                            paddingTop: 4,
                            borderTopWidth: active ? 2 : 0,
                            borderTopColor: c.brand.primary,
                        }}
                    >
                        <Feather
                            name={item.icon}
                            size={20}
                            color={active ? c.brand.primary : c.text.secondary}
                        />
                        <Text style={{
                            fontSize: 11,
                            marginTop: 2,
                            color: active ? c.brand.primary : c.text.secondary,
                            fontWeight: active ? "600" : "400",
                        }}>
                            {t(item.label)}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

// ── Layout Principal ──────────────────────────────────────────
export default function AuthenticatedLayout({ children }) {
    const { isSmall } = useResponsive();
    const { user, saveIntendedRoute, clearIntendedRoute } = useAuth();
    const navigation = useNavigation();
    
    // ============================================================
    // HOOKS - Deben estar ANTES de cualquier return condicional
    // ============================================================
    const [sidebarSelectedTab, setSidebarSelectedTab] = React.useState("dashboard");
    const [sidebarSelectedSubTab, setSidebarSelectedSubTab] = React.useState(null);
    
    const sidebarState = React.useMemo(() => ({
        sidebarSelectedTab,
        sidebarSelectedSubTab,
        setSidebarSelectedTab,
        setSidebarSelectedSubTab,
    }), [sidebarSelectedTab, sidebarSelectedSubTab]);
    
    const bottomPadding = isSmall ? 64 : 0;

    // ============================================================
    // TRACKING DE RUTA INTERNA para guardar intención de navegación
    // ============================================================
    
    // Flag para rastrear si ya se inició el tracking (derivado del usuario)
    const isRouteTrackingActive = React.useMemo(() => {
        return user !== null;
    }, [user]);
    
    // Listener de navegación - solo se activa cuando hay usuario
    React.useEffect(() => {
        if (!isRouteTrackingActive) return;
        
        //console.log('[AuthenticatedLayout] Starting navigation listener for route tracking');
        
        const unsubscribe = navigation.addListener('focus', () => {
            // Obtener el estado del navigation stack
            const state = navigation.getState();
            if (state?.routes && state.routes.length > 0) {
                const activeRoute = state.routes[state.index];
                const routeName = activeRoute?.name || "Dashboard";
                const routeParams = activeRoute?.params || {};
                
                console.log('[AuthenticatedLayout] Current route:', routeName, routeParams);
                
                // Guardar TODAS las rutas autenticadas para redirección futura
                const routeInfo = {
                    name: routeName,
                    params: routeParams
                };
                console.log('[AuthenticatedLayout] Saving route for future redirect:', routeInfo);
                saveIntendedRoute(routeInfo);
            }
        });
        
        return unsubscribe;
    }, [isRouteTrackingActive, navigation, saveIntendedRoute, clearIntendedRoute]);

    return (
        <SidebarStateContext.Provider value={sidebarState}>
            <View style={{ flex: 1, flexDirection: "row" }}>
                {/* Sidebar persistente - solo desktop */}
                {!isSmall && <PersistentSidebar />}
                
                {/* Contenido de la pantalla */}
                <View style={{ 
                    flex: 1,
                    paddingBottom: bottomPadding,
                    overflow: "hidden",
                }}>
                    {children}
                </View>
                
                {/* Bottom tabs - solo móvil */}
                {isSmall && <BottomTabs />}
            </View>

            {/* Session Manager - Gestiona advertencias de timeout */}
            <SessionManager />
        </SidebarStateContext.Provider>
    );
}