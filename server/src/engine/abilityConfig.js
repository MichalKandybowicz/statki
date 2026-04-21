const ABILITY_CONFIG = {
  linear: { cooldown: 2 },
  random: { cooldown: 1 },
  target: { cooldown: 2 },
  sonar: { cooldown: 3 },
};

function getAbilityCooldown(type) {
  return ABILITY_CONFIG[type]?.cooldown ?? 0;
}

module.exports = {
  ABILITY_CONFIG,
  getAbilityCooldown,
};

