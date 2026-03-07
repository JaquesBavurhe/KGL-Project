//1.Dependencies
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const moment = require("moment");
const cookieParser = require("cookie-parser");
const cors = require("cors");

require("dotenv").config();

//import routes
const { router: indexRoutes } = require("./routes/indexRoutes");
const {router: authRoutes} = require('./routes/authRoutes');
const {router: dashRoutes} = require('./routes/dashRoutes');
const {router: salesRoutes} = require('./routes/salesRoutes');
const {router: ProcurementRoutes} = require('./routes/ProcurementRoutes');
const { registerSwagger } = require("./docs/swagger");

//2. INITIALIZING EXPRESS APP
const app = express();
const PORT = process.env.PORT || 3000

//3. CONFIGURATIONS
const URI = process.env.MONGODB_URI;
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (!allowedOrigins.length) return true;
  return allowedOrigins.includes(origin);
};

app.locals.moment = moment;
mongoose.connect(URI);
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


//4.MIDDLEWARE
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


//serving static files
app.use(express.static(path.join(__dirname, "../frontend/public")));

// API docs
registerSwagger(app);

//5. USING IMPORTED ROUTES

app.use("/", indexRoutes);
app.use('/', authRoutes);
app.use('/', dashRoutes);
app.use('/', salesRoutes);
app.use('/', ProcurementRoutes);

//for non-existing routes
app.use((req, res) => {
  const wantsHtml = req.accepts("html");
  if (wantsHtml) {
    return res
      .status(404)
      .sendFile(path.join(__dirname, "../frontend/public/html/404.html"));
  }

  return res.status(404).json({ error: "Route not found" });
});

//6. Starting the server
app.listen(PORT, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log(`listening on port ${PORT}`);
  }
});

