const express = require("express");
const router = express.Router();
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const { authenticateToken, ensureDirector } = require("../middleware/authMiddleware");

// Creates a signed JWT payload used for authenticated requests.
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

// Shared cookie settings for storing the auth token in the browser.
const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production", //
  maxAge: 24 * 60 * 60 * 1000,
};

// Serves the login page.
router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/login.html"));
});

// Authenticates user credentials and returns a JWT + safe user profile.
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

// Redirects signup requests to login because self-signup is disabled.
router.get("/signup", (req, res) => {
  res.redirect("/login");
});

// Blocks public self-signup. Only directors can create users.
router.post("/signup", async (req, res) => {
  res.status(403).json({
    message: "Self-signup is disabled. Only the director can create users.",
  });
});

// Lists all users (director-only), excluding password hashes.
router.get("/users", authenticateToken(), ensureDirector, async (req, res) => {
  try {
    const users = await User.find({}, "-password").sort({ createdAt: -1 });
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Creates a new user account (director-only).
router.post("/users", authenticateToken(), ensureDirector, async (req, res) => {
  try {
    const body = req.body;
    const payload = {
      ...body,
      branch: body.role === "Director" ? null : body.branch,
    };

    const newUser = new User(payload);
    await newUser.save();

    const safeUser = newUser.toObject();
    delete safeUser.password;

    res.status(201).json({ message: "User created successfully", user: safeUser });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Updates a user account (director-only).
router.put("/users/:id", authenticateToken(), ensureDirector, async (req, res) => {
  try {
    const { id } = req.params;
    const existingUser = await User.findById(id);

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      fullName,
      username,
      phone,
      branch,
      role,
      password,
    } = req.body;

    if (fullName !== undefined) existingUser.fullName = fullName;
    if (username !== undefined) existingUser.username = username;
    if (phone !== undefined) existingUser.phone = phone;
    if (role !== undefined) existingUser.role = role;

    if (existingUser.role === "Director") {
      existingUser.branch = null;
    } else if (branch !== undefined) {
      existingUser.branch = branch;
    }

    if (password) {
      existingUser.password = password;
    }

    await existingUser.save();
    const safeUser = existingUser.toObject();
    delete safeUser.password;

    return res.status(200).json({ message: "User updated successfully", user: safeUser });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

// Deletes a user account (director-only), except the currently logged-in director.
router.delete("/users/:id", authenticateToken(), ensureDirector, async (req, res) => {
  try {
    const { id } = req.params;
    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Returns the currently authenticated user's profile.
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

// Clears auth cookie and redirects to login.
router.get("/logout", (req, res) => {
  res.clearCookie("token", authCookieOptions);
  res.redirect("/login");
});

module.exports = { router };
