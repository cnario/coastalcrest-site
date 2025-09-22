// api/send.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    // parse form data (Vercel will parse urlencoded/form-data if sent as form)
    const { name, email, message } = req.body;

    // transporter using SMTP (environment variables set in Vercel)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: `"Website Contact" <${process.env.SMTP_USER}>`, // sender address (use your SMTP user or a verified sender)
      to: process.env.TO_EMAIL || 'info@coastalcrestenergyltd.com', // recipient
      subject: `New contact from website: ${name || 'Unknown'}`,
      replyTo: email,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
      // html: add html if you prefer
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ ok: true, message: 'Message sent' });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to send message' });
  }
}

// api/send.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const { name, email, phone, message, website, form_time } = req.body || {};

    // 1) Honeypot: if filled, silently ignore (return success to avoid confirming)
    if (website && String(website).trim() !== '') {
      console.warn('Honeypot triggered. Dropping submission.', { website });
      return res.status(200).json({ ok: true, message: 'Message sent' });
    }

    // 2) Speed check: if form submitted too quickly (e.g. < 5 seconds), treat as bot
    const now = Date.now();
    let loadedAt = parseInt(form_time, 10) || 0;
    // if loadedAt is in seconds (older code), try to normalize
    if (loadedAt > 0 && loadedAt < 1e12 && loadedAt > 1e9) {
      // already ms
    } else if (loadedAt > 1e9 && loadedAt < 1e12) {
      // probably seconds -> convert to ms
      loadedAt = loadedAt * 1000;
    } else {
      // unknown or missing: set loadedAt to now so it won't be flagged erroneously
      loadedAt = now;
    }

    const delta = now - loadedAt;
    // If submitted in less than 5 seconds consider it suspicious
    if (delta < 5000) {
      console.warn('Fast submission detected (possible bot). Delta ms:', delta);
      return res.status(200).json({ ok: true, message: 'Message sent' });
    }

    // Basic required fields check
    if (!email || !message) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    // Configure transporter (Mailu)
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
}
