# Carpeta `src/assets`

Propósito:
- Almacena recursos estáticos usados por la aplicación: imágenes, íconos, fuentes y otros archivos que se incluyen en el bundle.

Contenido típico:
- `images/` — imágenes de la UI, logos y fotos de ejemplo.

Cómo se usa:
- En React Native se referencian con `require()` para assets empacados o con URIs para recursos remotos.

Integración con otras carpetas:
- `view` hace referencia directa a assets para mostrar imágenes en componentes.

Versionado y cache:
- Si las imágenes se actualizan frecuentemente, considera usar URIs remotos o un control de cache para evitar que usuarios vean versiones antiguas.
