require("dotenv").config();
const express=require("express");
const { specs, swaggerUi } = require('./swagger');
require("./DataBase/Connection");
require("./Seeder/seedDatabase");
const bodyParser = require("body-parser");
const profileRoutes = require("./Routes/UserProfileRoutes");


const userRouter=require("./Routes/UserRoutes");



const app=express();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.use(express.json());
app.use(bodyParser.json());





//I'm Starting Code Here
app.use(userRouter);
app.use(profileRoutes);
app.use('/public', express.static('./public'));

app.get("/",(req,res)=>{
    res.send("Welcome to my API");
})


//testing for email message 
//sendEmail("himanshudey19@gmail.com","Hello","Hello");
 
app.listen(process.env.PORT,()=>{
    console.log(`Server is running on port http://localhost:${process.env.PORT}`);
})