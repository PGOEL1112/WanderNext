// routes/support.js
const express = require("express");
const router = express.Router();

const { isLoggedIn } = require("../middleware/permissions");
const SupportTicket = require("../models/SupportTicket");
const User = require("../models/user");
const { createNotification } = require("../utils/notify");


// ======================================================
//  SUPPORT HOME
// ======================================================
router.get("/", isLoggedIn, (req, res) => {
  res.render("support/support", { currentUser: req.user });
});


// ======================================================
//  CREATE NORMAL SUPPORT TICKET
// ======================================================
router.post("/", isLoggedIn, async (req, res) => {
  try {
    const { issueType, message } = req.body;

    const admin = await User.findOne({ role: "admin" });
    if (!admin) {
      req.flash("error", "No admin available right now.");
      return res.redirect("/support");
    }

    const ticket = await SupportTicket.create({
      chatType: "ticket",
      issueType,
      message,
      status: "open",
      user: req.user._id,
      email: req.user.email,
      participants: {
        user: req.user._id,
        other: admin._id
      }
    });

    await createNotification(
      admin._id,
      `🆕 New support ticket from @${req.user.username}`,
      `/admin/support/${ticket._id}`
    );

    req.flash("success", "Your ticket has been created.");
    res.redirect(`/support/ticket/${ticket._id}`);
  } catch (err) {
    console.log("Support ticket create error:", err);
    req.flash("error", "Could not submit support ticket.");
    res.redirect("/support");
  }
});


// ======================================================
//  MY TICKETS PAGE
// ======================================================
router.get("/my-tickets", isLoggedIn, async (req, res) => {
  const tickets = await SupportTicket.find({ user: req.user._id }).sort({
    createdAt: -1
  });

  res.render("support/myTickets", { tickets, currentUser: req.user });
});


// ======================================================
//  CHAT-WITH (start direct chat user↔admin, owner↔admin, user↔owner)
// ======================================================
router.get("/chat-with/:targetRole", isLoggedIn, async (req, res) => {
  try {
    const myRole = req.user.role;
    const targetRole = req.params.targetRole;

    if (myRole === targetRole) {
      req.flash("error", "Cannot chat with same role.");
      return res.redirect("/support");
    }

    const targetUser = await User.findOne({ role: targetRole });
    if (!targetUser) {
      req.flash("error", `No ${targetRole} found.`);
      return res.redirect("/support");
    }

    const chatType = `${myRole}-${targetRole}`;

    let ticket = await SupportTicket.findOne({
      chatType,
      "participants.user": req.user._id,
      "participants.other": targetUser._id
    });

    if (!ticket) {
      ticket = await SupportTicket.create({
        chatType,
        issueType: "Direct Chat",
        message: `Direct ${chatType} chat started.`,
        user: req.user._id,
        email: req.user.email,
        status: "open",
        participants: {
          user: req.user._id,
          other: targetUser._id
        }
      });

      await createNotification(
        targetUser._id,
        `💬 New chat from @${req.user.username}`,
        `/support/ticket/${ticket._id}`
      );
    }

    res.redirect(`/support/ticket/${ticket._id}`);
  } catch (err) {
    console.log("chat-with error:", err);
    req.flash("error", "Unable to start chat.");
    res.redirect("/support");
  }
});


// ======================================================
//  TICKET CHAT PAGE
// ======================================================
router.get("/ticket/:id", isLoggedIn, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate("user", "username role email")
      .populate("participants.user", "username role email")
      .populate("participants.other", "username role email")
      .populate("messages.sender", "username role")
      .populate("messages.receiver", "username role");

    if (!ticket) {
      req.flash("error", "Ticket not found");
      return res.redirect("/support/my-tickets");
    }

    const allowed =
      (ticket.participants.user &&
        ticket.participants.user._id.equals(req.user._id)) ||
      (ticket.participants.other &&
        ticket.participants.other._id.equals(req.user._id)) ||
      req.user.role === "admin";

    if (!allowed) {
      req.flash("error", "Not allowed.");
      return res.redirect("/support");
    }

    res.render("support/ticketDetails", {
      ticket,
      currentUser: req.user
    });
  } catch (err) {
    console.log("Ticket details error:", err);
    req.flash("error", "Unable to load ticket");
    res.redirect("/support/my-tickets");
  }
});


// ======================================================
//  SEND MESSAGE (REAL-TIME CHAT)
// ======================================================
router.post("/:id/message", isLoggedIn, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ ok: false, error: "Empty message" });
    }

    const ticket = await SupportTicket.findById(req.params.id)
      .populate("participants.user", "username role")
      .populate("participants.other", "username role");

    if (!ticket) {
      return res.status(404).json({ ok: false, error: "Ticket not found" });
    }

    const senderId = req.user._id.toString();
    const senderRole = req.user.role;

    const receiverUser =
      ticket.participants.user._id.toString() === senderId
        ? ticket.participants.other
        : ticket.participants.user;

    const newMessage = {
      sender: senderId,
      receiver: receiverUser._id,
      text: text.trim()
    };

    ticket.messages.push(newMessage);
    ticket.status = "pending";
    await ticket.save();


    // 🔥 NOTIFICATION LOGIC
    if (senderRole === "admin") {
      await createNotification(
        receiverUser._id,
        `💬 Admin replied to your support ticket`,
        `/support/ticket/${ticket._id}`
      );
    } else {
      const admin = await User.findOne({ role: "admin" });
      if (admin) {
        await createNotification(
          admin._id,
          `💬 New message from @${req.user.username}`,
          `/admin/support/${ticket._id}`
        );
      }
    }


    // 🔥 SOCKET EMIT
    const io = req.app.locals.io;
    io.to(ticket._id.toString()).emit("chatMessage", {
      ticketId: ticket._id,
      text: newMessage.text,
      createdAt: new Date(),
      senderId,
      role: senderRole
    });

    res.json({ ok: true });
  } catch (err) {
    console.log("Support message error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ======================================================
//   ADMIN - View all chats with users / owners
// ======================================================
router.get("/admin-chats/:target", isLoggedIn, async (req, res) => {
  if (req.user.role !== "admin") {
    req.flash("error", "Access denied.");
    return res.redirect("/support");
  }

  const target = req.params.target; // 'users' or 'owners'

  let roleFilter = target === "users" ? "user" : "owner";

  const tickets = await SupportTicket.find({
    "participants.other": { $exists: true }
  })
    .populate("participants.user", "username role")
    .populate("participants.other", "username role");

  const filtered = tickets.filter(
    (t) =>
      t.participants.user.role === roleFilter ||
      t.participants.other.role === roleFilter
  );

  res.render("support/chatList", {
    title: `Chats with ${roleFilter}s`,
    chats: filtered,
    currentUser: req.user
  });
});

// ======================================================
//   OWNER - View all chats with users
// ======================================================
router.get("/owner-chats/users", isLoggedIn, async (req, res) => {
  if (req.user.role !== "owner") {
    req.flash("error", "Access denied.");
    return res.redirect("/support");
  }

  const tickets = await SupportTicket.find({
    "participants.user": req.user._id
  })
    .populate("participants.user", "username role")
    .populate("participants.other", "username role");

  res.render("support/chatList", {
    title: "Chats with Users",
    chats: tickets,
    currentUser: req.user
  });
});

module.exports = router;
