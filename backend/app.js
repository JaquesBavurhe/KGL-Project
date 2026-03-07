//1.Dependencies
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const moment = require("moment");
const cookieParser = require("cookie-parser");

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

