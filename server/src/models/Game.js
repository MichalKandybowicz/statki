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
  isRanked: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['waiting', 'setup', 'in_game', 'finished'],
    default: 'waiting',
  },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  endReason: {
    type: String,
    enum: ['win', 'surrender', 'timeout'],
    default: null,
  },
  finishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  endedAt: { type: Date, default: null },
  eloApplied: { type: Boolean, default: false },
  eloDeltas: {
    type: Map,
    of: Number,
    default: {},
  },
  eloBefore: {
    type: Map,
    of: Number,
    default: {},
  },
  eloAfter: {
    type: Map,
    of: Number,
    default: {},
  },
}, {
  timestamps: true,
});

gameSchema.index({ players: 1, status: 1, endedAt: -1 });
gameSchema.index({ winnerId: 1, endedAt: -1 });

module.exports = mongoose.model('Game', gameSchema);
