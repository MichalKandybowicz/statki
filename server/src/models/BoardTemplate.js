const mongoose = require('mongoose');

const boardTemplateSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  size: {
    type: Number,
    required: true,
    min: 10,
    max: 25,
  },
  tiles: {
    type: [[String]],
    required: true,
    validate: {
      validator: function (v) {
        const validTiles = new Set(['water', 'rock']);
        return (
          Array.isArray(v) &&
          v.every((row) => Array.isArray(row) && row.every((tile) => validTiles.has(tile)))
        );
      },
      message: "Tiles must only contain 'water' or 'rock'",
    },
  },
});

module.exports = mongoose.model('BoardTemplate', boardTemplateSchema);
