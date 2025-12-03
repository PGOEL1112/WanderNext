const express = require('express');
const router = express.Router();
const User = require('../models/user');

router.post('/:id/toggle', async (req, res) => {
  if (!req.isAuthenticated() || !req.user) return res.status(401).json({ ok:false });
  const user = await User.findById(req.user._id);
  const idx = user.savedListings.findIndex(x => x.equals(req.params.id));
  if (idx === -1) user.savedListings.push(req.params.id);
  else user.savedListings.splice(idx,1);
  await user.save();
  res.json({ ok:true, saved: idx===-1 });
});

module.exports = router;
