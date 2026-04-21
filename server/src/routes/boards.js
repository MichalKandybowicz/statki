const express = require('express');
const BoardTemplate = require('../models/BoardTemplate');
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
    const { size, tiles } = req.body;

    if (!size || size < 10 || size > 25) {
      return res.status(400).json({ error: 'Size must be between 10 and 25' });
    }

    const tilesError = validateTiles(tiles, size);
    if (tilesError) return res.status(400).json({ error: tilesError });

    const board = new BoardTemplate({ ownerId: req.user._id, size, tiles });
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

    const { size, tiles } = req.body;

    const newSize = size !== undefined ? size : board.size;
    if (newSize < 10 || newSize > 25) {
      return res.status(400).json({ error: 'Size must be between 10 and 25' });
    }

    if (tiles !== undefined) {
      const tilesError = validateTiles(tiles, newSize);
      if (tilesError) return res.status(400).json({ error: tilesError });
      board.tiles = tiles;
    }

    board.size = newSize;
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
    res.json({ message: 'Board deleted' });
  } catch (err) {
    console.error('Delete board error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
