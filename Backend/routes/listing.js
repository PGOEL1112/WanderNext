const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync"); 
const { isLoggedIn, isOwner, validateListing } = require("../middleware/middleware");

// Multer setup for file uploads
const { upload } = require("../middleware/multer");

// Controllers
const listingController = require("../controllers/listings");

// =======================
// 1. NEW FORM
// Must come BEFORE "/" and "/:id"
// =======================
router.get("/new", isLoggedIn, listingController.renderNewForm);

// =======================
// 2. INDEX + CREATE
// =======================
router.route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    upload.single("imageFile"),
    validateListing,
    wrapAsync(listingController.postRoute)
  );

// =======================
// 3. EDIT FORM
// Must come BEFORE "/:id"
// =======================
router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.editRoute)
);

// =======================
// 4. SHOW + UPDATE + DELETE
// =======================
router.route("/:id")
  .get(wrapAsync(listingController.showRoute))
  .put(
    isLoggedIn,
    isOwner,
    upload.single("imageFile"),
    validateListing,
    wrapAsync(listingController.updateRoute)
  )
  .delete(
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.deleteRoute)
  );

module.exports = router;
