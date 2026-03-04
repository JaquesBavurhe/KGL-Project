const express = require("express");
const router = express.Router();
const path = require("path");

// Serves the landing page.
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/public/html/index.html"));
});

module.exports = {router};

