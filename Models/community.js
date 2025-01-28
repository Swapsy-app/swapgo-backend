const mongoose = require("mongoose");

// Follow schema
const followSchema = new mongoose.Schema(
  {
    follower: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // User who follows
    following: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // User being followed
  },
);

const Follow = mongoose.model("Follow", followSchema);

module.exports = Follow;
