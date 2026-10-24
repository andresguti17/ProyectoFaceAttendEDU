import nodemailer from 'nodemailer';

// EmailMessage is a rendered email ready to be handed to the transport.
export interface EmailMessage {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
}

// SmtpConfig holds the SMTP settings of the delivery channel. Everything is
// read from the environment so the binary needs no config file (SERVICE.md §9).
//
// The service is usable without SMTP: when host is empty the sender is
// disabled and the API answers 202 "skipped" instead of failing, so the
// password-recovery flow of 01-ms-identity keeps working in dev.
export interface SmtpConfig {
  host: string;
  port: number;
  from: string;
  username: string;
  password: string;
  startTls: boolean;
  timeoutMs: number;
  internalToken: string;
}

// smtpConfigFromEnv builds the SmtpConfig from SMTP_* / EMAIL_* environment
// variables.
export function smtpConfigFromEnv(): SmtpConfig {
  return {
    host: (process.env.SMTP_HOST ?? '').trim(),
    port: intEnv('SMTP_PORT', 587),
    from: defaultEnv('SMTP_FROM', 'FaceAttend EDU <no-reply@faceattend.local>'),
    username: process.env.SMTP_USERNAME ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    startTls: boolEnv('SMTP_STARTTLS', true),
    timeoutMs: intEnv('SMTP_TIMEOUT_SECONDS', 10) * 1000,
    internalToken: process.env.EMAIL_INTERNAL_TOKEN ?? '',
  };
}

function defaultEnv(name: string, fallback: string): string {
  const v = (process.env[name] ?? '').trim();
  return v !== '' ? v : fallback;
}

function intEnv(name: string, fallback: number): number {
  const v = (process.env[name] ?? '').trim();
  if (v === '') {
    return fallback;
  }
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n) || n <= 0 || n > 65535) {
    return fallback;
  }
  return n;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  if (v === '') {
    return fallback;
  }
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

// SMTP_NOT_CONFIGURED is resolved (never thrown) when host is empty: the
// caller must treat it as "skipped", not as a failure (dev environments run
// without a relay).
export const SMTP_NOT_CONFIGURED = Symbol('smtp-not-configured');

// sendEmail delivers msg through a nodemailer transport built from cfg.
export async function sendEmail(cfg: SmtpConfig, msg: EmailMessage): Promise<void | typeof SMTP_NOT_CONFIGURED> {
  if (!cfg.host) {
    return SMTP_NOT_CONFIGURED;
  }

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: cfg.username ? { user: cfg.username, pass: cfg.password } : undefined,
    requireTLS: cfg.startTls,
    connectionTimeout: cfg.timeoutMs,
  });

  await transport.sendMail({
    from: cfg.from,
    to: msg.to,
    subject: msg.subject,
    text: msg.textBody,
    html: msg.htmlBody || undefined,
  });
}
