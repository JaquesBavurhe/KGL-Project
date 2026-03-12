const express = require("express");
const router = express.Router();
const path = require("path");
const {
  authenticateToken,
  ensureDirector,
  ensureManager,
  ensureAgent,
} = require("../middleware/authMiddleware");

// Sends users to their role-specific dashboard.

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

// Serves the director dashboard page.
router.get(
  "/dashboard/director",
  authenticateToken({ redirectOnFail: true }),
  ensureDirector,
  (req, res) => {
    res.sendFile(path.join(__dirname, "../../frontend/public/directorDashboard.html"));
  },
);

// Direct HTML route guard for legacy/static links.
router.get(
  "/directorDashboard.html",
  authenticateToken({ redirectOnFail: true }),
  ensureDirector,
  (req, res) => {
    res.sendFile(path.join(__dirname, "../../frontend/public/directorDashboard.html"));
  },
);

// Serves the manager dashboard page.
router.get(
  "/dashboard/manager",
  authenticateToken({ redirectOnFail: true }),
  ensureManager,
  (req, res) => {
    res.sendFile(path.join(__dirname, "../../frontend/public/managerDashboard.html"));
  },
);

// Direct HTML route guard for legacy/static links.
router.get(
  "/managerDashboard.html",
  authenticateToken({ redirectOnFail: true }),
  ensureManager,
  (req, res) => {
    res.sendFile(path.join(__dirname, "../../frontend/public/managerDashboard.html"));
  },
);

// Serves the sales agent dashboard page.
router.get(
  "/dashboard/sales-agent",
  authenticateToken({ redirectOnFail: true }),
  ensureAgent,
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../../frontend/public/salesAgentDashboard.html"),
    );
  },
);

// Direct HTML route guard for legacy/static links.
router.get(
  "/salesAgentDashboard.html",
  authenticateToken({ redirectOnFail: true }),
  ensureAgent,
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "../../frontend/public/salesAgentDashboard.html"),
    );
  },
);

module.exports = { router };

