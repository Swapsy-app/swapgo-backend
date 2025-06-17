const express = require("express");
const router = express.Router();
const Order = require("../../Models/ProductOrder/ProductOrder");
const Product = require("../../Models/ProductModels/Product");
const Address = require("../../Models/ProductModels/address");
const User = require("../../Models/User");
const authenticateToken = require("../../Modules/authMiddleware");

//plz note that modify this route to fetch dates like cancelled date delivered date etc.
// to fetch all orders of a buyer with product and seller details 
router.get("/buyer-orders", authenticateToken, async (req, res) => {
  try {
    const buyerId = req.user._id;
    const { orderStatus, issueStatus, paymentStatus } = req.query;

    const query = { buyerId };
    if (orderStatus) query.orderStatus = orderStatus;
    if (issueStatus) query.issueStatus = issueStatus;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const orders = await Order.find(query)
      .select("products orderStatus issueStatus paymentStatus createdAt buyerId")
      .lean();

    const finalOrders = [];

    for (const order of orders) {
      for (const item of order.products) {
        const product = await Product.findById(item.productId).select("images title").lean();

        let dedicatedPrice = null;
        const priceMode = item.priceMode;
        const fullPrice = item.fullPrice;

        if (priceMode === "cash") {
          dedicatedPrice = fullPrice.cash.enteredAmount;
        } else if (priceMode === "coin") {
          dedicatedPrice = fullPrice.coin.enteredAmount;
        } else if (priceMode === "mix") {
          dedicatedPrice = {
            enteredCash: fullPrice.mix.enteredCash,
            enteredCoin: fullPrice.mix.enteredCoin,
          };
        }

        finalOrders.push({
          orderMongoId: order._id, // ✅ Included Order Schema Mongo ID
          orderId: order._id,       // 🔁 Keeping this for backward compatibility if needed
          orderCreated: order.createdAt,
          orderStatus: order.orderStatus,
          issueStatus: order.issueStatus,
          paymentStatus: order.paymentStatus,
          buyerId: order.buyerId,
          sellerId: item.sellerId,
          productId: item.productId,
          productTitle: item.title,
          productImage: product?.images?.[0] || null,
          priceMode,
          mrp: fullPrice.mrp,
          dedicatedPrice,
        });
      }
    }

    return res.status(200).json({ orders: finalOrders });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch buyer orders" });
  }
});

//fetch order and product details for a specific order and product
router.get("/order-product-details", authenticateToken, async (req, res) => {
  try {
    const { orderId, productId } = req.query;

    if (!orderId || !productId) {
      return res.status(400).json({ message: "Order ID and Product ID are required" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Check if the user is the buyer
    if (order.buyerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const productInOrder = order.products.find(p => p.productId.toString() === productId);
    if (!productInOrder) {
      return res.status(404).json({ message: "Product not found in this order" });
    }

    // Fetch seller info
    const seller = await User.findById(productInOrder.sellerId).select("username avatar").lean();

    // Fetch product (for image)
    const product = await Product.findById(productId).select("images").lean();

    // Fetch delivery address
    const address = await Address.findById(order.deliveryAddressId).lean();

    // Determine price based on mode
    let priceValue;
    const mode = productInOrder.priceMode;
    const fullPrice = productInOrder.fullPrice;
    if (mode === "cash") {
      priceValue = fullPrice.cash.enteredAmount;
    } else if (mode === "coin") {
      priceValue = fullPrice.coin.enteredAmount;
    } else if (mode === "mix") {
      priceValue = {
        enteredCash: fullPrice.mix.enteredCash,
        enteredCoin: fullPrice.mix.enteredCoin
      };
    }

    // Response data
    const result = {
      seller: {
        username: seller?.username,
        avatar: seller?.avatar
      },
      product: {
        title: productInOrder.title,
        image: product?.images?.[0] || null
      },
      priceMode: mode,
      price: priceValue,
      mrp: fullPrice.mrp,
      shippingCharge: productInOrder.shippingCharge,
      convenienceCharge: productInOrder.convenienceCharge,
      order: {
        orderId: order.transactionId,
        createdAt: order.createdAt,
        status: order.orderStatus,
        issueStatus: order.issueStatus,
        issueId: order.issueId,
        paymentMode: order.paymentMode,
        paymentPrepaidType: order.paymentPrepaidType,
        codCharge: order.codCharge,
        delivery: {
          awb: order.deliveryInfo.awb,
          deliveryPartner: order.deliveryInfo.deliveryPartner
        },
        address: {
          name: address?.name,
          phoneNumber: address?.phoneNumber,
          houseNumber: address?.houseNumber,
          address: address?.address,
          landmark: address?.landmark,
          city: address?.city,
          state: address?.state,
          pincode: address?.pincode
        },
        totalShippingCharge: order.totalShippingCharge,
        totalConvenienceCharge: order.totalconvenienceCharge,
        totalShippingDiscount: order.totalShippingDiscount
      }
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error("Error fetching order-product details:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
