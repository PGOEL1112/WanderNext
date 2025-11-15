const Review = require("../models/reviews");
const ExpressError = require("../utils/ExpressError");
const {listingSchema, reviewSchema} = require("../schema");


module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in first!");
        return res.redirect("/login");
    }
    next();
};

module.exports.validateListing = (req,res, next) => {
    const {error}= listingSchema.validate(req.body);
    // Handling Error Via JOI
    if(error){
        const errMsg = error.details.map((ele) => ele.message).join(",");
        throw new ExpressError(400, errMsg);
    }
    else {
        next();
    }
}; 

module.exports.validateReviews = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((ele) => ele.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};


module.exports.saveRedirectUrl = (req,res,next) => {
    if(req.session.redirectUrl){
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

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

    if (!listing.owner._id.equals(req.user._id)) {
        req.flash("error", "You are not allowed to do that!");
        return res.redirect(`/listings/${id}`);
    }

    req.listing = listing;
    next();
};

module.exports.isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);

    if (!req.user) {
        req.flash("error", "You must be logged in!");
        return res.redirect("/login");
    }

    if (!review) {
        req.flash("error", "Review not found!");
        return res.redirect(`/listings/${id}`);
    }

    if (!review.author) {
        req.flash("error", "Review has no author field!");
        return res.redirect(`/listings/${id}`);
    }


    if (!review.author.equals(req.user._id)) {
        req.flash("error", "You are not the author of this review!");
        return res.redirect(`/listings/${id}`);
    }

    next();
};
