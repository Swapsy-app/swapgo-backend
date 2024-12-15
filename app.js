require("dotenv").config();
const express=require("express");
const nodemailer = require('nodemailer');
const { specs, swaggerUi } = require('./swagger');
require("./DataBase/Connection");
const bodyParser = require("body-parser");


const userRouter=require("./Routes/UserRoutes");




const app=express();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.use(express.json());
app.use(bodyParser.json());





//I'm Starting Code Here
app.use(userRouter);

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

//testing for email message
//sendEmail("himanshudey19@gmail.com","Hello","Hello");
 
app.listen(process.env.PORT,()=>{
    console.log(`Server is running on port http://localhost:${process.env.PORT}`);
})