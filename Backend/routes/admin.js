const express = require("express");
const router = express.Router();
const { isLoggedIn, isAdmin } = require("../middleware/permissions");
const Listing = require("../models/listing");
const User = require("../models/user");
const Booking = require("../models/Booking"); // booking model
const SupportTicket = require("../models/SupportTicket");


const { createNotification } = require("../utils/notify"); // ← use same helper as in bookings.js

// ===================== ADMIN DASHBOARD =====================
router.get("/", isLoggedIn, isAdmin, async (req, res, next) => {
  try {
    const [totalUsers, totalListings, totalBookings, paidAgg, openTickets] =
      await Promise.all([
        User.countDocuments({}),
        Listing.countDocuments({}),
        Booking.countDocuments({}),
        Booking.aggregate([
          { $match: { paymentStatus: "paid" } },
          { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]),
        SupportTicket.countDocuments({ status: { $ne: "resolved" } }) // ⭐ REAL COUNT
      ]);

    const totalRevenue = paidAgg.length > 0 ? paidAgg[0].total : 0;

    // Monthly Revenue
    const paidBookings = await Booking.find({ paymentStatus: "paid" }).lean();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyRevenue = Array(12).fill(0);

    paidBookings.forEach(b => {
      const m = new Date(b.createdAt).getMonth();
      monthlyRevenue[m] += b.totalPrice;
    });

    // Recent Bookings
    const recentBookings = await Booking.find({})
      .populate({
        path: "listing",
        populate: { path: "owner", select: "username email" }
      })
      .populate("user", "username email")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    res.render("admin/dashboard", {
      totalUsers,
      totalListings,
      totalBookings,
      totalRevenue,
      months,
      monthlyRevenue,
      recentBookings,
      openTickets
    });

  } catch (err) {
    console.error("Admin dashboard error:", err);
    next(err);
  }
});

// ===================== ALL LISTINGS =====================
router.get("/listings", isLoggedIn, isAdmin, async (req, res) => {
  const listings = await Listing.find({}).populate("owner");
  res.render("admin/listings", { listings });
});

// ===================== ALL USERS =====================
router.get("/users", isLoggedIn, isAdmin, async (req, res) => {
  const users = await User.find({});
  res.render("admin/users", { users });
});

// ===================== CHANGE ROLE =====================
router.post("/users/:id/role", isLoggedIn, isAdmin, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { role: req.body.role });
  req.flash("success", "Role updated!");
  res.redirect("/admin/users");
});

// ===================== DELETE USER =====================
router.delete("/users/:id", isLoggedIn, isAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  req.flash("success", "User deleted!");
  res.redirect("/admin/users");
});


// ===================== ANALYTICS: MONTHLY REVENUE =====================
router.get("/analytics", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const paidBookings = await Booking.find({ paymentStatus: "paid" }).lean();

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const revenue = Array(12).fill(0);

    paidBookings.forEach(b => {
      const m = new Date(b.createdAt).getMonth();
      revenue[m] += b.totalPrice;
    });

    res.render("admin/analytics", {
      months,
      revenue
    });
  } catch (err) {
    console.error("Admin analytics error:", err);
    res.send("Error loading analytics");
  }
});


// ===================== EARNINGS DASHBOARD (PER OWNER) =====================
router.get("/earnings", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find({ paymentStatus: "paid" })
      .populate({
        path: "listing",
        select: "title owner",
        populate: { path: "owner", select: "username email role" }
      })
      .populate("user", "username")
      .lean();

    const ownerMap = new Map();

    bookings.forEach(b => {
      if (!b.listing || !b.listing.owner) return;

      const owner = b.listing.owner;
      const ownerId = owner._id.toString();

      if (!ownerMap.has(ownerId)) {
        ownerMap.set(ownerId, {
          owner,
          totalRevenue: 0,
          bookingsCount: 0
        });
      }

      const entry = ownerMap.get(ownerId);
      entry.totalRevenue += b.totalPrice;
      entry.bookingsCount += 1;
    });

    const owners = Array.from(ownerMap.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    );

    res.render("admin/earnings", { owners });
  } catch (err) {
    console.error("Earnings dashboard error:", err);
    res.send("Error loading earnings dashboard");
  }
});

router.get("/support", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({})
      .populate("user", "username email")
      .sort({ createdAt: -1 });

    res.render("admin/supportDashboard", { 
      tickets, 
      currentUser: req.user 
    });

  } catch (err) {
    console.log("Support dashboard error:", err);
    req.flash("error", "Unable to load support tickets");
    res.redirect("/admin/dashboard");
  }
});


router.get("/support/:id", isLoggedIn, isAdmin, async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id)
    .populate("user", "username email");

  res.render("admin/supportTicket", { ticket , currentUser: req.user});
});

router.post("/support/:id/status", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate("user", "username");

    ticket.status = req.body.status;
    await ticket.save();

    // 🔔 Notify user
    await createNotification(
      ticket.user._id,
      `Your support ticket "${ticket.issueType}" status updated to ${ticket.status.toUpperCase()}.`,
      "/support/my-tickets"
    );

    req.flash("success", "Ticket status updated!");
    res.redirect("/admin/support");

  } catch (err) {
    console.log("Status update error:", err);
    req.flash("error", "Unable to update ticket status");
    res.redirect("/admin/support");
  }
});

// ===================== ADMIN REPLY =====================
router.post("/support/:id/reply", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate("user", "username");

    ticket.adminReply = req.body.reply;
    ticket.repliedAt = new Date();
    ticket.status = "resolved";
    await ticket.save();

    // 🔔 Notify user
    await createNotification(
      ticket.user._id,
      `Your support ticket "${ticket.issueType}" has been resolved. Admin replied to your message.`,
      "/support/my-tickets"
    );

    req.flash("success", "Reply sent!");
    res.redirect(`/admin/support/${ticket._id}`);

  } catch (err) {
    console.log("Reply error:", err);
    req.flash("error", "Unable to send reply");
    res.redirect("/admin/support");
  }
});

router.get("/support/:id/chat", isLoggedIn, isAdmin, async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id)
    .populate("user", "username email");

  if (!ticket) {
    req.flash("error", "Ticket not found");
    return res.redirect("/admin/support");
  }

  res.render("admin/liveChat", {
    ticket,
    adminId: req.user._id.toString()
  });
});

module.exports = router;
