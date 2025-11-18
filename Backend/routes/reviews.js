const express = require("express");
const router = express.Router({ mergeParams: true }); // ✅ important!
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isReviewAuthor , validateReviews} = require("../middleware/middleware");

const ReviewControllers = require("../controllers/reviews");


// -------------> Create Review
router.post("/", isLoggedIn,validateReviews, wrapAsync(ReviewControllers.creatReview));

// -------------> Delete Review
router.delete("/:reviewId", isLoggedIn,isReviewAuthor,wrapAsync(ReviewControllers.destroyReview));


module.exports = router;
