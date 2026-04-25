function getAbilityRules(type, size = 1) {
  const normalizedSize = Math.max(1, Number(size) || 1);

  switch (type) {
    case 'linear':
      return {
        minSize: 2,
        cooldown: normalizedSize + 1,
        segmentLength: normalizedSize,
      };
    case 'random':
      return {
        minSize: 2,
        cooldown: normalizedSize ,
        shotCount: Math.max(1, normalizedSize - 1),
      };
    case 'target':
      return {
        minSize: 1,
        cooldown: normalizedSize + 1,
        shotLimit: normalizedSize,
      };
    case 'sonar': {
      const scanCount = Math.ceil(normalizedSize / 3);
      return {
        minSize: 1,
        cooldown: (scanCount * 3) +1,
        scanCount,
      };
    }
    case 'scout_rocket':
      return {
        minSize: 4,
        maxSize: 6,
        cooldown: normalizedSize + 3,
      };
    case 'holy_bomb':
      return {
        minSize: 7,
        maxSize: 7,
        cooldown: 11,
      };
    default:
      return {
        minSize: 1,
        cooldown: 0,
      };
  }
}

function getAbilityCooldown(type, size = 1) {
  return getAbilityRules(type, size).cooldown;
}

module.exports = {
  getAbilityRules,
  getAbilityCooldown,
};

