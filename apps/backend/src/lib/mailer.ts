import nodemailer from "nodemailer";

// For development, we'll log the email to console if SMTP is not configured.
// In production, configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.SMTP_PORT || "587"),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"Social Funnel Admin" <admin@socialfunnel.com>',
    to: email,
    subject: "Set or Reset Your Password",
    text: `Hello,\n\nPlease use the following link to set or reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`,
    html: `<p>Hello,</p><p>Please use the following link to set or reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, please ignore this email.</p>`,
  };

  if (!process.env.SMTP_USER) {
    console.log("\n=======================================================");
    console.log("📧 MOCK EMAIL SENT (SMTP not configured)");
    console.log("To:", email);
    console.log("Subject:", mailOptions.subject);
    console.log("Reset Link:", resetLink);
    console.log("=======================================================\n");
    return;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
}
