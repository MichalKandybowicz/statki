const Room = require('../models/Room');
const { startGameForRoom } = require('./gameHandlers');
const { ensureUniqueRoomPlayers, getPlayerUserId } = require('../utils/roomPlayers');

function toSafeRoom(room) {
  return {
    ...room.toObject(),
    hasPassword: !!room.settings.password,
    settings: { ...room.settings.toObject(), password: undefined },
  };
}

async function loadSafeRoom(roomId) {
  const room = await Room.findById(roomId)
    .populate('hostId', 'email username')
    .populate('players.userId', 'email username');

  if (room) {
    await ensureUniqueRoomPlayers(room);
    await room.populate('players.userId', 'email username');
  }

  return room ? toSafeRoom(room) : null;
}

function registerRoomHandlers(io, socket, connectedUsers, turnTimers) {
  const userId = socket.user._id.toString();

  // join_room: join a socket room for live updates
  socket.on('join_room', async ({ roomId, password } = {}) => {
    try {
      if (!roomId) {
        return socket.emit('error', { message: 'roomId is required' });
      }

      const room = await Room.findById(roomId)
        .populate('hostId', 'email username')
        .populate('players.userId', 'email username');

      if (!room) {
        return socket.emit('error', { message: 'Room not found' });
      }

      await ensureUniqueRoomPlayers(room);
      await room.populate('players.userId', 'email username');

      const isPlayer = room.players.some(
        (p) => getPlayerUserId(p) === userId
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
        await ensureUniqueRoomPlayers(room);
        await room.populate('players.userId', 'email username');
      }

      socket.join(`room:${roomId}`);

      const safeRoom = toSafeRoom(room);

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

      await ensureUniqueRoomPlayers(room);

      room.players = room.players.filter(
        (p) => getPlayerUserId(p) !== userId
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
      await room.populate('hostId', 'email username');
      await room.populate('players.userId', 'email username');

      const safeRoom = toSafeRoom(room);

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
      await ensureUniqueRoomPlayers(room);
      if (room.status !== 'waiting' && room.status !== 'setup') {
        return socket.emit('error', { message: 'Room is not in a ready-able state' });
      }

      const player = room.players.find((p) => getPlayerUserId(p) === userId);
      if (!player) return socket.emit('error', { message: 'Not in this room' });

      player.ready = true;
      await room.save();
      await room.populate('hostId', 'email username');
      await room.populate('players.userId', 'email username');

      const safeRoom = toSafeRoom(room);

      io.to(`room:${roomId}`).emit('room_update', safeRoom);
    } catch (err) {
      console.error('player_ready error:', err);
      socket.emit('error', { message: 'Failed to set ready' });
    }
  });

  // change_map: host changes board template before game starts
  socket.on('change_map', async ({ roomId, boardTemplateId } = {}) => {
    try {
      if (!roomId || !boardTemplateId) {
        return socket.emit('error', { message: 'roomId and boardTemplateId are required' });
      }

      const room = await Room.findById(roomId);
      if (!room) return socket.emit('error', { message: 'Room not found' });
      await ensureUniqueRoomPlayers(room);

      if (room.hostId.toString() !== userId) {
        return socket.emit('error', { message: 'Only the host can change the map' });
      }
      if (room.status !== 'waiting' && room.status !== 'setup') {
        return socket.emit('error', { message: 'Cannot change map after game has started' });
      }

      const BoardTemplate = require('../models/BoardTemplate');
      const tmpl = await BoardTemplate.findOne({ _id: boardTemplateId, ownerId: userId });
      if (!tmpl) {
        return socket.emit('error', { message: 'Board template not found or not yours' });
      }

      room.settings.boardTemplateId = tmpl._id;
      room.settings.boardSize = tmpl.size;
      // reset ready state so players re-confirm placement on new map
      room.players.forEach(p => { p.ready = false; });
      room.status = 'waiting';
      await room.save();

      await room.populate('hostId', 'email username');
      await room.populate('players.userId', 'email username');

      io.to(`room:${roomId}`).emit('room_update', toSafeRoom(room));
      socket.emit('map_changed', { boardTemplateId: tmpl._id.toString(), boardSize: tmpl.size, name: tmpl.name || '' });
    } catch (err) {
      console.error('change_map error:', err);
      socket.emit('error', { message: 'Failed to change map' });
    }
  });

  socket.on('start_game', async ({ roomId } = {}) => {
    try {
      if (!roomId) {
        return socket.emit('error', { message: 'roomId is required' });
      }

      const room = await Room.findById(roomId);
      if (!room) return socket.emit('error', { message: 'Room not found' });
      await ensureUniqueRoomPlayers(room);
      if (room.hostId.toString() !== userId) {
        return socket.emit('error', { message: 'Only the host can start the game' });
      }
      if (room.status !== 'waiting' && room.status !== 'setup') {
        return socket.emit('error', { message: 'Room cannot be started right now' });
      }
      if (room.players.length !== 2) {
        return socket.emit('error', { message: 'Two players are required to start the game' });
      }
      if (!room.players.every((player) => player.ready)) {
        return socket.emit('error', { message: 'All players must be ready before starting' });
      }

      const result = await startGameForRoom(io, room, connectedUsers, turnTimers);
      if (!result.started) {
        return socket.emit('error', { message: result.message || 'Game could not be started' });
      }

      const safeRoom = await loadSafeRoom(roomId);
      if (safeRoom) {
        io.to(`room:${roomId}`).emit('room_update', safeRoom);
      }
    } catch (err) {
      console.error('start_game error:', err);
      socket.emit('error', { message: 'Failed to start game' });
    }
  });
}

module.exports = { registerRoomHandlers };
