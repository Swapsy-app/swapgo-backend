require("dotenv").config();
const express=require("express");
const { specs, swaggerUi } = require('./swagger');
require("./DataBase/Connection");
require("./Seeder/seedDatabase");
const bodyParser = require("body-parser");
const profileRoutes = require("./Routes/UserProfileRoutes");
const { setupWebSocket } = require('./Modules/websocket'); // Adjust the path as needed
const searchRoutes = require('./Routes/UserSearchRoute');
const communityRouter=require("./Routes/communityRoutes");
const userRouter=require("./Routes/UserRoutes");
const reportUserRoute=require("./Routes/ReportUserRoute")
const userAddressRoutes=require("./Routes/UserAddressRoutes");
const productRoutes=require("./Routes/ProductRoutes/ProductRoutes")
const productCardRoutes=require("./Routes/ProductRoutes/ProductCardFetch")
const productPageFetch=require("./Routes/ProductRoutes/ProductPageFetchRoutes")
const productBargain=require("./Routes/ProductRoutes/ProductBargainRoutes")

const app=express();
const server = require('http').createServer(app);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());



//I'm Starting Code Here
app.use(userRouter);
app.use(profileRoutes);
app.use(searchRoutes); 
app.use(communityRouter); 
app.use(reportUserRoute);
app.use(userAddressRoutes);
app.use(productRoutes);
app.use(productCardRoutes);
app.use(productPageFetch);
app.use(productBargain);

app.use('/public', express.static('./public'));

app.get("/",(req,res)=>{
    res.send("Welcome to my API");
})

// Setup WebSocket
setupWebSocket(server);

//testing for email message 
//sendEmail("himanshudey19@gmail.com","Hello","Hello");
 
server.listen(process.env.PORT,()=>{
    console.log(`Server is running on port http://localhost:${process.env.PORT}`);
})