const express = require('express');
const passport = require('passport');
const router = express.Router();

const User = require('../models/user');
const wrapAsync = require('../utils/wrapAsync');
const ActivityLog = require('../models/ActivityLog');
const { sendOTPEmail } = require('../utils/email');

const OwnerRequest = require("../models/OwnerRequest");
const Booking = require('../models/Booking');
const Review = require('../models/reviews');

const { isLoggedIn } = require('../middleware/roleMiddleware');
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

  const existingUser = await User.findOne({ email });

  if (existingUser && existingUser.isVerified) {
    req.flash('error', 'Email already registered. Please login.');
    return res.redirect('/login');
  }

  let user;

  if (!existingUser) {
    user = new User({ username, email, role: 'user' });
    user = await User.register(user, password);
  }
  else {
    const isMatch = await existingUser.authenticate(password);

    if (!isMatch.user) {
      req.flash('error', 'Incorrect Password');
      return res.redirect('/login');
    }
    user = existingUser;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otp = otp;
  user.otpExpires = Date.now() + 5 * 60 * 1000;
  user.isVerified = false;

  await user.save();

  console.log("🔥 REGISTER HIT");
  console.log("📧 Email:", user.email);
  console.log("🔐 OTP:", otp);

  // ✅ EMAIL SEND CHECK
  const result = await sendOTPEmail(user, otp);

  console.log("📨 OTP SEND RESULT:", result);

  // ❌ agar mail fail hua
  if (!result.success) {
    req.flash('error', 'Email sending failed ❌ Check server logs');
    return res.redirect('/register');
  }

  req.flash('success', 'OTP sent to your email ✅');
  res.redirect(`/verify-otp?email=${email}`);
}));

router.get('/verify-otp', (req, res) => {
  const { email } = req.query;

  if (!email) {
    req.flash("error", "Invalid request");
    return res.redirect("/register");
  }

  res.render("users/verifyOtp", { email });
});


router.post('/verify-otp', wrapAsync(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email });

  if (!user || user.otp !== otp || user.otpExpires < Date.now()) {
    req.flash('error', 'Invalid or expired OTP');
    return res.redirect(`/verify-otp?email=${email}`);
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;

  await user.save();

  req.login(user, (err) => {
    if (err) return res.redirect('/login');

    req.flash('success', 'Account verified successfully!');
    res.redirect('/listings');
  });
}));

router.post('/resend-otp', wrapAsync(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    req.flash('error', 'User not found');
    return res.redirect('/register');
  }
  if (user.otpExpires && user.otpExpires > Date.now() - 60000) {
    req.flash('error', 'Wait before requesting new OTP');
    return res.redirect(`/verify-otp?email=${email}`);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  user.otp = otp;
  user.otpExpires = Date.now() + 5 * 60 * 1000;

  await user.save();

  await sendOTPEmail(user, otp);

  req.flash('success', 'OTP resent');
  res.redirect(`/verify-otp?email=${email}`);
}));


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
      console.log("User After Auth:", req.user);

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

router.post("/auth/google", async (req, res) => {
  try {
    const { email, username } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        username,
        isVerified: true, // Google = auto verified
        role: 'user' // default role
      });

      await User.register(user, Math.random().toString(36)); // dummy password
    }

    req.login(user, (err) => {
      if (err) return res.json({ success: false });

      return res.json({ success: true });
    });

  } catch (err) {
    console.log("Google auth error:", err);
    res.json({ success: false });
  }
});

router.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    req.flash('success', 'Logged out successfully');
    res.redirect('/listings');
  });
});

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
          } catch { }
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
