const mongoose = require("mongoose");
const { Schema } = mongoose;

const ownerApplicationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  fullName: String,
  phone: String,
  address: String,
  govtId: String, // store file path or filename
  propertyDetails: String,
  proofFiles: [String], // array of uploaded proof filenames/paths
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  adminNote: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("OwnerApplication", ownerApplicationSchema);
