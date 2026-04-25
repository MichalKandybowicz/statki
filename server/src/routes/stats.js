const express = require('express');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function displayName(userDoc) {
  if (!userDoc) return 'Nieznany gracz';
  return userDoc.username || (userDoc.email ? userDoc.email.split('@')[0] : 'Nieznany gracz');
}

// GET /api/stats/history?page=1&limit=20&nick=
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const nickFilter = (req.query.nick || '').trim().toLowerCase();
    const myId = req.user._id;

    const [games, total] = await Promise.all([
      Game.find({ status: 'finished', players: myId })
        .sort({ endedAt: -1, createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('players', 'username email')
        .populate('winnerId', 'username email')
        .lean(),
      Game.countDocuments({ status: 'finished', players: myId }),
    ]);

    const rows = games.map((game) => {
      const players = Array.isArray(game.players) ? game.players : [];
      const opponent = players.find((p) => p && p._id?.toString() !== myId.toString()) || null;
      const opponentName = displayName(opponent);
      const winner = game.winnerId || null;
      const winnerId = winner?._id ? winner._id.toString() : game.winnerId ? game.winnerId.toString() : null;

      return {
        gameId: game._id.toString(),
        endedAt: game.endedAt || game.updatedAt || game.createdAt,
        endReason: game.endReason || 'win',
        winnerId,
        winnerName: displayName(winner),
        opponentId: opponent?._id ? opponent._id.toString() : null,
        opponentName,
        didWin: winnerId === myId.toString(),
      };
    });

    const filtered = nickFilter
      ? rows.filter((row) => row.opponentName.toLowerCase().includes(nickFilter))
      : rows;

    res.json({
      items: filtered,
      page,
      limit,
      total,
      hasNextPage: page * limit < total,
    });
  } catch (err) {
    console.error('History stats error:', err);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// GET /api/stats/players/search?q=nick
router.get('/players/search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ items: [] });

    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { username: re },
        { email: re },
      ],
    })
      .select('username email')
      .limit(20)
      .lean();

    res.json({
      items: users.map((u) => ({
        userId: u._id.toString(),
        username: displayName(u),
      })),
    });
  } catch (err) {
    console.error('Player search error:', err);
    res.status(500).json({ error: 'Failed to search players' });
  }
});

// GET /api/stats/head-to-head/:opponentId
router.get('/head-to-head/:opponentId', authMiddleware, async (req, res) => {
  try {
    const myId = req.user._id;
    const { opponentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(opponentId)) {
      return res.status(400).json({ error: 'Invalid opponent id' });
    }

    const opponent = await User.findById(opponentId).select('username email').lean();
    if (!opponent) return res.status(404).json({ error: 'Opponent not found' });

    const games = await Game.find({
      status: 'finished',
      players: { $all: [myId, opponentId] },
    })
      .select('winnerId endedAt')
      .sort({ endedAt: -1, _id: -1 })
      .lean();

    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (const game of games) {
      const winnerId = game.winnerId ? game.winnerId.toString() : null;
      if (!winnerId) {
        draws += 1;
      } else if (winnerId === myId.toString()) {
        wins += 1;
      } else if (winnerId === opponentId) {
        losses += 1;
      } else {
        draws += 1;
      }
    }

    res.json({
      opponent: {
        userId: opponent._id.toString(),
        username: displayName(opponent),
      },
      total: games.length,
      wins,
      losses,
      draws,
      lastMatchAt: games[0]?.endedAt || null,
    });
  } catch (err) {
    console.error('Head-to-head error:', err);
    res.status(500).json({ error: 'Failed to load head-to-head stats' });
  }
});

module.exports = router;

