const mongoose = require("mongoose");

const creditSchema = new mongoose.Schema(
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
    amountDue: {
      type: Number,
      required: true,
      min: 1,
    },
    buyerName: {
      type: String,
      required: true,
      minlength: 2,
      trim: true,
    },
    buyerNIN: {
      type: String,
      required: true,
      minlength: 6,
      trim: true,
    },
    buyerLocation: {
      type: String,
      required: true,
      minlength: 2,
      trim: true,
    },
    buyerContact: {
      type: String,
      required: true,
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
    dueDate: {
      type: Date,
      required: true,
    },
    dispatchDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Pending", "Partially Paid", "Paid"],
      default: "Pending",
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CreditSale", creditSchema);
