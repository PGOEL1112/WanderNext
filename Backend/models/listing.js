const { ref } = require("joi");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./reviews");


const listentingSchema = new Schema({
    title : {
        type : String,
        required : true,
    },

    description : {
        type : String,
        required : true,
    },

    image : {
        type : String,
        required : true,
        
    },

    price : {
        type : Number,
        required : true,
    },

    location : {
        type : String,
        required : true,
    },

    country : {
        type : String,
        required : true,
    },

    reviews : [
        {
            type : Schema.Types.ObjectId,
            ref : "Review",
        },
    ]
});
listentingSchema.post("findOneAndDelete", async(listing) => {
    if(listing){
        await  Review.deleteMany({_id : {$in: listing.reviews}});
    }
});

const Listing = mongoose.model("Listing", listentingSchema);
module.exports  = Listing;