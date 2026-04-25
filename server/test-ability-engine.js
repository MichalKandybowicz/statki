const {
  useLinearShot,
  useDiagonalShot,
  useRandomShot,
  useTargetShot,
  useSonar,
  useScoutRocket,
  useHolyBomb,
  useShipShapeShot,
  tickCooldowns,
} = require('./src/engine/abilityEngine');
const { processMove } = require('./src/engine/gameEngine');
const { getAbilityCooldown } = require('./src/engine/abilityConfig');

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
  assert(game.fleets.get('A')[0].cooldownRemaining === getAbilityCooldown('linear', 2), 'linear cooldown should follow config');
})();

(function testDiagonalShot() {
  const game = makeGame(9);
  const shooter = game.fleets.get('A')[0];
  shooter.abilityType = 'diagonal';
  shooter.positions = [{ x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }];
  shooter.cooldownRemaining = 0;

  game.fleets.set('B', [
    { name: 'DiagTarget', abilityType: 'target', positions: [{ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }], hits: [], isSunk: false, cooldownRemaining: 0 },
  ]);
  const hidden = makeBoard(9);
  placeShips(hidden, game.fleets.get('B'));
  game.boards.get('B').hidden = hidden;
  game.boards.get('B').visible = makeBoard(9);

  const results = useDiagonalShot(game, 'A', 0, { x: 2, y: 2 }, 'down-right');
  assert(results.length === 3, 'diagonal should fire exactly ship-size segment');
  assert(results.every((shot) => shot.hit === true), 'diagonal should hit along diagonal path');
  assert(game.fleets.get('A')[0].cooldownRemaining === getAbilityCooldown('diagonal', 3), 'diagonal cooldown should follow config');
})();

(function testRandomShot() {
  const game = makeGame();
  const shooter = game.fleets.get('A')[1];
  shooter.abilityType = 'random';
  shooter.positions = [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 3 }];
  shooter.cooldownRemaining = 0;
  const results = useRandomShot(game, 'A', 1);
  assert(results.length === 3, 'random should fire size - 1 shots');
  assert(game.fleets.get('A')[1].cooldownRemaining === getAbilityCooldown('random', 4), 'random cooldown should follow config');
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
  assert(game.fleets.get('A')[0].cooldownRemaining === getAbilityCooldown('target', 3), 'target cooldown should follow config');
})();

(function testSonarAndCooldownTick() {
  const game = makeGame();
  const sonarShip = game.fleets.get('A')[1];
  sonarShip.cooldownRemaining = 0;
  const sonar = useSonar(game, 'A', 1, { x: 4, y: 2 });
  assert(Array.isArray(sonar.positions) && sonar.positions.length === 1, 'size 3 sonar should reveal one position');
  assert(sonar.type === 'ship' && sonar.nearest, 'sonar should detect nearest ship');
  assert(sonar.origin.x === 4 && sonar.origin.y === 2, 'sonar should remember scan origin');
  assert(game.fleets.get('A')[1].cooldownRemaining === getAbilityCooldown('sonar', 3), 'sonar cooldown should follow config');
  tickCooldowns(game, 'A');
  assert(game.fleets.get('A')[1].cooldownRemaining === getAbilityCooldown('sonar', 3) - 1, 'tickCooldowns should decrement cooldown');
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

(function testSizeSixSonarRevealsTwoNearestTiles() {
  const game = makeGame(9);
  const sonarShip = game.fleets.get('A')[1];
  sonarShip.positions = [
    { x: 0, y: 8 },
    { x: 1, y: 8 },
    { x: 2, y: 8 },
    { x: 3, y: 8 },
    { x: 4, y: 8 },
    { x: 5, y: 8 },
  ];
  sonarShip.cooldownRemaining = 0;

  const targetShip = game.fleets.get('B')[0];
  targetShip.positions = [
    { x: 4, y: 4 },
    { x: 5, y: 4 },
    { x: 6, y: 4 },
    { x: 7, y: 4 },
    { x: 8, y: 4 },
  ];

  const freshBoard = makeBoard(9);
  placeShips(freshBoard, game.fleets.get('B'));
  game.boards.get('B').hidden = freshBoard;

  const sonar = useSonar(game, 'A', 1, { x: 4, y: 2 });
  assert(sonar.scanCount === 2, 'size 6 sonar should have 2 impulses');
  assert(sonar.positions.length === 2, 'size 6 sonar should reveal 2 nearest ship tiles');
  assert(sonar.positions.every((pos) => pos.y === 4), 'revealed sonar tiles should belong to the nearby target ship');
  assert(game.fleets.get('A')[1].cooldownRemaining === getAbilityCooldown('sonar', 6), 'size 6 sonar cooldown should follow config');
})();

(function testSonarDoesNotDetectShipBehindRock() {
  const game = makeGame(9);
  const sonarShip = game.fleets.get('A')[1];
  sonarShip.positions = [
    { x: 0, y: 8 },
    { x: 1, y: 8 },
    { x: 2, y: 8 },
    { x: 3, y: 8 },
    { x: 4, y: 8 },
    { x: 5, y: 8 },
  ];
  sonarShip.cooldownRemaining = 0;

  // Enemy ship in line, but rock blocks line of sight.
  game.fleets.set('B', [
    { name: 'Ukryty', abilityType: 'target', positions: [{ x: 6, y: 2 }, { x: 7, y: 2 }], hits: [], isSunk: false, cooldownRemaining: 0 },
  ]);

  const hidden = makeBoard(9);
  placeShips(hidden, game.fleets.get('B'));
  hidden[5][3] = 'rock';
  game.boards.get('B').hidden = hidden;

  const sonar = useSonar(game, 'A', 1, { x: 0, y: 8 });
  assert(sonar.positions.length === 0, 'sonar should not reveal ship hidden behind rock');
  assert(sonar.blocked === true, 'sonar should report blocked when rock obstructs line of sight');
})();

(function testScoutRocketMarksDetectedShipCells() {
  const game = makeGame(9);
  const fleetA = game.fleets.get('A');
  fleetA[0] = {
    name: 'Scout',
    abilityType: 'scout_rocket',
    positions: [{ x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }],
    hits: [],
    isSunk: false,
    cooldownRemaining: 0,
  };
  game.fleets.set('A', fleetA);

  const results = useScoutRocket(game, 'A', 0, { x: 2, y: 2 });
  assert(results.length === 1 && results[0].hit === true, 'scout rocket should fire single shot and hit target');
  const visible = game.boards.get('B').visible;
  assert(visible[2][3] === 'detected', 'scout rocket should mark sibling ship cells as detected');
  assert(game.fleets.get('A')[0].cooldownRemaining === getAbilityCooldown('scout_rocket', 4), 'scout rocket cooldown should follow config');
})();

(function testHolyBombRequiresDetectedAndSinksWholeShip() {
  const game = makeGame(9);
  const fleetA = game.fleets.get('A');
  fleetA[0] = {
    name: 'Holy',
    abilityType: 'holy_bomb',
    positions: [{ x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 6, y: 8 }],
    hits: [],
    isSunk: false,
    cooldownRemaining: 0,
  };
  game.fleets.set('A', fleetA);

  let failed = false;
  try {
    useHolyBomb(game, 'A', 0, { x: 2, y: 2 });
  } catch {
    failed = true;
  }
  assert(failed, 'holy bomb should fail when tile is not detected');

  useSonar(game, 'A', 1, { x: 2, y: 1 });
  const results = useHolyBomb(game, 'A', 0, { x: 2, y: 2 });
  assert(results.length >= 2, 'holy bomb should return all ship cells as sunk results');
  assert(game.fleets.get('B')[0].isSunk === true, 'holy bomb should sink entire target ship');
  assert(game.fleets.get('A')[0].cooldownRemaining === 11, 'holy bomb cooldown should be 11');
})();

(function testShipShapeShot() {
  const game = makeGame(9);
  const shooter = game.fleets.get('A')[0];
  shooter.abilityType = 'ship_shape';
  shooter.positions = [{ x: 0, y: 8 }, { x: 1, y: 8 }, { x: 1, y: 7 }];
  shooter.cooldownRemaining = 0;

  game.fleets.set('B', [
    { name: 'ShapeTarget', abilityType: 'target', positions: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 1 }], hits: [], isSunk: false, cooldownRemaining: 0 },
  ]);
  const hidden = makeBoard(9);
  placeShips(hidden, game.fleets.get('B'));
  game.boards.get('B').hidden = hidden;
  game.boards.get('B').visible = makeBoard(9);

  const results = useShipShapeShot(game, 'A', 0, { x: 2, y: 1 });
  assert(results.length === 3, 'ship-shape should shoot as many cells as ship has');
  assert(results.filter((shot) => shot.hit).length === 3, 'ship-shape should hit all cells matching its stencil');
  assert(game.fleets.get('A')[0].cooldownRemaining === getAbilityCooldown('ship_shape', 3), 'ship-shape cooldown should follow config');
})();

console.log('ability tests ok')
