const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateTokens, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const trimmedUsername = (username || '').trim();
    if (trimmedUsername && trimmedUsername.length > 32) {
      return res.status(400).json({ error: 'Username can be at most 32 characters' });
    }
    if (trimmedUsername && !/^[a-zA-Z0-9_\-. ]+$/.test(trimmedUsername)) {
      return res.status(400).json({ error: 'Username can only contain letters, digits, spaces, _ - .' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    if (trimmedUsername) {
      const takenNick = await User.findOne({ username: trimmedUsername });
      if (takenNick) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = new User({ email, passwordHash, username: trimmedUsername || undefined });
    await user.save();

    const { token, refreshToken } = generateTokens(user._id.toString());

    res.status(201).json({ token, refreshToken, user: user.toSafeObject() });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { token, refreshToken } = generateTokens(user._id.toString());

    res.json({ token, refreshToken, user: user.toSafeObject() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { token, refreshToken: newRefreshToken } = generateTokens(user._id.toString());
    res.json({ token, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  res.json(req.user.toSafeObject ? req.user.toSafeObject() : req.user);
});

// PATCH /api/auth/me — update username and/or password
router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (username !== undefined) {
      const trimmed = username.trim();
      if (trimmed.length === 0) return res.status(400).json({ error: 'Username cannot be empty' });
      if (trimmed.length > 32) return res.status(400).json({ error: 'Username can be at most 32 characters' });
      if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed)) {
        return res.status(400).json({ error: 'Username can only contain letters, digits, spaces, _ - .' });
      }
      const taken = await User.findOne({ username: trimmed, _id: { $ne: user._id } });
      if (taken) return res.status(409).json({ error: 'Username already taken' });
      user.username = trimmed;
    }

    if (newPassword !== undefined) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
      user.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    console.error('Update me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
