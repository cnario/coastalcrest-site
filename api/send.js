// api/send.js (CommonJS for Vercel)
const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const { name, email, phone, message, website, form_time } = req.body || {};

    // Honeypot: silently drop
    if (website && String(website).trim() !== '') {
      console.warn('Honeypot triggered. Dropping submission.', { website });
      return res.status(200).json({ ok: true, message: 'Message sent' });
    }

    // Speed check
    const now = Date.now();
    let loadedAt = parseInt(form_time, 10) || 0;
    if (loadedAt > 0 && loadedAt < 1e12 && loadedAt > 1e9) {
      // already ms
    } else if (loadedAt > 1e9 && loadedAt < 1e12) {
      loadedAt = loadedAt * 1000;
    } else {
      loadedAt = now;
    }
    const delta = now - loadedAt;
    if (delta < 5000) {
      console.warn('Fast submission detected (possible bot). Delta ms:', delta);
      return res.status(200).json({ ok: true, message: 'Message sent' });
    }

    if (!email || !message) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

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
      }
    });

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

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ ok: true, message: 'Message sent' });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to send message' });
  }
};
