const nodemailer = require('nodemailer');


// Mail transporter
const transporter = nodemailer.createTransport({
    service: "Gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: false,
      auth: {
          user: process.env.E_MAIL_ID,
          pass: process.env.EMAIL_PASS
      }
  });
  
  // Helper function to send email
  const sendEmail = (email, subject, text) => {
      return transporter.sendMail({
          from: process.env.E_MAIL_ID,
          to: email,
          subject,
          text
      });
  };

  module.exports={sendEmail};