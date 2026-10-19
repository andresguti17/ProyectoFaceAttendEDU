import { useState, useRef } from "react";
import { useTranslation } from "../core/utils/i18n/hooks/useTranslation";
import { useAuth } from "../context/AuthContext";
import { checkPassword, isValidEmail } from "../core/utils/validation";

// ── useLoginViewModel ────────────────────────────────────────

export function useLoginViewModel(onSuccess) {
    const { t } = useTranslation();
    const { login } = useAuth();

    const emailRef = useRef("");
    const passwordRef = useRef("");

    // Estado visible del email — controla el TextInput (input controlado)
    const [emailDisplay, setEmailDisplay] = useState("");
    // Estado visible del password — controla el TextInput
    const [password, setPasswordState] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Errores individuales por campo
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    
    // Estados de validación (success/warning)
    const [emailValid, setEmailValid] = useState(false);
    const [passwordValid, setPasswordValid] = useState(false);
    const [passwordWarning, setPasswordWarning] = useState(false);
    
    // Estados de progreso (durante validación backend)
    const [emailProgress, setEmailProgress] = useState(0);
    const [passwordProgress, setPasswordProgress] = useState(0);
    
    // Trigger para animación shake
    const [shakeFields, setShakeFields] = useState({
        email: false,
        password: false,
    });

    // Flags para saber si el campo ha sido tocado (touched)
    const [touched, setTouched] = useState({
        email: false,
        password: false,
    });

    // ── Validación en tiempo real del email ───────────────────
    function validateEmailRT(value) {
        if (!value || value.trim() === "") {
            setEmailError(t("El correo electrónico es requerido"));
            setEmailValid(false);
            return false;
        } else if (!isValidEmail(value)) {
            setEmailError(t("El correo electrónico no es válido"));
            setEmailValid(false);
            return false;
        } else {
            // Email válido según formato → mostrar verde
            setEmailError("");
            setEmailValid(true);
            return true;
        }
    }

    // ── Validación en tiempo real del password ────────────────
    // Solo valida errores, NO marca como válido
    function validatePasswordRT(value) {
        if (!value || value.trim() === "") {
            setPasswordError(t("La contraseña es requerida"));
            setPasswordValid(false);
            return false;
        } else {
            // NO marcar como válido hasta que el backend lo confirme
            setPasswordError("");
            return true;
        }
    }

    // Actualiza ref Y estado visible → validación runtime desde el primer carácter
    function setEmail(v) {
        emailRef.current = v;
        setEmailDisplay(v);
        
        // Validar SIEMPRE en tiempo real (desde el primer carácter)
        validateEmailRT(v);
    }

    function setPassword(v) {
        passwordRef.current = v;
        setPasswordState(v);
        
        // Validar SIEMPRE en tiempo real (desde el primer carácter)
        validatePasswordRT(v);
    }
    
    function togglePassword() {
        setShowPassword((v) => !v);
    }

    /** Rellena el campo de email desde el panel dev sin perder la capacidad de editar */
    function prefillEmail(email) {
        emailRef.current = email;
        setEmailDisplay(email);
    }

    // ── Marcar campo como tocado y validar ────────────────────
    function handleBlur(field) {
        setTouched(prev => ({ ...prev, [field]: true }));
        
        // Validar el campo específico al perder foco
        switch(field) {
            case 'email':
                validateEmailRT(emailRef.current);
                break;
            case 'password':
                validatePasswordRT(passwordRef.current);
                break;
        }
    }

    function validate() {
        // Marcar todos como tocados
        setTouched({ email: true, password: true });

        const newShake = { email: false, password: false };
        let isValid = true;

        // Validar todos los campos
        const emailIsValid = validateEmailRT(emailRef.current);
        const passwordIsValid = validatePasswordRT(passwordRef.current);

        if (!emailIsValid) {
            newShake.email = true;
            isValid = false;
        }
        if (!passwordIsValid) {
            newShake.password = true;
            isValid = false;
        }

        // Trigger shake animation
        if (!isValid) {
            setShakeFields(newShake);
            setTimeout(() => {
                setShakeFields({ email: false, password: false });
            }, 300);
        }

        return isValid;
    }

    async function handleLogin() {
        if (!validate()) return;
        
        // Resetear estados de validación
        setEmailValid(false);
        setPasswordValid(false);
        setPasswordWarning(false);
        setEmailProgress(0);
        setPasswordProgress(0);
        
        setLoading(true);

        // Simular progreso de validación (progress bar animation)
        const progressInterval = setInterval(() => {
            setEmailProgress(prev => Math.min(prev + 10, 90));
            setPasswordProgress(prev => Math.min(prev + 10, 90));
        }, 50);

        const result = await login({
            email: emailRef.current,
            password: passwordRef.current,
        }).catch((e) => (typeof e === "string" ? e : e?.message || "No se pudo iniciar sesión"));

        // Detener animación de progreso y desbloquear el botón SIEMPRE,
        // incluso si login() lanzó en vez de devolver un string: sin esto
        // un throw inesperado dejaba el spinner colgado y la promesa sin
        // manejar, sin ningún mensaje para el usuario.
        clearInterval(progressInterval);
        setLoading(false);

        // Manejar el resultado (puede ser string de error o objeto con success/redirectRoute)
        const isError = typeof result === 'string';
        const err = isError ? result : null;
        const redirectRoute = !isError && result?.redirectRoute ? result.redirectRoute : null;

        console.log('[useAuthViewModel] Login result processed:', { 
            isError, 
            err, 
            redirectRoute, 
            fullResult: result 
        });

        if (err) {
            // Resetear progreso
            setEmailProgress(0);
            setPasswordProgress(0);
            
            // Determinar en qué campo mostrar el error
            const isEmailError = err.includes("cuenta") || err.includes("correo") || err.includes("account") || err.includes("email");
            
            if (isEmailError) {
                // Error relacionado con el email (cuenta no encontrada)
                setEmailError(t(err));
                setEmailValid(false);
                setPasswordError("");
                setPasswordValid(false);
                setPasswordWarning(true); // Warning en contraseña (naranja + shake)
                setShakeFields({ email: true, password: true });
            } else {
                // Error relacionado con la contraseña (contraseña incorrecta)
                setPasswordError(t(err));
                setPasswordValid(false);
                setPasswordWarning(false);
                setEmailError("");
                setEmailValid(true); // Email era correcto
                setShakeFields({ email: false, password: true });
            }
            
            setTimeout(() => {
                setShakeFields({ email: false, password: false });
            }, 300);
        } else {
            // Login exitoso - completar progreso y marcar como válido
            console.log('[useAuthViewModel] Login successful, redirectRoute:', redirectRoute);
            setEmailProgress(100);
            setPasswordProgress(100);
            setEmailValid(true);
            setPasswordValid(true);
            
            // Pequeño delay para mostrar el verde antes de redirigir
            setTimeout(() => {
                console.log('[useAuthViewModel] Calling onSuccess with redirectRoute:', redirectRoute);
                onSuccess(redirectRoute); // Pasar la ruta de redirección al callback
            }, 200);
        }
    }

    return {
        showPassword,
        loading,
        emailDisplay,
        password,
        emailError,
        passwordError,
        emailValid,
        passwordValid,
        passwordWarning,
        emailProgress,
        passwordProgress,
        shakeFields,
        setEmail,
        setPassword,
        togglePassword,
        prefillEmail,
        handleBlur,
        handleLogin,
    };
}

// ── useSignupViewModel ───────────────────────────────────────

export function useSignupViewModel(onSuccess) {
    const { t } = useTranslation();
    const { register } = useAuth();

    const usernameRef = useRef("");
    const emailRef = useRef("");
    const passwordRef = useRef("");

    // Estados visibles para los inputs controlados
    const [username, setUsernameState] = useState("");
    const [email, setEmailState] = useState("");
    const [password, setPasswordState] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Errores individuales por campo
    const [usernameError, setUsernameError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    
    // Estados de validación (success)
    const [usernameValid, setUsernameValid] = useState(false);
    const [emailValid, setEmailValid] = useState(false);
    const [passwordValid, setPasswordValid] = useState(false);
    
    // Trigger para animación shake
    const [shakeFields, setShakeFields] = useState({
        username: false,
        email: false,
        password: false,
    });

    // Flags para saber si el campo ha sido tocado (touched)
    const [touched, setTouched] = useState({
        username: false,
        email: false,
        password: false,
    });

    // ── Validación en tiempo real del username ────────────────
    function validateUsernameRT(value) {
        if (!value || value.trim() === "") {
            setUsernameError(t("El nombre de usuario es requerido"));
            setUsernameValid(false);
            return false;
        } else if (value.trim().length < 3) {
            setUsernameError(t("El nombre debe tener al menos 3 caracteres"));
            setUsernameValid(false);
            return false;
        } else {
            setUsernameError("");
            setUsernameValid(true);
            return true;
        }
    }

    // ── Validación en tiempo real del email ───────────────────
    function validateEmailRT(value) {
        if (!value || value.trim() === "") {
            setEmailError(t("El correo electrónico es requerido"));
            setEmailValid(false);
            return false;
        } else if (!isValidEmail(value)) {
            setEmailError(t("El correo electrónico no es válido"));
            setEmailValid(false);
            return false;
        } else {
            setEmailError("");
            setEmailValid(true);
            return true;
        }
    }

    // ── Validación en tiempo real del password ────────────────
    function validatePasswordRT(value, currentUsername, currentEmail) {
        // Si está vacío
        if (!value || value.trim() === "") {
            setPasswordError(t("La contraseña es requerida"));
            setPasswordValid(false);
            return false;
        }

        // Validación robusta con contexto
        const passwordValidation = checkPassword(
            value,
            {
                username: currentUsername,
                email: currentEmail,
            }
        );

        if (!passwordValidation.isValid) {
            // Mostrar solo el primer error (progresivo) - traducido
            setPasswordError(t(passwordValidation.errors[0]));
            setPasswordValid(false);
            return false;
        } else {
            setPasswordError("");
            setPasswordValid(true);
            return true;
        }
    }

    function setUsername(v) {
        usernameRef.current = v;
        setUsernameState(v);
        
        // Validar SIEMPRE en tiempo real (desde el primer carácter)
        validateUsernameRT(v);
    }
    
    function setEmail(v) {
        emailRef.current = v;
        setEmailState(v);
        
        // Validar SIEMPRE en tiempo real (desde el primer carácter)
        validateEmailRT(v);
        
        // Re-validar password si ya tiene contenido (por si usa parte del email)
        if (passwordRef.current) {
            validatePasswordRT(passwordRef.current, usernameRef.current, v);
        }
    }
    
    function setPassword(v) {
        passwordRef.current = v;
        setPasswordState(v);
        
        // Validar SIEMPRE en tiempo real (desde el primer carácter)
        validatePasswordRT(v, usernameRef.current, emailRef.current);
    }
    
    function togglePassword() {
        setShowPassword((v) => !v);
    }

    // ── Marcar campo como tocado y validar ────────────────────
    function handleBlur(field) {
        setTouched(prev => ({ ...prev, [field]: true }));
        
        // Validar el campo específico al perder foco
        switch(field) {
            case 'username':
                validateUsernameRT(usernameRef.current);
                break;
            case 'email':
                validateEmailRT(emailRef.current);
                break;
            case 'password':
                validatePasswordRT(passwordRef.current, usernameRef.current, emailRef.current);
                break;
        }
    }

    function validate() {
        // Marcar todos como tocados
        setTouched({ username: true, email: true, password: true });

        const newShake = { username: false, email: false, password: false };
        let isValid = true;

        // Validar todos los campos
        const usernameIsValid = validateUsernameRT(usernameRef.current);
        const emailIsValid = validateEmailRT(emailRef.current);
        const passwordIsValid = validatePasswordRT(
            passwordRef.current, 
            usernameRef.current, 
            emailRef.current
        );

        if (!usernameIsValid) {
            newShake.username = true;
            isValid = false;
        }
        if (!emailIsValid) {
            newShake.email = true;
            isValid = false;
        }
        if (!passwordIsValid) {
            newShake.password = true;
            isValid = false;
        }

        // Trigger shake animation
        if (!isValid) {
            setShakeFields(newShake);
            setTimeout(() => {
                setShakeFields({ username: false, email: false, password: false });
            }, 300);
        }

        return isValid;
    }

    // El backend no expone un endpoint público de auto-registro: las cuentas
    // las crea un administrador (POST /api/v1/users). No hay onSuccess real
    // que llamar aquí, solo informar al usuario en vez de fingir un alta.
    function handleRegister() {
        if (!validate()) return;

        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setUsernameError(t("El autorregistro no está disponible. Contacta a tu administrador."));
            setUsernameValid(false);
            setShakeFields({ username: true, email: false, password: false });
            setTimeout(() => {
                setShakeFields({ username: false, email: false, password: false });
            }, 300);
        }, 400);
    }

    return {
        username,
        email,
        password,
        showPassword,
        loading,
        usernameError,
        emailError,
        passwordError,
        usernameValid,
        emailValid,
        passwordValid,
        shakeFields,
        setUsername,
        setEmail,
        setPassword,
        togglePassword,
        handleBlur,
        handleRegister,
    };
}
