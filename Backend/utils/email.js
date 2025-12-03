const nodemailer = require('nodemailer');

// ------------------------------------------------------
// CREATE TRANSPORTER (GMAIL SMTP OR ETHEREAL)
// ------------------------------------------------------
async function createTransporter() {

  // If user has SMTP credentials → use Gmail
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const isSecure = Number(process.env.SMTP_PORT) === 465;

    console.log("📨 Using SMTP:", process.env.SMTP_HOST, "PORT:", process.env.SMTP_PORT);

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: isSecure,                 // true → 465, false → 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // DEVELOPMENT MODE → USE ETHEREAL
  console.log("🧪 No SMTP credentials found → Using Ethereal test email");

  const testAccount = await nodemailer.createTestAccount();

  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
}

// ------------------------------------------------------
// UNIVERSAL SEND MAIL FUNCTION
// ------------------------------------------------------
async function sendMail({ to, subject, html }) {
  try {
    // IN DEVELOPMENT: Don't send Gmail email (faster)
    if (process.env.NODE_ENV === "development") {
      console.log("📧 DEV MODE: Email sending skipped");
      console.log("TO:", to);
      console.log("SUBJECT:", subject);
      return { success: true, devSkipped: true };
    }

    const transporter = await createTransporter();

    const info = await transporter.sendMail({
      from: `"WanderNext" <${process.env.SMTP_USER || "no-reply@wander.com"}>`,
      to,
      subject,
      html
    });

    console.log("📧 Email Sent:", info.messageId);

    // For ethereal preview
    if (nodemailer.getTestMessageUrl(info)) {
      console.log("🔗 Preview URL:", nodemailer.getTestMessageUrl(info));
    }

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
