const express = require("express");
const axios = require("axios");
const router = express.Router();

const Order = require("../../Models/ProductOrder/ProductOrder");

const DELHIVERY_BASE_URL = "https://track.delhivery.com/api/v1/packages/json/";

router.get("/track-shipment", async (req, res) => {
  try {
    const { waybill, ref_id } = req.query;

    if (!waybill && !ref_id) {
      return res.status(400).json({ message: "Either 'awb' or 'ref_id' is required" });
    }

    let queryParam = "";

    if (waybill) {
      queryParam = `?waybill=${waybill}`;
    } else if (ref_id) {
      const order = await Order.findById(ref_id).lean();
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (!order.deliveryInfo?.waybill) {
        return res.status(400).json({ message: "AWB not found in this order" });
      }

      queryParam = `?waybill=${order.deliveryInfo.waybill}`;
      
    }

    const url = `${DELHIVERY_BASE_URL}${queryParam}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Token ${process.env.DELHIVERY_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Shipment tracking error:", error.message);
    return res.status(500).json({
      message: "Error tracking shipment",
      error: error.message,
    });
  }
});

module.exports = router;
