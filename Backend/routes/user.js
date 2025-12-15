const express = require('express');
const passport = require('passport');
const router = express.Router();

const OwnerRequest = require("../models/OwnerRequest");
const User = require('../models/user');
const Booking = require('../models/Booking');
const Review = require('../models/reviews');

const wrapAsync = require('../utils/wrapAsync');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../utils/email');
const ActivityLog = require('../models/ActivityLog');
const { isLoggedIn, isAdmin } = require('../middleware/roleMiddleware');
const userController = require('../controllers/user');

const { upload } = require("../middleware/multer");
const { cloudinary } = require("../cloudinary");
const { createNotification } = require("../utils/notify");

// =======================================================
// REGISTER (ALWAYS as USER)
// =======================================================

router.get('/register', (req, res) => res.render('users/register'));

router.post('/register', wrapAsync(async (req, res) => {
  let { username, email, password } = req.body;

  // FORCE ROLE USER ⬇⬇⬇
  const role = "user";

  const user = new User({ username, email, role });
  const registeredUser = await User.register(user, password);

  // Email verification token
  const token = crypto.randomBytes(20).toString('hex');
  registeredUser.verifyToken = token;
  registeredUser.verifyTokenExpires = Date.now() + 86400000;
  await registeredUser.save();

  const emailResult = await sendVerificationEmail(registeredUser, token);

  if (!emailResult.success) {
    console.log("⚠ Verification email failed:", emailResult.error);

    // DEV MODE auto-verify
    if (process.env.NODE_ENV === "development") {
      registeredUser.isVerified = true;
      registeredUser.verifyToken = undefined;
      registeredUser.verifyTokenExpires = undefined;
      await registeredUser.save();
    }
  }

  req.flash('success', 'Registration successful! Check email for verification.');
  res.redirect('/login');
}));


// =======================================================
// BECOME OWNER PAGE
// =======================================================

router.get("/become-owner", isLoggedIn, async (req, res) => {
  try {
    if (req.user.role === "owner") {
      req.flash("success", "You are already an owner.");
      return res.redirect("/dashboard/owner");
    }

    const existingRequest = await OwnerRequest.findOne({ user: req.user._id });

    res.render("owner/becomeOwner", {
      currentUser: req.user,
      existingRequest,
    });

  } catch (err) {
    console.log("Become owner error:", err);
    req.flash("error", "Unable to open owner apply page.");
    res.redirect("/dashboard/user");
  }
});


// =======================================================
// SUBMIT OWNER REQUEST
// =======================================================

router.post("/become-owner", isLoggedIn, async (req, res) => {
  try {
    if (req.user.role === "owner") {
      req.flash("success", "You are already an owner.");
      return res.redirect("/dashboard/owner");
    }

    const {
      fullName,
      phone,
      address,
      city,
      govIdType,
      govIdNumber,
      propertyType,
      propertyCount,
      message,
    } = req.body;

    if (!fullName || !phone || !address || !city) {
      req.flash("error", "All required fields must be filled.");
      return res.redirect("/become-owner");
    }

    let request = await OwnerRequest.findOne({ user: req.user._id });

    if (request && request.status === "pending") {
      req.flash("error", "Your previous request is still pending.");
      return res.redirect("/become-owner");
    }

    if (request && request.status === "rejected") {
      // Update rejected request
      request.fullName = fullName;
      request.phone = phone;
      request.address = address;
      request.city = city;
      request.govIdType = govIdType;
      request.govIdNumber = govIdNumber;
      request.propertyType = propertyType;
      request.propertyCount = propertyCount || 1;
      request.message = message;
      request.status = "pending";
      request.reviewedAt = undefined;
      request.reviewedBy = undefined;
      await request.save();
    } else if (!request) {
      // First time
      request = await OwnerRequest.create({
        user: req.user._id,
        fullName,
        phone,
        address,
        city,
        govIdType,
        govIdNumber,
        propertyType,
        propertyCount: propertyCount || 1,
        message,
      });
    }

    // Notify Admins
    const admins = await User.find({ role: "admin" }).select("_id");
    await Promise.all(
      admins.map((a) =>
        createNotification(
          a._id,
          `🆕 New Owner Request from @${req.user.username}`,
          `/admin/owners`
        )
      )
    );

    req.flash("success", "Your owner request has been submitted.");
    res.redirect("/become-owner");

  } catch (err) {
    console.log("Owner request error:", err);
    req.flash("error", "Could not submit owner request.");
    res.redirect("/become-owner");
  }
});


// =======================================================
// EMAIL VERIFY
// =======================================================

router.get('/verify-email/:token', wrapAsync(async (req, res) => {
  const user = await User.findOne({
    verifyToken: req.params.token,
    verifyTokenExpires: { $gt: Date.now() }
  });

  if (!user) {
    req.flash('error', 'Invalid or expired link.');
    return res.redirect('/register');
  }

  user.isVerified = true;
  user.verifyToken = undefined;
  user.verifyTokenExpires = undefined;
  await user.save();

  req.flash('success', 'Email verified! Please login.');
  res.redirect('/login');
}));


// =======================================================
// RESEND VERIFY EMAIL
// =======================================================

router.post('/resend-verify', wrapAsync(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    req.flash('error', 'No account with that email.');
    return res.redirect('/login');
  }

  if (user.isVerified) {
    req.flash('info', 'Account already verified.');
    return res.redirect('/login');
  }

  const token = crypto.randomBytes(20).toString('hex');
  user.verifyToken = token;
  user.verifyTokenExpires = Date.now() + 86400000;
  await user.save();

  await sendVerificationEmail(user, token);
  req.flash('success', 'Verification email resent.');
  res.redirect('/login');
}));


// =======================================================
// LOGIN
// =======================================================

router.get('/login', (req, res) => res.render('users/login'));

router.post('/login', (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash('error', info?.message || 'Invalid credentials');
      return res.redirect('/login');
    }

    if (!user.isVerified) {
      req.flash('error', 'Please verify your email first.');
      return res.redirect('/login');
    }

    // User selects role but MUST match his DB role
    const selectedRole = req.body.role;

    if (user.role !== selectedRole) {
      req.flash('error', `Access Denied. You are registered as ${user.role}.`);
      return res.redirect('/login');
    }

    req.logIn(user, async (err) => {
      if (err) return next(err);

      user.lastLoginAt = new Date();
      user.lastLoginIP = req.ip;
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save();

      await ActivityLog.create({ user: user._id, action: 'login', ip: req.ip });

      if (user.role === 'admin') return res.redirect('/admin');
      if (user.role === 'owner') return res.redirect('/dashboard/owner');
      return res.redirect('/listings');
    });
  })(req, res, next);
});


// =======================================================
// LOGOUT
// =======================================================

router.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) return next(err);
    req.flash('success', 'Logged out successfully');
    res.redirect('/listings');
  });
});


// =======================================================
// PROFILE
// =======================================================

router.get("/profile", isLoggedIn, async (req, res) => {
  try {
    const userId = req.user._id;

    const totalBookings = await Booking.countDocuments({ user: userId });
    const wishlistCount = req.user.savedListings?.length || 0;

    const upcomingTrips = await Booking.countDocuments({
      user: userId,
      startDate: { $gte: new Date() },
      status: { $ne: "canceled" }
    });

    const reviewCount = await Review.countDocuments({ author: userId });

    res.render("users/profile", {
      totalBookings,
      wishlistCount,
      upcomingTrips,
      reviewCount,
      currentUser: req.user
    });

  } catch (err) {
    console.log("PROFILE ERROR:", err);
    req.flash("error", "Cannot load profile");
    res.redirect("/");
  }
});


// =======================================================
// PROFILE EDIT + UPDATE
// =======================================================

router.get("/profile/edit", isLoggedIn, (req, res) => {
  res.render("users/edit", { currentUser: req.user });
});

router.post(
  "/profile/update",
  isLoggedIn,
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      user.username = req.body.username || user.username;
      user.email = req.body.email || user.email;
      user.bio = req.body.bio || user.bio;
      user.phone = req.body.phone || user.phone;

      if (req.file) {
        if (user.profileImage?.filename) {
          try {
            await cloudinary.uploader.destroy(user.profileImage.filename);
          } catch {}
        }

        user.profileImage = {
          url: req.file.path,
          filename: req.file.filename
        };
      }

      await user.save();

      req.login(user, () => {
        req.flash("success", "Profile updated");
        res.redirect("/profile");
      });

    } catch (err) {
      req.flash("error", "Could not update profile");
      res.redirect("/profile/edit");
    }
  }
);


// =======================================================
// INVOICES
// =======================================================

router.get("/download/invoices", isLoggedIn, async (req, res) => {
  try {
    const invoices = await Booking.find({
      user: req.user._id,
      paymentStatus: "paid"
    }).populate("listing");

    res.render("users/invoices", { invoices });

  } catch (err) {
    req.flash("error", "Unable to load invoices");
    res.redirect("/profile");
  }
});


// =======================================================
// SAVED LISTINGS
// =======================================================

router.get("/saved", isLoggedIn, wrapAsync(userController.savedListings));

router.post('/listings/:id/save', isLoggedIn, wrapAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  const id = req.params.id;

  const idx = user.savedListings.findIndex(x => x.equals(id));

  if (idx === -1) user.savedListings.push(id);
  else user.savedListings.splice(idx, 1);

  await user.save();

  res.json({ ok: true, saved: idx === -1 });
}));


// =======================================================
// RECENTLY VIEWED
// =======================================================

router.post('/listings/:id/viewed', isLoggedIn, wrapAsync(async (req, res) => {
  const user = await User.findById(req.user._id);

  user.recentlyViewed = user.recentlyViewed.filter(x => !x.equals(req.params.id));
  user.recentlyViewed.unshift(req.params.id);

  if (user.recentlyViewed.length > 10) user.recentlyViewed.pop();

  await user.save();
  res.json({ ok: true });
}));


// =======================================================
// SUPPORT
// =======================================================

router.get("/support", isLoggedIn, (req, res) => {
  res.render("support", { currentUser: req.user });
});

const SupportTicket = require("../models/SupportTicket");

router.post("/support", isLoggedIn, async (req, res) => {
  try {
    const { issueType, message } = req.body;

    await SupportTicket.create({
      user: req.user._id,
      email: req.user.email,
      issueType,
      message,
      status: "open"
    });

    req.flash("success", "Support request submitted");
    res.redirect("/support");

  } catch (err) {
    req.flash("error", "Could not submit support request");
    res.redirect("/support");
  }
});

module.exports = router;
