const express = require('express');
const router = express.Router();
const User = require('../models/user');
const wrapAsync = require('../utils/wrapAsync');
const crypto = require('crypto');
const { sendResetEmail } = require('../utils/email');
const ActivityLog = require('../models/ActivityLog');

// Show forgot
router.get('/forgot-password', (req, res) => res.render('users/forgot-password'));

// Handle forgot: generate token, email link
router.post('/forgot-password', wrapAsync(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    req.flash('error','No account with that email.');
    return res.redirect('/forgot-password');
  }
  const token = crypto.randomBytes(20).toString('hex');
  user.resetToken = token;
  user.resetTokenExpires = Date.now() + 60*60*1000; // 1 hour
  await user.save();
  await sendResetEmail(user, token);
  await ActivityLog.create({ user: user._id, action: 'requested_password_reset', ip: req.ip });
  req.flash('success','Password reset link sent to email (check console in dev).');
  res.redirect('/forgot-password');
}));

// Show reset form
router.get('/reset-password/:token', wrapAsync(async (req, res) => {
  const user = await User.findOne({ resetToken: req.params.token, resetTokenExpires: { $gt: Date.now() }});
  if (!user) {
    req.flash('error','Invalid or expired token.');
    return res.redirect('/forgot-password');
  }
  res.render('users/reset-password', { token: req.params.token });
}));

// Handle reset
router.post('/reset-password/:token', wrapAsync(async (req, res) => {
  const { password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    req.flash('error','Passwords do not match.');
    return res.redirect(`/reset-password/${req.params.token}`);
  }
  const user = await User.findOne({ resetToken: req.params.token, resetTokenExpires: { $gt: Date.now() }});
  if (!user) {
    req.flash('error','Invalid or expired token.');
    return res.redirect('/forgot-password');
  }
  await user.setPassword(password);
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;
  await user.save();
  await ActivityLog.create({ user: user._id, action: 'password_reset', ip: req.ip });
  req.flash('success','Password reset successful. Please login.');
  res.redirect('/login');
}));

module.exports = router;
