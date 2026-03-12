// Core dependencies and utilities.
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const moment = require("moment");
const cookieParser = require("cookie-parser");
const cors = require("cors");

require("dotenv").config();

// Route modules.
const { router: indexRoutes } = require("./routes/indexRoutes");
const {router: authRoutes} = require('./routes/authRoutes');
const {router: dashRoutes} = require('./routes/dashRoutes');
const {router: salesRoutes} = require('./routes/salesRoutes');
const {router: ProcurementRoutes} = require('./routes/ProcurementRoutes');
const { registerSwagger } = require("./docs/swagger");

// Express app bootstrap.
const app = express();
const PORT = process.env.PORT || 3000

// Environment-driven configuration values.
const URI = process.env.MONGODB_URI;
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Allow requests with no Origin (server-to-server/tools), otherwise enforce allowlist.
const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (!allowedOrigins.length) return true;
  return allowedOrigins.includes(origin);
};

// Expose moment in app locals for any template/view usage.
app.locals.moment = moment;

// Connect to MongoDB once at startup and log connection lifecycle events.
mongoose.connect(URI).catch((error) => {
  console.error(`Initial MongoDB connection failed: ${error.message}`);
});
mongoose.connection 
  .once("open", () => {
    console.log("Mongoose connection open!!");
  })
  .on("error", (error) => {
    console.error(`Connection error:${error.message}`);
  });


  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());


// CORS policy for browser clients.
app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin denied"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
}));

app.get("/health", (req, res) => res.send("Backend is live"));

// Mount Swagger documentation endpoints.
registerSwagger(app);

// Register API and page routes.

app.use("/", indexRoutes);
app.use('/', authRoutes);
app.use('/', dashRoutes);
app.use('/', salesRoutes);
app.use('/', ProcurementRoutes);

// Serve frontend static assets after protected routes.
app.use(express.static(path.join(__dirname, "../frontend/public")));

// Final 404 handler for unmatched routes.
app.use((req, res) => {
  const wantsHtml = req.accepts("html");
  if (wantsHtml) {
    return res
      .status(404)
      .sendFile(path.join(__dirname, "../frontend/public/404.html"));
  }

  return res.status(404).json({ error: "Route not found" });
});

// Start HTTP server.
app.listen(PORT, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log(`listening on port ${PORT}`);
  }
});
