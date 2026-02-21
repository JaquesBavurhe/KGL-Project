// backend/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    minlength: 2,
    trim: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 2,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    match: /^(\+256|0)[0-9]{9}$/,
  },
  branch: {
    type: String,
    enum: ["Maganjo", "Matugga"],
    default: null,
  },
  role: {
    type: String,
    enum: ["Director", "Manager", "Sales Agent"],
    required: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre("validate", function (next) {
  if (this.role === "Director") {
    this.branch = null;
  }
  next();
});

userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) {
      return next();
    }

    this.password = await bcrypt.hash(this.password, 10);
    return next();
  } catch (error) {
    return next(error);
  }
});

module.exports = mongoose.model("User", userSchema);
