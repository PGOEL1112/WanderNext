const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync"); 
const { isLoggedIn , isOwner, validateListing } = require("../middleware/middleware");

// IMPORT CORRECT UPLOAD
const { upload } = require("../middleware/multer");

// Controllers
const listingController = require("../controllers/listings");


// 1. Index + Create
router.route("/")
    .get(wrapAsync(listingController.index))
    .post(
        isLoggedIn,
        upload.single("imageFile"),
        validateListing,
        wrapAsync(listingController.postRoute)
    );

// 2. New Form
router.get("/new", isLoggedIn, listingController.renderNewForm);


// 3. EDIT ROUTE — MUST COME BEFORE "/:id"
router.get(
    "/:id/edit",
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.editRoute)
);


// 4. Show + Update + Delete
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
