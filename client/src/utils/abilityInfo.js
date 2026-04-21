export const ABILITY_INFO = {
  linear: {
    key: 'linear',
    label: 'Salwa liniowa',
    shortLabel: 'Liniowa',
    cooldown: 2,
    description: 'Strzela przez cały rząd wyznaczony na podstawie położenia statku. Trafia każde nieodkryte pole w tej linii.',
    targeting: 'Nie wymaga wyboru celu — odpala całą linię.',
  },
  random: {
    key: 'random',
    label: 'Strzał losowy',
    shortLabel: 'Losowy',
    cooldown: 1,
    description: 'Wybiera losowe nieodkryte pole przeciwnika i oddaje w nie strzał.',
    targeting: 'Nie wymaga wyboru celu.',
  },
  target: {
    key: 'target',
    label: 'Salwa precyzyjna',
    shortLabel: 'Celowana',
    cooldown: 2,
    description: 'Pozwala wskazać do 3 pól na planszy przeciwnika i ostrzelać je w jednej turze.',
    targeting: 'Wymaga wskazania 3 pól na planszy przeciwnika.',
  },
  sonar: {
    key: 'sonar',
    label: 'Sonar',
    shortLabel: 'Sonar',
    cooldown: 3,
    description: 'Wykrywa najbliższe ukryte pole statku przeciwnika. Jeśli nie ma już statków, może wskazać skałę.',
    targeting: 'Nie wymaga wyboru celu — działa automatycznie.',
  },
}

export function getAbilityInfo(type) {
  return ABILITY_INFO[type] || {
    key: type || 'unknown',
    label: type || 'Brak',
    shortLabel: type || 'Brak',
    cooldown: 0,
    description: 'Brak opisu tej umiejętności.',
    targeting: 'Brak dodatkowych informacji.',
  }
}

