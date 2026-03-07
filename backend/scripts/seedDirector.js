const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const User = require("../models/User");

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Check backend/.env loading.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const exists = await User.findOne({ username: "orban" });
  if (exists) {
    console.log("Director already exists");
    await mongoose.disconnect();
    return;
  }

  const user = new User({
    fullName: "Mr. Orban",
    username: "orban",
    phone: "0755790611",
    role: "Director",
    branch: null,
    password: "12345678",
  });

  await user.save();
  console.log("Director created");
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
