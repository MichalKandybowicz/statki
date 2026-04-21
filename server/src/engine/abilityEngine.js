/**
 * Ability Engine - handles special ship abilities.
 * All functions mutate the game document and return result data.
 * Callers must save the game after use.
 */

const { processMove } = require('./gameEngine');
const { getAbilityRules, getAbilityCooldown } = require('./abilityConfig');

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

  const size = ship.positions?.length || 1;
  const rules = getAbilityRules(ship.abilityType, size);
  if (size < rules.minSize) {
    throw new Error(`Ship too small for ${ship.abilityType} ability`);
  }

  return { fleet, ship, size, rules };
}

/**
 * Sets a cooldown on a ship after using its ability.
 * Current turn counts toward cooldown progression, so we store cooldown-1.
 */
function applyCooldown(fleet, shipIndex, cooldown = 1) {
  fleet[shipIndex].cooldownRemaining = Math.max(0, cooldown - 1);
}

function getOpponentId(game, playerId) {
  const opponentId = game.players.find((p) => p.toString() !== playerId.toString());
  if (!opponentId) throw new Error('Opponent not found');
  return opponentId.toString();
}

function isShotTile(tile) {
  return tile === 'miss' || tile === 'hit' || tile === 'sunk';
}

function getLinePoints(start, end) {
  const points = [];
  let x0 = start.x;
  let y0 = start.y;
  const x1 = end.x;
  const y1 = end.y;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (!(x0 === x1 && y0 === y1)) {
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
    points.push({ x: x0, y: y0 });
  }

  return points;
}

function isBlockedByRock(hiddenBoard, start, end) {
  const line = getLinePoints(start, end);
  for (let i = 0; i < line.length - 1; i++) {
    const point = line[i];
    if (hiddenBoard[point.y]?.[point.x] === 'rock') {
      return true;
    }
  }
  return false;
}

/**
 * Linear shot: fires a segment chosen by the player horizontally or vertically.
 */
function useLinearShot(game, playerId, shipIndex, target, orientation = 'horizontal') {
  const { fleet, rules } = validateShipForAbility(game, playerId, shipIndex);
  if (!target || target.x === undefined || target.y === undefined) {
    throw new Error('Target start point is required for linear shot');
  }
  if (!['horizontal', 'vertical'].includes(orientation)) {
    throw new Error('Orientation must be horizontal or vertical');
  }

  const length = rules.segmentLength;
  const results = [];

  for (let step = 0; step < length; step++) {
    const x = target.x + (orientation === 'horizontal' ? step : 0);
    const y = target.y + (orientation === 'vertical' ? step : 0);

    if (x < 0 || x >= game.boardSize || y < 0 || y >= game.boardSize) {
      results.push({ x, y, hit: false, sunk: false, error: 'Out of bounds' });
      continue;
    }

    const result = processMove(game, playerId, x, y);
    results.push({
      x,
      y,
      hit: result.hit,
      sunk: result.sunk,
      shipIndex: result.shipIndex,
      sunkPositions: result.sunkPositions || [],
      alreadyShot: result.alreadyShot,
    });
  }

  applyCooldown(fleet, shipIndex, getAbilityCooldown('linear', length));
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');

  return results;
}

/**
 * Random shot: fires multiple random shots equal to ship size - 1.
 */
function useRandomShot(game, playerId, shipIndex) {
  const { fleet, rules } = validateShipForAbility(game, playerId, shipIndex);
  const opponentId = getOpponentId(game, playerId);
  const hidden = game.boards.get(opponentId).hidden;

  const unshot = [];
  for (let y = 0; y < game.boardSize; y++) {
    for (let x = 0; x < game.boardSize; x++) {
      if (!isShotTile(hidden[y][x])) {
        unshot.push({ x, y });
      }
    }
  }

  const results = [];
  const shotCount = Math.min(rules.shotCount, unshot.length);

  for (let i = 0; i < shotCount; i++) {
    const index = Math.floor(Math.random() * unshot.length);
    const target = unshot.splice(index, 1)[0];
    const result = processMove(game, playerId, target.x, target.y);
    results.push({
      x: target.x,
      y: target.y,
      hit: result.hit,
      sunk: result.sunk,
      shipIndex: result.shipIndex,
      sunkPositions: result.sunkPositions || [],
      alreadyShot: result.alreadyShot,
    });
  }

  applyCooldown(fleet, shipIndex, getAbilityCooldown('random', rules.shotCount + 1));
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');

  return results;
}

/**
 * Target shot: fires at selected targets until the first hit or shot limit is exhausted.
 */
function useTargetShot(game, playerId, shipIndex, targets) {
  const { fleet, rules, size } = validateShipForAbility(game, playerId, shipIndex);

  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('At least one target is required');
  }

  const limitedTargets = targets.slice(0, rules.shotLimit);
  const results = [];

  for (const { x, y } of limitedTargets) {
    if (x < 0 || x >= game.boardSize || y < 0 || y >= game.boardSize) {
      results.push({ x, y, hit: false, sunk: false, error: 'Out of bounds' });
      continue;
    }

    const result = processMove(game, playerId, x, y);
    results.push({
      x,
      y,
      hit: result.hit,
      sunk: result.sunk,
      shipIndex: result.shipIndex,
      sunkPositions: result.sunkPositions || [],
      alreadyShot: result.alreadyShot,
    });

    if (result.hit) break;
  }

  applyCooldown(fleet, shipIndex, getAbilityCooldown('target', size));
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');

  return results;
}

/**
 * Sonar: reveals nearest undiscovered ship/rock positions. Number of scans depends on size.
 */
function useSonar(game, playerId, shipIndex, target) {
  const { fleet, ship, rules } = validateShipForAbility(game, playerId, shipIndex);
  if (!target || target.x === undefined || target.y === undefined) {
    throw new Error('Target point is required for sonar');
  }
  if (target.x < 0 || target.x >= game.boardSize || target.y < 0 || target.y >= game.boardSize) {
    throw new Error('Sonar target out of bounds');
  }
  const opponentId = getOpponentId(game, playerId);
  const hidden = game.boards.get(opponentId).hidden;

  const candidates = [];
  let blockedShipExists = false;
  for (let y = 0; y < game.boardSize; y++) {
    for (let x = 0; x < game.boardSize; x++) {
      const tile = hidden[y][x];
      if (tile === 'ship') {
        const blocked = isBlockedByRock(hidden, target, { x, y });
        if (blocked) {
          blockedShipExists = true;
          continue;
        }

        candidates.push({
          x,
          y,
          type: tile,
          dist: Math.abs(x - target.x) + Math.abs(y - target.y),
        });
      }
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  const revealed = candidates.slice(0, rules.scanCount);
  const positions = revealed.map(({ x, y }) => ({ x, y }));
  const detectedType = revealed[0]?.type || 'water';

  applyCooldown(fleet, shipIndex, getAbilityCooldown('sonar', ship.positions.length));
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');

  return {
    type: detectedType,
    nearest: revealed[0] ? { x: revealed[0].x, y: revealed[0].y } : null,
    positions,
    scanCount: rules.scanCount,
    blocked: blockedShipExists && revealed.length === 0,
    origin: target,
  };
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
