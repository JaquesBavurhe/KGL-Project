const jwt = require("jsonwebtoken");

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization || "";
  const hasBearer = authHeader.startsWith("Bearer ");
  const bearerToken = hasBearer ? authHeader.split(" ")[1] : null;

  return req.cookies?.token || bearerToken;
};

const authenticateToken =
  ({ redirectOnFail = false } = {}) =>
  (req, res, next) => {
    const token = getTokenFromRequest(req);

    if (!token) {
      if (redirectOnFail) return res.redirect("/login");
      return res.status(401).json({ message: "Authentication token is missing" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      if (redirectOnFail) return res.redirect("/login");
      return res.status(401).json({ message: "Invalid or expired authentication token" });
    }
  };


//

const requireRole = (allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).send("Access denied");
  }

  return next();
};

const ensureDirector = requireRole(["Director"]);
const ensureManager = requireRole(["Manager"]);
const ensureAgent = requireRole(["Sales Agent"]);
const ensureManagerOrAgent = requireRole(["Manager", "Sales Agent"]);

module.exports = {
  authenticateToken,
  ensureDirector,
  ensureManager,
  ensureAgent,
  ensureManagerOrAgent,
  requireRole,
};
