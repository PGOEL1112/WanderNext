const rateLimit = require('express-rate-limit');

const createLimiter = (opts = {}) => {
  return rateLimit({
    windowMs: opts.windowMs || 15*60*1000,
    max: opts.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: opts.message || 'Too many requests, try again later.'
  });
};

module.exports = createLimiter;
