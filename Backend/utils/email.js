const nodemailer = require("nodemailer");

let transporter;

/* --------------------------------------------------
   CREATE SMTP TRANSPORTER (BREVO)
-------------------------------------------------- */
async function getTransporter() {
  if (transporter) return transporter;

   transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,              // smtp-relay.brevo.com
    port: Number(process.env.SMTP_PORT),      // 587
    secure: false,                            // MUST false for 587
    requireTLS: true,                         // 🔥 IMPORTANT
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false               // 🔥 RENDER FIX
    },
    connectionTimeout: 120000,
    greetingTimeout: 60000,
    socketTimeout: 120000
  });

  await transporter.verify();
  console.log("✅ Brevo SMTP connected");

  return transporter;
}


/* --------------------------------------------------
   SEND MAIL
-------------------------------------------------- */
async function sendMail({ to, subject, html }) {
  try {
    const smtp = await getTransporter();

    const info = await smtp.sendMail({
      from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
      to,
      subject,
      html
    });

    console.log("📧 Email sent:", info.messageId);
    return { success: true };

  } catch (err) {
    console.error("❌ Email error:", err.message);
    return { success: false, error: err.message };
  }
}

/* --------------------------------------------------
   EMAIL TEMPLATE
-------------------------------------------------- */
function emailTemplate({ title, message, buttonUrl, buttonLabel }) {
  return `
  <div style="font-family:Arial; max-width:600px; margin:auto; padding:20px;
       border:1px solid #ddd; border-radius:12px;">
    <h2 style="text-align:center;">${title}</h2>
    <p>${message}</p>
    ${
      buttonUrl
        ? `<div style="text-align:center;margin:20px">
            <a href="${buttonUrl}" style="
              background:#ff385c;
              color:white;
              padding:12px 24px;
              border-radius:8px;
              text-decoration:none;
              font-weight:bold;">
              ${buttonLabel}
            </a>
          </div>`
        : ""
    }
    <p style="text-align:center;color:#999">WanderNext © 2025</p>
  </div>`;
}

/* --------------------------------------------------
   VERIFICATION EMAIL
-------------------------------------------------- */
async function sendVerificationEmail(user, token) {
  const url = `${process.env.BACKEND_URL}/verify-email/${token}`;

  return sendMail({
    to: user.email,
    subject: "Verify your WanderNext email",
    html: emailTemplate({
      title: "Verify Email",
      message: `Hi ${user.username}, please verify your email.`,
      buttonUrl: url,
      buttonLabel: "Verify Email"
    })
  });
}

/* --------------------------------------------------
   RESET PASSWORD EMAIL
-------------------------------------------------- */
async function sendResetEmail(user, token) {
  const url = `${process.env.BACKEND_URL}/reset-password/${token}`;

  return sendMail({
    to: user.email,
    subject: "Reset your WanderNext password",
    html: emailTemplate({
      title: "Reset Password",
      message: "Click below to reset your password.",
      buttonUrl: url,
      buttonLabel: "Reset Password"
    })
  });
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendResetEmail
};
