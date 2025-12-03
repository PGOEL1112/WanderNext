// routes/notifications.js (example)
const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { isLoggedIn } = require("../middleware/permissions");

router.delete("/notifications/delete/:id", isLoggedIn, async (req, res) => {
  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.log("Delete notif error:", err);
    return res.status(500).json({ ok: false });
  }
});

module.exports = router;
