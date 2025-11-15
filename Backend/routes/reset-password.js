const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/user");

// =========================
// SHOW FORGOT PASSWORD
// =========================
router.get("/forgot-password", (req, res) => {
  res.render("users/forgot-password");
});

// =========================
// HANDLE FORGOT PASSWORD
// =========================
// =========================
// HANDLE FORGOT PASSWORD
// =========================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      req.flash("error", "No account found with that email.");
      return res.redirect("/forgot-password");
    }

    // Generate a token
    const token = Math.random().toString(36).substr(2, 12);
    user.resetToken = token;
    user.resetTokenExpires = Date.now() + 1000 * 60 * 30; // 30 minutes
    await user.save();

    // 🔹 Redirect user directly to reset password page
    res.redirect(`/reset-password/${token}`);
  } catch (err) {
    console.log(err);
    req.flash("error", "Something went wrong.");
    res.redirect("/forgot-password");
  }
});

// =========================
// SHOW RESET PASSWORD FORM
// =========================
router.get("/reset-password/:token", async (req, res) => {
  try {
    const user = await User.findOne({
      resetToken: req.params.token,
      resetTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash("error", "Reset link expired or invalid.");
      return res.redirect("/forgot-password");
    }

    res.render("users/reset-password", { token: req.params.token });
  } catch (err) {
    console.log(err);
    req.flash("error", "Something went wrong.");
    res.redirect("/forgot-password");
  }
});

// =========================
// HANDLE RESET PASSWORD SUBMIT
// =========================
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match.");
      return res.redirect(`/reset-password/${token}`);
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash("error", "Reset link expired or invalid.");
      return res.redirect("/forgot-password");
    }

    // ✅ Use passport-local-mongoose's setPassword
    await user.setPassword(password);

    // Clear token and expiry
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;

    await user.save();

    req.flash("success", "Password reset successful! Please log in.");
    res.redirect("/login");

  } catch (err) {
    console.log("RESET ERROR →", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/forgot-password");
  }
});

module.exports = router;
