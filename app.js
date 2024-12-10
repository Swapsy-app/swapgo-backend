require("dotenv").config();
const express=require("express");


const app=express();
app.use(express.json());


 
app.listen(process.env.PORT,()=>{
    console.log(`Server is running on port http://localhost:${process.env.PORT}`);
})