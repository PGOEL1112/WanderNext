// fixOwners.js
// Usage: node fixOwners.js [ownerIdentifier]
// ownerIdentifier can be: userId | username | email
// IMPORTANT: Backup your DB before running any mass update.

const mongoose = require('mongoose');
const Listing = require('./models/listing');
const User = require('./models/user');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://priyanshu11goel_db_user:wOUnOgzlRWlnefS0@cluster0.0ephqqr.mongodb.net/WanderNext?retryWrites=true&w=majority";

async function findOwner(identifier) {
  if (!identifier) return null;

  // try as ObjectId
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const byId = await User.findById(identifier).lean();
    if (byId) return byId;
  }

  // try email
  let user = await User.findOne({ email: identifier }).lean();
  if (user) return user;

  // try username
  user = await User.findOne({ username: identifier }).lean();
  if (user) return user;

  return null;
}

function looksLikeUnknownOwner(o) {
  if (o === undefined || o === null) return true;
  if (typeof o === 'string' && (o.trim() === '' || o.trim().toLowerCase() === 'unknown')) return true;
  return false;
}

async function fixOwners() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('🔌 Connected to MongoDB');

    const arg = process.argv[2]; // optional owner identifier (id / username / email)

    let owner = null;
    if (arg) {
      owner = await findOwner(arg);
      if (!owner) {
        console.warn(`⚠ No user found for identifier "${arg}". Will fallback to first user with role 'owner' if available.`);
      }
    }

    if (!owner) {
      owner = await User.findOne({ role: 'owner' }).lean();
    }

    if (!owner) {
      console.error('⛔ No owner user found. Create an owner user first or run with an owner identifier.');
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Using owner: ${owner.username || owner.email || owner._id} (${owner._id})`);

    // Fetch all listings (could be filtered; you can adjust to limit)
    const listings = await Listing.find().lean();

    const toUpdate = []; // { listingId, reason, originalOwner, resolvedOwnerId }
    const unresolvedStringOwners = []; // to attempt mapping username->user
    const orphanedOwnerIds = new Set();

    // Build set of owner ids referenced in listings that look like ObjectIds
    const referencedOwnerIds = listings
      .map(l => l.owner)
      .filter(Boolean)
      .filter(o => typeof o !== 'string' || mongoose.Types.ObjectId.isValid(String(o)))
      .map(o => String(o));

    // Pre-fetch users for referencedOwnerIds to see which ones exist
    const existingUsers = referencedOwnerIds.length ? await User.find({ _id: { $in: referencedOwnerIds } }, { _id: 1 }).lean() : [];
    const existingOwnerIdSet = new Set(existingUsers.map(u => String(u._id)));

    for (const l of listings) {
      const ow = l.owner;

      // Case 1: totally missing / null / empty / 'unknown'
      if (looksLikeUnknownOwner(ow)) {
        toUpdate.push({
          listingId: l._id,
          reason: 'missing owner',
          originalOwner: ow,
          resolvedOwnerId: owner._id
        });
        continue;
      }

      // Case 2: owner stored as non-ObjectId string (probably username/email)
      if (typeof ow === 'string' && !mongoose.Types.ObjectId.isValid(ow)) {
        // try to resolve: username -> user, or email -> user
        const foundUser = await User.findOne({ $or: [{ username: ow }, { email: ow }] }).lean();
        if (foundUser) {
          // resolved to an existing user, no reassign to default owner
          // but we still ensure the listing owner is set to the user's _id (ObjectId)
          toUpdate.push({
            listingId: l._id,
            reason: `resolved owner string "${ow}" -> user ${foundUser._id}`,
            originalOwner: ow,
            resolvedOwnerId: foundUser._id
          });
        } else {
          // couldn't resolve the string -> reassign to fallback owner
          toUpdate.push({
            listingId: l._id,
            reason: `unresolved owner string "${ow}"`,
            originalOwner: ow,
            resolvedOwnerId: owner._id
          });
        }
        continue;
      }

      // Case 3: owner looks like ObjectId but referenced user missing (orphaned)
      if (mongoose.Types.ObjectId.isValid(String(ow)) && !existingOwnerIdSet.has(String(ow))) {
        orphanedOwnerIds.add(String(ow));
        toUpdate.push({
          listingId: l._id,
          reason: `orphaned owner id ${String(ow)}`,
          originalOwner: String(ow),
          resolvedOwnerId: owner._id
        });
        continue;
      }

      // otherwise assume owner is valid -> nothing to do
    }

    console.log(`🟦 Found ${toUpdate.length} listings that look like they need owner fixing.`);
    if (orphanedOwnerIds.size) {
      console.log(`⚠ ${[...orphanedOwnerIds].length} listings reference non-existent owner ids (they will be reassigned).`);
    }

    if (!toUpdate.length) {
      console.log('🎉 Nothing to update!');
      await mongoose.disconnect();
      return;
    }

    // Confirm action summary
    console.log('Summary (first 10 shown):');
    toUpdate.slice(0, 10).forEach(t => {
      console.log(` - Listing ${t.listingId}: ${t.reason} -> assign ${t.resolvedOwnerId}`);
    });

    // Proceed with updates - loop and update so we get per-document logging
    let updatedCount = 0;
    for (const t of toUpdate) {
      try {
        // Use findByIdAndUpdate to ensure correct ObjectId assignment (owner._id is already an ObjectId)
        const res = await Listing.findByIdAndUpdate(t.listingId, { $set: { owner: t.resolvedOwnerId } }, { new: true });
        if (res) {
          updatedCount++;
          console.log(`✔ Updated listing ${t.listingId} — reason: ${t.reason}`);
        } else {
          console.warn(`⚠ Could not update listing ${t.listingId} (not found)`);
        }
      } catch (err) {
        console.error(`❌ Failed to update listing ${t.listingId}:`, err.message || err);
      }
    }

    console.log(`\n🎉 DONE — Updated ${updatedCount} listings. (${toUpdate.length - updatedCount} failed)`);
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (err) {
    console.error('❌ Error running fixOwners:', err);
    try { await mongoose.disconnect(); } catch(e) {}
    console.log('🔌 Disconnected from MongoDB (after error)');
  }
}

fixOwners();
