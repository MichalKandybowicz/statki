function getAbilityRules(type, size = 1) {
  const normalizedSize = Math.max(1, Number(size) || 1);

  switch (type) {
    case 'linear':
      return {
        minSize: 2,
        cooldown: normalizedSize,
        segmentLength: normalizedSize,
      };
    case 'random':
      return {
        minSize: 2,
        cooldown: normalizedSize + 1,
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
        cooldown: scanCount * 3,
        scanCount,
      };
    }
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

