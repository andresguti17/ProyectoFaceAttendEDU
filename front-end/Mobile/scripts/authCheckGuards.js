// Guardas del script check-auth-json-server.js: solo apunta a servidores
// locales o de red privada y nunca refleja saltos de línea en el log.

const PRIVATE_IPV4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

function isLocalHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || PRIVATE_IPV4.some((pattern) => pattern.test(host));
}

function assertSafeTarget(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`URL no válida: ${safeLogText(rawUrl)}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Protocolo no permitido: ${url.protocol}`);
  }
  if (!isLocalHost(url.hostname)) {
    throw new Error(`El script solo apunta a servidores locales o de red privada, no a ${safeLogText(url.hostname)}`);
  }
}

function safeLogText(text) {
  return String(text).replace(/[\u0000-\u001f\u007f]/g, ' ');
}

module.exports = { assertSafeTarget, safeLogText };
