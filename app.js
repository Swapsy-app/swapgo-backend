require("dotenv").config();
const express=require("express");
const cors = require("cors");
const { specs, swaggerUi } = require('./swagger');
require("./DataBase/Connection");
require("./Seeder/seedDatabase");
const profileRoutes = require("./Routes/UserProfileRoutes");
const { setupWebSocket } = require('./Modules/websocket'); // Adjust the path as needed
const searchRoutes = require('./Routes/UserSearchRoute');
const communityRouter=require("./Routes/communityRoutes");
const userRouter=require("./Routes/UserRoutes");
const reportUserRoute=require("./Routes/ReportUserRoute");
const userAddressRoutes=require("./Routes/UserAddressRoutes");
const productRoutes=require("./Routes/ProductRoutes/ProductRoutes");
const productCardRoutes=require("./Routes/ProductRoutes/ProductCardFetch");
const productPageFetch=require("./Routes/ProductRoutes/ProductPageFetchRoutes");
const productBargain=require("./Routes/ProductRoutes/ProductBargainRoutes");
const productComment = require("./Routes/ProductRoutes/ProductCommentRoutes");
const ProductWishlist = require("./Routes/ProductRoutes/ProductWishlist");
const ProductPincode = require("./Routes/ProductRoutes/ProductPincode");
const ProductCart = require("./Routes/ProductRoutes/ProductCartRoutes");
const HolidayMode = require("./Routes/SellerFeatureRoutes/HolidayMode");
const ShippingLabel = require("./Routes/SellerFeatureRoutes/ShippingLabel");

const app=express();
const server = require('http').createServer(app);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173" }));


//I'm Starting Code Here
app.use("/api/auth",userRouter);
app.use("/api/userprofile",profileRoutes);
app.use("/api/searchuser",searchRoutes); 
app.use("/api/community",communityRouter); 
app.use("/api/reportuser",reportUserRoute);
app.use("/api/useraddress",userAddressRoutes);
app.use("/api/productsell",productRoutes);
app.use("/api/productcard",productCardRoutes);
app.use("/api/productpage",productPageFetch);
app.use("/api/bargain",productBargain);
app.use("/api/comments", productComment);
app.use("/api/wishlist", ProductWishlist);
app.use("/api/pincode", ProductPincode);
app.use("/api/cart", ProductCart);
app.use("/api/holiday", HolidayMode);
app.use("/api/shippinglabel", ShippingLabel);

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