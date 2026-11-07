import express from 'express';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import crypto from 'node:crypto';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '128kb' }));
const required = ['MAIL_USER', 'MAIL_PASSWORD', 'GATEWAY_TOKEN'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error('Missing required environment variable names:', missing.join(', '));
  process.exit(1);
}
const address = process.env.MAIL_USER.toLowerCase();
if (address !== 'adam@trinitycontinuum.com') {
  console.error('Gateway only supports the explicitly authorized Adam mailbox');
  process.exit(1);
}
const smtp = nodemailer.createTransport({
  host: 'mail.privateemail.com', port: 465, secure: true,
  auth: { user: address, pass: process.env.MAIL_PASSWORD },
  tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
});
function authorized(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /i, '');
  const a = Buffer.from(token);
  const b = Buffer.from(process.env.GATEWAY_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
app.get('/health', (_, res) => res.json({ ok: true, configured: true }));
app.use('/v1', authorized);
app.post('/v1/send', async (req, res) => {
  const { to, subject, text, replyTo, inReplyTo, references } = req.body || {};
  if (!Array.isArray(to) || !to.length || to.length > 20 ||
      !to.every(v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ||
      typeof subject !== 'string' || !subject.trim() || subject.length > 300 ||
      typeof text !== 'string' || !text.trim() || text.length > 100000) {
    return res.status(400).json({ error: 'Invalid recipients, subject or message' });
  }
  if (replyTo && replyTo !== address) return res.status(400).json({ error: 'Reply-To not authorized' });
  try {
    const result = await smtp.sendMail({
      from: address, to, subject, text, replyTo: address,
      ...(inReplyTo ? { inReplyTo: String(inReplyTo) } : {}),
      ...(references ? { references: String(references) } : {})
    });
    res.json({ accepted: result.accepted, rejected: result.rejected, messageId: result.messageId });
  } catch (error) {
    console.error('SMTP send failed:', error.code || error.name);
    res.status(502).json({ error: 'SMTP send failed', code: error.code || 'UNKNOWN' });
  }
});
app.get('/v1/inbox', async (req, res) => {
  const count = Math.max(1, Math.min(30, Number(req.query.limit) || 10));
  const client = new ImapFlow({
    host: 'mail.privateemail.com', port: 993, secure: true,
    auth: { user: address, pass: process.env.MAIL_PASSWORD },
    logger: false
  });
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    let messages = [];
    try {
      const total = client.mailbox.exists;
      if (total > 0) {
        const start = Math.max(1, total - count + 1);
        for await (const msg of client.fetch(`${start}:*`, { uid: true, envelope: true, flags: true })) {
          messages.push({
            uid: msg.uid, subject: msg.envelope?.subject,
            from: msg.envelope?.from?.map(x => x.address),
            date: msg.envelope?.date, messageId: msg.envelope?.messageId
          });
        }
      }
    } finally { lock.release(); }
    res.json({ mailbox: address, messages });
  } catch (error) {
    console.error('IMAP read failed:', error.code || error.name);
    res.status(502).json({ error: 'IMAP read failed' });
  } finally { await client.logout().catch(() => {}); }
});
app.listen(Number(process.env.PORT) || 10000, '0.0.0.0');
