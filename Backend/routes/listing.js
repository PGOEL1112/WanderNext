const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");
const {listingSchema} = require("../schema");
const Listing = require("../models/listing"); 


// Middleware ----> for handling error through validateListing
const validateListing = (req,res, next) => {
    let {error}= listingSchema.validate(req.body);
    
    // Handling Error Via JOI
    if(error){
        let errMsg = error.details.map((ele) => ele.message).join(",");
        throw new ExpressError(400, errMsg);
    }
    else {
        next();
    }
}; 


// -------------> 2. Index Route
router.get("/", wrapAsync(async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index", { allListings });
}));

// -----------------> 3. Create Route
router.get("/new", (req,res) => {
     res.render("listings/new");
});


//  Create route - handle form POST Submission
router.post("/", validateListing, wrapAsync (async (req, res) => {
    const newListing = new Listing(req.body.listing);
    await newListing.save();
    req.flash("success", "✅ New Listing Created! Successfully")
    res.redirect("/listings");
}));


// ------------> 4. Show Route 
router.get("/:id", wrapAsync(async(req,res) => {
    const {id} =req.params;
    const listing =  await Listing.findById(id).populate("reviews");
    if (!listing) {
        req.flash("error", "❌ Cannot find that listing!");
        return res.redirect("/listings");
    }
    res.render("listings/show", {listing});
}));

// -----------> 5. Edit Route
router.get("/:id/edit", wrapAsync(async (req,res) => {
    const {id} =req.params;
    const listing =  await Listing.findById(id); 
    if (!listing) {
        req.flash("error", "❌ Cannot find that listing to edit!");
        return res.redirect("/listings");
  }
    res.render("listings/edit", {listing});
}));

// --------------> Update Route 
router.put("/:id", validateListing, wrapAsync(async (req,res) => {
    const {id} = req.params;
    await Listing.findByIdAndUpdate(id, req.body.listing, { new: true });
    req.flash("success", "✅ Listing updated successfully!");
    res.redirect(`/listings/${listing._id}`);
}));

// -------------> 6. Delete Route
router.delete("/:id", wrapAsync(async (req,res) => {
    const {id} = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "✅ Listing deleted successfully!");
    res.redirect("/listings");
}));

module.exports = router;