const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema(
  {
    produceName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    produceType: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    branch: {
      type: String,
      required: true,
      enum: ["Maganjo", "Matugga"],
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Stock", stockSchema);
