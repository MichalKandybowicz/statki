const express = require('express');
const ShipTemplate = require('../models/ShipTemplate');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { isContiguous, countCells } = require('../utils/floodFill');
const { getAbilityRules } = require('../engine/abilityConfig');

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

function validateName(name) {
  if (typeof name !== 'string' || !name.trim()) {
    return 'Ship name is required';
  }
  if (name.trim().length > 40) {
    return 'Ship name must be at most 40 characters';
  }
  return null;
}

function validateAbilityForSize(abilityType, size) {
  const validAbilities = ['linear', 'random', 'target', 'sonar'];
  if (!validAbilities.includes(abilityType)) {
    return 'Invalid abilityType';
  }

  const rules = getAbilityRules(abilityType, size);
  if (size < rules.minSize) {
    return `Ability ${abilityType} requires ship size >= ${rules.minSize}`;
  }

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

// GET /api/ships/community
router.get('/community', async (req, res) => {
  try {
    const ships = await ShipTemplate.find()
      .populate('ownerId', 'email')
      .sort({ _id: -1 })
      .lean();

    res.json(
      ships.map((ship) => ({
        ...ship,
        owner: {
          _id: ship.ownerId?._id,
          email: ship.ownerId?.email,
        },
        isOwn: ship.ownerId?._id?.toString() === req.user._id.toString(),
      }))
    );
  } catch (err) {
    console.error('List community ships error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ships
router.post('/', async (req, res) => {
  try {
    const { name, shape, abilityType } = req.body;

    const nameError = validateName(name);
    if (nameError) return res.status(400).json({ error: nameError });

    const shapeError = validateShape(shape);
    if (shapeError) return res.status(400).json({ error: shapeError });

    const size = countCells(shape);
    const abilityError = validateAbilityForSize(abilityType, size);
    if (abilityError) return res.status(400).json({ error: abilityError });

    const ship = new ShipTemplate({ ownerId: req.user._id, name: name.trim(), shape, size, abilityType });
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

    const { name, shape, abilityType } = req.body;

    if (name !== undefined) {
      const nameError = validateName(name);
      if (nameError) return res.status(400).json({ error: nameError });
      ship.name = name.trim();
    }

    let nextSize = ship.size;
    let nextAbilityType = abilityType !== undefined ? abilityType : ship.abilityType;

    if (shape !== undefined) {
      const shapeError = validateShape(shape);
      if (shapeError) return res.status(400).json({ error: shapeError });
      ship.shape = shape;
      nextSize = countCells(shape);
      ship.size = nextSize;
    }

    if (abilityType !== undefined) {
      nextAbilityType = abilityType;
    }

    const abilityError = validateAbilityForSize(nextAbilityType, nextSize);
    if (abilityError) return res.status(400).json({ error: abilityError });
    ship.abilityType = nextAbilityType;

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

// POST /api/ships/:id/favorite
router.post('/:id/favorite', async (req, res) => {
  try {
    const ship = await ShipTemplate.findById(req.params.id);
    if (!ship) return res.status(404).json({ error: 'Ship not found' });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { favoriteShips: ship._id } },
      { new: true }
    );

    res.json({ favoriteShips: user.favoriteShips || [] });
  } catch (err) {
    console.error('Favorite ship error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/ships/:id/favorite
router.delete('/:id/favorite', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { favoriteShips: req.params.id } },
      { new: true }
    );

    res.json({ favoriteShips: user.favoriteShips || [] });
  } catch (err) {
    console.error('Unfavorite ship error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ships/:id/copy
router.post('/:id/copy', async (req, res) => {
  try {
    const sourceShip = await ShipTemplate.findById(req.params.id).lean();
    if (!sourceShip) return res.status(404).json({ error: 'Ship not found' });

    const providedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const copyName = providedName || `${sourceShip.name} (kopia)`;

    const nameError = validateName(copyName);
    if (nameError) return res.status(400).json({ error: nameError });

    const copiedShip = new ShipTemplate({
      ownerId: req.user._id,
      name: copyName,
      shape: sourceShip.shape,
      size: sourceShip.size,
      abilityType: sourceShip.abilityType,
    });
    await copiedShip.save();

    res.status(201).json(copiedShip);
  } catch (err) {
    console.error('Copy ship error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
