const axios = require("axios");

/* --------------------------------------------------
   SEND MAIL USING BREVO API (RENDER SAFE)
-------------------------------------------------- */
async function sendMail({ to, subject, html }) {
  try {
    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: process.env.SENDER_NAME || "WanderNext",
          email: process.env.SENDER_EMAIL
        },
        to: [{ email: to }],
        subject,
        htmlContent: html
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    console.log("📧 Email sent via Brevo API:", res.data.messageId);
    return { success: true };

  } catch (err) {
    console.error(
      "❌ Brevo API email error:",
      err.response?.data || err.message
    );
    return { success: false, error: err.message };
  }
}

/* --------------------------------------------------
   EMAIL TEMPLATE
-------------------------------------------------- */
function emailTemplate({ title, message, buttonUrl, buttonLabel }) {
  return `
  <div style="font-family:Arial;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:12px">
    <h2 style="text-align:center">${title}</h2>
    <p>${message}</p>
    ${
      buttonUrl
        ? `<div style="text-align:center;margin:20px">
            <a href="${buttonUrl}" style="
              background:#ff385c;
              color:#fff;
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
