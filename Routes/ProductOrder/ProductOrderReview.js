const express = require("express");
const router = express.Router();
const authenticateToken = require("../../Modules/authMiddleware");
const Product = require("../../Models/ProductModels/Product");
const CoinWallet = require("../../Models/CoinWalletModels/Coin"); 
const CoinTransaction = require("../../Models/CoinWalletModels/CoinTrans");
const Order = require("../../Models/ProductOrder/ProductOrder");
const User = require("../../Models/User");
const mongoose = require("mongoose");
const Address = require("../../Models/ProductModels/address");

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

// product order creation 2nd route non cashfree
router.post("/create-order", authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const buyerId = req.user._id;
    const {
      productIds,
      paymentMode,
      paymentPrepaidType,
      deliveryAddressId,
      totalShippingDiscount,
      totalShippingCharge,
      totalconvenienceCharge,
      productCashPaid,
      totalCashPaid,
      totalCoinPaid,
      coinPurchase,
      frontendCharges,
    } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0 || productIds.length > 5) {
      return res.status(400).json({ error: "Invalid product list." });
    }

    const buyer = await User.findById(buyerId).lean();
    if (!buyer) return res.status(400).json({ error: "Buyer id missing." });

    const products = await Product.find({ _id: { $in: productIds } }).session(session);
    if (products.length !== productIds.length) {
      return res.status(400).json({ error: "One or more products not found." });
    }

    const orderProducts = [];
    for (const prod of products) {
      if (prod.quantity === 0 || prod.status === "sold") {
        return res.status(400).json({ error: `Product ${prod._id} is sold.` });
      }

      const charges = frontendCharges.find(p => p.productId === String(prod._id));
      if (!charges) {
        return res.status(400).json({ error: `Frontend charges missing for product ${prod._id}` });
      }

      const priceMode = prod.price.cash?.enteredAmount ? "cash"
                      : prod.price.coin?.enteredAmount ? "coin"
                      : "mix";

      orderProducts.push({
        productId: prod._id,
        sellerId: prod.sellerId,
        quantity: 1,
        priceMode,
        shippingCharge: charges.shippingCharge,
        convenienceCharge: charges.convenienceCharge,
        weight: prod.weight.toString(),
        fullPrice: prod.price,
        title: prod.title,
        condition: prod.condition,
        gstNumber: buyer.gstNumber,
        pickupAddressId: prod.pickupAddress,
      });

      prod.quantity -= 1;
      prod.quantitySold += 1;
      if (prod.quantity === 0) prod.status = "sold";
      await prod.save({ session });
    }

    const pickupAddressId = orderProducts[0].pickupAddressId;

    const newOrder = new Order({
      buyerId,
      products: orderProducts,
      paymentMode,
      paymentPrepaidType,
      deliveryAddressId,
      pickupAddressId,
      totalShippingDiscount,
      totalShippingCharge,
      totalconvenienceCharge,
      productCashPaid,
      totalCashPaid,
      totalCoinPaid,
      coinPurchase,
      paymentStatus: "pending",
      orderStatus: "pending"
    });

    await newOrder.save({ session });

    // 💰 Deduct coins from wallet
    const coinWallet = await CoinWallet.findOne({ userId: buyerId }).session(session);
    const coinsToDeduct = totalCoinPaid - (coinPurchase || 0);

    const deducted = {
      earned: 0,
      reward: 0,
      bought: 0,
      borrowed: 0
    };

    if (coinsToDeduct > 0) {
      let remaining = coinsToDeduct;

      const totalAvailable = coinWallet.earnedCoinBalance +
                             coinWallet.rewardCoinBalance +
                             coinWallet.boughtCoinBalance +
                             coinWallet.borrowedCoinBalance;

      const usable = totalAvailable - coinWallet.blockedCoins;

      if (coinsToDeduct > usable) {
        throw new Error("Insufficient usable coins to deduct.");
      }

      if (coinWallet.earnedCoinBalance >= remaining) {
        coinWallet.earnedCoinBalance -= remaining;
        deducted.earned = remaining;
        remaining = 0;
      } else {
        deducted.earned = coinWallet.earnedCoinBalance;
        remaining -= coinWallet.earnedCoinBalance;
        coinWallet.earnedCoinBalance = 0;
      }

      if (remaining > 0) {
        if (coinWallet.rewardCoinBalance >= remaining) {
          coinWallet.rewardCoinBalance -= remaining;
          deducted.reward = remaining;
          remaining = 0;
        } else {
          deducted.reward = coinWallet.rewardCoinBalance;
          remaining -= coinWallet.rewardCoinBalance;
          coinWallet.rewardCoinBalance = 0;
        }
      }

      if (remaining > 0) {
        if (coinWallet.boughtCoinBalance >= remaining) {
          coinWallet.boughtCoinBalance -= remaining;
          deducted.bought = remaining;
          remaining = 0;
        } else {
          deducted.bought = coinWallet.boughtCoinBalance;
          remaining -= coinWallet.boughtCoinBalance;
          coinWallet.boughtCoinBalance = 0;
        }
      }

      if (remaining > 0) {
        coinWallet.borrowedCoinBalance -= remaining;
        deducted.borrowed = remaining;
        remaining = 0;
      }

      await coinWallet.save({ session });

      await CoinTransaction.create([{
        userId: buyerId,
        orderId: newOrder._id,
        coinAmount: coinsToDeduct,
        type: "debit",
        description: "Coins spent for product purchase"
      }], { session });
    }

    if (coinPurchase && coinPurchase > 0) {
      coinWallet.boughtCoinBalance += coinPurchase;
      await coinWallet.save({ session });

      await CoinTransaction.create([{
        userId: buyerId,
        orderId: newOrder._id,
        coinAmount: coinPurchase,
        type: "credit",
        description: "Coins bought for product purchase"
      }], { session });
    }

    // ⏳ Fail order & refund coins after 10 minutes if still pending
    setTimeout(async () => {
      const order = await Order.findById(newOrder._id);
      if (!order || order.paymentStatus !== "pending") return;

      order.paymentStatus = "failed";
      order.orderStatus = "failed";
      await order.save();

      for (const item of order.products) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.quantity += 1;
          product.quantitySold = Math.max(0, product.quantitySold - 1);
          if (product.status === "sold") product.status = "available";
          await product.save();
        }
      }

      const wallet = await CoinWallet.findOne({ userId: order.buyerId });
      if (!wallet) return;

      if (totalCoinPaid > 0) {
        wallet.earnedCoinBalance += deducted.earned;
        wallet.rewardCoinBalance += deducted.reward;
        wallet.boughtCoinBalance += deducted.bought;
        wallet.borrowedCoinBalance += deducted.borrowed;

        await wallet.save();

        await CoinTransaction.create([{
          userId: order.buyerId,
          orderId: order._id,
          coinAmount: coinsToDeduct,
          type: "credit",
          description: "Coin refund for failed transaction"
        }]);

        if (coinPurchase > 0) {
          await CoinTransaction.create([{
            userId: order.buyerId,
            orderId: order._id,
            coinAmount: coinPurchase,
            type: "debit",
            description: "Coin purchase reverted due to transaction failure"
          }]);
        }
      }
    }, 10 * 60 * 1000);

    await session.commitTransaction();
    session.endSession();
    return res.status(201).json({ success: true, orderId: newOrder._id });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Order creation failed:", error);
    return res.status(500).json({ error: "Failed to create order." });
  }
});

module.exports = router;
