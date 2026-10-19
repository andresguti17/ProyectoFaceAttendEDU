// Solo lo usa Jest: Metro (expo start/export) trae su propio preset interno y
// no lee este archivo. jest-expo/web no inyecta un preset de Babel por
// defecto como sí hace el preset nativo, así que hace falta declararlo aquí
// para que jest pueda transformar JSX/ESM.
module.exports = {
    presets: ["babel-preset-expo"],
};
