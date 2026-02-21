const mongoose = require("mongoose");

const procurementSchema = new mongoose.Schema(
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
      match: [/^[A-Za-z\s]+$/, "Produce type must contain letters only"],
    },

    tonnage: {
      type: Number,
      required: true,
      min: 100, // since minimum is 1000kg in real case you can adjust
    },

    cost: {
      type: Number,
      required: true,
      min: 10000,
    },

    dealerName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },

    dealerContact: {
      type: String,
      required: true,
      match: [/^\+?\d{10,15}$/, "Invalid phone number format"],
    },

    branch: {
      type: String,
      required: true,
      enum: ["Maganjo", "Matugga"],
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Procurement", procurementSchema);
