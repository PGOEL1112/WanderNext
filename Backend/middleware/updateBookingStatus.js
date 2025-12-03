const Booking = require('../models/Booking');

async function autoUpdateBookingStatus(req, res, next) {
  try {
    // Only update bookings that are still pending or confirmed
    const now = new Date();

    // Mark pending bookings that are past start date as canceled automatically
    await Booking.updateMany(
      { status: 'pending', endDate: { $lt: now } },
      { $set: { status: 'canceled' } }
    );

    // Optionally, mark confirmed bookings that have ended as completed (if you track it)
    await Booking.updateMany(
      { status: 'confirmed', endDate: { $lt: now } },
      { $set: { status: 'completed' } }
    );

    // Move on to next middleware / route
    next();
  } catch (err) {
    console.error("Error in autoUpdateBookingStatus:", err);
    // Fail gracefully, don’t break page rendering
    next();
  }
}

// Also expose a function for setInterval
async function runAutoUpdate() {
  try {
    const now = new Date();
    await Booking.updateMany(
      { status: 'pending', endDate: { $lt: now } },
      { $set: { status: 'canceled' } }
    );
  } catch (err) {
    console.error("Error running scheduled autoUpdateBookingStatus:", err);
  }
}

module.exports = autoUpdateBookingStatus;
module.exports.runAutoUpdate = runAutoUpdate;
