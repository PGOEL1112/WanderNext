const express = require("express");
const router = express.Router({ mergeParams: true }); // ✅ important!
const wrapAsync = require("../utils/wrapAsync");
const Review = require("../models/reviews");
const Listing = require("../models/listing");
const { isLoggedIn, isReviewAuthor , validateReviews} = require("../middleware/middleware");



// -------------> Create Review
router.post("/", isLoggedIn,validateReviews, wrapAsync(async (req, res) => {

  if (!req.user || !req.user._id) {
    req.flash("error", "You must be logged in to add a review!");
    return res.redirect("/login");
  }

  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    req.flash("error", "❌Listing not found!");
    return res.redirect("/listings");
  }

  const newReview = new Review(req.body.review);
  newReview.author = req.user._id;
  listing.reviews.push(newReview);
  await newReview.save();
  await listing.save();

   req.flash("success", "✅ Successfully added your review!");
  res.redirect(`/listings/${listing._id}`);
}));

// -------------> Delete Review
router.delete("/:reviewId", isLoggedIn,isReviewAuthor,wrapAsync(async (req, res) => {
  const { id, reviewId } = req.params;
  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "✅ Review deleted successfully!");
  res.redirect(`/listings/${id}`);
}));

module.exports = router;
