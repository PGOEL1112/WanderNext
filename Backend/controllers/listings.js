const Listing = require("../models/listing");
const { cloudinary } = require("../cloudinary");

module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index", { allListings });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new");
};

module.exports.showRoute = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");

  if (!listing) {
    req.flash("error", "❌ Cannot find that listing!");
    return res.redirect("/listings");
  }

  res.render("listings/show", { listing });
};

module.exports.postRoute = async (req, res) => {
  const listing = new Listing(req.body.listing);

  if (req.file) {
    listing.image = {
      url: req.file.path,
      filename: req.file.filename
    };
  } else {
    req.flash("error", "Please upload an image");
    return res.redirect("/listings/new");
  }

  listing.owner = req.user._id;
  await listing.save();

  req.flash("success", "Listing created successfully!");
  res.redirect(`/listings/${listing._id}`);
};

module.exports.editRoute = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  res.render("listings/edit", { listing });
};



// ✅ FIXED UPDATE ROUTE (no null errors now)
module.exports.updateRoute = async (req, res) => {
  const { id } = req.params;

  // Fetch first --- Prevents "listing is null" errors
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  // Update fields manually
  listing.title = req.body.listing.title;
  listing.description = req.body.listing.description;
  listing.price = req.body.listing.price;
  listing.location = req.body.listing.location;
  listing.country = req.body.listing.country;

  // Handle new uploaded image
  if (req.file) {
    // Delete old image
    if (listing.image && listing.image.filename) {
      try {
        await cloudinary.uploader.destroy(listing.image.filename);
      } catch (err) {
        console.log("Cloudinary deletion error:", err);
      }
    }

    // Save new image
    listing.image = {
      url: req.file.path,
      filename: req.file.filename
    };
  }

  await listing.save();

  req.flash("success", "Listing updated successfully!");
  res.redirect(`/listings/${listing._id}`);
};



// ✅ FIXED DELETE ROUTE (checks before deleting)
module.exports.deleteRoute = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  // Delete cloudinary image
  if (listing.image && listing.image.filename) {
    await cloudinary.uploader.destroy(listing.image.filename);
  }

  await Listing.findByIdAndDelete(id);

  req.flash("success", "Listing deleted successfully!");
  res.redirect("/listings");
};
