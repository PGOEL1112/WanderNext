const Listing = require("../models/listing");

module.exports.savedListings = async (req, res) => {
    const user = await req.user.populate("savedListings");
    res.render("users/saved", { saved: user.savedListings });
};

module.exports.viewSavedUsers = async (req, res) => {
  const listing = await Listing.findById(req.params.id)
    .populate("savedBy", "username email");

  res.render("listings/savedUsers", { listing });
};