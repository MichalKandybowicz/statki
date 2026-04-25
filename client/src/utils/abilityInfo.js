function pluralTurns(value) {
  return value === 1 ? 'tura' : value >= 2 && value <= 4 ? 'tury' : 'tur'
}

export function getAbilityInfo(type, size = 1) {
  const normalizedSize = Math.max(1, Number(size) || 1)

  switch (type) {
    case 'linear':
      return {
        key: 'linear',
        label: 'Salwa liniowa',
        shortLabel: 'Liniowa',
        cooldown: normalizedSize,
        description: `Wybierasz początek i kierunek salwy (poziomo lub pionowo). Strzał obejmuje dokładnie ${normalizedSize} pól w jednej linii.`,
        targeting: 'Wymaga wskazania pola startowego oraz kierunku poziomo/pionowo.',
        requirement: 'Minimalny rozmiar statku: 2 pola.',
      }
    case 'random': {
      const shotCount = Math.max(1, normalizedSize - 1)
      const cooldown = normalizedSize + 1
      return {
        key: 'random',
        label: 'Strzał losowy',
        shortLabel: 'Losowy',
        cooldown,
        description: `Oddaje ${shotCount} losow${shotCount === 1 ? 'y strzał' : shotCount < 5 ? 'e strzały' : 'ych strzałów'} w nieodkryte pola przeciwnika.`,
        targeting: 'Nie wymaga wyboru celu.',
        requirement: 'Minimalny rozmiar statku: 2 pola.',
      }
    }
    case 'target': {
      const cooldown = normalizedSize + 1
      return {
        key: 'target',
        label: 'Salwa precyzyjna',
        shortLabel: 'Precyzyjna',
        cooldown,
        description: `Możesz wskazać do ${normalizedSize} pól. Strzały wykonywane są po kolei i kończą się natychmiast po pierwszym trafieniu.`,
        targeting: `Wskaż od 1 do ${normalizedSize} pól, a potem zatwierdź salwę.`,
        requirement: 'Brak minimalnego rozmiaru ponad 1 pole.',
      }
    }
    case 'sonar': {
      const scanCount = Math.ceil(normalizedSize / 3)
      const cooldown = scanCount * 3
      return {
        key: 'sonar',
        label: 'Sonar',
        shortLabel: 'Sonar',
        cooldown,
        description: `Oddajesz impuls sonarowy w wybrane pole. Sonar pokazuje do ${scanCount} najbliższych pól statków od miejsca skanu, ale skały blokują wykrycie.`,
        targeting: 'Wymaga wskazania pola na planszy przeciwnika.',
        requirement: '1-3 pola = 1 skan, 4-6 = 2 skany, 7 = 3 skany.',
      }
    }
    case 'scout_rocket':
      return {
        key: 'scout_rocket',
        label: 'Rakieta zwiadowcza',
        shortLabel: 'Zwiad',
        cooldown: 5,
        description: 'Oddajesz pojedynczy strzał. Jeśli trafi, wszystkie pola trafionego statku zostają oznaczone jako wykryte.',
        targeting: 'Wymaga wskazania jednego pola na planszy przeciwnika.',
        requirement: 'Rozmiar statku: 4-6 pól.',
      }
    case 'holy_bomb':
      return {
        key: 'holy_bomb',
        label: 'Święta bomba',
        shortLabel: 'Bomba',
        cooldown: 11,
        description: 'Może zostać użyta tylko na wykrytym polu wrogiego statku. Niszczy cały wskazany statek naraz.',
        targeting: 'Wybierz pole oznaczone jako wykryte.',
        requirement: 'Rozmiar statku: dokładnie 7 pól.',
      }
    default:
      return {
        key: type || 'unknown',
        label: type || 'Brak',
        shortLabel: type || 'Brak',
        cooldown: 0,
        description: 'Brak opisu tej umiejętności.',
        targeting: 'Brak dodatkowych informacji.',
        requirement: '',
      }
  }
}

export const ABILITY_TYPES = ['linear', 'random', 'target', 'sonar', 'scout_rocket', 'holy_bomb']

export function getAbilityCards(size = 1) {
  return ABILITY_TYPES.map(type => getAbilityInfo(type, size))
}

export function formatCooldownTurns(value) {
  return `${value} ${pluralTurns(value)}`
}
