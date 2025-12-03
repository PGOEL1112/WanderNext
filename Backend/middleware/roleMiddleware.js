// middleware/roleMiddleware.js
module.exports = {
  isLoggedIn: (req, res, next) => {
    if (!req.isAuthenticated()) {
      req.flash('error', 'You must be logged in to access this page.');
      return res.redirect('/login');
    }
    next();
  },

  isAdmin: (req, res, next) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      req.flash('error', 'Admin access required.');
      return res.redirect('/login');
    }
    next();
  },

  isOwnerOrAdmin: (req, res, next) => {
    if (!req.isAuthenticated()) {
      req.flash('error', 'Login required.');
      return res.redirect('/login');
    }
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/listings');
    }
    next();
  }
};
