//1.Dependencies
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const passport = require("passport");
const moment = require("moment");
const session = require("express-session")({
  secret: "jaques",
  resave: false,
  saveUninitialized: false,
});

require("dotenv").config();

//import models
const User = require("./models/User");

//import routes
const { router: indexRoutes } = require("./routes/indexRoutes");
const {router: authRoutes} = require('./routes/authRoutes');
// const salesRoutes = require('./routes/salesRoutes');

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


// app.set('view engine', 'pug'); // setting pug as the view engine
// app.set('views', path.join(__dirname, 'views')); // specifying a folder containing front-end files

//4.MIDDLEWARE


//serving static files
app.use(express.static(path.join(__dirname, "public")));


//express session configs
app.use(session);
app.use(passport.initialize());
app.use(passport.session());

//5. USING IMPORTED ROUTES

app.use("/", indexRoutes);
app.use('/', authRoutes);
// app.use('/', salesRoutes);


//passport configs
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//for non-existing routes
app.use((req, res) => {
  res.status(404); //always above the server
});

//6. Starting the server
app.listen(PORT, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log(`listening on port ${PORT}`);
  }
});
