const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    produceName: {
      type: String,
      required: true,
      minlength: 2,
      trim: true,
    },
    tonnageKg: {
      type: Number,
      required: true,
      min: 1,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 10000,
    },
    buyerName: {
      type: String,
      required: true,
      minlength: 2,
      trim: true,
    },
    salesAgentName: {
      type: String,
      required: true,
      minlength: 2,
      trim: true,
    },
    branch: {
      type: String,
      enum: ["Maganjo", "Matugga"],
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sale", saleSchema);
