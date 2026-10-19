// Copia los scripts del SDK web de DigitalPersona a public/vendor para que la
// pantalla «Biometría» los cargue desde /vendor/*.js (los SDK son globales UMD,
// no módulos: no se pueden importar con Metro). Lo ejecutan los scripts
// `start`/`web` de package.json y el Dockerfile antes de `expo export`.
import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const vendor = resolve(root, "public", "vendor");
const files = [
    ["@digitalpersona/websdk", "websdk.client.ui.js"],
    ["@digitalpersona/fingerprint", "fingerprint.sdk.js"],
];

await mkdir(vendor, { recursive: true });
for (const [pkg, file] of files) {
    await copyFile(resolve(root, "node_modules", pkg, "dist", file), resolve(vendor, file));
}
console.log(`DigitalPersona SDK -> ${vendor}`);
