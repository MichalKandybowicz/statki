const { verifySocketToken } = require('../middleware/auth');
const User = require('../models/User');
const { registerRoomHandlers } = require('./roomHandlers');
const { registerGameHandlers } = require('./gameHandlers');

// Map of userId -> Set of socket ids (for reconnect / multi-tab support)
const connectedUsers = new Map();
// Map of gameId -> turn timeout handle
const turnTimers = new Map();

function initSocket(io) {
  // Auth middleware for Socket.io
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    try {
      const decoded = verifySocketToken(token);
      const user = await User.findById(decoded.userId).select('-passwordHash');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`Socket connected: ${socket.id} (user: ${userId})`);

    // Track connected sockets per user
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);

    // Register domain-specific handlers
    registerRoomHandlers(io, socket, connectedUsers, turnTimers);
    registerGameHandlers(io, socket, connectedUsers, turnTimers);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (user: ${userId})`);
      const sockets = connectedUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }
    });

    socket.on('error', (err) => {
      console.error(`Socket error (${socket.id}):`, err.message);
    });
  });

  return { connectedUsers, turnTimers };
}

/**
 * Emit an event to all sockets belonging to a given userId.
 */
function emitToUser(io, connectedUsers, userId, event, data) {
  const sockets = connectedUsers.get(userId.toString());
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit(event, data);
    }
  }
}

module.exports = { initSocket, emitToUser };
