const Review = require("../models/reviews");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");
const { listingSchema, reviewSchema } = require("../schema");

// isLoggedIn
module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You must be logged in first!");
    return res.redirect("/login");
  }
  next();
};

module.exports.isAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  req.flash('error', 'Admins only.');
  return res.redirect('/');
};

// validateListing
module.exports.validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    req.flash("error", error.details.map(el => el.message).join(", "));
    return res.redirect("back");
  }
  next();
};

// validateReviews
module.exports.validateReviews = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((ele) => ele.message).join(",");
    throw new ExpressError(400, errMsg);
  }
  next();
};

// saveRedirectUrl
module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
    delete req.session.redirectUrl;
  }
  next();
};

// isOwner (enforce owner or admin)
module.exports.isOwner = async (req, res, next) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "❌ Listing not found!");
    return res.redirect("/listings");
  }
  if (!req.user) {
    req.flash("error", "You must be logged in!");
    return res.redirect("/login");
  }
  // allow admin or owner
  if (req.user.role === 'admin' || listing.owner.equals(req.user._id)) {
    req.listing = listing;
    return next();
  }
  req.flash("error", "You are not allowed to do that!");
  return res.redirect(`/listings/${id}`);
};

// isReviewAuthor
module.exports.isReviewAuthor = async (req, res, next) => {
  const { reviewId, id } = req.params;
  const review = await Review.findById(reviewId);
  if (!req.user) {
    req.flash("error", "You must be logged in!");
    return res.redirect("/login");
  }
  if (!review) {
    req.flash("error", "Review not found!");
    return res.redirect(`/listings/${id}`);
  }
  if (!review.author.equals(req.user._id)) {
    req.flash("error", "You are not the author of this review!");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

