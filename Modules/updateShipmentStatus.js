const cron = require("node-cron");
const axios = require("axios");
const Order = require("../Models/ProductOrder/ProductOrder");

const DELHIVERY_BASE_URL = "https://track.delhivery.com/api/v1/packages/json/";
const STATUS_MAPPING = {
  "In Transit": "shipped",
  "RTO": "delivery_not_accepted",
  "Lost": "delivery_issue",
  "Delivered": "delivered",
};

const updateShipmentStatuses = async () => {
  try {
    const activeOrders = await Order.find({
      orderStatus: { $in: ["pickup_confirmed", "shipped"] },
      "deliveryInfo.waybill": { $exists: true },
    });

    for (const order of activeOrders) {
      const awb = order.deliveryInfo.waybill;
      const response = await axios.get(`${DELHIVERY_BASE_URL}?waybill=${awb}`, {
        headers: {
          Authorization: `Token ${process.env.DELHIVERY_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const pkg = response.data?.ShipmentData?.[0]?.Shipment;
      const currentStatus = pkg?.status?.status;
      const mappedStatus = STATUS_MAPPING[currentStatus];

      if (mappedStatus && mappedStatus !== order.orderStatus) {
        await Order.findByIdAndUpdate(order._id, { orderStatus: mappedStatus });
        console.log(`Order ${order._id} updated to ${mappedStatus}`);
      }
    }
  } catch (err) {
    console.error("CRON update failed:", err.message);
  }
};


cron.schedule("0 */3 * * *", updateShipmentStatuses); // At minute 0 of every 3rd hour
// This cron job will run every 3 hours to update shipment statuses

module.exports = updateShipmentStatuses;
// This module exports the updateShipmentStatuses function which can be used in other parts of the application.