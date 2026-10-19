# Carpeta `src/view`

Propósito:
- Contiene las pantallas (`screens`) y componentes visuales (`components`) que conforman la interfaz de usuario de la aplicación.

Estructura habitual (según este repo):
- `components/` — componentes reutilizables (botones, selectores, modales, barras de navegación, etc.).
- `screens/` — pantallas completas que combinan componentes y `viewmodels`.

Convenciones y recomendaciones:
- Separar componentes presentacionales de contenedores: los componentes pequeños deben ser puros y recibir props.
- `screens` deben usar `viewmodels` para obtener estado y acciones.
- Mantener estilos en archivos separados (p. ej. `style/Style.js`) y reutilizar variables de tema.

Internacionalización y accesibilidad:
- Usar `i18n.js` desde `utils` para textos.
- Aprovechar roles y jerarquía (por ejemplo `themeByRole.js`) para ajustar UI según permisos.

Interacciones con otras carpetas:
- `assets` proporciona recursos gráficos para los componentes.
- `viewmodels` suministran datos y acciones.
- `navigations` define qué `screens` se muestran y cómo se enlazan.