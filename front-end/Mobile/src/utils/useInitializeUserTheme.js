import {useEffect, useState, useCallback} from 'react';
import {useTheme} from '../view/components/common/ThemeContext';
import {getCurrentUserRole} from '../services/UserService';

export const useInitializeUserTheme = () => {
    const { loadThemeForRole } = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const [userRole, setUserRole] = useState(null);

    const initializeTheme = useCallback(async () => {
        try {
            setIsLoading(true);
            const role = await getCurrentUserRole();
            if (role) {
                setUserRole(role);
                await loadThemeForRole(role);
            }
        } catch (error) {
            console.error('Error inicializando tema del usuario:', error);
        } finally {
            setIsLoading(false);
        }
    }, [loadThemeForRole]);

    useEffect(() => {
        initializeTheme();
    }, [initializeTheme]);

    return { isLoading, userRole, setUserRole, initializeTheme };
};
