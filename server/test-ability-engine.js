const { useLinearShot, useRandomShot, useTargetShot, useSonar, tickCooldowns } = require('./src/engine/abilityEngine');
const { processMove } = require('./src/engine/gameEngine');

function makeBoard(size, fill = 'water') {
  return Array.from({ length: size }, () => Array(size).fill(fill));
}

function makeGame(size = 5) {
  const players = ['A', 'B'];
  return {
    _id: 'g1',
    boardSize: size,
    players,
    turn: 'A',
    turnStartedAt: new Date(),
    lastActionAt: new Date(),
    status: 'in_game',
    winnerId: null,
    skips: new Map([['A', 0], ['B', 0]]),
    boards: new Map([
      ['A', { hidden: makeBoard(size), visible: makeBoard(size) }],
      ['B', { hidden: makeBoard(size), visible: makeBoard(size) }],
    ]),
    fleets: new Map([
      ['A', [{ name: 'Alpha', abilityType: 'linear', positions: [{ x: 2, y: 2 }], hits: [], isSunk: false, cooldownRemaining: 0 }]],
      ['B', [{ name: 'Beta', abilityType: 'linear', positions: [{ x: 1, y: 2 }, { x: 3, y: 2 }], hits: [], isSunk: false, cooldownRemaining: 0 }]],
    ]),
    markModified() {},
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(function testProcessMoveSunkPositions() {
  const game = makeGame();
  let result = processMove(game, 'A', 1, 2);
  assert(result.hit === true && result.sunk === false, 'single hit should hit but not sink');
  result = processMove(game, 'A', 3, 2);
  assert(result.sunk === true, 'second hit should sink ship');
  assert(Array.isArray(result.sunkPositions) && result.sunkPositions.length === 2, 'sunkPositions should contain full ship');
  assert(game.boards.get('B').hidden[2][1] === 'sunk' && game.boards.get('B').hidden[2][3] === 'sunk', 'all sunk tiles should be marked sunk');
})();

(function testLinearShot() {
  const game = makeGame();
  const results = useLinearShot(game, 'A', 0);
  assert(results.length === 5, 'linear should shoot full row');
  assert(results.filter((result) => result.hit).length === 2, 'linear should hit both ship cells in row');
  assert(game.fleets.get('A')[0].cooldownRemaining === 2, 'linear cooldown should be 2');
})();

(function testRandomShot() {
  const game = makeGame();
  const hidden = game.boards.get('B').hidden;
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) hidden[y][x] = 'miss';
  }
  hidden[4][4] = 'ship';
  game.fleets.set('B', [{ name: 'Beta', abilityType: 'random', positions: [{ x: 4, y: 4 }], hits: [], isSunk: false, cooldownRemaining: 0 }]);
  const results = useRandomShot(game, 'A', 0);
  assert(results.length === 1 && results[0].x === 4 && results[0].y === 4 && results[0].hit === true, 'random should hit the only available cell');
  assert(game.fleets.get('A')[0].cooldownRemaining === 1, 'random cooldown should be 1');
})();

(function testTargetShot() {
  const game = makeGame();
  const results = useTargetShot(game, 'A', 0, [{ x: 1, y: 2 }, { x: 0, y: 0 }, { x: 9, y: 9 }]);
  assert(results.length === 3, 'target should return up to 3 results');
  assert(results[0].hit === true, 'target should hit first target');
  assert(results[1].hit === false, 'target should miss water');
  assert(results[2].error === 'Out of bounds', 'target should report out of bounds');
  assert(game.fleets.get('A')[0].cooldownRemaining === 2, 'target cooldown should be 2');
})();

(function testSonarAndCooldownTick() {
  const game = makeGame();
  const sonar = useSonar(game, 'A', 0);
  assert(sonar.type === 'ship' && sonar.nearest, 'sonar should detect nearest ship');
  assert(game.fleets.get('A')[0].cooldownRemaining === 3, 'sonar cooldown should be 3');
  tickCooldowns(game, 'A');
  assert(game.fleets.get('A')[0].cooldownRemaining === 2, 'tickCooldowns should decrement cooldown');
})();

console.log('ability tests ok');

