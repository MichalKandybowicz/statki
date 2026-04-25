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
  if (rules.maxSize && size > rules.maxSize) {
    throw new Error(`Ship too large for ${ship.abilityType} ability`);
  }

  return { fleet, ship, size, rules };
}

/**
 * Sets a cooldown on a ship after using its ability.
 */
function applyCooldown(fleet, shipIndex, cooldown = 1) {
  fleet[shipIndex].cooldownRemaining = Math.max(0, cooldown);
}

function getOpponentId(game, playerId) {
  const opponentId = game.players.find((p) => p.toString() !== playerId.toString());
  if (!opponentId) throw new Error('Opponent not found');
  return opponentId.toString();
}

function isShotTile(tile) {
  return tile === 'miss' || tile === 'hit' || tile === 'sunk';
}

function canMarkDetected(tile) {
  return tile !== 'hit' && tile !== 'miss' && tile !== 'sunk';
}

function markDetectedPositions(game, playerId, opponentId, positions) {
  const opponentBoard = game.boards.get(opponentId);
  if (!opponentBoard) return [];
  const visible = opponentBoard.visible;
  const marked = [];

  for (const pos of positions || []) {
    const x = Number(pos?.x);
    const y = Number(pos?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    if (x < 0 || x >= game.boardSize || y < 0 || y >= game.boardSize) continue;
    if (!canMarkDetected(visible[y][x])) continue;

    visible[y][x] = 'detected';
    marked.push({ x, y });
  }

  if (marked.length > 0) {
    game.boards.set(opponentId, opponentBoard);
    game.markModified('boards');
  }
  return marked;
}

function isVisionBlockingTile(tile) {
  return tile === 'rock' || tile === 'sunk';
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getLinePoints(start, end) {
  // Supercover line: includes all cells touched by the ray between two grid points.
  // This prevents sonar from "seeing through" rocks at diagonal/corner intersections.
  const points = [{ x: start.x, y: start.y }];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  const nx = Math.abs(dx);
  const ny = Math.abs(dy);
  const signX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const signY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

  let x = start.x;
  let y = start.y;
  let ix = 0;
  let iy = 0;

  while (ix < nx || iy < ny) {
    const decision = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx;

    if (decision === 0) {
      x += signX;
      y += signY;
      ix++;
      iy++;
      points.push({ x, y });
    } else if (decision < 0) {
      x += signX;
      ix++;
      points.push({ x, y });
    } else {
      y += signY;
      iy++;
      points.push({ x, y });
    }
  }

  return points;
}

function isBlockedByObstacle(hiddenBoard, start, end) {
  const line = getLinePoints(start, end);
  // Skip start point and destination point.
  for (let i = 1; i < line.length - 1; i++) {
    const point = line[i];
    if (isVisionBlockingTile(hiddenBoard[point.y]?.[point.x])) {
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
        const blocked = isBlockedByObstacle(hidden, target, { x, y });
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

  const groupedByDistance = new Map();
  for (const candidate of candidates) {
    if (!groupedByDistance.has(candidate.dist)) {
      groupedByDistance.set(candidate.dist, []);
    }
    groupedByDistance.get(candidate.dist).push(candidate);
  }

  const orderedDistances = [...groupedByDistance.keys()].sort((a, b) => a - b);
  const revealed = [];
  for (const distance of orderedDistances) {
    const group = shuffle(groupedByDistance.get(distance));
    for (const candidate of group) {
      if (revealed.length >= rules.scanCount) break;
      revealed.push(candidate);
    }
    if (revealed.length >= rules.scanCount) break;
  }

  const positions = revealed.map(({ x, y }) => ({ x, y }));
  const detectedPositions = markDetectedPositions(game, playerId, opponentId, positions);
  const detectedType = revealed[0]?.type || 'water';

  applyCooldown(fleet, shipIndex, getAbilityCooldown('sonar', ship.positions.length));
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');

  return {
    type: detectedType,
    nearest: revealed[0] ? { x: revealed[0].x, y: revealed[0].y } : null,
    positions,
    detectedPositions,
    scanCount: rules.scanCount,
    blocked: blockedShipExists && revealed.length === 0,
    origin: target,
  };
}

/**
 * Scout rocket: single shot. If it hits, all cells of that ship become detected.
 */
function useScoutRocket(game, playerId, shipIndex, target) {
  const { fleet } = validateShipForAbility(game, playerId, shipIndex);
  if (!target || target.x === undefined || target.y === undefined) {
    throw new Error('Target point is required for scout rocket');
  }
  if (target.x < 0 || target.x >= game.boardSize || target.y < 0 || target.y >= game.boardSize) {
    throw new Error('Scout rocket target out of bounds');
  }

  const result = processMove(game, playerId, target.x, target.y);
  const opponentId = getOpponentId(game, playerId);
  let detectedPositions = [];

  if (result.hit && Number.isInteger(result.shipIndex) && result.shipIndex >= 0) {
    const opponentFleet = game.fleets.get(opponentId) || [];
    const hitShip = opponentFleet[result.shipIndex];
    if (hitShip?.positions?.length) {
      detectedPositions = markDetectedPositions(game, playerId, opponentId, hitShip.positions);
    }
  }

  applyCooldown(fleet, shipIndex, getAbilityCooldown('scout_rocket', fleet[shipIndex].positions?.length || 1));
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');

  return [{
    x: target.x,
    y: target.y,
    hit: result.hit,
    sunk: result.sunk,
    shipIndex: result.shipIndex,
    sunkPositions: result.sunkPositions || [],
    alreadyShot: result.alreadyShot,
    detectedPositions,
  }];
}

/**
 * Holy bomb: can only be used on detected enemy tile and sinks that entire ship.
 */
function useHolyBomb(game, playerId, shipIndex, target) {
  const { fleet } = validateShipForAbility(game, playerId, shipIndex);
  if (!target || target.x === undefined || target.y === undefined) {
    throw new Error('Target point is required for holy bomb');
  }
  if (target.x < 0 || target.x >= game.boardSize || target.y < 0 || target.y >= game.boardSize) {
    throw new Error('Holy bomb target out of bounds');
  }

  const opponentId = getOpponentId(game, playerId);
  const opponentBoard = game.boards.get(opponentId);
  if (!opponentBoard) throw new Error('Opponent board not found');

  if (opponentBoard.visible[target.y]?.[target.x] !== 'detected') {
    throw new Error('Holy bomb requires a detected enemy tile');
  }

  const opponentFleet = game.fleets.get(opponentId) || [];
  const hitShipIndex = opponentFleet.findIndex((ship) =>
    ship.positions?.some((p) => p.x === target.x && p.y === target.y)
  );
  if (hitShipIndex < 0) {
    throw new Error('No ship found on selected detected tile');
  }

  const targetShip = opponentFleet[hitShipIndex];
  if (!targetShip || targetShip.isSunk) {
    throw new Error('Selected ship is already sunk');
  }

  const hidden = opponentBoard.hidden;
  const visible = opponentBoard.visible;
  const existingHits = new Set((targetShip.hits || []).map((p) => `${p.x}:${p.y}`));
  const results = [];

  for (const pos of targetShip.positions || []) {
    hidden[pos.y][pos.x] = 'sunk';
    visible[pos.y][pos.x] = 'sunk';
    const key = `${pos.x}:${pos.y}`;
    if (!existingHits.has(key)) {
      targetShip.hits.push({ x: pos.x, y: pos.y });
      existingHits.add(key);
    }
    results.push({
      x: pos.x,
      y: pos.y,
      hit: true,
      sunk: true,
      shipIndex: hitShipIndex,
      sunkPositions: targetShip.positions.map((p) => ({ x: p.x, y: p.y })),
      alreadyShot: false,
    });
  }

  targetShip.isSunk = true;
  game.fleets.set(opponentId, opponentFleet);
  game.boards.set(opponentId, opponentBoard);
  game.lastActionAt = new Date();
  game.markModified('fleets');
  game.markModified('boards');

  applyCooldown(fleet, shipIndex, getAbilityCooldown('holy_bomb', fleet[shipIndex].positions?.length || 1));
  game.fleets.set(playerId.toString(), fleet);
  game.markModified('fleets');

  return results;
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

module.exports = {
  useLinearShot,
  useRandomShot,
  useTargetShot,
  useSonar,
  useScoutRocket,
  useHolyBomb,
  tickCooldowns,
};
