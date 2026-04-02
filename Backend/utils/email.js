const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendMail({ to, subject, html }) {
  try {
    console.log("📨 TRYING TO SEND EMAIL TO:", to);
    const response = await resend.emails.send({
      from: `${process.env.SENDER_NAME} <onboarding@resend.dev>`,
      to,
      subject,
      html
    });

    console.log("📧 Email sent:",response);
    return { success: true };

  } catch (err) {
    console.error("❌ Email error:", err.message);
    return { success: false, error: err.message };
  }
}

/* ==================================================
   EMAIL TEMPLATE
================================================== */
function emailTemplate({ title, message, buttonUrl, buttonLabel }) {
  return `
  <div style="
    font-family: 'Segoe UI', Roboto, Arial, sans-serif;
    background:#f4f6fb;
    padding:40px 0;
  ">
    <div style="
      max-width:600px;
      margin:auto;
      background:#ffffff;
      border-radius:16px;
      overflow:hidden;
      box-shadow:0 20px 40px rgba(0,0,0,0.08);
    ">

      <!-- HEADER -->
      <div style="
        background:linear-gradient(135deg,#6C63FF,#4f46e5);
        padding:24px;
        color:white;
        text-align:center;
      ">
        <h1 style="margin:0;font-size:22px;">WanderNext</h1>
        <p style="margin:6px 0 0;font-size:14px;opacity:.9;">
          Discover your next stay
        </p>
      </div>

      <!-- BODY -->
      <div style="padding:30px;">
        <h2 style="color:#111827;font-size:20px;margin-bottom:12px;">
          ${title}
        </h2>

        <p style="color:#4b5563;font-size:15px;line-height:1.6;">
          ${message}
        </p>

        ${
          buttonUrl
            ? `
          <div style="text-align:center;margin:30px 0;">
            <a href="${buttonUrl}" style="
              display:inline-block;
              background:linear-gradient(90deg,#6C63FF,#4f46e5);
              color:white;
              padding:14px 28px;
              border-radius:999px;
              font-size:15px;
              font-weight:600;
              text-decoration:none;
              box-shadow:0 10px 25px rgba(79,70,229,0.35);
            ">
              ${buttonLabel}
            </a>
          </div>
          `
            : ""
        }

        <p style="font-size:13px;color:#9ca3af;">
          If you didn’t request this, you can safely ignore this email.
        </p>
      </div>

      <!-- FOOTER -->
      <div style="
        background:#f9fafb;
        padding:16px;
        text-align:center;
        font-size:12px;
        color:#9ca3af;
      ">
        © ${new Date().getFullYear()} WanderNext. All rights reserved.
      </div>

    </div>
  </div>
  `;
}

async function sendOTPEmail(user, otp) {
  return sendMail({
    to: user.email,
    subject: "Your OTP Code",
    html: emailTemplate({
      title: "Verify Your Email",
      message: `Hi ${user.username}, your OTP is <b>${otp}</b>. Valid for 5 minutes.`,
    })
  });
}

/* ==================================================
   VERIFICATION EMAIL
================================================== */
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

/* ==================================================
   RESET PASSWORD EMAIL
================================================== */
async function sendResetEmail(user, token) {
  const url = `${process.env.BACKEND_URL}/reset-password/${token}`;

  return sendMail({
    to: user.email,
    subject: "Reset your password",
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
  sendOTPEmail,
  sendVerificationEmail,
  sendResetEmail,
  emailTemplate
};
