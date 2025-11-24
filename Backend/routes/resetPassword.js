const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcryptjs"); // only needed if not using passport-local-mongoose
const User = require("../models/user");

// =========================
// SHOW FORGOT PASSWORD FORM
// =========================
router.get("/forgot-password", (req, res) => {
  res.render("users/forgot-password"); // Ensure file is named "forgot-password.ejs"
});

// =========================
// HANDLE FORGOT PASSWORD SUBMIT
// =========================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      req.flash("error", "No account found with that email.");
      return res.redirect("/forgot-password");
    }

    // Generate secure token
    const token = crypto.randomBytes(20).toString("hex");
    user.resetToken = token;
    user.resetTokenExpires = Date.now() + 1000 * 60 * 30; // 30 minutes

    await user.save();

    // In production, you would send this token via email
    // sendResetEmail(user.email, token);

    // Redirect directly for development
    res.redirect(`/reset-password/${token}`);
  } catch (err) {
    console.log("Forgot Password Error →", err);
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
      return res.redirect("/forgot-password"); // corrected path
    }

    res.render("users/reset-password", { token: req.params.token }); // Ensure file is "reset-password.ejs"
  } catch (err) {
    console.log("Reset Password Form Error →", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/forgot-password"); // corrected path
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
      resetTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash("error", "Reset link expired or invalid.");
      return res.redirect("/forgot-password"); // corrected path
    }

    // ===== Option 1: Using passport-local-mongoose =====
    if (user.setPassword) {
      await user.setPassword(password);
    } 
    // ===== Option 2: Using plain bcryptjs =====
    else {
      const hashedPassword = await bcrypt.hash(password, 12);
      user.password = hashedPassword;
    }

    // Clear token and expiry
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;

    await user.save();

    req.flash("success", "Password reset successful! Please log in.");
    res.redirect("/login");
  } catch (err) {
    console.log("Reset Password Submit Error →", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/forgot-password"); // corrected path
  }
});

module.exports = router;
