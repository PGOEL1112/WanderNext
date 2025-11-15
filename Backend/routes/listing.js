const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const Listing = require("../models/listing"); 
const { isLoggedIn , isOwner, validateListing } = require("../middleware/middleware");


// -------------> 2. Index Route
router.get("/", wrapAsync(async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index", { allListings });
}));

// -----------------> 3. Create Route
router.get("/new", isLoggedIn, (req, res) => {
    res.render("listings/new");
});


//  Create route - handle form POST Submission
router.post("/", isLoggedIn, validateListing, wrapAsync(async (req, res) => {
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    await newListing.save();
    req.flash("success", "✅ Listing Created Successfully!");
    res.redirect(`/listings/${newListing._id}`);
}));


// ------------> 4. Show Route 
router.get("/:id",  wrapAsync(async(req,res) => {
    const {id} =req.params;
    const listing =  await Listing.findById(id).populate({path : "reviews", populate : {path: "author"}}).populate("owner");
    if (!listing) {
        req.flash("error", "❌ Cannot find that listing!");
        return res.redirect("/listings");
    }
    res.render("listings/show", {listing});
}));

// -----------> 5. Edit Route
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(async (req,res) => {
    const {id} =req.params;
    const listing =  await Listing.findById(id); 
    if (!listing) {
        req.flash("error", "❌ Cannot find that listing to edit!");
        return res.redirect("/listings");
  }
    res.render("listings/edit", {listing});
}));

// --------------> Update Route 
router.put("/:id", isLoggedIn, isOwner, validateListing, wrapAsync(async (req,res) => {
    const {id} = req.params;
    const listing = await Listing.findByIdAndUpdate(id, req.body.listing, { new: true });
    req.flash("success", "✅ Listing updated successfully!");
    res.redirect(`/listings/${listing._id}`);

}));

// -------------> 6. Delete Route
router.delete("/:id", isLoggedIn, isOwner, wrapAsync(async (req,res) => {
    const {id} = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "✅ Listing deleted successfully!");
    res.redirect("/listings");
}));

module.exports = router;