const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema({
    email: { 
      type: String, 
      required: true, 
      unique: true 
    },
    
    username: { 
      type: String, 
      required: true 
    },
    
    // password handled by passport-local-mongoose
    role: { type: String, enum: ['user','owner','admin'], default: 'user' },

    // email verification
    isVerified: { 
      type: Boolean, 
      default: false 
    },

    verifyToken: String,
    verifyTokenExpires: Date,

    // password reset
    resetToken: String,
    resetTokenExpires: Date,

    profileImage: {
      url: String,
      filename: String
    },

    bio: {
      type: String,
      default: ""
    },

    phone: {
      type: String,
      default: ""
    },
    
    // wishlist & activity
    savedListings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
    recentlyViewed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],

    // login tracking
    lastLoginAt: Date,
    lastLoginIP: String,

    loginCount: { 
      type: Number, 
      default: 0 
    }
  }, 
  
  { timestamps: true });

    // plugin adds username, hash, salt, setPassword, authenticate
    userSchema.plugin(passportLocalMongoose, { usernameField: 'username' });

module.exports = mongoose.model("User", userSchema);
