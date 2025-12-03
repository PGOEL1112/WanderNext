const express = require("express");
const router = express.Router();

const OwnerRequest = require("../models/OwnerRequest");
const User = require("../models/user");
const { createNotification } = require("../utils/notify");

// Mounted in app.js as:
// app.use("/admin/owners", isLoggedIn, isAdmin, ownerApprovalRoutes);


// =====================================================
// GET: /admin/owners  → Show pending + processed requests
// =====================================================
router.get("/", async (req, res) => {
  const pending = await OwnerRequest.find({ status: "pending" })
    .populate("user", "username email role")
    .sort({ createdAt: -1 });

  const processed = await OwnerRequest.find({
    status: { $in: ["approved", "rejected"] },
  })
    .populate("user", "username email role")
    .sort({ updatedAt: -1 });

  res.render("admin/ownerRequests", {
    currentUser: req.user,
    pending,
    processed,
  });
});


// =====================================================
// POST: /admin/owners/:id/approve → Approve owner request
// =====================================================
router.post("/:id/approve", async (req, res) => {
  try {
    const request = await OwnerRequest.findById(req.params.id).populate(
      "user",
      "username email role"
    );

    if (!request) {
      req.flash("error", "Owner request not found.");
      return res.redirect("/admin/owners");
    }

    if (request.status === "approved") {
      req.flash("success", "This request is already approved.");
      return res.redirect("/admin/owners");
    }

    // Mark request as approved
    request.status = "approved";
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    await request.save();

    // Update user role → owner
    const user = await User.findById(request.user._id);
    if (user) {
      user.role = "owner";
      await user.save();
    }

    // Notify user
    await createNotification(
      request.user._id,
      "✅ Your Owner Account has been approved! You can now add listings.",
      "/dashboard/owner"
    );

    req.flash("success", `Owner access granted to @${request.user.username}`);
    res.redirect("/admin/owners");

  } catch (err) {
    console.log("Approve owner error:", err);
    req.flash("error", "Could not approve owner.");
    res.redirect("/admin/owners");
  }
});


// =====================================================
// POST: /admin/owners/:id/reject → Reject owner request
// =====================================================
router.post("/:id/reject", async (req, res) => {
  try {
    const { reason } = req.body;

    const request = await OwnerRequest.findById(req.params.id).populate(
      "user",
      "username email role"
    );

    if (!request) {
      req.flash("error", "Owner request not found.");
      return res.redirect("/admin/owners");
    }

    request.status = "rejected";
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    await request.save();

    // Notify user
    await createNotification(
      request.user._id,
      `❌ Your owner request was rejected.${reason ? " Reason: " + reason : ""}`,
      "/become-owner"
    );

    req.flash("success", "Owner request rejected.");
    res.redirect("/admin/owners");

  } catch (err) {
    console.log("Reject owner error:", err);
    req.flash("error", "Could not reject owner.");
    res.redirect("/admin/owners");
  }
});

module.exports = router;
