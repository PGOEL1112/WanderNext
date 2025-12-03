const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");
const Booking = require("../models/Booking");


function isLoggedIn(req, res, next) {
    if (!req.isAuthenticated()) return res.redirect("/login");
    next();
}

router.get("/user", isLoggedIn, async (req, res) => {
    try {
        if (req.user.role !== "user") return res.redirect("/");

        const userId = req.user._id;

        // ====== FETCH STATS ======

        // Total bookings
        const totalBookings = await Booking.countDocuments({ user: userId });

        // Upcoming trips
        const upcomingTrips = await Booking.countDocuments({
            user: userId,
            checkIn: { $gte: new Date() }
        });

        // Wishlist count
        const User = require("../models/user");
        const user = await User.findById(userId).populate("savedListings");
        const wishlistCount = user.savedListings.length;

        // Reviews written
        const Review = require("../models/reviews");
        const reviewCount = await Review.countDocuments({ author: userId });

        // Render dashboard
        res.render("dashboards/userDashboard", {
            currentUser: req.user,
            totalBookings,
            upcomingTrips,
            wishlistCount,
            reviewCount
        });

    } catch (err) {
        console.log("❌ User dashboard error:", err);
        req.flash("error", "Could not load user dashboard");
        res.redirect("/");
    }
});


router.get("/owner", isLoggedIn, async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res.redirect("/");
    }

    const ownerId = req.user._id;

    // 👉 Fetch owner listings
    const myListings = await Listing.find({ owner: ownerId }).lean();
    const activeListings = myListings.length;

    // 👉 Fetch bookings for owner listings
    const bookings = await Booking.find({
      listing: { $in: myListings.map(l => l._id) }
    })
      .populate("user", "username email")
      .populate("listing", "title location country")
      .sort({ createdAt: -1 })
      .lean();

    // 👉 Stats
    const totalBookings = bookings.length;

    const totalRevenue = bookings
      .filter(b => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + b.totalPrice, 0);

    const today = new Date();
    const upcomingBookings = bookings.filter(
      b => b.startDate > today && b.status !== "canceled"
    ).length;

    const recentBookings = bookings.slice(0, 6); // last 6

    return res.render("dashboards/ownerDashboard", {
      currentUser: req.user,
      activeListings,
      totalBookings,
      totalRevenue,
      upcomingBookings,
      recentBookings,
      myListings
    });

  } catch (err) {
    console.log("🔥 OWNER DASHBOARD ERROR:", err);
    req.flash("error", "Unable to load dashboard");
    res.redirect("/");
  }
});

router.get("/admin", isLoggedIn, (req, res) => {
    if (req.user.role !== "admin") return res.redirect("/");
    res.render("dashboards/adminDashboard", { currentUser: req.user });
});

module.exports = router;
