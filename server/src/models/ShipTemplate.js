const mongoose = require('mongoose');

const shipTemplateSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 40,
  },
  shape: {
    type: [[Number]],
    required: true,
    validate: {
      validator: function (v) {
        return (
          Array.isArray(v) &&
          v.length <= 4 &&
          v.every((row) => Array.isArray(row) && row.length <= 4 && row.every((c) => c === 0 || c === 1))
        );
      },
      message: 'Shape must be a valid 4x4 grid of 0s and 1s',
    },
  },
  size: {
    type: Number,
    required: true,
    min: 1,
  },
  abilityType: {
    type: String,
    enum: ['linear', 'diagonal', 'random', 'target', 'sonar', 'scout_rocket', 'holy_bomb', 'ship_shape'],
    required: true,
  },
});

module.exports = mongoose.model('ShipTemplate', shipTemplateSchema);
