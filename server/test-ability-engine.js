const { useLinearShot, useRandomShot, useTargetShot, useSonar, tickCooldowns } = require('./src/engine/abilityEngine');
const { processMove } = require('./src/engine/gameEngine');

function makeBoard(size, fill = 'water') {
  return Array.from({ length: size }, () => Array(size).fill(fill));
}

function placeShips(board, ships) {
  ships.forEach((ship) => {
    ship.positions.forEach(({ x, y }) => {
      board[y][x] = 'ship'
    })
  })
}

function makeGame(size = 7) {
  const players = ['A', 'B'];
  const myFleet = [
    { name: 'Alpha', abilityType: 'linear', positions: [{ x: 1, y: 1 }, { x: 2, y: 1 }], hits: [], isSunk: false, cooldownRemaining: 0 },
    { name: 'Gamma', abilityType: 'sonar', positions: [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }], hits: [], isSunk: false, cooldownRemaining: 0 },
  ]
  const enemyFleet = [
    { name: 'Beta', abilityType: 'target', positions: [{ x: 2, y: 2 }, { x: 3, y: 2 }], hits: [], isSunk: false, cooldownRemaining: 0 },
    { name: 'Delta', abilityType: 'random', positions: [{ x: 5, y: 5 }, { x: 5, y: 6 }], hits: [], isSunk: false, cooldownRemaining: 0 },
  ]

  const boardA = { hidden: makeBoard(size), visible: makeBoard(size) }
  const boardB = { hidden: makeBoard(size), visible: makeBoard(size) }
  placeShips(boardA.hidden, myFleet)
  placeShips(boardB.hidden, enemyFleet)
  boardB.hidden[0][6] = 'rock'

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
      ['A', boardA],
      ['B', boardB],
    ]),
    fleets: new Map([
      ['A', myFleet],
      ['B', enemyFleet],
    ]),
    markModified() {},
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

(function testProcessMoveSunkPositions() {
  const game = makeGame();
  let result = processMove(game, 'A', 2, 2);
  assert(result.hit === true && result.sunk === false, 'single hit should hit but not sink');
  result = processMove(game, 'A', 3, 2);
  assert(result.sunk === true, 'second hit should sink ship');
  assert(Array.isArray(result.sunkPositions) && result.sunkPositions.length === 2, 'sunkPositions should contain full ship');
  assert(game.boards.get('B').hidden[2][2] === 'sunk' && game.boards.get('B').hidden[2][3] === 'sunk', 'all sunk tiles should be marked sunk');
})();

(function testLinearShot() {
  const game = makeGame();
  const results = useLinearShot(game, 'A', 0, { x: 2, y: 2 }, 'horizontal');
  assert(results.length === 2, 'linear should shoot exactly ship-size segment');
  assert(results[0].hit === true && results[1].hit === true, 'linear should hit both cells in chosen segment');
  assert(game.fleets.get('A')[0].cooldownRemaining === 1, 'linear cooldown should store base cooldown - 1');
})();

(function testRandomShot() {
  const game = makeGame();
  const shooter = game.fleets.get('A')[1];
  shooter.abilityType = 'random';
  shooter.positions = [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 3 }];
  shooter.cooldownRemaining = 0;
  const results = useRandomShot(game, 'A', 1);
  assert(results.length === 3, 'random should fire size - 1 shots');
  assert(game.fleets.get('A')[1].cooldownRemaining === 4, 'random cooldown should be size + 1 minus current turn');
})();

(function testTargetShotStopsOnHit() {
  const game = makeGame();
  const shooter = game.fleets.get('A')[0];
  shooter.abilityType = 'target';
  shooter.positions = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }];
  shooter.cooldownRemaining = 0;
  const results = useTargetShot(game, 'A', 0, [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 5, y: 5 }]);
  assert(results.length === 2, 'target should stop after first hit');
  assert(results[0].hit === false && results[1].hit === true, 'target should miss then hit');
  assert(game.fleets.get('A')[0].cooldownRemaining === 3, 'target cooldown should be size + 1 minus current turn');
})();

(function testSonarAndCooldownTick() {
  const game = makeGame();
  const sonarShip = game.fleets.get('A')[1];
  sonarShip.cooldownRemaining = 0;
  const sonar = useSonar(game, 'A', 1, { x: 4, y: 2 });
  assert(Array.isArray(sonar.positions) && sonar.positions.length === 1, 'size 3 sonar should reveal one position');
  assert(sonar.type === 'ship' && sonar.nearest, 'sonar should detect nearest ship');
  assert(sonar.origin.x === 4 && sonar.origin.y === 2, 'sonar should remember scan origin');
  assert(game.fleets.get('A')[1].cooldownRemaining === 2, 'sonar cooldown should be 3 minus current turn');
  tickCooldowns(game, 'A');
  assert(game.fleets.get('A')[1].cooldownRemaining === 1, 'tickCooldowns should decrement cooldown');
})();

(function testSonarBlockedByRock() {
  const game = makeGame();
  const sonarShip = game.fleets.get('A')[1];
  sonarShip.cooldownRemaining = 0;
  game.boards.get('B').hidden[1][1] = 'rock';
  const sonar = useSonar(game, 'A', 1, { x: 0, y: 0 });
  assert(sonar.positions.length === 0, 'blocked sonar should reveal no ship positions');
  assert(sonar.blocked === true, 'blocked sonar should report blocked state');
})();

console.log('ability tests ok')
