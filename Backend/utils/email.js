const nodemailer = require('nodemailer');
let cachedTransporter = null;

// ------------------------------------------------------
// CREATE TRANSPORTER (GMAIL SMTP OR ETHEREAL)
// ------------------------------------------------------
async function createTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    const isSecure = Number(process.env.SMTP_PORT) === 465;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: isSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.verify();
    console.log("✅ SMTP connected successfully");

    cachedTransporter = transporter;
    return transporter;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("❌ SMTP not configured in production");
  }

  console.log("🧪 Using Ethereal (DEV)");
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: testAccount
  });

  cachedTransporter = transporter;
  return transporter;
}
// ------------------------------------------------------
// UNIVERSAL SEND MAIL FUNCTION
// ------------------------------------------------------
async function sendMail({ to, subject, html }) {
  console.log("SMTP CHECK:", {
    NODE_ENV: process.env.NODE_ENV,
    HOST: process.env.SMTP_HOST,
    PORT: process.env.SMTP_PORT,
    USER: !!process.env.SMTP_USER,
    PASS: !!process.env.SMTP_PASS
  });

  try {
    if (
  process.env.NODE_ENV === "development" &&
  !process.env.SMTP_HOST
) {
  console.log("📧 DEV MODE → Email skipped");
  return { success: true, devSkipped: true };
}


    const transporter = await createTransporter();

    const info = await transporter.sendMail({
      from: `"WanderNext" <${process.env.SMTP_USER}>`,
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
// ------------------------------------------------------
// EMAIL TEMPLATE
// ------------------------------------------------------
function emailTemplate({ title, message, buttonUrl, buttonLabel }) {
  return `
    <div style="font-family:Arial; max-width:600px; margin:auto; padding:20px;
         border:1px solid #ddd; border-radius:12px;">
      
      <h2 style="text-align:center; color:#333;">${title}</h2>

      <p style="font-size:16px; color:#555;">${message}</p>

      ${buttonUrl ? `
        <div style="text-align:center; margin:25px 0;">
          <a href="${buttonUrl}" style="
              background:#ff385c; 
              color:white; 
              padding:12px 25px; 
              border-radius:8px;
              font-weight:bold;
              text-decoration:none;
          ">${buttonLabel}</a>
        </div>
      ` : ""}

      <p style="text-align:center; color:#aaa;">WanderNext © 2025</p>
    </div>`;
}

// ------------------------------------------------------
// VERIFICATION EMAIL
// ------------------------------------------------------
async function sendVerificationEmail(user, token) {
  const url = `${process.env.BACKEND_URL}/verify-email/${token}`;

  return sendMail({
    to: user.email,
    subject: "Verify your WanderNext Email",
    html: emailTemplate({
      title: "Verify Your WanderNext Account",
      message: `Hi ${user.username},<br>Please click the button below to verify your email.`,
      buttonUrl: url,
      buttonLabel: "Verify Email"
    })
  });
}

// ------------------------------------------------------
// RESET PASSWORD EMAIL
// ------------------------------------------------------
async function sendResetEmail(user, token) {
  const url = `${process.env.BACKEND_URL}/reset-password/${token}`;

  return sendMail({
    to: user.email,
    subject: "Reset your WanderNext password",
    html: emailTemplate({
      title: "Reset Password",
      message: `Click the button below to reset your password.`,
      buttonUrl: url,
      buttonLabel: "Reset Password"
    })
  });
}

module.exports = {
  sendVerificationEmail,
  sendResetEmail,
  sendMail,
  emailTemplate
};
