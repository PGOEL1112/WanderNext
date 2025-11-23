const express = require("express");
const router = express.Router();

// Example API route (Modify as needed)
router.get("/test", (req, res) => {
  res.json({ message: "API Working!" });
});

module.exports = router;
