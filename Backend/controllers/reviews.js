const Review = require("../models/reviews");
const Listing = require("../models/listing");


module.exports.creatReview = async (req, res) => {

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
};

module.exports.destroyReview = async (req, res) => {
  const { id, reviewId } = req.params;
  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "✅ Review deleted successfully!");
  res.redirect(`/listings/${id}`);
};

