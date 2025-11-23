const axios = require('axios');

const geocodeLocation = async (location) => {
  try {
    const response = await axios.get(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(location)}.json?key=${process.env.MAP_TOKEN}`
    );

    const data = response.data;
    if (!data.features || data.features.length === 0) {
      throw new Error('Location not found');
    }

    const [lng, lat] = data.features[0].geometry.coordinates;
    return [lng, lat];
  } catch (err) {
    console.error('Geocoding error:', err);
    throw err;
  }
};

module.exports = geocodeLocation;
