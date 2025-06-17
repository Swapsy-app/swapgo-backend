const express = require("express");
const router = express.Router();
const authenticateToken = require("../../Modules/authMiddleware");
const Order = require("../../Models/ProductOrder/ProductOrder");
const User = require("../../Models/User");
const Product = require("../../Models/ProductModels/Product");
const Address = require("../../Models/ProductModels/address");


//route to get order status for seller to allow him to confirm order for buyer
router.get("/fetch-seller-orders", authenticateToken, async (req, res) => {
  const sellerId = req.user._id;

  try {
    const allOrders = await Order.find({ "products.sellerId": sellerId })
      .select("products orderStatus paymentStatus transactionId pickupAddressId deliveryAddressId createdAt");

    const filteredOrders = [];

    allOrders.forEach((order) => {
      const sellerProducts = order.products.filter(
        (product) => product.sellerId.toString() === sellerId.toString()
      );

      if (sellerProducts.length > 0) {
        filteredOrders.push({
          _id: order._id,
          transactionId: order.transactionId,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          pickupAddressId: order.pickupAddressId,     // ✅ Only ID
          deliveryAddressId: order.deliveryAddressId, // ✅ Only ID
          products: sellerProducts,
          createdAt: order.createdAt,
        });
      }
    });

    return res.status(200).json({ orders: filteredOrders });
  } catch (err) {
    console.error("Error fetching seller orders:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

//to fetch buyer product and seller details at order confirm page (route not tested on postman plz check before integrating if everything is performing fine)
router.get("/order-details/:orderId", async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    const pickupAddress = await Address.findById(order.pickupAddressId).lean();
    if (!pickupAddress) return res.status(404).json({ message: "Pickup address not found" });

    const enrichedProducts = await Promise.all(
      order.products.map(async (prod) => {
        const buyer = await User.findById(order.buyerId).select("username avatar").lean();
        const product = await Product.findById(prod.productId).select("images").lean();

        let priceDetails = null;

        if (prod.priceMode === "cash") {
          priceDetails = {
            enteredAmount: prod.fullPrice?.cash?.enteredAmount || null,
            mrp: prod.fullPrice?.mrp || null,
            type: "cash"
          };
        } else if (prod.priceMode === "coin") {
          priceDetails = {
            enteredAmount: prod.fullPrice?.coin?.enteredAmount || null,
            mrp: prod.fullPrice?.mrp || null,
            type: "coin"
          };
        } else if (prod.priceMode === "mix") {
          priceDetails = {
            enteredCash: prod.fullPrice?.mix?.enteredCash || null,
            enteredCoin: prod.fullPrice?.mix?.enteredCoin || null,
            mrp: prod.fullPrice?.mrp || null,
            type: "mix"
          };
        }

        return {
          title: prod.title,
          productId: prod.productId,
          buyerId: order.buyerId,
          buyerUsername: buyer?.username,
          buyerAvatar: buyer?.avatar,
          productImage: product?.images?.[0] || null,
          priceDetails,
        };
      })
    );

    return res.status(200).json({
      orderId: order._id,
      transactionId: order.transactionId,
      products: enrichedProducts,
      pickupAddress: {
        name: pickupAddress.name,
        houseNumber: pickupAddress.houseNumber,
        address: pickupAddress.address,
        city: pickupAddress.city,
        state: pickupAddress.state,
        pincode: pickupAddress.pincode,
        landmark: pickupAddress.landmark,
        phoneNumber: pickupAddress.phoneNumber,
      },
    });
  } catch (err) {
    console.error("Error fetching order details:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
