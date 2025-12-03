const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  guests: { type: Number, default: 1 },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'canceled', 'completed'], default: 'pending' },
  paymentStatus: { type: String, enum: ['paid', 'refunded', 'pending'], default: 'pending' },
  paymentId: { type: String },
  paymentOrderId: { type: String }

}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
