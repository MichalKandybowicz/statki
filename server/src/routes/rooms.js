const express = require('express');
const Room = require('../models/Room');
const BoardTemplate = require('../models/BoardTemplate');
const { authMiddleware } = require('../middleware/auth');
const { ensureUniqueRoomPlayers } = require('../utils/roomPlayers');

const router = express.Router();
router.use(authMiddleware);

// GET /api/rooms - list open rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({ status: 'waiting' })
      .select('-settings.password')
      .populate('hostId', 'email username')
      .sort({ createdAt: -1 });

    for (const room of rooms) {
      await ensureUniqueRoomPlayers(room);
    }

    const sanitized = rooms.map((r) => ({
      ...r.toObject(),
      hasPassword: !!(r.settings && r.settings.password),
      settings: { ...r.settings.toObject(), password: undefined },
    }));

    res.json(sanitized);
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rooms - create room
router.post('/', async (req, res) => {
  try {
    const { turnTimeLimit = 60, shipLimit = 5, password, boardTemplateId, isRanked = false } = req.body;

    if (!boardTemplateId) {
      return res.status(400).json({ error: 'boardTemplateId is required' });
    }
    if (turnTimeLimit < 10 || turnTimeLimit > 300) {
      return res.status(400).json({ error: 'turnTimeLimit must be between 10 and 300 seconds' });
    }
    if (shipLimit < 1 || shipLimit > 10) {
      return res.status(400).json({ error: 'shipLimit must be between 1 and 10' });
    }
    if (typeof isRanked !== 'boolean') {
      return res.status(400).json({ error: 'isRanked must be a boolean' });
    }

    const boardTemplate = await BoardTemplate.findById(boardTemplateId).lean();
    if (!boardTemplate) {
      return res.status(404).json({ error: 'Board template not found' });
    }

    const room = new Room({
      hostId: req.user._id,
      players: [{ userId: req.user._id, ready: false }],
      isRanked,
      settings: {
        boardSize: boardTemplate.size,
        turnTimeLimit,
        shipLimit,
        password: password || null,
        boardTemplateId,
      },
    });
    await room.save();

    const populated = await Room.findById(room._id)
      .populate('hostId', 'email username');

    await ensureUniqueRoomPlayers(populated);

    res.status(201).json({
      ...populated.toObject(),
      hasPassword: !!populated.settings.password,
      settings: { ...populated.settings.toObject(), password: undefined },
    });
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rooms/:id - get room details
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('hostId', 'email username')
      .populate('players.userId', 'email username');

    if (!room) return res.status(404).json({ error: 'Room not found' });

    await ensureUniqueRoomPlayers(room);
    await room.populate('players.userId', 'email username');

    const isPlayer = room.players.some(
      (p) => p.userId && p.userId._id.toString() === req.user._id.toString()
    );

    res.json({
      ...room.toObject(),
      hasPassword: !!room.settings.password,
      settings: { ...room.settings.toObject(), password: isPlayer ? room.settings.password : undefined },
    });
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rooms/:id/join
router.post('/:id/join', async (req, res) => {
  try {
    const { password } = req.body;
    const room = await Room.findById(req.params.id);

    if (!room) return res.status(404).json({ error: 'Room not found' });
    await ensureUniqueRoomPlayers(room);
    if (room.status !== 'waiting') {
      return res.status(400).json({ error: 'Room is not accepting players' });
    }

    const alreadyIn = room.players.some(
      (p) => p.userId.toString() === req.user._id.toString()
    );
    if (alreadyIn) {
      return res.status(400).json({ error: 'Already in room' });
    }

    if (room.players.length >= 2) {
      return res.status(400).json({ error: 'Room is full' });
    }

    if (room.settings.password && room.settings.password !== password) {
      return res.status(403).json({ error: 'Wrong password' });
    }

    room.players.push({ userId: req.user._id, ready: false });
    await room.save();

    const populated = await Room.findById(room._id)
      .populate('hostId', 'email username')
      .populate('players.userId', 'email username');

    await ensureUniqueRoomPlayers(populated);

    res.json({
      ...populated.toObject(),
      hasPassword: !!populated.settings.password,
      settings: { ...populated.settings.toObject(), password: undefined },
    });
  } catch (err) {
    console.error('Join room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/rooms/:id - delete room (host only)
router.delete('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.hostId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the host can delete this room' });
    }

    await Room.deleteOne({ _id: room._id });
    res.json({ message: 'Room deleted' });
  } catch (err) {
    console.error('Delete room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
