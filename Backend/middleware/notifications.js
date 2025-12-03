const Notification = require("../models/Notification");

async function fetchNotifications(req, res, next) {
  if (!req.user) {
    res.locals.notifications = [];
    res.locals.unreadCount = 0;
    return next();
  }

  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false
    });

    res.locals.notifications = notifications;
    res.locals.unreadCount = unreadCount;
    next();
  } catch (err) {
    console.error("Fetch notifications error:", err);
    res.locals.notifications = [];
    res.locals.unreadCount = 0;
    next();
  }
}

module.exports = fetchNotifications;
