const Room = require('../models/Room');
const { emitToUser } = require('./socketUtils');

function registerRoomHandlers(io, socket, connectedUsers) {
  const userId = socket.user._id.toString();

  // join_room: join a socket room for live updates
  socket.on('join_room', async ({ roomId, password } = {}) => {
    try {
      if (!roomId) {
        return socket.emit('error', { message: 'roomId is required' });
      }

      const room = await Room.findById(roomId)
        .populate('hostId', 'email')
        .populate('players.userId', 'email');

      if (!room) {
        return socket.emit('error', { message: 'Room not found' });
      }

      const isPlayer = room.players.some(
        (p) => p.userId && p.userId._id.toString() === userId
      );

      // If not already a player, validate and add
      if (!isPlayer) {
        if (room.status !== 'waiting') {
          return socket.emit('error', { message: 'Room is not accepting players' });
        }
        if (room.players.length >= 2) {
          return socket.emit('error', { message: 'Room is full' });
        }
        if (room.settings.password && room.settings.password !== password) {
          return socket.emit('error', { message: 'Wrong password' });
        }

        room.players.push({ userId: socket.user._id, ready: false });
        await room.save();
        await room.populate('players.userId', 'email');
      }

      socket.join(`room:${roomId}`);

      const safeRoom = {
        ...room.toObject(),
        hasPassword: !!room.settings.password,
        settings: { ...room.settings.toObject(), password: undefined },
      };

      io.to(`room:${roomId}`).emit('room_update', safeRoom);
    } catch (err) {
      console.error('join_room error:', err);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // leave_room
  socket.on('leave_room', async ({ roomId } = {}) => {
    try {
      if (!roomId) return;

      socket.leave(`room:${roomId}`);

      const room = await Room.findById(roomId);
      if (!room || room.status !== 'waiting') return;

      room.players = room.players.filter(
        (p) => p.userId.toString() !== userId
      );

      if (room.players.length === 0) {
        await Room.deleteOne({ _id: roomId });
        return;
      }

      // Transfer host if host left
      if (room.hostId.toString() === userId && room.players.length > 0) {
        room.hostId = room.players[0].userId;
      }

      await room.save();
      await room.populate('hostId', 'email');
      await room.populate('players.userId', 'email');

      const safeRoom = {
        ...room.toObject(),
        hasPassword: !!room.settings.password,
        settings: { ...room.settings.toObject(), password: undefined },
      };

      io.to(`room:${roomId}`).emit('room_update', safeRoom);
    } catch (err) {
      console.error('leave_room error:', err);
    }
  });

  // player_ready
  socket.on('player_ready', async ({ roomId } = {}) => {
    try {
      if (!roomId) {
        return socket.emit('error', { message: 'roomId is required' });
      }

      const room = await Room.findById(roomId);
      if (!room) return socket.emit('error', { message: 'Room not found' });
      if (room.status !== 'waiting' && room.status !== 'setup') {
        return socket.emit('error', { message: 'Room is not in a ready-able state' });
      }

      const player = room.players.find((p) => p.userId.toString() === userId);
      if (!player) return socket.emit('error', { message: 'Not in this room' });

      player.ready = true;
      await room.save();
      await room.populate('hostId', 'email');
      await room.populate('players.userId', 'email');

      const safeRoom = {
        ...room.toObject(),
        hasPassword: !!room.settings.password,
        settings: { ...room.settings.toObject(), password: undefined },
      };

      io.to(`room:${roomId}`).emit('room_update', safeRoom);
    } catch (err) {
      console.error('player_ready error:', err);
      socket.emit('error', { message: 'Failed to set ready' });
    }
  });
}

module.exports = { registerRoomHandlers };
