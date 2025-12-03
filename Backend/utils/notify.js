const Notification = require("../models/Notification");
const appExports = require("../app");

async function createNotification(userId, message, link = "#") {
  try {
    const notif = await Notification.create({
      user: userId,
      message,
      link,
      isRead: false,
    });

    // yahan se ioInstance lo (live reference)
    const io = appExports.ioInstance;

    if (io) {
      io.to(userId.toString()).emit("newNotification", {
        _id: notif._id,
        message: notif.message,
        link: notif.link,
        createdAt: notif.createdAt,
      });
    } else {
      console.log("⚠ ioInstance not ready yet");
    }

    return notif;
  } catch (err) {
    console.error("Notification error:", err);
  }
}

module.exports = { createNotification };
