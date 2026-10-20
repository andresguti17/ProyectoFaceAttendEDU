// Publica una actualización OTA: node scripts/publish-update.js <canal> [mensaje]
// Sin mensaje usa el asunto del último commit.
const {execFileSync} = require('child_process');

const [channel = 'production', ...rest] = process.argv.slice(2);
if (!['development', 'preview', 'production'].includes(channel)) {
    console.error(`Canal desconocido: ${channel}. Usa development, preview o production.`);
    process.exit(1);
}
const message = rest.join(' ') || execFileSync('git', ['log', '-1', '--pretty=%s']).toString().trim();
const run = (cmd, args) => execFileSync(cmd, args, {stdio: 'inherit', shell: process.platform === 'win32'});

run('npx', ['eas-cli', 'update', '--channel', channel, '--message', message, '--non-interactive']);
