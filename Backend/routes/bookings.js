const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Listing = require('../models/listing');
const autoUpdateBookingStatus = require("../middleware/updateBookingStatus");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { sendMail, emailTemplate } = require("../utils/email");
const { createNotification } = require("../utils/notify");
const User = require("../models/user");


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ===================== Middleware =====================
function isLoggedIn(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

function isOwner(req, res, next) {
  if (!req.user || req.user.role !== 'owner') {
    req.flash('error', 'Access denied');
    return res.redirect('/');
  }
  next();
}

// ===================== Premium Booking Page =====================
// GET Premium Booking Page
router.get('/listings/:id/premium-book', isLoggedIn, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) {
      req.flash('error', 'Listing not found');
      return res.redirect('/listings');
    }

    // Pass booked dates to the template
    const bookings = await Booking.find({
      listing: listing._id,
      status: { $ne: 'canceled' }
    }).lean();

    const bookedDates = bookings.map(b => ({
      startDate: b.startDate.toISOString().split('T')[0],
      endDate: b.endDate.toISOString().split('T')[0]
    }));

    res.render('bookings/premiumBooking', {
      listing,
      bookedDates,
      currentUser: req.user
    });
  } catch (err) {
    console.error('Error in GET /premium-book:', err);
    req.flash('error', 'Something went wrong');
    res.redirect('/listings');
  }
});


// ===================== Create Booking + Razorpay Order =====================
// POST /bookings/listings/:id/premium-book
router.post('/listings/:id/premium-book', isLoggedIn, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      req.flash('error', 'Listing not found');
      return res.redirect('/listings');
    }

    // Prevent owner from booking own listing
    if (listing.owner.equals(req.user._id)) {
      req.flash('error', 'You cannot book your own listing.');
      return res.redirect(`/bookings/listings/${listing._id}/premium-book`);
    }

    const { startDate, endDate, guests } = req.body;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate dates
    if (start < today) {
      req.flash('error', 'Check-in date cannot be in the past.');
      return res.redirect(`/bookings/listings/${listing._id}/premium-book`);
    }
    if (end <= start) {
      req.flash('error', 'Check-out date must be after check-in date.');
      return res.redirect(`/bookings/listings/${listing._id}/premium-book`);
    }

    // Check overlapping bookings
    const overlap = await Booking.findOne({
      listing: listing._id,
      status: { $ne: 'canceled' },
      startDate: { $lt: end },
      endDate: { $gt: start }
    });

    if (overlap) {
      req.flash('error', 'This property is already booked for selected dates.');
      return res.redirect(`/bookings/listings/${listing._id}/premium-book`);
    }

    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const totalPrice = listing.price * nights;

    // Create Razorpay order (instead of directly saving booking)
    const options = {
      amount: totalPrice * 100, // in paise
      currency: "INR",
      receipt: `booking_${Date.now()}`,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);

    // Render a checkout page where Razorpay popup will open
    res.render('bookings/checkout', {
      listing,
      currentUser: req.user,
      orderId: order.id,
      amount: totalPrice,
      currency: 'INR',
      startDate,
      endDate,
      guests,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    console.error('Error in POST /premium-book:', err);
    req.flash('error', 'Something went wrong');
    return res.redirect(`/bookings/listings/${req.params.id}/premium-book`);
  }
});


// ===================== Verify Razorpay Payment & Create Booking =====================
router.post('/verify-payment', isLoggedIn, async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      listingId,
      startDate,
      endDate,
      guests
    } = req.body;

    // Verify signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid signature, payment verification failed'
      });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const totalPrice = listing.price * nights;

    // Double-check overlapping booking here as well
    const overlap = await Booking.findOne({
      listing: listing._id,
      status: { $ne: 'canceled' },
      startDate: { $lt: end },
      endDate: { $gt: start }
    });

    if (overlap) {
      return res.status(400).json({
        success: false,
        message: 'This property just got booked for these dates. Payment will be refunded by Razorpay.'
      });
    }

    // Create booking now that payment is successful
    const booking = new Booking({
      user: req.user._id,
      listing: listing._id,
      startDate: start,
      endDate: end,
      guests,
      totalPrice,
      status: 'pending',           // owner will confirm later
       paymentStatus: 'paid',
        paymentId: razorpay_payment_id,
        paymentOrderId: razorpay_order_id
    });

    await booking.save();

    const user = await User.findById(req.user._id);

    if (user && user.email) {
      await sendMail({
        to: user.email,
        subject: "Your Wandernext booking is created",
        html: emailTemplate({
          title: "Booking Created Successfully 🎉",
          message: `Hi ${user.username || "Traveler"}, <br>
            Your booking for <b>${listing.title}</b> has been created and is awaiting host confirmation.<br>
            Dates: <b>${start.toDateString()} - ${end.toDateString()}</b><br>
            Total: <b>₹${totalPrice}</b>`,
          buttonUrl: `${process.env.FRONTEND_URL || ""}/bookings`,
          buttonLabel: "View My Booking"
        })
      });
    }
     
    await createNotification(
      req.user._id,
      `Your booking for "${listing.title}" has been created and is awaiting host confirmation.`,
      "/bookings"
    );

    if (listing.owner) {
      await createNotification(
        listing.owner,
        `You have a new booking request for "${listing.title}".`,
        "/bookings/owner"
      );
    }


    return res.json({
      success: true,
      message: 'Payment verified & booking created',
      bookingId: booking._id
    });

  } catch (err) {
    console.error('Error in /verify-payment:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying payment'
    });
  }
});


// ===================== List User Bookings =====================
router.get('/', isLoggedIn, autoUpdateBookingStatus, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('listing')
      .sort({ createdAt: -1 })
      .lean();
    res.render('bookings/list', { bookings });
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

// ===================== Owner Bookings =====================
router.get('/owner', isLoggedIn, isOwner, autoUpdateBookingStatus, async (req, res) => {
  try {
    const listings = await Listing.find({ owner: req.user._id }).select('_id').lean();
    const listingIds = listings.map(l => l._id);

    const bookings = await Booking.find({ listing: { $in: listingIds } })
      .populate('user')
      .populate('listing')
      .sort({ createdAt: -1 })
      .lean();
    res.render('bookings/owner', { bookings });
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

// ===================== Confirm Booking =====================
router.patch('/:id/confirm', isLoggedIn, isOwner, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('listing');
    if (!booking) {
      req.flash('error', 'Booking not found');
      return res.redirect('/bookings/owner');
    }

    // Only owner of listing can confirm
    if (!booking.listing.owner.equals(req.user._id)) {
      req.flash('error', 'Not authorized to confirm this booking');
      return res.redirect('/bookings/owner');
    }

    booking.status = 'confirmed';
    await booking.save();

    // Email + Notification
    try {
      const user = await User.findById(booking.user);
      if (user && user.email) {
        await sendMail({
          to: user.email,
          subject: "Your Wandernext booking is confirmed ✅",
          html: emailTemplate({
            title: "Booking Confirmed ✅",
            message: `Hi ${user.username || "Traveler"}, <br>
              Your booking for <b>${booking.listing.title}</b> has been confirmed by the host.`,
            buttonUrl: `${process.env.FRONTEND_URL || ""}/bookings`,
            buttonLabel: "View Booking"
          })
        });
      }

      await createNotification(
        booking.user,
        `Your booking for "${booking.listing.title}" has been confirmed by the host.`,
        "/bookings"
      );
    } catch (err) {
      console.error("Confirm booking email/notification error:", err);
    }


    req.flash('success', 'Booking confirmed successfully!');
    res.redirect('/bookings/owner');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong');
    res.redirect('/bookings/owner');
  }
});

// ===================== Cancel Booking (PATCH) =====================
router.patch('/:id/cancel', isLoggedIn, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('listing');
    if (!booking) {
      req.flash('error', 'Booking not found');
      return res.redirect(req.user.role === 'owner' ? '/bookings/owner' : '/bookings');
    }

    const isUser = booking.user.equals(req.user._id);
    const isOwnerOfListing = req.user.role === 'owner' && booking.listing.owner.equals(req.user._id);

    if (!isUser && !isOwnerOfListing) {
      req.flash('error', 'Not authorized');
      return res.redirect(req.user.role === 'owner' ? '/bookings/owner' : '/bookings');
    }

    // AUTO-REFUND: only when owner cancels a paid booking
    if (isOwnerOfListing && booking.paymentStatus === 'paid' && booking.paymentId) {
      try {
        await razorpay.payments.refund(booking.paymentId, {
          amount: booking.totalPrice * 100
        });
        booking.paymentStatus = 'refunded';
      } catch (err) {
        console.error("Refund error:", err);
        req.flash('error', 'Refund could not be processed automatically. Please contact support.');
      }
    }

    booking.status = 'canceled';
    await booking.save();

    // EMAIL + NOTIFICATION to user
    try {
      const user = await User.findById(booking.user);
      if (user && user.email) {
        await sendMail({
          to: user.email,
          subject: "Your Wandernext booking was canceled",
          html: emailTemplate({
            title: "Booking Canceled",
            message: `Hi ${user.username || "Traveler"}, <br>
              Your booking for <b>${booking.listing.title}</b> was canceled ${
                isOwnerOfListing ? "by the host." : "by you."
              }<br>
              ${
                booking.paymentStatus === 'refunded'
                  ? "Your refund has been initiated and will reflect in your account shortly."
                  : "If any payment was made, applicable refund will be processed as per policy."
              }`,
            buttonUrl: `${process.env.FRONTEND_URL || ""}/bookings`,
            buttonLabel: "View Bookings"
          })
        });
      }

      await createNotification(
        booking.user,
        `Your booking for "${booking.listing.title}" was canceled ${isOwnerOfListing ? "by the host" : ""}.`,
        "/bookings"
      );
    } catch (err) {
      console.error("Cancel email/notification error:", err);
    }

    req.flash('success', 'Booking canceled successfully!');
    return res.redirect(req.user.role === 'owner' ? '/bookings/owner' : '/bookings');

  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong');
    return res.redirect(req.user.role === 'owner' ? '/bookings/owner' : '/bookings');
  }
});

// ===================== Delete Booking (DELETE) =====================
router.delete('/:id', isLoggedIn, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      req.flash('error', 'Booking not found');
      return res.redirect('/bookings');
    }

    // Allow user OR owner deleting canceled/completed bookings
    if (
      booking.user.equals(req.user._id) ||
      (req.user.role === 'owner')
    ) {
      await Booking.findByIdAndDelete(req.params.id);

      req.flash('success', 'Booking deleted successfully!');
      return res.redirect(req.user.role === 'owner' ? '/bookings/owner' : '/bookings');
    }

    req.flash('error', 'Not authorized');
    return res.redirect('/bookings');
  } catch (err) {
    console.log(err);
    req.flash('error', 'Something went wrong');
    res.redirect('/bookings');
  }
});

router.get("/:id/invoice", isLoggedIn, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({ path: "listing", populate: { path: "owner" } })
      .populate("user");

    if (!booking) {
      req.flash("error", "Booking not found");
      return res.redirect("/bookings");
    }

    const isUser = booking.user._id.equals(req.user._id);
    const isOwner = booking.listing.owner._id.equals(req.user._id);
    const isAdmin = req.user.role === "admin";

    if (!isUser && !isOwner && !isAdmin) {
      req.flash("error", "Not authorized");
      return res.redirect("/bookings");
    }

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${booking._id}.pdf`
    );
    doc.pipe(res);

    // THEME COLORS
    const GOLD = "#d4af37";
    const DARK = "#111111";
    const GRAY_BG = "#f4f4f4";
    const LINE = "#d0d0d0";

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // ---------- BACKGROUND ----------
    doc.rect(0, 0, pageWidth, pageHeight).fill(GRAY_BG);

    // ---------- CARD CONTAINER ----------
    doc
      .fillColor("white")
      .roundedRect(30, 30, pageWidth - 60, pageHeight - 60, 12)
      .fill();

    // INNER LAYOUT
    let y = 60;
    const leftX = 60;
    const rightX = pageWidth - 60;

    // Helper: divider line across card
    const drawLine = (yy) => {
      doc
        .moveTo(leftX, yy)
        .lineTo(rightX, yy)
        .strokeColor(LINE)
        .stroke();
    };

    // Helper: section title like [ BOOKING SUMMARY ]
    const sectionTitle = (text) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(GOLD)
        .text(`[ ${text} ]`, leftX, y);
      y = doc.y + 8;
      drawLine(y);
      y += 12;
      doc.fillColor(DARK).fontSize(11).font("Helvetica");
    };

    // ---------- MAIN TITLE ----------
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(DARK)
      .text("WANDERNEXT", leftX, y, { align: "left" });

    doc
      .font("Helvetica")
      .fontSize(14)
      .fillColor(DARK)
      .text("BOOKING INVOICE", leftX, y + 22);

    y += 60;
    drawLine(y);
    y += 18;

    const nights =
      (booking.endDate - booking.startDate) / (1000 * 60 * 60 * 24);

    // ---------- BOOKING SUMMARY ----------
    sectionTitle("BOOKING SUMMARY");

    const labelX = leftX;
    const valueX = leftX + 140;

    const addRow = (label, value) => {
      doc.font("Helvetica-Bold").fillColor(DARK).text(label, labelX, y);
      doc
        .font("Helvetica")
        .fillColor(DARK)
        .text(value || "-", valueX, y);
      y += 16;
    };

    addRow("Guest Name:", booking.user.username || booking.user.email);
    addRow("Email:", booking.user.email || "—");
    addRow("Listing:", booking.listing.title);
    addRow(
      "Location:",
      `${booking.listing.location}, ${booking.listing.country}`
    );
    addRow("Nights:", nights);
    addRow("Guests:", booking.guests);

    y += 10;

    // ---------- STAY DETAILS ----------
    sectionTitle("STAY DETAILS");

    addRow("Check-in:", booking.startDate.toDateString());
    addRow("Check-out:", booking.endDate.toDateString());
    addRow("Booking Status:", (booking.status || "").toUpperCase());

    y += 10;

    // ---------- PRICE BREAKDOWN ----------
    sectionTitle("PRICE BREAKDOWN");

    // Table columns
    const colDesc = leftX;
    const colQty = leftX + 220;
    const colPrice = leftX + 300;
    const colTotal = leftX + 390;

    // Header
    doc
      .font("Helvetica-Bold")
      .fillColor(DARK)
      .text("Description", colDesc, y);
    doc.text("Qty", colQty, y);
    doc.text("Price (₹)", colPrice, y);
    doc.text("Total (₹)", colTotal, y);
    y += 16;

    drawLine(y);
    y += 10;

    // Row helper
    const priceRow = (desc, qty, price, total) => {
      doc.font("Helvetica").fillColor(DARK);
      doc.text(desc, colDesc, y, { width: 200 });
      if (qty !== null) doc.text(String(qty), colQty, y);
      if (price !== null) doc.text(String(price), colPrice, y);
      doc.text(String(total), colTotal, y);
      y += 18;
    };

    const baseAmount = booking.listing.price * nights;
    const cleaningFee = 0;
    const taxes = 0;

    priceRow(`Nightly Rate`, nights, booking.listing.price, baseAmount);
    priceRow("Cleaning Fee", null, null, cleaningFee);
    priceRow("Taxes", null, null, taxes);

    drawLine(y);
    y += 8;

    // TOTAL
    doc.font("Helvetica-Bold").fillColor(DARK);
    doc.text("TOTAL PAID", colDesc, y);
    doc.text(`₹${booking.totalPrice}`, colTotal, y);
    y += 24;

    // ---------- PAYMENT DETAILS ----------
    sectionTitle("PAYMENT DETAILS");

    addRow("Payment ID:", booking.paymentId || "N/A");
    addRow("Order ID:", booking.paymentOrderId || "N/A");
    addRow(
      "Payment Status:",
      (booking.paymentStatus || "PAID").toUpperCase()
    );
    addRow("Invoice Date:", new Date().toDateString());

    y += 10;

    // ---------- PROPERTY IMAGE ----------
    sectionTitle("PROPERTY IMAGE");

    if (booking.listing.image?.url) {
      try {
        const imgResp = await axios.get(booking.listing.image.url, {
          responseType: "arraybuffer",
        });
        const imgBuffer = Buffer.from(imgResp.data);
        const imgHeight = 120;

        if (y + imgHeight > pageHeight - 120) {
          doc.addPage();
          // redrawing card bg on new page
          doc.rect(0, 0, pageWidth, pageHeight).fill(GRAY_BG);
          doc
            .fillColor("white")
            .roundedRect(30, 30, pageWidth - 60, pageHeight - 60, 12)
            .fill();
          y = 60;
        }

        doc.image(imgBuffer, leftX, y, { width: 220, height: imgHeight });
        y += imgHeight + 20;
      } catch (e) {
        doc
          .font("Helvetica")
          .fillColor(DARK)
          .text("Image could not be loaded.", leftX, y);
        y += 20;
      }
    } else {
      doc
        .font("Helvetica")
        .fillColor(DARK)
        .text("No image available for this property.", leftX, y);
      y += 20;
    }

    // ---------- QR CODE ----------
    sectionTitle("VERIFY INVOICE - QR CODE");

    const qrText = `Invoice: ${booking._id} | User: ${
      booking.user.email
    } | Amount: ₹${booking.totalPrice} | Status: ${
      booking.paymentStatus || "PAID"
    }`;

    const qrDataURL = await QRCode.toDataURL(qrText);
    const qrBuffer = Buffer.from(qrDataURL.split(",")[1], "base64");

    const qrSize = 110;
    if (y + qrSize + 100 > pageHeight - 60) {
      doc.addPage();
      doc.rect(0, 0, pageWidth, pageHeight).fill(GRAY_BG);
      doc
        .fillColor("white")
        .roundedRect(30, 30, pageWidth - 60, pageHeight - 60, 12)
        .fill();
      y = 60;
    }

    // Draw QR border
    doc
      .rect(leftX - 2, y - 2, qrSize + 4, qrSize + 4)
      .strokeColor(GOLD)
      .stroke();

    doc.image(qrBuffer, leftX, y, { width: qrSize, height: qrSize });

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(DARK)
      .text("Scan to verify invoice authenticity", leftX + qrSize + 15, y + 30);

    y += qrSize + 30;

    // ---------- SIGNATURE ----------
    sectionTitle("AUTHORIZED SIGNATURE");

    doc
      .font("Helvetica")
      .fillColor(DARK)
      .text("Authorized Signature:", leftX, y);
    y += 30;
    doc.text("______________________________", leftX, y);
    y += 40;

    drawLine(y);
    y += 20;

    // ---------- FOOTER (CENTERED) ----------
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#666")
      .text("Thank you for booking with WanderNext.", 0, y + 10, {
        align: "center",
      });
    doc.text(
      "This is a system-generated invoice. No physical signature is required.",
      {
        align: "center",
      }
    );
    doc.text("WanderNext © 2025", { align: "center" });

    doc.end();
  } catch (err) {
    console.error("Invoice Error:", err);
    req.flash("error", "Could not generate invoice");
    res.redirect("/bookings");
  }
});


// ===================== Payment Success / Failed Pages =====================
router.get('/payment-success', isLoggedIn, (req, res) => {
  res.render('bookings/bookingSuccess');
});

router.get('/payment-failed', isLoggedIn, (req, res) => {
  res.render('bookings/paymentFailed');
});

module.exports = router;
