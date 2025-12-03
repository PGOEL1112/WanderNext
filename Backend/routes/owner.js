const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");
const { isLoggedIn, requireOwner } = require("../middleware/permissions");

// OWNER DASHBOARD
router.get("/dashboard", isLoggedIn, requireOwner, async (req, res) => {
    const myListings = await Listing.find({ owner: req.user._id });
    res.render("owner/dashboard", { myListings });
});

// CREATE LISTING FORM
router.get("/new", isLoggedIn, requireOwner, (req, res) => {
    res.render("owner/new");
});

// CREATE LISTING
router.post("/new", isLoggedIn, requireOwner, async (req, res) => {
    const listing = new Listing(req.body.listing);
    listing.owner = req.user._id;
    await listing.save();

    req.flash("success", "Listing created!");
    res.redirect("/owner/dashboard");
});

// MY LISTINGS PAGE
router.get("/my-listings", isLoggedIn, requireOwner, async (req, res) => {
    const listings = await Listing.find({ owner: req.user._id });
    res.render("owner/myListings", { listings });
});

module.exports = router;
