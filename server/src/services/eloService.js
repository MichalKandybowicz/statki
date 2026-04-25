const INITIAL_ELO = 800;
const K_FACTOR = 32;
const MIN_ELO = 100;

function sanitizeElo(value) {
  const elo = Number(value);
  if (!Number.isFinite(elo)) return INITIAL_ELO;
  return Math.max(MIN_ELO, Math.round(elo));
}

function expectedScore(playerElo, opponentElo) {
  const p = sanitizeElo(playerElo);
  const o = sanitizeElo(opponentElo);
  return 1 / (1 + Math.pow(10, (o - p) / 400));
}

function applyEloResult(playerElo, opponentElo, score) {
  const current = sanitizeElo(playerElo);
  const expected = expectedScore(playerElo, opponentElo);
  const next = Math.round(current + K_FACTOR * (score - expected));
  return Math.max(MIN_ELO, next);
}

function calculateRatedMatch({ winnerElo, loserElo }) {
  const winnerBefore = sanitizeElo(winnerElo);
  const loserBefore = sanitizeElo(loserElo);

  const winnerAfter = applyEloResult(winnerBefore, loserBefore, 1);
  const loserAfter = applyEloResult(loserBefore, winnerBefore, 0);

  return {
    winner: {
      before: winnerBefore,
      after: winnerAfter,
      delta: winnerAfter - winnerBefore,
    },
    loser: {
      before: loserBefore,
      after: loserAfter,
      delta: loserAfter - loserBefore,
    },
  };
}

module.exports = {
  INITIAL_ELO,
  calculateRatedMatch,
};

