const express = require("express");
const passport = require("passport");
const User = require("../models/user");
const wrapAsync = require("../utils/wrapAsync");
const { saveRedirectUrl } = require("../middleware/middleware");
const router = express.Router();
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// =============================
// LOCAL TEST EMAIL TRANSPORTER
// =============================
async function createTransporter() {
    const testAccount = await nodemailer.createTestAccount();

    return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass
        },
    });
}

// ======================================================
// REGISTER
// ======================================================
router.get("/register", (req, res) => {
    res.render("users/register");
});

router.post("/register", wrapAsync(async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const user = new User({ email, username });
        const registeredUser = await User.register(user, password);

        req.login(registeredUser, err => {
            if (err) return next(err);
            req.flash("success", "Welcome to WanderNext!");
            res.redirect("/listings");
        });

    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/register");
    }
}));

// ======================================================
// LOGIN
// ======================================================
router.get("/login", (req, res) => {
    res.render("users/login");
});

router.post("/login",
    saveRedirectUrl,
    passport.authenticate("local", {
        failureFlash: true,
        failureRedirect: "/login"
    }),
    (req, res) => {
        req.flash("success", "Welcome Back!");
        let redirectUrl = res.locals.redirectUrl || "/listings";
        res.redirect(redirectUrl);
    }
);

// ======================================================
// LOGOUT
// ======================================================
router.get("/logout", (req, res, next) => {
    req.logout(function (err) {
        if (err) return next(err);
        req.flash("success", "Logged out successfully!");
        res.redirect("/listings");
    });
});

// ======================================================
// FORGOT PASSWORD — SHOW PAGE
// ======================================================
router.get("/forgot-password", (req, res) => {
    res.render("users/forgotPassword");
});

// ======================================================
// FORGOT PASSWORD — HANDLE REQUEST
// ======================================================
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        req.flash("error", "No account found with that email.");
        return res.redirect("/forgot-password");
    }

    const token = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour validity

    await user.save();

    const transporter = await createTransporter();
    const resetURL = `http://localhost:3000/reset-password/${token}`;

    const mailInfo = await transporter.sendMail({
        from: "WanderNext <no-reply@wander.com>",
        to: email,
        subject: "Reset Your Password",
        html: `
            <h2>Password Reset</h2>
            <p>Click below to reset your password:</p>
            <a href="${resetURL}" target="_blank">${resetURL}</a>
            <p>Link expires in <strong>1 hour</strong>.</p>
        `
    });

    console.log("📩 RESET EMAIL PREVIEW:");
    console.log(nodemailer.getTestMessageUrl(mailInfo));

    req.flash("success", "Password reset link sent! Check your console for preview.");
    res.redirect("/forgot-password");
});

// ======================================================
// RESET PASSWORD — SHOW PAGE
// ======================================================
router.get("/reset-password/:token", async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() } // still valid?
    });

    if (!user) {
        req.flash("error", "Invalid or expired link.");
        return res.redirect("/forgot-password");
    }

    res.render("users/resetPassword", { token: req.params.token });
});

// ======================================================
// RESET PASSWORD — SAVE NEW PASSWORD
// ======================================================
router.post("/reset-password/:token", async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        req.flash("error", "Invalid or expired link.");
        return res.redirect("/forgot-password");
    }

    const { password } = req.body;

    // Passport-local-mongoose will hash + salt automatically
    await user.setPassword(password);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    req.flash("success", "Password reset successfully! Login using your new password.");
    res.redirect("/login");
});

module.exports = router;
