const express = require("express");
const router = express.Router();
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const Notification = require("../models/Notification");
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
const useCrossSiteCookies = process.env.CROSS_SITE_COOKIES === "true";
const authCookieOptions = {
  httpOnly: true,
  sameSite: useCrossSiteCookies ? "none" : "lax",
  secure: useCrossSiteCookies || process.env.NODE_ENV === "production", //
  maxAge: 24 * 60 * 60 * 1000,
};

// Creates one short notification per director when a non-director updates profile details.
const createDirectorProfileChangeNotifications = async ({ actorUser, changedFields }) => {
  if (!actorUser || !Array.isArray(changedFields) || !changedFields.length) return;
  if (actorUser.role === "Director") return;

  const directors = await User.find({ role: "Director" }).select("_id");
  if (!directors.length) return;

  const fieldLabel = changedFields.join(", ");
  const actorLabel = actorUser.fullName || actorUser.username || "A user";
  const message = `${actorLabel} updated their profile (${fieldLabel}).`;

  const documents = directors.map((director) => ({
    recipient: director._id,
    actor: actorUser._id,
    message,
  }));

  await Notification.insertMany(documents);
};

// Serves the login page.
router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/public/html/login.html"));
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
            mustResetPassword: Boolean(user.mustResetPassword),
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
      mustResetPassword: true,
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
      existingUser.mustResetPassword = true;
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

// Updates the currently authenticated user's profile details.
router.put("/auth/profile", authenticateToken(), async (req, res) => {
  try {
    const { fullName, username, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    // Tracks exactly which profile fields changed so the director notification stays concise.
    const changedFields = [];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (fullName !== undefined) {
      const trimmedFullName = String(fullName).trim();
      if (trimmedFullName.length < 2) {
        return res.status(400).json({ message: "Full name must be at least 2 characters." });
      }
      if (trimmedFullName !== user.fullName) {
        changedFields.push("full name");
      }
      user.fullName = trimmedFullName;
    }

    if (username !== undefined) {
      const trimmedUsername = String(username).trim();
      if (trimmedUsername.length < 2) {
        return res.status(400).json({ message: "Username must be at least 2 characters." });
      }
      if (trimmedUsername !== user.username) {
        changedFields.push("username");
      }
      user.username = trimmedUsername;
    }

    if (newPassword !== undefined && newPassword !== "") {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to set a new password." });
      }

      if (String(newPassword).length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters." });
      }

      const currentPasswordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!currentPasswordMatch) {
        return res.status(401).json({ message: "Current password is incorrect." });
      }

      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({ message: "New password must be different from current password." });
      }

      user.password = String(newPassword);
      user.mustResetPassword = false;
      changedFields.push("password");
    }

    await user.save();
    // Notify directors after the profile is successfully persisted.
    await createDirectorProfileChangeNotifications({
      actorUser: user,
      changedFields: [...new Set(changedFields)],
    });

    const token = buildToken(user);
    res.cookie("token", token, authCookieOptions);

    return res.status(200).json({
      message: "Profile updated successfully.",
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        branch: user.branch,
        mustResetPassword: Boolean(user.mustResetPassword),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Username is already taken." });
    }
    return res.status(500).json({ message: error.message });
  }
});

// Returns recent notifications for the currently authenticated director.
router.get("/notifications/director", authenticateToken(), ensureDirector, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 30) : 10;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user.id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("message createdAt isRead"),
      Notification.countDocuments({ recipient: req.user.id, isRead: false }),
    ]);

    return res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Marks all director notifications as read for the current user.
router.post("/notifications/director/read-all", authenticateToken(), ensureDirector, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true } },
    );

    return res.status(200).json({ message: "Notifications marked as read." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Allows logged-in users to change their first-login temporary password.
router.post("/auth/reset-first-password", authenticateToken(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentPasswordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!currentPasswordMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password must be different from current password." });
    }

    user.password = newPassword;
    user.mustResetPassword = false;
    await user.save();

    const token = buildToken(user);
    res.cookie("token", token, authCookieOptions);

    return res.status(200).json({
      message: "Password updated successfully.",
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        branch: user.branch,
        mustResetPassword: Boolean(user.mustResetPassword),
      },
    });
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
