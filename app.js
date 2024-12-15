require("dotenv").config();
const express=require("express");
const nodemailer = require('nodemailer');
require("./DataBase/Connection");
const bodyParser = require("body-parser");
const swaggerJsdoc = require("swagger-jsdoc"),
swaggerUi = require("swagger-ui-express");

const userRouter=require("./Routes/UserRoutes");

const app=express();
app.use(express.json());

const options = {
    definition: {
      openapi: "3.1.0",
      info: {
        title: "SwapKaro Express API with Swagger",
        version: "0.1.0",
        description:
          "This is a simple CRUD API application made with Express and documented with Swagger",
        license: {
          name: "---",
          url: "---",
        },
        contact: {
          name: "SwapKaro",
          url: "https://swapkaro.com",
          email: "swapkaro@email.com",
        },
      },
      servers: [
        {
          url: "http://localhost:3000/",
        },
      ],
    },
    apis: ["./app.js"],
  };





const specs = swaggerJsdoc(options);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs,{ explorer: true })
);
app.use(userRouter);


//I'm Starting Code Here

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