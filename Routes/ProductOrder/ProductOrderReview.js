const express = require("express");
const router = express.Router();
const authenticateToken = require("../../Modules/authMiddleware");
const Product = require("../../Models/ProductModels/Product");
const CoinWallet = require("../../Models/CoinWalletModels/Coin"); // Adjust path if needed


// Coin pricing tiers
const getCoinBuyRate = (coins) => {
    if (coins >= 3000) return 0.15;
    if (coins >= 2000) return 0.17;
    if (coins >= 1000) return 0.19;
    return 0.22;
  };

// product buying final review page
router.get("/product-price-details", authenticateToken, async (req, res) => {
  try {
    const buyerId = req.user._id;

    let { productId, priceType, cartProducts } = req.query;

    if (!productId && !cartProducts) {
      return res.status(400).json({ error: "Provide either productId or cartProducts." });
    }

    let productsToFetch = [];

    if (cartProducts) {
      cartProducts = JSON.parse(cartProducts);
      if (!Array.isArray(cartProducts) || cartProducts.length > 5) {
        return res.status(400).json({ error: "cartProducts must be an array of up to 5 items." });
      }
      productsToFetch = cartProducts.map(p => ({ id: p.productId, priceType: p.priceType }));
    } else {
      productsToFetch.push({ id: productId, priceType });
    }

    const productIds = productsToFetch.map(p => p.id);
    const productDocs = await Product.find({ _id: { $in: productIds } });

    const coinWallet = await CoinWallet.findOne({ userId: buyerId }).lean();
    const coinBalance =
      (coinWallet?.rewardCoinBalance || 0) +
      (coinWallet?.earnedCoinBalance || 0) +
      (coinWallet?.boughtCoinBalance || 0) +
      (coinWallet?.borrowedCoinBalance || 0);

    let totalCoinShortage = 0;
    let totalCashToBuyCoins = 0;
    let coinsUsedSoFar = 0;

    const results = productsToFetch.map(({ id, priceType }) => {
      const product = productDocs.find(p => p._id.toString() === id);
      if (!product) return { error: `Product with ID ${id} not found.` };

      const baseDetails = {
        productId: product._id,
        image: product.images?.[0],
        title: product.title,
        sellerId: product.sellerId,
        weight: product.weight,
        gstNumber: product.gstNumber,
        condition: product.condition,
        mrp: product.price?.mrp
      };

      const price = product.price || {};
      let priceDetails = {};
      let coinInfo = {};

      if (priceType === "cash") {
        if (!price.cash?.enteredAmount) {
          return { error: `Undefined priceType 'cash' for product ID ${id}` };
        }
        priceDetails = {
          priceType: "cash",
          enteredAmount: price.cash.enteredAmount
        };
      } else if (priceType === "coin") {
        if (!price.coin?.enteredAmount) {
          return { error: `Undefined priceType 'coin' for product ID ${id}` };
        }
        const coinAmount = price.coin.enteredAmount;
        const availableCoins = Math.max(0, coinBalance - coinsUsedSoFar);
        if (availableCoins >= coinAmount) {
          coinsUsedSoFar += coinAmount;
          coinInfo = {
            sufficient: true,
            coinDeducted: coinAmount,
            coinShortage: 0,
            cashNeeded: 0
          };
        } else {
          const shortage = coinAmount - availableCoins;
          const rate = getCoinBuyRate(shortage);
          const cashToBuy = parseFloat((shortage * rate).toFixed(2));

          coinsUsedSoFar += availableCoins;
          totalCoinShortage += shortage;
          totalCashToBuyCoins += cashToBuy;

          coinInfo = {
            sufficient: false,
            coinDeducted: availableCoins,
            coinShortage: shortage,
            cashNeeded: cashToBuy
          };
        }
        priceDetails = { priceType: "coin", enteredAmount: coinAmount, ...coinInfo };
      } else if (priceType === "mix") {
        if (!price.mix?.enteredCash || !price.mix?.enteredCoin) {
          return { error: `Undefined priceType 'mix' for product ID ${id}` };
        }
        const coinAmount = price.mix.enteredCoin;
        const cashAmount = price.mix.enteredCash;

        const availableCoins = Math.max(0, coinBalance - coinsUsedSoFar);
        if (availableCoins >= coinAmount) {
          coinsUsedSoFar += coinAmount;
          coinInfo = {
            sufficient: true,
            coinDeducted: coinAmount,
            coinShortage: 0,
            cashNeeded: 0
          };
        } else {
          const shortage = coinAmount - availableCoins;
          const rate = getCoinBuyRate(shortage);
          const cashToBuy = parseFloat((shortage * rate).toFixed(2));

          coinsUsedSoFar += availableCoins;
          totalCoinShortage += shortage;
          totalCashToBuyCoins += cashToBuy;

          coinInfo = {
            sufficient: false,
            coinDeducted: availableCoins,
            coinShortage: shortage,
            cashNeeded: cashToBuy
          };
        }

        priceDetails = {
          priceType: "mix",
          enteredCash: cashAmount,
          enteredCoin: coinAmount,
          ...coinInfo
        };
      } else {
        return { error: `Invalid priceType '${priceType}' for product ID ${id}` };
      }

      return {
        ...baseDetails,
        ...priceDetails
      };
    });

    const response = {
      buyerId,
      coinBalance,
      products: results
    };

    if (cartProducts) {
      response.totalCoinShortage = totalCoinShortage;
      response.totalCashToBuyCoins = totalCashToBuyCoins;
    }

    res.json(response);
  } catch (err) {
    console.error("Error in /product-price-details:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
});


module.exports = router;
