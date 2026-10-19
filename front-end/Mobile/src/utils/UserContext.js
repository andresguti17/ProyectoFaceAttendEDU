import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getCurrentUser, getCurrentUserRole} from '../services/UserService';

/**
 * Contexto global para gestionar el estado del usuario autenticado.
 * Consolida la lógica repetida de gestión de rol y datos del usuario.
 */
const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
    const [userRole, setUserRole] = useState(null);
    const [userEmail, setUserEmail] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoadingUser, setIsLoadingUser] = useState(false);

    // Cargar usuario al montar el contexto
    const loadUserData = useCallback(async () => {
        try {
            setIsLoadingUser(true);
            const role = await getCurrentUserRole();
            const user = await getCurrentUser();
            const email = await AsyncStorage.getItem('userEmail');

            setUserRole(role);
            setCurrentUser(user);
            setUserEmail(email);
        } catch (error) {
            console.error('Error cargando datos del usuario:', error);
        } finally {
            setIsLoadingUser(false);
        }
    }, []);

    useEffect(() => {
        loadUserData();
    }, [loadUserData]);

    // Métodos útiles
    const normalizedRole = (userRole || '').toLowerCase().trim();

    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'administrador';
    const isTeacher = normalizedRole === 'teacher' || normalizedRole === 'docente' || normalizedRole === 'instructor';
    const isStudent = normalizedRole === 'student' || normalizedRole === 'estudiante' || normalizedRole === 'aprendiz';

    const value = {
        // Estado
        userRole,
        userEmail,
        currentUser,
        isLoadingUser,

        // Setters
        setUserRole,
        setUserEmail,
        setCurrentUser,

        // Métodos
        loadUserData,
        isAdmin,
        isTeacher,
        isStudent,
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

/**
 * Hook para acceder al contexto de usuario
 */
export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser debe ser usado dentro de UserProvider');
    }
    return context;
};
