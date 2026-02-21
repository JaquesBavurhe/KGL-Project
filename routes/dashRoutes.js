const express = require("express");
const router = express.Router();
const path = require("path");
const { authenticateToken } = require("../middleware/authMiddleware");

const requireRole = (allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).send("Access denied");
  }
  return next();
};

router.get(
  "/dashboard",
  authenticateToken({ redirectOnFail: true }),
  (req, res) => {
    if (req.user.role === "Director") {
      return res.redirect("/dashboard/director");
    }

    if (["Sales Agent", "Manager"].includes(req.user.role)) {
      return res.redirect("/dashboard/sales-agent");
    }

    return res.status(403).send("No dashboard assigned for this role");
  },
);

router.get(
  "/dashboard/director",
  authenticateToken({ redirectOnFail: true }),
  requireRole(["Director"]),
  (req, res) => {
    res.sendFile(path.join(__dirname, "../public/html/directorDashboard.html"));
  },
);

router.get(
  "/dashboard/sales-agent",
  authenticateToken({ redirectOnFail: true }),
  requireRole(["Sales Agent", "Manager"]),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../public/html/salesAgentDashboard.html"),
    );
  },
);

module.exports = { router };
