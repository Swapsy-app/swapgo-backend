const express = require("express");
const router = express.Router();
const Cart = require("../../Models/ProductModels/cart");
const Product = require("../../Models/ProductModels/Product");
const User = require("../../Models/User");
const authenticateToken = require("../../Modules/authMiddleware");

//add to cart from same seller upto 5 products per seller
router.post("/add-cart", authenticateToken, async (req, res) => {
  try {
    const buyerId = req.user._id; // Fetch authenticated user's ID
    const { productId } = req.body;

    // Fetch product details
    const product = await Product.findById(productId).select("sellerId");
    if (!product) return res.status(404).json({ message: "Product not found" });

    const sellerId = product.sellerId;

    // Prevent seller from adding their own product to the cart
    if (buyerId.toString() === sellerId.toString()) {
      return res.status(400).json({ message: "Sellers cannot add their own products to the cart" });
    }

    // Find buyer's cart for this seller
    let cart = await Cart.findOne({ buyerId, sellerId });

    if (!cart) {
      cart = new Cart({ buyerId, sellerId, products: [] });
    } else if (cart.products.length >= 5) {
      return res.status(400).json({ message: "You can add a maximum of 5 products per seller" });
    }

    // Check if product is already in cart
    if (cart.products.includes(productId)) {
      return res.status(400).json({ message: "Product already in cart" });
    }

    // Add product to cart
    cart.products.push(productId);
    await cart.save();

    res.status(200).json({ message: "Product added to cart", cart });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//get cart details
router.get("/get-cart", authenticateToken, async (req, res) => {
    try {
      const buyerId = req.user._id; // Fetch authenticated buyer's ID
  
      // Find cart items for this buyer
      const carts = await Cart.find({ buyerId })
        .populate({ path: "sellerId", select: "username avatar" }) // Fetch seller details
        .populate({ path: "products", select: "title images price" }); // Fetch product details
  
      if (!carts.length) {
        return res.status(404).json({ message: "Cart is empty" });
      }
  
      // Format response seller-wise
      const formattedCart = carts.map(cart => {
        const seller = cart.sellerId;
        let totalCash = 0, totalCoin = 0, totalMixCash = 0, totalMixCoin = 0;
  
        const products = cart.products.map(product => {
          const { cash, coin, mix } = product.price || {};
  
          // Determine available price type
          const priceDetails = {};
          if (cash && cash.enteredAmount !== undefined) {
            priceDetails.cash = cash.enteredAmount;
            totalCash += cash.enteredAmount;
          }
          if (coin && coin.enteredAmount !== undefined) {
            priceDetails.coin = coin.enteredAmount;
            totalCoin += coin.enteredAmount;
          }
          if (mix && mix.enteredCash !== undefined && mix.enteredCoin !== undefined) {
            priceDetails.mixCash = mix.enteredCash;
            priceDetails.mixCoin = mix.enteredCoin;
            totalMixCash += mix.enteredCash;
            totalMixCoin += mix.enteredCoin;
          }
  
          return {
            title: product.title,
            image: product.images[0], // First image only
            price: priceDetails
          };
        });
  
        return {
          seller: {
            username: seller.username,
            avatar: seller.avatar,
          },
          products,
          totalPrice: {
            totalCash,
            totalCoin,
            totalMix: { cash: totalMixCash, coin: totalMixCoin }
          }
        };
      });
  
      res.status(200).json({ cart: formattedCart });
  
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });  

//get number of product/combo in cart counter
router.get("/get-buyer-cart-summary", authenticateToken, async (req, res) => {
  try {
    const buyerId = req.user._id;

    // Find all cart items for the buyer
    const carts = await Cart.find({ buyerId });

    if (!carts.length) {
      return res.status(404).json({ message: "Cart is empty" });
    }

    let totalProducts = 0;
    let uniqueSellers = new Set();

    // Iterate through each seller's cart
    carts.forEach(cart => {
      totalProducts += cart.products.length; // Count total products
      uniqueSellers.add(cart.sellerId.toString()); // Add unique seller IDs
    });

    const totalCombos = uniqueSellers.size; // Number of different sellers = number of combos

    res.status(200).json({
      totalProducts,
      totalCombos,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
  

// Remove product(s) from cart (seller-wise or product-wise)
router.delete("/remove-cart", authenticateToken, async (req, res) => {
  try {
    const buyerId = req.user._id;
    const { sellerId, productId } = req.body; 

    // Ensure at least one parameter is provided
    if (!sellerId && !productId) {
      return res.status(400).json({ message: "Provide sellerId or productId to remove from cart" });
    }

    let cart;

    // Case 1: Remove all products from a specific seller
    if (sellerId) {
      cart = await Cart.findOneAndDelete({ buyerId, sellerId });
      if (!cart) return res.status(404).json({ message: "No cart found for the given seller" });

      return res.status(200).json({ message: "All products from seller removed from cart" });
    }

    // Case 2: Remove a single product from the cart
    if (productId) {
      cart = await Cart.findOne({ buyerId, products: productId });
      if (!cart) return res.status(404).json({ message: "Product not found in cart" });

      // Remove product from cart
      cart.products = cart.products.filter(item => item.toString() !== productId);

      // If no products remain in the cart, delete the cart entry
      if (cart.products.length === 0) {
        await Cart.findByIdAndDelete(cart._id);
        return res.status(200).json({ message: "Product removed. Seller cart deleted as it was empty" });
      } else {
        await cart.save();
        return res.status(200).json({ message: "Product removed from cart", cart });
      }
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


module.exports = router;
