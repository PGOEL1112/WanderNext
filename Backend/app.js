if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const app = express();
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError");

const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");

// MODELS
const User = require("./models/user");

// ROUTES
const resetPasswordRoutes = require("./routes/reset-password");
const listings = require("./routes/listing");
const reviews = require("./routes/reviews");
const users = require("./routes/user");
const apiRoutes = require("./routes/api");

const Atlasdburl = process.env.ATLAS_DB_URL;

// ---------------------------
// 🟦 MONGODB CONNECTION
// ---------------------------
const MONGO_URL = "mongodb://127.0.0.1:27017/WanderNext";
mongoose
  .connect(Atlasdburl)
  .then(() => console.log("✅ MongoDB Connected Successfully!"))
  .catch((err) => console.log("❌ MongoDB Connection Error:", err));


// ---------------------------
// 🟦 APP CONFIG
// ---------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


// ---------------------------
// 🟦 SESSION STORE
// ---------------------------
const store = MongoStore.create({
  mongoUrl: Atlasdburl,
  collectionName: "sessions",
  ttl: 14 * 24 * 60 * 60   // 14 days
});

store.on("error", (err) => {
  console.log("⚠ Mongo Session Store Error", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET || "mysupersecret",
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
// 🟦 GLOBAL MIDDLEWARE
// ---------------------------
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});


// ---------------------------
// 🟦 ROUTES
// ---------------------------
app.get("/", (req, res) => {
  res.render("listings/home");
});

app.use("/api", apiRoutes);
app.use("/listings", listings);
app.use("/listings/:id/reviews", reviews);
app.use("/", users);
app.use("/", resetPasswordRoutes);


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
  if (res.headersSent) {
    return next(err);
  }
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
