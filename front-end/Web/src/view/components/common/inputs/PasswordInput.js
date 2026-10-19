import React, { useState } from "react";
import { TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TextInput } from "./TextInput";
import { useTheme } from "../../hooks/useTheme";

/**
 * PasswordInput - Input de contraseña con toggle show/hide
 * 
 * Preset especializado de TextInput para contraseñas. Incluye botón de ojo
 * para alternar visibilidad de la contraseña.
 * 
 * @param {string} value - Valor del input
 * @param {function} onChangeText - Callback al cambiar texto
 * @param {string} placeholder - Placeholder (default: "Contraseña")
 * @param {boolean} showPassword - Estado de visibilidad (controlled)
 * @param {function} onTogglePassword - Callback al cambiar visibilidad (controlled)
 * @param {object} ...props - Todas las props de TextInput
 * 
 * @example
 * // PasswordInput básico (uncontrolled visibility)
 * const [password, setPassword] = useState("");
 * <PasswordInput
 *   value={password}
 *   onChangeText={setPassword}
 * />
 * 
 * @example
 * // Con label y error
 * <PasswordInput
 *   label="Contraseña"
 *   value={password}
 *   onChangeText={setPassword}
 *   error={!!errors.password}
 *   errorMessage={errors.password}
 * />
 * 
 * @example
 * // Controlled visibility
 * const [password, setPassword] = useState("");
 * const [showPassword, setShowPassword] = useState(false);
 * 
 * <PasswordInput
 *   value={password}
 *   onChangeText={setPassword}
 *   showPassword={showPassword}
 *   onTogglePassword={() => setShowPassword(!showPassword)}
 * />
 * 
 * @example
 * // Confirmar contraseña
 * <View>
 *   <PasswordInput
 *     label="Nueva contraseña"
 *     value={newPassword}
 *     onChangeText={setNewPassword}
 *   />
 *   <PasswordInput
 *     label="Confirmar contraseña"
 *     value={confirmPassword}
 *     onChangeText={setConfirmPassword}
 *     error={newPassword !== confirmPassword}
 *     errorMessage="Las contraseñas no coinciden"
 *   />
 * </View>
 */
export function PasswordInput({
  value,
  onChangeText,
  placeholder = "Contraseña",
  showPassword: controlledShowPassword,
  onTogglePassword,
  ...props
}) {
  const { theme } = useTheme();
  
  // Estado interno si no es controlled
  const [internalShowPassword, setInternalShowPassword] = useState(false);
  
  // Usar controlled si está disponible, sino usar estado interno
  const isControlled = controlledShowPassword !== undefined;
  const showPassword = isControlled ? controlledShowPassword : internalShowPassword;
  
  const handleToggle = () => {
    if (isControlled && onTogglePassword) {
      onTogglePassword();
    } else {
      setInternalShowPassword(!internalShowPassword);
    }
  };

  const eyeIcon = (
    <TouchableOpacity onPress={handleToggle}>
      <Feather
        name={showPassword ? "eye-off" : "eye"}
        size={18}
        color={theme.colors.text.secondary}
      />
    </TouchableOpacity>
  );

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      type={showPassword ? "text" : "password"}
      rightIcon={eyeIcon}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
    />
  );
}

export default PasswordInput;
