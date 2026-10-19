# Carpeta `src/utils`

Propósito:
- Agrupar funciones de ayuda reutilizables y específicas del dominio que no pertenecen a una `service` ni a un `viewmodel` en particular.

Ejemplos en este proyecto:
- `getHighestRole.js` — lógica para obtener el rol más alto de un usuario.
- `i18n.js` — configuración y helpers para internacionalización.
- `themeByRole.js` — determina tema visual según rol.
- `useLanguageRefresh.js` — hook para forzar recarga de textos cuando cambia el idioma.

Buenas prácticas:
- Mantener utilidades puras cuando sea posible (sin efectos secundarios) para facilitar tests.
- Documentar precondiciones y resultados esperados.
- Evitar mezclar estado dentro de utilidades a menos que sean hooks específicos.

Interacción con el proyecto:
- `viewmodels` y `view` consumen utilidades para cálculos, formateos y hooks transversales.