// routes/adminSupport.js
const express = require("express");
const router = express.Router();

const { isLoggedIn, isAdmin } = require("../middleware/permissions");
const SupportTicket = require("../models/SupportTicket");

// ALL /admin/support/* routes should use this router in app.js:
// app.use("/admin/support", isLoggedIn, isAdmin, adminSupportRouter);

// -----------------------------------------
//  GET /admin/support  → Admin Support Dashboard
// -----------------------------------------
router.get("/", async (req, res) => {
  const tickets = await SupportTicket.find({})
    .sort({ updatedAt: -1 })
    .populate("user", "username email role")
    .populate("participants.user", "username role email")
    .populate("participants.other", "username role email");

  res.render("support/supportDashboard", {
    tickets,
    currentUser: req.user,
  });
});

// -----------------------------------------
//  GET /admin/support/:id  → Ticket details page
// -----------------------------------------
router.get("/:id", async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id)
    .populate("user", "username email role")
    .populate("participants.user", "username role email")
    .populate("participants.other", "username role email")
    .populate("messages.sender", "username role")
    .populate("messages.receiver", "username role");

  if (!ticket) {
    req.flash("error", "Ticket not found");
    return res.redirect("/admin/support");
  }

  res.render("support/adminTicketDetails", {
    ticket,
    currentUser: req.user,
  });
});

// -----------------------------------------
//  POST /admin/support/:id/status  → Update status
// -----------------------------------------
router.post("/:id/status", async (req, res) => {
  const { status } = req.body;
  await SupportTicket.findByIdAndUpdate(req.params.id, { status });
  req.flash("success", "Status updated");
  res.redirect(`/admin/support/${req.params.id}`);
});

// -----------------------------------------
//  POST /admin/support/:id/reply  → Old style reply (optional)
//  Also pushes message to chat as admin
// -----------------------------------------
router.post("/:id/reply", async (req, res) => {
  const { reply } = req.body;

  const ticket = await SupportTicket.findById(req.params.id)
    .populate("participants.user", "username role email")
    .populate("participants.other", "username role email")
    .populate("user", "username role email");

  if (!ticket) {
    req.flash("error", "Ticket not found");
    return res.redirect("/admin/support");
  }

  ticket.adminReply = reply;
  ticket.repliedAt = new Date();

  // also send as chat message
  const adminId = req.user._id;
  // receiver is the non-admin participant
  let receiverUser =
    ticket.participants.user?.role === "admin"
      ? ticket.participants.other
      : ticket.participants.user;

  if (!receiverUser) receiverUser = ticket.user;

  ticket.messages.push({
    sender: adminId,
    receiver: receiverUser ? receiverUser._id : undefined,
    text: reply,
  });

  await ticket.save();

  req.flash("success", "Reply sent");
  res.redirect(`/admin/support/${req.params.id}`);
});

// -----------------------------------------
//  GET /admin/support/:id/chat → open chat UI
// -----------------------------------------
router.get("/:id/chat", async (req, res) => {
  // Just reuse main support chat page
  return res.redirect(`/support/ticket/${req.params.id}`);
});

module.exports = router;
