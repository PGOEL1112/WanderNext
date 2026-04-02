const Notification = require("../models/Notification");


let ioInstance = null;

// 👇 set from app.js
function setIO(io) {
  ioInstance = io;
}


async function createNotification(userId, message, link = "#") {
  try {
    const notif = await Notification.create({
      user: userId,
      message,
      link,
      isRead: false,
    });

    if (ioInstance) {
      ioInstance.to(userId.toString()).emit("newNotification", {
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

module.exports = { createNotification, setIO };
