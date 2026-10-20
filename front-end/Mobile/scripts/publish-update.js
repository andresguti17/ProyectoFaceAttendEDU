// Publica una actualización OTA: node scripts/publish-update.js <canal> [mensaje]
// Sin mensaje usa el asunto del último commit. Las variables EXPO_PUBLIC_* se toman
// del perfil del mismo nombre en eas.json: `eas update` empaqueta en este equipo y
// no lee el `env` de los perfiles de build, así que sin esto la URL del backend se perdería.
const {execFileSync} = require('child_process');
const path = require('path');

const [channel = 'production', ...rest] = process.argv.slice(2);
if (!['development', 'preview', 'production'].includes(channel)) {
    console.error(`Canal desconocido: ${channel}. Usa development, preview o production.`);
    process.exit(1);
}
const profileEnv = require(path.join(__dirname, '..', 'eas.json')).build[channel].env || {};
const message = rest.join(' ') || execFileSync('git', ['log', '-1', '--pretty=%s']).toString().trim();

execFileSync('npx', ['eas-cli', 'update', '--channel', channel, '--message', message, '--clear-cache', '--non-interactive'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {...process.env, ...profileEnv},
});
