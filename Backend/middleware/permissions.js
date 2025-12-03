module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        req.flash("error", "You must be logged in first.");
        return res.redirect("/login");
    }
    next();
};

module.exports.isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
        req.flash("error", "Only admins can access this page.");
        return res.redirect("/");
    }
    next();
};

module.exports.requireOwner = (req, res, next) => {
    if (!req.user || req.user.role !== "owner") {
        req.flash("error", "Only owners can access this page.");
        return res.redirect("/");
    }
    next();
};
