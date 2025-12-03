module.exports = function(allowedRoles) {
  return function(req, res, next) {
    if (!req.isAuthenticated()) {
      req.flash('error', 'You must be logged in.');
      return res.redirect('/login');
    }
    if (!allowedRoles.includes(req.user.role)) {
      req.flash('error', 'You do not have permission to perform this action.');
      return res.redirect('/listings');
    }
    next();
  }
}
