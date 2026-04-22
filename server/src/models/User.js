const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    maxlength: 32,
  },
  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
  },
  passwordHash: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  favoriteShips: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ShipTemplate',
      },
    ],
    default: [],
  },
  favoriteBoards: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BoardTemplate',
      },
    ],
    default: [],
  },
});

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  if (!obj.username) obj.username = obj.email.split('@')[0];
  return obj;
};

module.exports = mongoose.model('User', userSchema);
