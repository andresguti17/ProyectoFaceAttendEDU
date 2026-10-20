// Templates available to callers. Kept as a whitelist so /api/v1/emails can
// never be abused as an open relay that renders arbitrary content.
export const TEMPLATE_VERIFICATION_CODE = 'verification_code';
export const TEMPLATE_USER_CREDENTIALS = 'user_credentials';

// subjectFor returns the fixed subject line of a template. Callers cannot
// provide their own subject: that is what keeps this endpoint from being a
// relay.
export function subjectFor(templateName: string): string {
  if (templateName === TEMPLATE_VERIFICATION_CODE) {
    return 'Restablece tu contraseña - FaceAttend EDU';
  }
  if (templateName === TEMPLATE_USER_CREDENTIALS) {
    return 'Tus credenciales de acceso - FaceAttend EDU';
  }
  return 'FaceAttend EDU';
}

type Values = Record<string, string>;

// Caller-provided values land inside HTML, so they are always escaped there.
function esc(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderVerificationCodeText(values: Values): string {
  const greeting = values.recipientname ? `, ${values.recipientname}` : '';
  return `${values.appname}

Hola${greeting}:

Tu código de verificación es: ${values.code}

Caduca en ${values.minutes} minutos. Si no solicitaste este código, ignora este
mensaje: tu contraseña no cambió.
`;
}

function renderVerificationCodeHtml(values: Values): string {
  const greeting = values.recipientname ? `, ${esc(values.recipientname)}` : '';
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(values.appname)}</title>
</head>
<body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${esc(values.appname)}</h1>
    <p style="margin:0 0 12px;font-size:15px;color:#4b5563;">
      Hola${greeting}, recibiste este correo porque solicitaste
      restablecer tu contraseña.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#4b5563;">Tu código de verificación es:</p>
    <p style="margin:0 0 20px;font-size:34px;letter-spacing:10px;font-weight:bold;color:#111827;text-align:center;background:#f9fafb;border-radius:8px;padding:16px 0;">
      ${esc(values.code)}
    </p>
    <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Caduca en ${esc(values.minutes)} minutos.</p>
    <p style="margin:0;font-size:13px;color:#6b7280;">
      Si no solicitaste este código, ignora este correo: tu contraseña no cambió.
    </p>
  </div>
</body>
</html>
`;
}

function renderUserCredentialsText(values: Values): string {
  const greeting = values.recipientname ? `, ${values.recipientname}` : '';
  const access = values.loginurl ? `\nIngresa en: ${values.loginurl}\n` : '';
  return `${values.appname}

Hola${greeting}:

Se creó tu cuenta. Estas son tus credenciales de acceso:

Usuario: ${values.username}
Contraseña: ${values.password}
${access}
Por seguridad, cambia tu contraseña al iniciar sesión y no compartas este
correo. Si no esperabas esta cuenta, avisa a tu administrador.
`;
}

function renderUserCredentialsHtml(values: Values): string {
  const greeting = values.recipientname ? `, ${esc(values.recipientname)}` : '';
  const access = values.loginurl
    ? `<p style="margin:0 0 16px;font-size:14px;color:#4b5563;">Ingresa en <a href="${esc(values.loginurl)}" style="color:#2563eb;">${esc(values.loginurl)}</a></p>`
    : '';
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(values.appname)}</title>
</head>
<body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${esc(values.appname)}</h1>
    <p style="margin:0 0 12px;font-size:15px;color:#4b5563;">
      Hola${greeting}, se creó tu cuenta. Estas son tus credenciales de acceso:
    </p>
    <table role="presentation" style="width:100%;margin:0 0 16px;border-collapse:collapse;background:#f9fafb;border-radius:8px;">
      <tr><td style="padding:10px 14px;font-size:13px;color:#6b7280;">Usuario</td>
          <td style="padding:10px 14px;font-size:15px;font-weight:bold;color:#111827;">${esc(values.username)}</td></tr>
      <tr><td style="padding:10px 14px;font-size:13px;color:#6b7280;">Contraseña</td>
          <td style="padding:10px 14px;font-size:15px;font-weight:bold;color:#111827;font-family:Consolas,monospace;">${esc(values.password)}</td></tr>
    </table>
    ${access}
    <p style="margin:0;font-size:13px;color:#6b7280;">
      Por seguridad, cambia tu contraseña al iniciar sesión y no compartas este
      correo. Si no esperabas esta cuenta, avisa a tu administrador.
    </p>
  </div>
</body>
</html>
`;
}

const RENDERERS: Record<string, { required: string[]; text: (v: Values) => string; html: (v: Values) => string }> = {
  [TEMPLATE_VERIFICATION_CODE]: { required: ['code'], text: renderVerificationCodeText, html: renderVerificationCodeHtml },
  [TEMPLATE_USER_CREDENTIALS]: { required: ['username', 'password'], text: renderUserCredentialsText, html: renderUserCredentialsHtml },
};

// SUPPORTED_TEMPLATES is the whitelist the /api/v1/emails route checks.
export const SUPPORTED_TEMPLATES = Object.keys(RENDERERS);

function normalize(data: Values): Values {
  const values: Values = {};
  for (const [key, value] of Object.entries(data)) {
    values[key.toLowerCase().trim()] = value;
  }
  return values;
}

function fallback(value: string | undefined, def: string): string {
  if (!value || value.trim() === '') {
    return def;
  }
  return value;
}

// render produces the plain-text and HTML bodies of a template. Data keys are
// matched case-insensitively, so clients may send "code" or "Code".
export function render(templateName: string, data: Values): { text: string; html: string } {
  const renderer = RENDERERS[templateName];
  if (!renderer) {
    throw new Error(`unknown template "${templateName}"`);
  }

  const values = normalize(data);
  for (const field of renderer.required) {
    if (!values[field] || values[field].trim() === '') {
      throw new Error(`data.${field} is required for template "${templateName}"`);
    }
  }

  for (const [key, value] of Object.entries(values)) {
    if (value.includes('{{') || value.includes('}}')) {
      throw new Error(`data.${key} contains unsupported characters`);
    }
  }

  values.appname = fallback(values.appname, 'FaceAttend EDU');
  values.minutes = fallback(values.minutes, '10');

  return { text: renderer.text(values), html: renderer.html(values) };
}
