const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const app = express();
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError");

const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");

// Models
const User = require("./models/user");


// ROUTES
const resetPasswordRoutes = require("./routes/reset-password");
const listings = require("./routes/listing");
const reviews = require("./routes/reviews");
const users = require("./routes/user");


// ---------------------------
// 🟦 MIDDLEWARE SETUP
// ---------------------------

// Body Parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Method Override
app.use(methodOverride("_method"));

// Static Files
app.use(express.static(path.join(__dirname, "public")));

// View Engine
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


// ---------------------------
// 🟦 SESSION + FLASH
// ---------------------------
const sessionOptions = {
  secret: "mySecretKey",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
  },
};
app.use(session(sessionOptions));
app.use(flash());


// ---------------------------
// 🟦 PASSPORT AUTH SETUP
// ---------------------------
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


// ---------------------------
// 🟦 FLASH + CURRENT USER GLOBALS
// ---------------------------
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});


// ---------------------------
// 🟦 MONGODB CONNECTION
// ---------------------------
const MONGO_URL = "mongodb://127.0.0.1:27017/WanderNext";
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected Successfully!"))
  .catch((err) => console.log("❌ MongoDB Connection Error:", err));


// ---------------------------
// 🟦 ROUTES
// ---------------------------

// ROOT
app.get("/", (req, res) => {
  res.render("listings/home");  
});

// External Auth Routes
app.use("/",resetPasswordRoutes);   // /forgot-password /reset-password

// App Routes
app.use("/listings", listings);
app.use("/listings/:id/reviews", reviews);
app.use("/", users);


// ---------------------------
// 🟦 404 HANDLER
// ---------------------------
app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});


// ---------------------------
// 🟦 GLOBAL ERROR HANDLER
// ---------------------------
app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Something went wrong!";
  res.status(statusCode).render("error", { message: err.message });
});


// ---------------------------
// 🟦 SERVER START
// ---------------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
