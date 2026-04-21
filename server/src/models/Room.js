const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  players: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      ready: { type: Boolean, default: false },
    },
  ],
  settings: {
    boardSize: { type: Number, default: 10, min: 10, max: 25 },
    turnTimeLimit: { type: Number, default: 60 },
    password: { type: String, default: null },
    boardTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoardTemplate', default: null },
  },
  status: {
    type: String,
    enum: ['waiting', 'setup', 'in_game', 'finished'],
    default: 'waiting',
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Room', roomSchema);
