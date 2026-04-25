const express = require('express');
const BoardTemplate = require('../models/BoardTemplate');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function validateTiles(tiles, size) {
  if (!Array.isArray(tiles) || tiles.length !== size) {
    return `Tiles must have exactly ${size} rows`;
  }
  const validTiles = new Set(['water', 'rock']);
  for (const row of tiles) {
    if (!Array.isArray(row) || row.length !== size) {
      return `Each row must have exactly ${size} columns`;
    }
    for (const tile of row) {
      if (!validTiles.has(tile)) {
        return "Tiles must be 'water' or 'rock'";
      }
    }
  }
  return null;
}

function validateBoardName(name) {
  if (typeof name !== 'string' || !name.trim()) {
    return 'Board name is required';
  }
  if (name.trim().length > 60) {
    return 'Board name must be at most 60 characters';
  }
  return null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/boards
router.get('/', async (req, res) => {
  try {
    const boards = await BoardTemplate.find({ ownerId: req.user._id }).lean();
    res.json(boards);
  } catch (err) {
    console.error('List boards error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/boards/community?q=
router.get('/community', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const query = { ownerId: { $ne: req.user._id } };

    if (q.length >= 1) {
      const safe = new RegExp(escapeRegex(q), 'i');
      const users = await User.find({
        _id: { $ne: req.user._id },
        $or: [{ username: safe }, { email: safe }],
      })
        .select('_id')
        .limit(100)
        .lean();

      query.$or = [
        { name: { $regex: safe } },
        { ownerId: { $in: users.map((u) => u._id) } },
      ];
    }

    const boards = await BoardTemplate.find(query)
      .populate('ownerId', 'username email')
      .sort({ _id: -1 })
      .limit(200)
      .lean();

    res.json(
      boards.map((board) => ({
        ...board,
        owner: {
          _id: board.ownerId?._id,
          username: board.ownerId?.username,
          email: board.ownerId?.email,
        },
        isOwn: false,
      }))
    );
  } catch (err) {
    console.error('List community boards error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/boards/:id
router.get('/:id', async (req, res) => {
  try {
    const board = await BoardTemplate.findById(req.params.id).lean();
    if (!board) return res.status(404).json({ error: 'Board not found' });
    res.json(board);
  } catch (err) {
    console.error('Get board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/boards
router.post('/', async (req, res) => {
  try {
    const { name, size, tiles } = req.body;

    const nameError = validateBoardName(name);
    if (nameError) return res.status(400).json({ error: nameError });

    if (!size || size < 10 || size > 25) {
      return res.status(400).json({ error: 'Size must be between 10 and 25' });
    }

    const tilesError = validateTiles(tiles, size);
    if (tilesError) return res.status(400).json({ error: tilesError });

    const board = new BoardTemplate({ ownerId: req.user._id, name: name.trim(), size, tiles });
    await board.save();
    res.status(201).json(board);
  } catch (err) {
    console.error('Create board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/boards/:id
router.put('/:id', async (req, res) => {
  try {
    const board = await BoardTemplate.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const { name, size, tiles } = req.body;

    const newSize = size !== undefined ? size : board.size;
    if (newSize < 10 || newSize > 25) {
      return res.status(400).json({ error: 'Size must be between 10 and 25' });
    }

    if (name !== undefined) {
      const nameError = validateBoardName(name);
      if (nameError) return res.status(400).json({ error: nameError });
      board.name = name.trim();
    }

    if (tiles !== undefined) {
      const tilesError = validateTiles(tiles, newSize);
      if (tilesError) return res.status(400).json({ error: tilesError });
      board.tiles = tiles;
    }

    board.size = newSize;
    if (!board.name) {
      board.name = `Plansza ${newSize}x${newSize}`;
    }
    await board.save();
    res.json(board);
  } catch (err) {
    console.error('Update board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/boards/:id
router.delete('/:id', async (req, res) => {
  try {
    const board = await BoardTemplate.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user._id,
    });
    if (!board) return res.status(404).json({ error: 'Board not found' });

    await User.updateMany(
      { favoriteBoards: board._id },
      { $pull: { favoriteBoards: board._id } }
    );

    res.json({ message: 'Board deleted' });
  } catch (err) {
    console.error('Delete board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/boards/:id/favorite
router.post('/:id/favorite', async (req, res) => {
  try {
    const board = await BoardTemplate.findById(req.params.id);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { favoriteBoards: board._id } },
      { new: true }
    );

    res.json({ favoriteBoards: user.favoriteBoards || [] });
  } catch (err) {
    console.error('Favorite board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/boards/:id/favorite
router.delete('/:id/favorite', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { favoriteBoards: req.params.id } },
      { new: true }
    );

    res.json({ favoriteBoards: user.favoriteBoards || [] });
  } catch (err) {
    console.error('Unfavorite board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/boards/:id/copy
router.post('/:id/copy', async (req, res) => {
  try {
    const sourceBoard = await BoardTemplate.findById(req.params.id).lean();
    if (!sourceBoard) return res.status(404).json({ error: 'Board not found' });

    const providedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const copyName = providedName || `${sourceBoard.name} (kopia)`;

    const nameError = validateBoardName(copyName);
    if (nameError) return res.status(400).json({ error: nameError });

    const copiedBoard = new BoardTemplate({
      ownerId: req.user._id,
      name: copyName,
      size: sourceBoard.size,
      tiles: sourceBoard.tiles,
    });
    await copiedBoard.save();

    res.status(201).json(copiedBoard);
  } catch (err) {
    console.error('Copy board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
