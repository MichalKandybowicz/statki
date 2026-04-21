function getPlayerUserId(player) {
  if (!player) return null;
  const raw = player.userId?._id || player.userId;
  return raw ? raw.toString() : null;
}

function normalizeRoomPlayers(players = []) {
  const byUserId = new Map();

  for (const player of players) {
    const userId = getPlayerUserId(player);
    if (!userId) continue;

    if (!byUserId.has(userId)) {
      byUserId.set(userId, {
        userId: player.userId,
        ready: !!player.ready,
      });
      continue;
    }

    const existing = byUserId.get(userId);
    existing.ready = existing.ready || !!player.ready;

    // Prefer populated user objects when available
    if (player.userId && typeof player.userId === 'object' && player.userId._id) {
      existing.userId = player.userId;
    }
  }

  return Array.from(byUserId.values());
}

async function ensureUniqueRoomPlayers(room) {
  if (!room) return { room, changed: false };

  const normalized = normalizeRoomPlayers(room.players || []);
  const changed = normalized.length !== (room.players || []).length;

  if (changed) {
    room.players = normalized;
    await room.save();
  }

  return { room, changed };
}

module.exports = {
  getPlayerUserId,
  ensureUniqueRoomPlayers,
};


