// Templates available to callers. Kept as a whitelist so /api/v1/emails can
// never be abused as an open relay that renders arbitrary content.
export const TEMPLATE_VERIFICATION_CODE = 'verification_code';

// subjectFor returns the fixed subject line of a template. Callers cannot
// provide their own subject: that is what keeps this endpoint from being a
// relay.
export function subjectFor(templateName: string): string {
  if (templateName === TEMPLATE_VERIFICATION_CODE) {
    return 'Restablece tu contraseña - FaceAttend EDU';
  }
  return 'FaceAttend EDU';
}

function renderVerificationCodeText(values: Record<string, string>): string {
  const greeting = values.recipientname ? `, ${values.recipientname}` : '';
  return `${values.appname}

Hola${greeting}:

Tu código de verificación es: ${values.code}

Caduca en ${values.minutes} minutos. Si no solicitaste este código, ignora este
mensaje: tu contraseña no cambió.
`;
}

function renderVerificationCodeHtml(values: Record<string, string>): string {
  const greeting = values.recipientname ? `, ${values.recipientname}` : '';
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${values.appname}</title>
</head>
<body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${values.appname}</h1>
    <p style="margin:0 0 12px;font-size:15px;color:#4b5563;">
      Hola${greeting}, recibiste este correo porque solicitaste
      restablecer tu contraseña.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#4b5563;">Tu código de verificación es:</p>
    <p style="margin:0 0 20px;font-size:34px;letter-spacing:10px;font-weight:bold;color:#111827;text-align:center;background:#f9fafb;border-radius:8px;padding:16px 0;">
      ${values.code}
    </p>
    <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Caduca en ${values.minutes} minutos.</p>
    <p style="margin:0;font-size:13px;color:#6b7280;">
      Si no solicitaste este código, ignora este correo: tu contraseña no cambió.
    </p>
  </div>
</body>
</html>
`;
}

const RENDERERS: Record<string, { text: (v: Record<string, string>) => string; html: (v: Record<string, string>) => string }> = {
  [TEMPLATE_VERIFICATION_CODE]: { text: renderVerificationCodeText, html: renderVerificationCodeHtml },
};

function normalize(data: Record<string, string>): Record<string, string> {
  const values: Record<string, string> = {};
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
export function render(templateName: string, data: Record<string, string>): { text: string; html: string } {
  const renderer = RENDERERS[templateName];
  if (!renderer) {
    throw new Error(`unknown template "${templateName}"`);
  }

  const values = normalize(data);
  if (!values.code || values.code.trim() === '') {
    throw new Error(`data.code is required for template "${templateName}"`);
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
