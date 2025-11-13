const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const app = express();
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError");
const session = require("express-session");
const flash = require("connect-flash");

// Modules exports from routes and using them
const listings = require("./routes/listing");
const reviews  = require("./routes/reviews");

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")))


// View Engine Setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // adjust path for backend folder
app.engine('ejs', ejsMate);

const sessionOptions = {
  secret: "mySecretKey",
  resave: false,
  saveUninitialized: true,
  cookie : {
    expires : Date.now() + 1000 * 60 * 60 * 24 * 7, // Stores for 7 Days
    maxAge : 1000 * 60 * 24 * 7,
    httpOnly : true,
  },
};
app.use(session(sessionOptions));
app.use(flash());

app.use((req,res,next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// MongoDB Connection
const MONGO_URL = "mongodb://127.0.0.1:27017/WanderNext";
async function main() {
  await mongoose.connect(MONGO_URL);
}
main()
  .then(() => console.log("✅ MongoDB Connected Successfully!"))
  .catch((err) => console.log("❌ MongoDB Connection Error:", err));


// Routes ------> 1. Root Route
// ✅ Root route
app.get("/", (req, res) => {
  res.redirect("/listings"); // Better UX than a plain text message
});


app.use("/listings", listings);
app.use("/listings/:id/reviews", reviews);
 
// 404 for unmatched routes
app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

// Global error handler
app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  const message = err.message || "Something went wrong!";
  res.status(statusCode).render("error", { message });
});


// Start Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
