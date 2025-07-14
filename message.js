require('dotenv').config();
const nodemailer = require("nodemailer");

function sendEmail(to, subject, text) {
    // Wrap in an async IIFE so we can use await
(async () => {
  // Create a transporter using Gmail with environment variables
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // Do not fail on invalid certificates
      rejectUnauthorized: false
    }
  });

  // Send email from your real Gmail account
  const info = await transporter.sendMail({
    from: `"Orhun Tech" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: subject,
    text: text,
    html: "<b>" + text + "</b>",
  });

  console.log("Message sent:", info.messageId);
})().catch(console.error);
}

// Export the sendEmail function
module.exports = { sendEmail };