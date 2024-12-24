require("dotenv").config();
const express=require("express");

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

app.get("/",(req,res)=>{
    res.send("Welcome to my API");
})


//testing for email message
//sendEmail("himanshudey19@gmail.com","Hello","Hello");
 
app.listen(process.env.PORT,()=>{
    console.log(`Server is running on port http://localhost:${process.env.PORT}`);
})