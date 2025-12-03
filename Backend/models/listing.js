const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./reviews");

const listingSchema = new Schema({
    title: {
        type: String,
        required: true,
    },

    description: {
        type: String,
        required: true,
    },

    image: {
        url: {
            type: String,
            required: true,
        },
        filename: {
            type: String,
            required: true,
        }
    },

    price: {
        type: Number,
        required: true,
    },

    location: {
        type: String,
        required: true,
    },

    country: {
        type: String,
        required: true,
    },

    category: {
        type: String,
        required:true,
        enum: ['beach','mountain','villa','trending','city','camping','luxury','historic','all'],
    },

    // ⭐ IMPORTANT FOR MAP
    geometry: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        coordinates: {
            type: [Number], // [lng, lat]
            default : [77.2090,28.6139],
            required: true
        }
    },

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    reviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Review"
        }
    ],
    savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    amenities: {
        type: [String],
        default: []
    },

},{ timestamps: true });

// Delete related reviews when listing is deleted
listingSchema.post("findOneAndDelete", async function (listing) {
    if (listing) {
        await Review.deleteMany({ _id: { $in: listing.reviews } });
    }
});

module.exports = mongoose.model("Listing", listingSchema);
