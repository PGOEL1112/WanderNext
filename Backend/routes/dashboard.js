const express = require("express");
const router = express.Router();

// ===== MODELS =====
const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/Booking");
const Review = require("../models/reviews");
const SupportTicket = require("../models/SupportTicket");

// ===== MIDDLEWARE =====
function isLoggedIn(req, res, next) {
  if (!req.isAuthenticated()) {
    req.flash("error", "Please login first");
    return res.redirect("/login");
  }
  next();
}

function isAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    req.flash("error", "Unauthorized access");
    return res.redirect("/");
  }
  next();
}

/* =====================================================
   USER DASHBOARD
===================================================== */
router.get("/user", isLoggedIn, async (req, res) => {
  if (req.user.role !== "user") return res.redirect("/");

  const userId = req.user._id;

  try {
    const [
      totalBookings,
      upcomingTrips,
      user,
      reviewCount
    ] = await Promise.all([
      Booking.countDocuments({ user: userId }),
      Booking.countDocuments({
        user: userId,
        checkIn: { $gte: new Date() }
      }),
      User.findById(userId).populate("savedListings"),
      Review.countDocuments({ author: userId })
    ]);

    res.render("dashboards/userDashboard", {
      currentUser: req.user,
      totalBookings,
      upcomingTrips,
      wishlistCount: user.savedListings.length,
      reviewCount
    });

  } catch (err) {
    console.error("❌ USER DASHBOARD ERROR:", err);
    req.flash("error", "Unable to load user dashboard");
    res.redirect("/");
  }
});


/* =====================================================
   OWNER DASHBOARD
===================================================== */
router.get("/owner", isLoggedIn, async (req, res) => {
  if (req.user.role !== "owner") return res.redirect("/");

  try {
    const ownerId = req.user._id;

    // Owner listings
    const myListings = await Listing.find({ owner: ownerId }).lean();
    const listingIds = myListings.map(l => l._id);

    // Bookings on owner listings
    const bookings = await Booking.find({
      listing: { $in: listingIds }
    })
      .populate("user", "username email")
      .populate("listing", "title location country")
      .sort({ createdAt: -1 })
      .lean();

    const totalBookings = bookings.length;

    const totalRevenue = bookings
      .filter(b => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + b.totalPrice, 0);

    const today = new Date();
    const upcomingBookings = bookings.filter(
      b => b.checkIn > today && b.status !== "canceled"
    ).length;

    const recentBookings = bookings.slice(0, 6);

    res.render("dashboards/ownerDashboard", {
      currentUser: req.user,
      activeListings: myListings.length,
      totalBookings,
      totalRevenue,
      upcomingBookings,
      recentBookings,
      myListings
    });

  } catch (err) {
    console.error("❌ OWNER DASHBOARD ERROR:", err);
    req.flash("error", "Unable to load owner dashboard");
    res.redirect("/");
  }
});



module.exports = router;
