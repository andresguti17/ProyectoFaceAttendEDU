import {useState} from "react";
import {useTranslation} from "react-i18next";
import {restoreLanguageForRole} from "../view/components/common/languageByRole";
import {useTheme} from "../view/components/common/ThemeContext";
import {AuthService, authError} from "../services/AuthService";
import {ApiError} from "../api/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {removeToken, saveToken} from "../storage/TokenStorage";
import {getHighestRole} from "../utils/getHighestRole";
import AuthResponse from "../models/identity/AuthResponse";

const MAX_FAILED_ATTEMPTS = 3;

export function useLoginViewModel({onLogin}) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [terms, setTerms] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [errorTimestamp, setErrorTimestamp] = useState(0);
    const [failedAttempts, setFailedAttempts] = useState(0);

    const {t} = useTranslation();
    const {loadThemeForRole} = useTheme();

    const setErrorWithTimestamp = (message) => {
        setError(message);
        setErrorTimestamp(Date.now());
    };

    const validate = () => {
        if (!email.trim()) {
            setErrorWithTimestamp(t("login.errorEmail"));
            return false;
        }
        if (!password.trim()) {
            setErrorWithTimestamp(t("login.errorPassword"));
            return false;
        }
        if (!terms) {
            setErrorWithTimestamp(t('login.acceptTerms'));
            return false;
        }
        setError(null);
        return true;
    };

    // Fallos esperados del login (401/400 de credenciales, red caída): no son
    // fallos de la app, así que no se registran con console.error. React Native
    // LogBox los pintaba como "error de Expo" en cada intento fallido, aunque
    // la pantalla ya muestra el alerta con el motivo.
    const isExpectedLoginError = (err) =>
        (err instanceof ApiError && [0, 400, 401, 403, 408].includes(err.status)) ||
        ["INVALID_CREDENTIALS", "ACCOUNT_DISABLED", "NO_ROLES", "ROLE_WITHOUT_PERMISSIONS"].includes(err?.code);

    const handleError = (err) => {
        const newCount = failedAttempts + 1;
        setFailedAttempts(newCount);

        // ApiError y authError ya traen el motivo traducido (red, tiempo de
        // espera, permisos, 5xx, credenciales, sin rol…): se muestra tal cual.
        // Antes todo lo que no era ApiError salía como "credenciales inválidas"
        // aunque el problema fuera otro.
        setErrorWithTimestamp(err?.message || t("httpErrors.unknown"));
    };

    const submit = async () => {
        setError(null);
        setErrorTimestamp(0);

        if (!validate()) return;

        setIsLoading(true);

        try {
            const authResponse = await AuthService.login(email, password);

            if (!authResponse || !authResponse.token) {
                throw authError("SESSION_NOT_CREATED", "authErrors.sessionNotCreated");
            }

            const userData = authResponse.user;
            const saved = await saveToken(authResponse.token, userData?.email || email);

            if (!saved) {
                throw authError("SESSION_NOT_SAVED", "authErrors.sessionNotSaved");
            }

            const role = getHighestRole(userData?.roles ?? []);
            if (!role) {
                throw authError("NO_ROLES", "authErrors.noRoles");
            }

            setFailedAttempts(0);
            await AsyncStorage.setItem('userEmail', userData?.email || email);
            try {
              await AsyncStorage.setItem('userProfile', JSON.stringify({
                userId: userData?.user_id || null,
                personId: userData?.person_id || null,
                username: userData?.username || null,
                email: userData?.email || email,
                name: userData?.name || null,
                roles: userData?.roles ?? [],
              }));
            } catch {}
            await loadThemeForRole(role);
            await restoreLanguageForRole(role);

            if (onLogin) {
                onLogin(role, authResponse.token);
            }
        } catch (err) {
            // Sólo los fallos inesperados van a consola: el alerta de la
            // pantalla ya informa al usuario y LogBox deja de pintar el
            // "error de Expo" en cada intento con credenciales inválidas.
            if (!isExpectedLoginError(err)) {
                console.error("Error en login:", err);
            }
            handleError(err);
            try {
                await removeToken();
            } catch {}
        } finally {
            setIsLoading(false);
        }
    };

    const clearError = () => {
        setError(null);
        setErrorTimestamp(0);
    };

    const resetFailedAttempts = () => {
        setFailedAttempts(0);
    };

    return {
        email, password, terms, isLoading, error, errorTimestamp,
        failedAttempts, maxFailedAttempts: MAX_FAILED_ATTEMPTS,
        setEmail, setPassword, setTerms,
        submit, clearError, resetFailedAttempts,
    };
}
