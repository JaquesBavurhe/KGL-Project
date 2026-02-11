//1.Dependencies
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const moment = require('moment');
const session = require('express-session')({
  secret: 'jaques',
  resave: false,
  saveUninitialized: false,
});

require('dotenv').config();

//2. INITIALIZING EXPRESS APP
const app = express();
const port = 3000;

//3. CONFIGURATIONS
app.locals.moment = moment;
mongoose.connect(process.env.DATABASE);
mongoose.connection
  .once('open', () => {
    console.log('Mongoose connection open!!');
  })
  .on('error', (error) => {
    console.error(`Connection error:${error.message}`);
  });

app.set('view engine', 'pug'); // setting pug as the view engine
app.set('views', path.join(__dirname, 'views')); // specifying a folder containing front-end files

//4.MIDDLEWARE
// middleware for serving static files
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'))); 

//5. ROUTES
//import routes
const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');
const salesRoutes = require('./routes/salesRoutes');


//express session configs
app.use(session);
app.use(passport.initialize());
app.use(passport.session());

//passport configs
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//for non-existing routes
app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Not Found' }); //always above the server
});

//6. Starting the server
app.listen(port, () => console.log(`listening on port ${port}`));
