# Arquitectura MVVM - FaceAttend EDU (Web)

## 📋 Capas Implementadas

### 1. **Model** (`src/model/`)
Clases de datos que representan entidades del negocio:
- `LoginRequest.ts` - Datos de entrada para login
- `AuthResponse.ts` - Respuesta decodificada del servidor
- `AttendanceResponse.ts` - Respuesta de asistencia

**Responsabilidad:** Definir contratos de datos y transformaciones (métodos `toApi()`, `fromApi()`)

---

### 2. **ViewModel** (`src/viewmodels/`)
Hooks personalizados que contienen la **lógica de negocio** y el **estado**:

#### `useLoginViewModel.ts` 
```typescript
export function useLoginViewModel({ onLogin }) {
    // Estado
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Lógica de validación
    const validate = () => { ... }

    // Lógica de autenticación
    const submit = async () => { ... }

    // Retorna estado + métodos
    return { email, password, isLoading, error, setEmail, setPassword, submit, clearError }
}
```

**Responsabilidades:**
- Gestionar estado de formulario
- Validar entrada
- Llamar servicios (AuthService)
- Procesar respuestas
- Guardar datos (Token, Rol)
- Ejecutar callbacks cuando sea necesario

---

### 3. **View** (`src/view/`)

#### **Screens** (`src/view/screens/`)
Contenedores de navegación que:
- Manejan la **navegación** entre pantallas
- Pasan callbacks al componente de UI

#### **Componentes** (`src/view/components/own_components/`)
Componentes de UI que:
- **Usan el ViewModel** con `useLoginViewModel()`
- Renderizan la interfaz
- Manejan eventos del usuario (onChange, onPress, etc.)
- Controlan estado local de UI (animaciones, focus, etc.)

```typescriptreact
export function LoginPage({ onLoginSuccess, onForgotPassword, onRegister }) {
    const { email, password, isLoading, error, setEmail, setPassword, submit } 
        = useLoginViewModel({ onLogin: onLoginSuccess });

    return (
        // UI con estado del ViewModel
        <TextInput value={email} onChangeText={setEmail} />
        <Button onPress={submit} />
    );
}
```

---

## 🔄 Flujo de Datos

```
Screen (LoginScreen)
    ↓ importa y renderiza
View (LoginPage)
    ↓ usa
ViewModel (useLoginViewModel)
    ↓ usa
Services (AuthService, TokenStorage)
    ↓ retorna datos
Model (LoginRequest, AuthResponse)
    ↓ 
Screen ejecuta callback para navegar
```

### Ejemplo: Flujo de Login

1. **Usuario ingresa email/password** → `View` captura con `setEmail()`, `setPassword()`
2. **Usuario presiona "Ingresar"** → `View` llama `submit()`
3. **ViewModel valida** → Si hay error, actualiza `error`
4. **ViewModel llama AuthService** → `login(credentials)`
5. **ViewModel procesa respuesta** → Decodifica JWT, extrae rol
6. **ViewModel guarda datos** → `saveToken()`, `localStorage`
7. **ViewModel ejecuta callback** → `onLogin(role, token)`
8. **Screen ejecuta navegación** → `navigation.replace("FaceAttendEDU-Dashboard")`

---

## 🎯 Ventajas de MVVM

| Aspecto | Beneficio |
|--------|-----------|
| **Separación de responsabilidades** | Lógica ≠ Presentación |
| **Reutilización** | ViewModel puede usarse en múltiples vistas |
| **Testeable** | Lógica aislada, fácil de mockear |
| **Mantenible** | Cambios de UI no afectan lógica |
| **Escalable** | Estructura clara para crecer |

---

## 📁 Estructura Completa

```
src/
├── model/                    ← Datos
│   ├── LoginRequest.ts
│   ├── AuthResponse.ts
│   └── AttendanceResponse.ts
├── viewmodels/               ← Lógica + Estado
│   └── useLoginViewModel.ts
├── services/                 ← Llamadas API
│   ├── AuthService.ts
│   └── UserService.ts
├── storage/                  ← Persistencia
│   └── TokenStorage.ts
├── view/
│   ├── screens/              ← Navegación
│   │   ├── loginScreen.tsx
│   │   └── dashboardScreen.tsx
│   └── components/
│       ├── own_components/   ← UI + ViewModel
│       │   ├── auth/
│       │   │   └── loginView.tsx
│       │   ├── dashboard/
│       │   │   └── dashboardView.tsx
│       │   └── ...
│       └── ui/               ← Componentes puros
│           ├── button.tsx
│           └── ...
```

---

## ✅ Implementación Completada

- ✅ `useLoginViewModel.ts` - ViewModel completo
- ✅ `loginView.tsx` - Vista refactorizada
- ✅ `loginScreen.tsx` - Screen actualizado
- ✅ Validación de email/contraseña
- ✅ Manejo de errores
- ✅ Persistencia de token y rol
- ✅ Estructura MVVM clara

---

## 🚀 Próximos ViewModels

Siguiendo este patrón, crear ViewModels para:
- `useDashboardViewModel.ts`
- `useStudentsViewModel.ts`
- `useCoursesViewModel.ts`
- etc.

