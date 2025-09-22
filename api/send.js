// api/send.js (CommonJS with verbose debug for troubleshooting)
const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const { name, email, phone, message, website, form_time } = req.body || {};

    // Honeypot
    if (website && String(website).trim() !== '') {
      console.warn('Honeypot triggered. Dropping submission.', { website });
      return res.status(200).json({ ok: true, message: 'Message sent' });
    }

    // Basic speed check (as before)
    const now = Date.now();
    let loadedAt = parseInt(form_time, 10) || now;
    if (loadedAt > 1e9 && loadedAt < 1e12 && loadedAt < 1e11) loadedAt = loadedAt * 1000;
    const delta = now - loadedAt;
    if (delta < 5000) {
      console.warn('Fast submission detected. Delta:', delta);
      return res.status(200).json({ ok: true, message: 'Message sent' });
    }

    if (!email || !message) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    // Build transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: process.env.MAILU_TLS_REJECT_UNAUTHORIZED !== 'false'
      },
      // enable debug for nodemailer (this logs to console)
      logger: true,
      debug: true
    });

    // 1) Verify connection/auth
    try {
      await transporter.verify();
      console.log('SMTP verify: OK');
    } catch (vErr) {
      console.error('SMTP verify failed:', vErr && vErr.message ? vErr.message : vErr);
      // return error so you can see the cause; remove in production
      return res.status(500).json({ ok: false, error: 'SMTP verify failed', details: String(vErr) });
    }

    const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER;
    const toAddress = process.env.TO_EMAIL || 'info@coastalcrestenergyltd.com';

    const mailOptions = {
      from: `"Coastalcrest Website" <${fromAddress}>`,
      to: toAddress,
      subject: `Website contact from ${name || 'Anonymous'}`,
      replyTo: email,
      text:
          `You have a new contact request from the website.\n\n` +
          `Name: ${name || 'N/A'}\n` +
          `Email: ${email}\n` +
          `Phone: ${phone || 'N/A'}\n\n` +
          `Message:\n${message}\n`
    };

    // 2) Send mail and log response
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('sendMail info:', info); // includes messageId and response
      return res.status(200).json({ ok: true, message: 'Message sent', info: { messageId: info.messageId, response: info.response } });
    } catch (sendErr) {
      console.error('sendMail failed:', sendErr);
      return res.status(500).json({ ok: false, error: 'Failed to send', details: String(sendErr) });
    }
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ ok: false, error: 'Server error', details: String(err) });
  }
};
