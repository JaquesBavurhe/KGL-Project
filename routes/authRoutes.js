const express = require("express");
const router = express.Router();
const path = require("path");

const User = require("../models/User");

router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/login.html"));
});

router.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/signup.html"));
});

router.post("/signup", async (req, res) => {
  try {
    const body = req.body;
    const newUser = new User(body);
    await newUser.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});



module.exports = { router };
