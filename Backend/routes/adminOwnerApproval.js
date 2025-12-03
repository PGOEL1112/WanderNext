const express = require("express");
const router = express.Router();
const { isLoggedIn, isAdmin } = require("../middleware/permissions");
const OwnerApplication = require("../models/OwnerApplication");
const User = require("../models/user");
const { createNotification } = require("../utils/notify");

/** View list of owner applications */
router.get("/", isLoggedIn, isAdmin, async (req, res) => {
  const apps = await OwnerApplication.find().sort({ createdAt: -1 }).populate("user", "username email role");
  res.render("admin/ownerRequests", { apps, currentUser: req.user });
});

/** View single application */
router.get("/:id", isLoggedIn, isAdmin, async (req, res) => {
  const app = await OwnerApplication.findById(req.params.id).populate("user", "username email role");
  if (!app) {
    req.flash("error", "Application not found");
    return res.redirect("/admin/owners");
  }
  res.render("admin/ownerRequestDetails", { app, currentUser: req.user });
});

/** Approve */
router.post("/:id/approve", isLoggedIn, isAdmin, async (req, res) => {
  const app = await OwnerApplication.findById(req.params.id);
  if (!app) {
    req.flash("error", "Not found");
    return res.redirect("/admin/owners");
  }

  const user = await User.findById(app.user);
  user.role = "owner";
  await user.save();

  app.status = "approved";
  await app.save();

  // notify user
  await createNotification(user._id, "✅ Your owner application has been approved", "/dashboard/owner");

  req.flash("success", "Application approved and user elevated to owner.");
  res.redirect(`/admin/owners/${app._id}`);
});

/** Reject */
router.post("/:id/reject", isLoggedIn, isAdmin, async (req, res) => {
  const { adminNote } = req.body;
  const app = await OwnerApplication.findById(req.params.id).populate("user");
  if (!app) {
    req.flash("error", "Not found");
    return res.redirect("/admin/owners");
  }

  app.status = "rejected";
  app.adminNote = adminNote || "";
  await app.save();

  await createNotification(app.user._id, "❌ Your owner application was rejected. Check details.", "/dashboard/user");

  req.flash("success", "Application rejected.");
  res.redirect(`/admin/owners/${app._id}`);
});

module.exports = router;
