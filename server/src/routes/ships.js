const express = require('express');
const ShipTemplate = require('../models/ShipTemplate');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { isContiguous, countCells } = require('../utils/floodFill');

const router = express.Router();
router.use(authMiddleware);

function validateShape(shape) {
  if (!Array.isArray(shape) || shape.length === 0 || shape.length > 4) {
    return 'Shape must be a 1-4 row array';
  }
  for (const row of shape) {
    if (!Array.isArray(row) || row.length === 0 || row.length > 4) {
      return 'Each row must have 1-4 columns';
    }
    for (const cell of row) {
      if (cell !== 0 && cell !== 1) {
        return 'Cells must be 0 or 1';
      }
    }
  }
  const size = countCells(shape);
  if (size === 0) return 'Ship must have at least one cell';
  if (!isContiguous(shape)) return 'Ship cells must be contiguous';
  return null;
}

// GET /api/ships
router.get('/', async (req, res) => {
  try {
    const ships = await ShipTemplate.find({ ownerId: req.user._id }).lean();
    res.json(ships);
  } catch (err) {
    console.error('List ships error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ships
router.post('/', async (req, res) => {
  try {
    const { shape, abilityType } = req.body;

    const shapeError = validateShape(shape);
    if (shapeError) return res.status(400).json({ error: shapeError });

    const validAbilities = ['linear', 'random', 'target', 'sonar'];
    if (!validAbilities.includes(abilityType)) {
      return res.status(400).json({ error: 'Invalid abilityType' });
    }

    const size = countCells(shape);
    const ship = new ShipTemplate({ ownerId: req.user._id, shape, size, abilityType });
    await ship.save();

    res.status(201).json(ship);
  } catch (err) {
    console.error('Create ship error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/ships/:id
router.put('/:id', async (req, res) => {
  try {
    const ship = await ShipTemplate.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!ship) return res.status(404).json({ error: 'Ship not found' });

    const { shape, abilityType } = req.body;

    if (shape !== undefined) {
      const shapeError = validateShape(shape);
      if (shapeError) return res.status(400).json({ error: shapeError });
      ship.shape = shape;
      ship.size = countCells(shape);
    }

    if (abilityType !== undefined) {
      const validAbilities = ['linear', 'random', 'target', 'sonar'];
      if (!validAbilities.includes(abilityType)) {
        return res.status(400).json({ error: 'Invalid abilityType' });
      }
      ship.abilityType = abilityType;
    }

    await ship.save();
    res.json(ship);
  } catch (err) {
    console.error('Update ship error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/ships/:id
router.delete('/:id', async (req, res) => {
  try {
    const ship = await ShipTemplate.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user._id,
    });
    if (!ship) return res.status(404).json({ error: 'Ship not found' });

    // Remove from any user's favorites
    await User.updateMany(
      { favoriteShips: ship._id },
      { $pull: { favoriteShips: ship._id } }
    );

    res.json({ message: 'Ship deleted' });
  } catch (err) {
    console.error('Delete ship error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
