// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const faceattend = require("./eslint-rules");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Estándar de botones: el color sale del tema (Configuración > Apariencia).
    // Los propios botones (Button/IconButton/buttonColors) son la fuente del estándar.
    files: ["src/view/**/*.js"],
    ignores: ["src/view/components/common/buttons/**", "**/__tests__/**"],
    plugins: { faceattend },
    rules: {
      "faceattend/button-standard": "error",
    },
  },
]);
