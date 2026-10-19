import { sendEmail, smtpConfigFromEnv, SMTP_NOT_CONFIGURED } from '../sender';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
const nodemailer = require('nodemailer');

describe('sendEmail', () => {
  it('resolves SMTP_NOT_CONFIGURED when host is empty', async () => {
    const cfg = { host: '', port: 1025, from: 'a@b.c', username: '', password: '', startTls: false, timeoutMs: 1000, internalToken: '' };
    expect(await sendEmail(cfg, { to: 'x@y.com', subject: 's', textBody: 't', htmlBody: '' })).toBe(SMTP_NOT_CONFIGURED);
  });
  it('sends through a nodemailer transport when host is set', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    nodemailer.createTransport.mockReturnValue({ sendMail });
    const cfg = { host: 'smtp.local', port: 587, from: 'a@b.c', username: '', password: '', startTls: true, timeoutMs: 1000, internalToken: '' };
    await sendEmail(cfg, { to: 'x@y.com', subject: 's', textBody: 't', htmlBody: '<p>h</p>' });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'x@y.com', subject: 's' }));
  });
});
