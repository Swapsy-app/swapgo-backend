const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reportOption: { type: String, required: true }, // Selected dropdown option
    reason: { type: String, required: true }, // Text box content
  },
  { timestamps: true }
);

const Report = mongoose.model("Report", reportSchema);
module.exports = Report;
