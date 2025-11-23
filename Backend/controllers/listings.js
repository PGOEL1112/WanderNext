const Listing = require("../models/listing");
const { cloudinary } = require("../cloudinary");
const geocodeLocation = require("../utils/geocode"); // your custom geocode function
const mongoose = require("mongoose");

// ------------------ INDEX ------------------
// controllers/listingController.js

module.exports.index = async (req, res) => {
  const { category, search, minPrice, maxPrice, gst } = req.query;

  let query = {};

  if (category && category !== "all") {
    query.category = category;
  }

  if (search && search.trim() !== "") {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
      { country: { $regex: search, $options: "i" } },
    ];
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  let allListings = await Listing.find(query);

  // Apply GST if toggle is ON
  if (gst === "on") {
    allListings = allListings.map(listing => {
      return {
        ...listing._doc,
        price: Math.round(listing.price * 1.18)  // 18% GST
      };
    });
  }

  res.render("listings/index", { allListings, category, search, minPrice, maxPrice, gst });
};

// ------------------ NEW FORM ------------------
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new");
};

// ------------------ SHOW ------------------
module.exports.showRoute = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    req.flash('error', 'Invalid listing ID.');
    return res.redirect('/listings');
  }

  try {
    const listing = await Listing.findById(id)
      .populate({
        path: 'reviews',
        populate: { path: 'author' }
      })
      .populate('owner');

    if (!listing) {
      req.flash('error', 'Listing not found!');
      return res.redirect('/listings');
    }

    // Ensure geometry coordinates exist
    if (!listing.geometry || !Array.isArray(listing.geometry.coordinates)) {
      listing.geometry = {
        type: 'Point',
        coordinates: [78.9629, 20.5937] // default coords
      };
    }

    // Pass your MapTiler token here
    res.render('listings/show', {
      listing,
      mapToken: process.env.MAP_TOKEN // <--- important
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong.');
    res.redirect('/listings');
  }
};


// ------------------ CREATE ------------------
// ------------------ CREATE ------------------
module.exports.postRoute = async (req, res) => {
  try {
    // Validate req.body.listing exists
    if (!req.body.listing) {
      req.flash("error", "Form submission error. Please try again.");
      return res.redirect("/listings/new");
    }

    const { title, description, price, location, country, category } = req.body.listing;

    // Ensure required fields
    if (!title || !description || !price || !location || !country || !category) {
      req.flash("error", "Please fill in all required fields.");
      return res.redirect("/listings/new");
    }

    const listing = new Listing({
      title,
      description,
      price,
      location,
      country,
      category,
      owner: req.user._id
    });

    // Image check
    if (req.file) {
      listing.image = {
        url: req.file.path,
        filename: req.file.filename
      };
    } else {
      req.flash("error", "Please upload an image.");
      return res.redirect("/listings/new");
    }

    // Geocode location
    const geoData = await geocodeLocation(location);
    if (!geoData || geoData.length !== 2) {
      req.flash("error", "Could not fetch coordinates for this location.");
      return res.redirect("/listings/new");
    }

    listing.geometry = {
      type: "Point",
      coordinates: geoData
    };

    await listing.save();
    req.flash("success", "Listing created successfully!");
    res.redirect(`/listings/${listing._id}`);
  } catch (err) {
    console.error("Error creating listing:", err);
    req.flash("error", `Failed to create listing: ${err.message}`);
    res.redirect("/listings/new");
  }
};

// ------------------ EDIT ------------------
module.exports.editRoute = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }
  res.render("listings/edit", { listing });
};

// ------------------ UPDATE ------------------
module.exports.updateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    if (!req.body.listing) {
      req.flash("error", "Form submission error. Please try again.");
      return res.redirect(`/listings/${id}/edit`);
    }

    const { title, description, price, location, country, category } = req.body.listing;

    // Validate required fields
    if (!title || !description || !price || !location || !country || !category) {
      req.flash("error", "Please fill in all required fields.");
      return res.redirect(`/listings/${id}/edit`);
    }

    listing.title = title;
    listing.description = description;
    listing.price = price;
    listing.location = location;
    listing.country = country;
    listing.category = category;

    // Geocode location if changed
    const geoData = await geocodeLocation(location);
    if (!geoData || geoData.length !== 2) {
      req.flash("error", "Could not fetch coordinates for this location.");
      return res.redirect(`/listings/${id}/edit`);
    }
    listing.geometry = {
      type: "Point",
      coordinates: geoData
    };

    // Update image if uploaded
    if (req.file) {
      if (listing.image && listing.image.filename) {
        await cloudinary.uploader.destroy(listing.image.filename);
      }
      listing.image = {
        url: req.file.path,
        filename: req.file.filename
      };
    }

    await listing.save();
    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${listing._id}`);
  } catch (err) {
    console.error("Error updating listing:", err);
    req.flash("error", `Failed to update listing: ${err.message}`);
    res.redirect(`/listings/${req.params.id}/edit`);
  }
};
// ------------------ DELETE ------------------
module.exports.deleteRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    if (listing.image.filename) {
      await cloudinary.uploader.destroy(listing.image.filename);
    }

    await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing deleted successfully!");
    res.redirect("/listings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to delete listing.");
    res.redirect("/listings");
  }
};
