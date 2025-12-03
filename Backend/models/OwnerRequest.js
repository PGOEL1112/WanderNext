// Backend/models/OwnerRequest.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const ownerRequestSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // ek user ki 1 active request
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    govIdType: {
      type: String,
      enum: ["aadhaar", "pan", "passport", "other", ""],
      default: "",
    },

    govIdNumber: {
      type: String,
      trim: true,
    },

    propertyType: {
      type: String,
      trim: true, // e.g. "Apartment", "Villa", "Homestay"
    },

    propertyCount: {
      type: Number,
      default: 1,
    },

    message: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OwnerRequest", ownerRequestSchema);
