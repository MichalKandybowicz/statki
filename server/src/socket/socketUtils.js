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

module.exports = { emitToUser };

