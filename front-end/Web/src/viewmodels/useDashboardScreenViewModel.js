import { useState, useMemo } from "react";
import { useAuth }           from "../context/AuthContext";
import { useRolePermissions } from "./useRolePermissions";
import { useTranslation }     from "../core/utils/i18n/hooks/useTranslation";

// Definición completa de todos los tabs posibles.
// Cada View decide si renderiza o no según los permisos.
// Soporta estructura jerárquica mediante la propiedad "children"
const ALL_TABS = [
    { key: "dashboard",    label: "Inicio",        icon: "layout"      },
    // Sección del super admin: gestión de escuelas y su asistencia
    { key: "schools",      label: "Escuelas",      icon: "map"         },
    // Pantallas de asistencia y de consulta (HU-HIST / HU-JUS / nav-map)
    { key: "history",       label: "Historial",       icon: "clock"      },
    { key: "justifications",label: "Justificaciones", icon: "file-text"  },
    { 
        key: "users",     
        label: "Usuarios",       
        icon: "users",
        // SIN optionalNavigation - el item padre navega directamente a "todos los usuarios"
        // Sub-secciones de usuarios (se renderizarán como sub-items en la sidebar)
        children: [
            { key: "students",   label: "Estudiantes",  icon: "user",       adminOnly: false },
            { key: "teachers",   label: "Profesores",   icon: "user-check", adminOnly: true  },
            { key: "admins",     label: "Admins",       icon: "shield",     adminOnly: true  },
        ]
    },
    { key: "courses",      label: "Cursos",        icon: "book-open"   },
    { key: "environments", label: "Ambientes",     icon: "home"        },
    { key: "academic",     label: "Académico",     icon: "award"       },
    // Matriz rol x permiso (HU-IAM-003, FR 1.1.2): solo Super Admin.
    { key: "roles",        label: "Roles",         icon: "shield"      },
    // Bandeja de alertas (HU-JUS-003, FR 6.3): alcance propio.
    { key: "alerts",       label: "Alertas",       icon: "bell"        },
    { 
        key: "reports",      
        label: "Reportes",      
        icon: "bar-chart-2",
        // SIN optionalNavigation - el item padre navega directamente
        // Sub-secciones de reportes
        children: [
            { key: "historicos", label: "Históricos", icon: "clock",          adminOnly: false },
            { key: "sanciones",  label: "Sanciones",  icon: "alert-triangle", adminOnly: false },
        ]
    },
    { 
        key: "settings",     
        label: "Configuración",  
        icon: "settings",
        optionalNavigation: true, // No navega al hacer click, solo expande/contrae
        // Sub-secciones de configuración (se renderizarán como sub-items en la sidebar)
        children: [
            { key: "general",        label: "General",         icon: "globe",    adminOnly: true },
            { key: "facial",         label: "Reconocimiento",  icon: "aperture", adminOnly: true },
            { key: "notifications",  label: "Notificaciones",  icon: "bell",     adminOnly: false },
            { key: "security",       label: "Seguridad",       icon: "shield",   adminOnly: true },
            { key: "appearance",     label: "Apariencia",      icon: "sliders",  adminOnly: false },
            // Sede y Contactos dejaron de ser tabs propios y ahora son una
            // sola sección: "Sede" reúne los datos de la institución y el
            // directorio de instructores (antes "Contactos"). El Super Admin
            // global no tiene sede propia: no ve esta sección.
            { key: "schoolInfo",     label: "Sede",            icon: "map-pin",  adminOnly: false, hideForSuperAdmin: true },
        ]
    },
];

export function useDashboardScreenViewModel() {
    const permissions = useRolePermissions();
    const { t } = useTranslation();

    // Filtra los tabs según los permisos del rol actual y aplica labels dinámicos y traducciones
    const visibleTabs = useMemo(
        () => ALL_TABS
            .filter(t => permissions.visibleTabs.includes(t.key))
            .map(tab => {
                // Obtener label específico por rol si existe
                const roleSpecificLabel = permissions.getTabLabel(tab.key);
                
                // Aplicar traducción al label
                const translatedLabel = t(roleSpecificLabel || tab.label);
                
                // Procesar children si existen
                let processedChildren = undefined;
                if (tab.children) {
                    processedChildren = tab.children
                        .filter(child => (!child.adminOnly || permissions.canManageUsers) &&
                            (!child.hideForSuperAdmin || !permissions.isSuperAdmin))
                        .map(child => {
                            const childRoleLabel = permissions.getTabLabel(child.key);
                            return {
                                ...child,
                                // Aplicar traducción al label del child
                                label: t(childRoleLabel || child.label),
                            };
                        });
                }
                
                return {
                    ...tab,
                    label: translatedLabel,
                    children: processedChildren,
                    optionalNavigation: tab.optionalNavigation,
                };
            }),
        [permissions.visibleTabs, permissions.getTabLabel, permissions.canManageUsers, permissions.isSuperAdmin, t]
    );

    // Si el tab inicial (dashboard) no fuera visible, toma el primero disponible
    const initialTab = (visibleTabs[0]?.key ?? "dashboard");
    const [currentTab, setCurrentTab] = useState(initialTab);
    
    // Estado para sub-tabs (para tabs jerárquicos como settings)
    const [currentSubTab, setCurrentSubTab] = useState(null);

    // Si por algún cambio de rol el tab actual ya no es visible, resetear
    const safeTab = permissions.visibleTabs.includes(currentTab)
        ? currentTab
        : initialTab;

    function setTab(key) {
        if (permissions.visibleTabs.includes(key)) {
            setCurrentTab(key);
            // Reset sub-tab cuando se cambia de tab principal
            setCurrentSubTab(null);
        }
    }
    
    function setSubTab(parentKey, subKey) {
        // Verificar que el tab principal esté visible
        if (permissions.visibleTabs.includes(parentKey)) {
            setCurrentTab(parentKey);
            setCurrentSubTab(subKey);
        }
    }

    return {
        currentTab: safeTab,
        currentSubTab,
        bottomTabs: visibleTabs || [],
        setTab,
        setSubTab,
    };
}
