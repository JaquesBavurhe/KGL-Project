// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    minlength: 2,
    trim: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 2,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    match: /^(\+256|0)[0-9]{9}$/, // Uganda phone format
  },
  branch: {
    type: String,
    enum: ['Maganjo', 'Matugga'],
    default: null, // Director doesn’t need a branch
  },
  role: {
    type: String,
    enum: ['Director', 'Manager', 'Sales Agent'],
    required: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    // Note: hash before saving (using bcrypt)
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});


userSchema.pre('save', async(next)=> {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});


module.exports = mongoose.model('User', userSchema);
