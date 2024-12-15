const mongoose=require("mongoose");
// MongoDB connection
mongoose.connect(`${process.env.DB_URL}/swapkaro`)
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));