const express = require("express");
const axios = require("axios");
const router = express.Router();
const Order = require("../../Models/ProductOrder/ProductOrder");

const DELHIVERY_BASE_URL = "https://track.delhivery.com/api/v1/packages/json/";
const STATUS_MAPPING = {
  "In Transit": "shipped",
  "RTO": "delivery_not_accepted",
  "Lost": "delivery_issue",
  "Delivered": "delivered",
};

// Route to fetch and update status of a specific order
router.get("/update-order-status", async (req, res) => {
  try {
    const { waybill, ref_id } = req.query;

    if (!waybill && !ref_id) {
      return res.status(400).json({ message: "Either 'waybill' or 'ref_id' is required" });
    }

    let awb = waybill;

    if (!awb && ref_id) {
      const order = await Order.findById(ref_id);
      if (!order || !order.deliveryInfo?.waybill) {
        return res.status(404).json({ message: "Order or AWB not found" });
      }
      awb = order.deliveryInfo.waybill;
    }

    const response = await axios.get(`${DELHIVERY_BASE_URL}?waybill=${awb}`, {
      headers: {
        Authorization: `Token ${process.env.DELHIVERY_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const pkg = response.data?.ShipmentData?.[0]?.Shipment;
    if (!pkg) {
      return res.status(404).json({ message: "No shipment data found" });
    }

    const currentStatus = pkg?.status?.status;
    const mappedStatus = STATUS_MAPPING[currentStatus];

    if (!mappedStatus) {
      return res.status(200).json({ message: "No matching internal status. Skipped update.", currentStatus });
    }

    // Update order
    const updatedOrder = await Order.findOneAndUpdate(
      { "deliveryInfo.waybill": awb },
      { orderStatus: mappedStatus },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found for update" });
    }

    return res.status(200).json({
      message: "Order status updated",
      updatedOrder,
      currentStatus,
      mappedStatus,
    });
  } catch (error) {
    console.error("Error updating order status:", error.message);
    return res.status(500).json({ message: "Internal error", error: error.message });
  }
});

module.exports = router;
