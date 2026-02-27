const express = require("express");
const router = express.Router();
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const { authenticateToken } = require("../middleware/authMiddleware");

const buildToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role,
      branch: user.branch,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" },
  );

const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production", //
  maxAge: 24 * 60 * 60 * 1000,
};

router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/login.html"));
});

router.post("/login", async (req, res) => {
  try {
    const body = req.body;
    const user = await User.findOne({ username: body.username });
    if (user) {
      const passwordMatch = await bcrypt.compare(body.password, user.password);
      if (passwordMatch) {
        const token = buildToken(user);
        res.cookie("token", token, authCookieOptions);
        res.status(200).json({
          message: "Login successful",
          token,
          user: {
            id: user._id,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            branch: user.branch,
          },
        });
      } else {
        res.status(401).json({ message: "Invalid credentials" });
      }
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/signup.html"));
});

router.post("/signup", async (req, res) => {
  try {
    const body = req.body;
    const payload = {
      ...body,
      branch: body.role === "Director" ? null : body.branch,
    };

    const newUser = new User(payload);
    await newUser.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//
router.get("/auth/me", authenticateToken(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

//logout
router.get("/logout", (req, res) => {
  res.clearCookie("token", authCookieOptions);
  res.redirect("/login");
});

module.exports = { router };
