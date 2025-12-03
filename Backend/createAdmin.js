const mongoose = require('mongoose');
const User = require('./models/user');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.ATLAS_DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function createAdmin() {
  const existing = await User.findOne({ email: 'admin@example.com' });
  if (existing) {
    console.log('Admin already exists');
    return process.exit(0);
  }

  const admin = new User({ username: 'admin', email: 'admin@example.com', role: 'admin', isVerified: true });
  await User.register(admin, 'Admin@123'); // password
  console.log('Admin created successfully!');
  process.exit(0);
}

createAdmin();
