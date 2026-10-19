# Carpeta `src/viewmodels`

Propósito:
- Actuar como la capa de presentación (presenter/controller) entre la UI (`view`) y la capa de datos (`services`). Aquí viven los hooks personalizados que exponen estado, acciones y efectos para las pantallas.

Archivos de ejemplo en el repo:
- `useLoginViewModel.js`, `useDashboardViewModel.js`, `useProfileViewModel.js`, etc.

Responsabilidades principales:
- Mantener el estado local de la pantalla (loading, error, data).
- Llamar a `services` para solicitar o enviar datos.
- Transformar respuestas en estructuras listas para la UI.
- Manejar navegación y side-effects mínimos (por ejemplo, redirecciones tras login).

Patrones recomendados:
- Hooks con API clara: `{ state, actions }` o `{ data, loading, error, fetch }`.
- Separar lógica pura y efectos (usar `useEffect` para efectos secundarios).
- No manipular la navegación directamente desde lógica de negocio; exponer callbacks que `view` use para navegar.

Testing:
- Mockear `services` para probar la lógica de los `viewmodels`.
- Probar transiciones de estado (loading → success → error).

Cómo se complementan con otras carpetas:
- `view` importa estos hooks para renderizar la UI.
- `services` proveen las funciones que los `viewmodels` consumen.
- `model` puede usarse para normalizar datos antes de exponerlos a la UI.
