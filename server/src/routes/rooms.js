const express = require('express');
const Room = require('../models/Room');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/rooms - list open rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({ status: 'waiting' })
      .select('-settings.password')
      .populate('hostId', 'email')
      .sort({ createdAt: -1 })
      .lean();

    const sanitized = rooms.map((r) => ({
      ...r,
      hasPassword: !!(r.settings && r.settings.password),
      settings: { ...r.settings, password: undefined },
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
    const { boardSize = 10, turnTimeLimit = 60, password, boardTemplateId } = req.body;

    if (boardSize < 10 || boardSize > 25) {
      return res.status(400).json({ error: 'boardSize must be between 10 and 25' });
    }
    if (turnTimeLimit < 10 || turnTimeLimit > 300) {
      return res.status(400).json({ error: 'turnTimeLimit must be between 10 and 300 seconds' });
    }

    const room = new Room({
      hostId: req.user._id,
      players: [{ userId: req.user._id, ready: false }],
      settings: {
        boardSize,
        turnTimeLimit,
        password: password || null,
        boardTemplateId: boardTemplateId || null,
      },
    });
    await room.save();

    const populated = await Room.findById(room._id)
      .populate('hostId', 'email')
      .lean();

    res.status(201).json({
      ...populated,
      hasPassword: !!populated.settings.password,
      settings: { ...populated.settings, password: undefined },
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
      .populate('hostId', 'email')
      .populate('players.userId', 'email')
      .lean();

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isPlayer = room.players.some(
      (p) => p.userId && p.userId._id.toString() === req.user._id.toString()
    );

    res.json({
      ...room,
      hasPassword: !!room.settings.password,
      settings: { ...room.settings, password: isPlayer ? room.settings.password : undefined },
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
      .populate('hostId', 'email')
      .populate('players.userId', 'email')
      .lean();

    res.json({
      ...populated,
      hasPassword: !!populated.settings.password,
      settings: { ...populated.settings, password: undefined },
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
