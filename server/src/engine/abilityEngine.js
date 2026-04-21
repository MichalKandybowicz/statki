/**
 * Ability Engine - handles special ship abilities.
 * All functions mutate the game document and return result data.
 * Callers must save the game after use.
 */

const { processMove } = require('./gameEngine');

/**
 * Validates that a ship exists, belongs to the player, and is not sunk.
 */
function validateShipForAbility(game, playerId, shipIndex) {
  const fleet = game.fleets.get(playerId.toString());
  if (!fleet) throw new Error('Fleet not found');
  const ship = fleet[shipIndex];
  if (!ship) throw new Error('Ship not found');
  if (ship.isSunk) throw new Error('Ship is sunk');
  if (ship.cooldownRemaining > 0) throw new Error('Ability on cooldown');
  return { fleet, ship };
}

/**
 * Sets a cooldown on a ship after using its ability.
 */
function applyCooldown(fleet, shipIndex, cooldown = 1) {
  fleet[shipIndex].cooldownRemaining = cooldown;
}

/**
 * Linear shot: fires at all cells in a row or column aligned with the ship.
 * Shoots horizontally across the row of the first ship cell.
 */
function useLinearShot(game, playerId, shipIndex) {
  const { fleet, ship } = validateShipForAbility(game, playerId, shipIndex);

  const opponentId = game.players.find((p) => p.toString() !== playerId.toString());
  if (!opponentId) throw new Error('Opponent not found');

  // Fire along the row of the ship's first position
  const row = ship.positions[0].y;
  const results = [];

  for (let x = 0; x < game.boardSize; x++) {
    try {
      const result = processMove(game, playerId, x, row);
      results.push({ x, y: row, hit: result.hit, sunk: result.sunk, alreadyShot: result.alreadyShot });
    } catch {
      results.push({ x, y: row, hit: false, sunk: false, alreadyShot: false });
    }
  }

  applyCooldown(fleet, shipIndex, 2);
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');

  return results;
}

/**
 * Random shot: fires at a random unshot cell on the opponent's board.
 */
function useRandomShot(game, playerId, shipIndex) {
  const { fleet } = validateShipForAbility(game, playerId, shipIndex);

  const opponentId = game.players.find((p) => p.toString() !== playerId.toString());
  if (!opponentId) throw new Error('Opponent not found');

  const opponentBoard = game.boards.get(opponentId.toString());
  const hidden = opponentBoard.hidden;

  // Collect all unshot cells
  const unshot = [];
  for (let y = 0; y < game.boardSize; y++) {
    for (let x = 0; x < game.boardSize; x++) {
      const tile = hidden[y][x];
      if (tile !== 'miss' && tile !== 'hit' && tile !== 'sunk') {
        unshot.push({ x, y });
      }
    }
  }

  if (unshot.length === 0) {
    return [];
  }

  const target = unshot[Math.floor(Math.random() * unshot.length)];
  const result = processMove(game, playerId, target.x, target.y);

  applyCooldown(fleet, shipIndex, 1);
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');

  return [{ x: target.x, y: target.y, hit: result.hit, sunk: result.sunk }];
}

/**
 * Target shot: fires at a specified list of target cells (up to 3).
 */
function useTargetShot(game, playerId, shipIndex, targets) {
  const { fleet } = validateShipForAbility(game, playerId, shipIndex);

  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('Targets array is required');
  }

  const MAX_TARGETS = 3;
  const limitedTargets = targets.slice(0, MAX_TARGETS);
  const results = [];

  for (const { x, y } of limitedTargets) {
    if (x < 0 || x >= game.boardSize || y < 0 || y >= game.boardSize) {
      results.push({ x, y, hit: false, sunk: false, error: 'Out of bounds' });
      continue;
    }
    try {
      const result = processMove(game, playerId, x, y);
      results.push({ x, y, hit: result.hit, sunk: result.sunk, alreadyShot: result.alreadyShot });
    } catch {
      results.push({ x, y, hit: false, sunk: false });
    }
  }

  applyCooldown(fleet, shipIndex, 2);
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');

  return results;
}

/**
 * Sonar: reveals the nearest ship cell type on the opponent's board without firing.
 * Returns { type: 'ship'|'rock'|'water', nearest: {x,y}|null }
 */
function useSonar(game, playerId, shipIndex) {
  const { fleet, ship } = validateShipForAbility(game, playerId, shipIndex);

  const opponentId = game.players.find((p) => p.toString() !== playerId.toString());
  if (!opponentId) throw new Error('Opponent not found');

  const opponentBoard = game.boards.get(opponentId.toString());
  const hidden = opponentBoard.hidden;

  // BFS from ship's centroid to find nearest undiscovered ship cell
  const centerX = Math.round(
    ship.positions.reduce((sum, p) => sum + p.x, 0) / ship.positions.length
  );
  const centerY = Math.round(
    ship.positions.reduce((sum, p) => sum + p.y, 0) / ship.positions.length
  );

  let nearestShip = null;
  let minDist = Infinity;

  for (let y = 0; y < game.boardSize; y++) {
    for (let x = 0; x < game.boardSize; x++) {
      if (hidden[y][x] === 'ship') {
        const dist = Math.abs(x - centerX) + Math.abs(y - centerY);
        if (dist < minDist) {
          minDist = dist;
          nearestShip = { x, y };
        }
      }
    }
  }

  applyCooldown(fleet, shipIndex, 3);
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');

  if (nearestShip) {
    return { type: 'ship', nearest: nearestShip };
  }

  // Check for undiscovered rocks
  for (let y = 0; y < game.boardSize; y++) {
    for (let x = 0; x < game.boardSize; x++) {
      const tile = hidden[y][x];
      if (tile === 'rock') {
        return { type: 'rock', nearest: { x, y } };
      }
    }
  }

  return { type: 'water', nearest: null };
}

/**
 * Decrements all cooldowns for a player's fleet at the start of their turn.
 */
function tickCooldowns(game, playerId) {
  const fleet = game.fleets.get(playerId.toString());
  if (!fleet) return;
  for (const ship of fleet) {
    if (ship.cooldownRemaining > 0) {
      ship.cooldownRemaining--;
    }
  }
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');
}

module.exports = { useLinearShot, useRandomShot, useTargetShot, useSonar, tickCooldowns };
