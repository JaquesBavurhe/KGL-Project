const express = require("express");
const router = express.Router();
const path = require("path");
const {
  authenticateToken,
  ensureDirector,
  ensureManager,
  ensureAgent,
} = require("../middleware/authMiddleware");

//

router.get(
  "/dashboard",
  authenticateToken({ redirectOnFail: true }),
  (req, res) => {
    if (req.user.role === "Director") {
      return res.redirect("/dashboard/director");
    }

    if (req.user.role === "Manager") {
      return res.redirect("/dashboard/manager");
    }

    if (req.user.role === "Sales Agent") {
      return res.redirect("/dashboard/sales-agent");
    }

    return res.status(403).send("No dashboard assigned for this role");
  },
);

router.get(
  "/dashboard/director",
  authenticateToken({ redirectOnFail: true }),
  ensureDirector,
  (req, res) => {
    res.sendFile(path.join(__dirname, "../public/html/directorDashboard.html"));
  },
);

router.get(
  "/dashboard/manager",
  authenticateToken({ redirectOnFail: true }),
  ensureManager,
  (req, res) => {
    res.sendFile(path.join(__dirname, "../public/html/managerDashboard.html"));
  },
);

router.get(
  "/dashboard/sales-agent",
  authenticateToken({ redirectOnFail: true }),
  ensureAgent,
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../public/html/salesAgentDashboard.html"),
    );
  },
);

module.exports = { router };
