const Listing = require("../models/listing");
const { cloudinary } = require("../cloudinary");
const geocodeLocation = require("../utils/geocode"); // your custom geocode function
const mongoose = require("mongoose");
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/user');


// ------------------ INDEX ------------------
module.exports.index = async (req, res) => {
  try {
    let {
      category = "all",
      search = "",
      minPrice = "",
      maxPrice = "",
      gst = "",
      amenity = "",
      sort = ""
    } = req.query;

    // Build Query
    let query = {};

    // CATEGORY FILTER
    if (category && category !== "all") {
      query.category = category;
    }

    // SEARCH FILTER
    if (search.trim() !== "") {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { country: { $regex: search, $options: "i" } }
      ];
    }

    // PRICE FILTER
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // AMENITIES FILTER (multi)
    if (amenity && amenity !== "all") {
      if (Array.isArray(amenity)) {
        query.amenities = { $all: amenity };
      } else {
        query.amenities = { $in: [amenity] };
      }
    }

    // FETCH LISTINGS — IMPORTANT: KEEP createdAt
    // SORTING FIX (FULLY CORRECT)
let sortOption = {};
if (sort === 'priceLow') sortOption.price = 1;
else if (sort === 'priceHigh') sortOption.price = -1;
else if (sort === 'recent') sortOption.createdAt = -1;

// Fetch listings once, with sorting
let allListings = await Listing.find(query).sort(sortOption).lean();

// Apply GST/Final price
allListings = allListings.map(listing => {
  listing.finalPrice = gst === "on"
    ? Math.round(listing.price * 1.18)
    : listing.price;
  return listing;
});


    res.render("listings/index", {
      allListings,
      category,
      search,
      minPrice,
      maxPrice,
      gst,
      amenity,
      sort,
      currentUser: req.user || null
    });

  } catch (err) {
    console.log(err);
    req.flash("error", "Could not load listings");
    res.redirect("/");
  }
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

  const listing = await Listing.findById(id)
    .populate({ path: 'reviews', populate: { path: 'author', select: 'username' } })
    .populate({ path: 'owner', select: 'username email role' })
    .populate({ path: 'savedBy', select: 'username email' }); // populate saved users

  if (!listing) {
    req.flash('error', 'Listing not found!');
    return res.redirect('/listings');
  }

  // Default coordinates if missing
  if (!listing.geometry || !Array.isArray(listing.geometry.coordinates)) {
    listing.geometry = { type: 'Point', coordinates: [78.9629, 20.5937] };
  }

  // Track recently viewed
  if (req.user) {
    const user = await User.findById(req.user._id);
    user.recentlyViewed = user.recentlyViewed.filter(x => !x.equals(listing._id));
    user.recentlyViewed.unshift(listing._id);
    if (user.recentlyViewed.length > 10) user.recentlyViewed.pop();
    await user.save();
  }

  // Pass mapToken to template
  res.render('listings/show', { listing, currentUser: req.user, mapToken: process.env.MAP_TOKEN });
};



module.exports.postRoute = async (req, res) => {
  try {
    if (!req.body.listing) {
      req.flash("error", "Invalid form submission.");
      return res.redirect("/listings/new");
    }

    const { title, description, price, location, country, category, amenities } = req.body.listing;

    // Required fields check
    if (!title || !description || !price || !location || !country || !category) {
      req.flash("error", "Please fill all required fields.");
      return res.redirect("/listings/new");
    }

    // Convert amenities into an array always
    const amenitiesArray = amenities
      ? Array.isArray(amenities)
        ? amenities
        : [amenities]
      : [];

    const listing = new Listing({
      title,
      description,
      price,
      location,
      country,
      category,
      amenities: amenitiesArray,
      owner: req.user._id,
    });

    // Image required
    if (!req.file) {
      req.flash("error", "Please upload an image.");
      return res.redirect("/listings/new");
    }

    listing.image = {
      url: req.file.path,
      filename: req.file.filename,
    };

    // GeoCoding
    const geoData = await geocodeLocation(location);
    if (!geoData || geoData.length !== 2) {
      req.flash("error", "Unable to fetch location coordinates.");
      return res.redirect("/listings/new");
    }

    listing.geometry = {
      type: "Point",
      coordinates: geoData,
    };

    await listing.save();

    req.flash("success", "Listing created successfully!");
    res.redirect(`/listings/${listing._id}`);
  } catch (err) {
    console.error("Error creating listing:", err);
    req.flash("error", "Failed to create listing.");
    res.redirect("/listings/new");
  }
};

// ------------------ EDIT ------------------
module.exports.editRoute = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id).populate('owner');
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
      req.flash("error", "Listing not found.");
      return res.redirect("/listings");
    }

    if (!req.body.listing) {
      req.flash("error", "Invalid form submission.");
      return res.redirect(`/listings/${id}/edit`);
    }

    const { title, description, price, location, country, category, amenities } = req.body.listing;

    // Required fields
    if (!title || !description || !price || !location || !country || !category) {
      req.flash("error", "Please fill all required fields.");
      return res.redirect(`/listings/${id}/edit`);
    }

    // Update fields
    listing.title = title;
    listing.description = description;
    listing.price = price;
    listing.location = location;
    listing.country = country;
    listing.category = category;

    // Amenities array handling
    listing.amenities = amenities
      ? Array.isArray(amenities)
        ? amenities
        : [amenities]
      : [];

    // Geocode if location changed
    const geoData = await geocodeLocation(location);
    if (!geoData || geoData.length !== 2) {
      req.flash("error", "Unable to fetch location coordinates.");
      return res.redirect(`/listings/${id}/edit`);
    }

    listing.geometry = {
      type: "Point",
      coordinates: geoData,
    };

    // Update image if new uploaded
    if (req.file) {
      if (listing.image?.filename) {
        await cloudinary.uploader.destroy(listing.image.filename);
      }

      listing.image = {
        url: req.file.path,
        filename: req.file.filename,
      };
    }

    await listing.save();

    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${listing._id}`);
  } catch (err) {
    console.error("Error updating listing:", err);
    req.flash("error", "Failed to update listing.");
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

module.exports.saveListing = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(req.user._id);
  const listing = await Listing.findById(id);
  if (!listing) return res.json({ ok: false });

  const alreadySaved = user.savedListings.some(s => s.toString() === id.toString());

  if (alreadySaved) {
    user.savedListings = user.savedListings.filter(s => s.toString() !== id.toString());
    listing.savedBy = (listing.savedBy || []).filter(u => u.toString() !== user._id.toString());
    await user.save();
    await listing.save();
    return res.json({ ok: true, saved: false });
  } else {
    user.savedListings.push(listing._id);
    listing.savedBy = listing.savedBy || [];
    listing.savedBy.push(user._id);
    await user.save();
    await listing.save();
    return res.json({ ok: true, saved: true });
  }
};

