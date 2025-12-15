// ============================================
// Load .env (Only in development)
// ============================================
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: "./Backend/.env" });
}

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const http = require("http");
const { Server } = require("socket.io");

// Express + Socket Server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MODELS
const User = require("./models/user");

// MIDDLEWARES
const rateLimiter = require("./middleware/rateLimiter")();
const fetchNotifications = require("./middleware/notifications");
const { runAutoUpdate } = require("./middleware/updateBookingStatus");
const { isLoggedIn, isAdmin } = require("./middleware/permissions");

// ROUTES IMPORT
const ownerApprovalRoutes = require("./routes/ownerApproval");
const resetPasswordRoutes = require("./routes/resetPassword");
const listingRoutes = require("./routes/listing");
const reviewRoutes = require("./routes/reviews");
const userRoutes = require("./routes/user");
const apiRoutes = require("./routes/api");
const adminRoutes = require("./routes/admin");
const ownerRoutes = require("./routes/owner");
const bookingRoutes = require("./routes/bookings");
const wishlistRoutes = require("./routes/wishlist");
const dashboardRoutes = require("./routes/dashboard");

const supportRoutes = require("./routes/support");
const adminSupportRouter = require("./routes/adminSupport");
const notificationRoutes = require("./routes/notifications");
const { sendMail } = require("./utils/email");
// ============================================
// DATABASE CONNECTION
// ============================================
const dbUrl = process.env.ATLAS_DB_URL;

if (!dbUrl) {
  console.error("❌ ERROR: ATLAS_DB_URL missing from .env");
  process.exit(1);
}

mongoose
  .connect(dbUrl)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

// ============================================
// APP CONFIG
// ============================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Auto-update bookings
setInterval(runAutoUpdate, 10 * 60 * 1000);

// ============================================
// SESSION CONFIG
// ============================================
const store = MongoStore.create({
  mongoUrl: dbUrl,
  collectionName: "sessions",
});

store.on("error", (e) => console.log("⚠ Session Store Error", e));

app.use(
  session({
    store,
    secret: process.env.SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use(flash());

// ============================================
// PASSPORT AUTH
// ============================================
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ============================================
// GLOBAL TEMPLATE VARIABLES
// ============================================
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// Global Notification Loader
app.use(fetchNotifications);

// ============================================
// RATE LIMITER
// ============================================
app.use("/login", rateLimiter);
app.use("/forgot-password", rateLimiter);

// ============================================
// ROUTES START HERE
// ============================================

app.get("/", (req, res) => res.render("listings/home"));

// 🔔 Notifications
app.use("/", notificationRoutes);

// USER, LOGIN, REGISTER, BECOME-OWNER, ETC.
app.use("/", userRoutes);

// PUBLIC ROUTES
app.use("/api", apiRoutes);
app.use("/listings", listingRoutes);
app.use("/listings/:id/reviews", reviewRoutes);

// SUPPORT SYSTEM
app.use("/support", supportRoutes);

// ADMIN SUPPORT (must come BEFORE /admin)
app.use("/admin/support", isLoggedIn, isAdmin, adminSupportRouter);

// OWNER APPROVAL SYSTEM FOR ADMIN
app.use("/admin/owners", isLoggedIn, isAdmin, ownerApprovalRoutes);

// GENERAL ADMIN ROUTES
app.use("/admin", adminRoutes);

// OWNER ROUTES
app.use("/owner", ownerRoutes);

// BOOKING, WISHLIST, DASHBOARD
app.use("/bookings", bookingRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/dashboard", dashboardRoutes);

// RESET PASSWORD ROUTES
app.use("/", resetPasswordRoutes);
 // path adjust karo

app.get("/debug-email", async (req, res) => {
  try {
    const r = await sendMail({
      to: "your@email.com",   // apna email
      subject: "SMTP DEBUG",
      html: "<h2>SMTP is working</h2>"
    });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Attach Socket instance globally
app.locals.io = io;

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const { statusCode = 500 } = err;
  res.status(statusCode).render("error", { message: err.message });
});

// ============================================
// SOCKET.IO EVENTS
// ============================================
io.on("connection", (socket) => {
  console.log("⚡ Socket connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
  });

  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId);
  });

  socket.on("joinUser", (userId) => {
    if (userId) socket.join(userId);
  });

  socket.on("chatMessage", (data) => {
    io.to(data.room).emit("chatMessage", data);
  });

  socket.on("disconnect", () => {
    console.log("⚡ Socket disconnected:", socket.id);
  });
});

module.exports.ioInstance = io;

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// Run booking auto-update immediately
runAutoUpdate();
