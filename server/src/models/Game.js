const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema(
  { x: Number, y: Number },
  { _id: false }
);

const shipStateSchema = new mongoose.Schema(
  {
    shipTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShipTemplate' },
    name: { type: String, default: 'Statek' },
    abilityType: { type: String, default: null },
    positions: [positionSchema],
    hits: [positionSchema],
    isSunk: { type: Boolean, default: false },
    cooldownRemaining: { type: Number, default: 0 },
  },
  { _id: false }
);

const boardStateSchema = new mongoose.Schema(
  {
    hidden: [[String]],
    visible: [[String]],
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  boardSize: { type: Number, required: true },
  turnTimeLimit: { type: Number, default: 60 },
  boards: {
    type: Map,
    of: boardStateSchema,
  },
  fleets: {
    type: Map,
    of: [shipStateSchema],
  },
  turn: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  skips: {
    type: Map,
    of: Number,
    default: {},
  },
  lastActionAt: { type: Date, default: Date.now },
  turnStartedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['waiting', 'setup', 'in_game', 'finished'],
    default: 'waiting',
  },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
});

module.exports = mongoose.model('Game', gameSchema);
