/**
 * Universal Text and Polish Address Normalizer.
 * Strips Polish diacritics and transliterates Cyrillic (Ukrainian/Russian) into searchable Latin phonetics.
 */

const POLISH_DIACRITICS_MAP: Record<string, string> = {
  'ą': 'a', 'Ą': 'A',
  'ć': 'c', 'Ć': 'C',
  'ę': 'e', 'Ę': 'E',
  'ł': 'l', 'Ł': 'L',
  'ń': 'n', 'Ń': 'N',
  'ó': 'o', 'Ó': 'O',
  'ś': 's', 'Ś': 'S',
  'ź': 'z', 'Ź': 'Z',
  'ż': 'z', 'Ż': 'Z',
};

const KNOWN_CYRILLIC_WORDS: Record<string, string> = {
  'люблін': 'lublin',
  'люблин': 'lublin',
  'варшава': 'warszawa',
  'лодзь': 'lodz',
  'краків': 'krakow',
  'краков': 'krakow',
  'вроцлав': 'wroclaw',
  'познань': 'poznan',
  'ґданськ': 'gdansk',
  'гданськ': 'gdansk',
  'гдянск': 'gdansk',
  'щецин': 'szczecin',
  'бидгощ': 'bydgoszcz',
  'бидгощь': 'bydgoszcz',
  'катовиці': 'katowice',
  'катовице': 'katowice',
  'білосток': 'bialystok',
  'белосток': 'bialystok',
  'ряшів': 'rzeszow',
  'жешув': 'rzeszow',
  'торунь': 'torun',
  'кільце': 'kielce',
  'кельце': 'kielce',
  'ольштин': 'olsztyn',
  'ополе': 'opole',
  'зелена гура': 'zielona gora',
  'зелена-гура': 'zielona gora',
  'горжув': 'gorzow',
  'венявська': 'wieniawska',
  'венявска': 'wieniawska',
  'вєнявска': 'wieniawska',
  'краківське': 'krakowskie',
  'краковске': 'krakowskie',
  'рацлавицькі': 'raclawickie',
  'липова': 'lipowa',
  'спокійна': 'spokojna',
  'маршалковська': 'marszalkowska',
  'маршалковска': 'marszalkowska',
  'свентокшиська': 'swietokrzyska',
  'єрусалимські': 'jerozolimskie',
  'єрозолімські': 'jerozolimskie',
  'новий світ': 'nowy swiat',
  'піотрковська': 'piotrkowska',
  'флоріанська': 'florianska',
};

const CYRILLIC_PHONETICS: [RegExp, string][] = [
  [/ня/g, 'nia'],
  [/вя/g, 'wia'],
  [/мя/g, 'mia'],
  [/бя/g, 'bia'],
  [/пя/g, 'pia'],
  [/дзя/g, 'dzia'],
  [/тя/g, 'tia'],
  [/дя/g, 'dia'],
  [/ся/g, 'sia'],
  [/зя/g, 'zia'],
  [/ці/g, 'ci'],
  [/сі/g, 'si'],
  [/ні/g, 'ni'],
  [/ді/g, 'di'],
  [/ті/g, 'ti'],
  [/ві/g, 'wi'],
  [/мі/g, 'mi'],
  [/бі/g, 'bi'],
  [/пі/g, 'pi'],
  [/щ/g, 'szcz'],
  [/ч/g, 'cz'],
  [/ш/g, 'sz'],
  [/ж/g, 'z'],
  [/х/g, 'ch'],
  [/ць/g, 'c'],
  [/дз/g, 'dz'],
  [/дж/g, 'dz'],
  [/є/g, 'ie'],
  [/ї/g, 'i'],
  [/ю/g, 'iu'],
  [/я/g, 'ia'],
  [/ґ/g, 'g'],
  [/а/g, 'a'],
  [/б/g, 'b'],
  [/в/g, 'w'],
  [/г/g, 'h'],
  [/д/g, 'd'],
  [/е/g, 'e'],
  [/з/g, 'z'],
  [/и/g, 'y'],
  [/і/g, 'i'],
  [/й/g, 'j'],
  [/к/g, 'k'],
  [/л/g, 'l'],
  [/м/g, 'm'],
  [/н/g, 'n'],
  [/о/g, 'o'],
  [/п/g, 'p'],
  [/р/g, 'r'],
  [/с/g, 's'],
  [/т/g, 't'],
  [/у/g, 'u'],
  [/ф/g, 'f'],
  [/ц/g, 'c'],
  [/ь/g, ''],
  [/ъ/g, ''],
  [/ы/g, 'y'],
  [/э/g, 'e'],
  [/ё/g, 'io'],
  [/['"`’ʼ]/g, ''],
];

const PREFIX_PATTERNS = [
  /^(вул\.|вулиця|просп\.|проспект|пров\.|провулок|пл\.|площа|бульв\.|бульвар)\s+/i,
  /^(ul\.|ulica|al\.|aleja|aleje|pl\.|plac|os\.|osiedle|skwer|rondo)\s+/i,
];

/**
 * Strips Polish diacritics into ASCII letters.
 */
export function stripPolishDiacritics(text: string): string {
  if (!text) return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    result += POLISH_DIACRITICS_MAP[char] ?? char;
  }
  return result;
}

/**
 * Transliterates Cyrillic text (Ukrainian / Russian) into Polish-compatible Latin phonetics.
 */
export function transliterateCyrillic(text: string): string {
  if (!text) return '';
  let lower = text.toLowerCase().trim();

  for (const prefix of PREFIX_PATTERNS) {
    lower = lower.replace(prefix, '');
  }
  lower = lower.trim();

  if (KNOWN_CYRILLIC_WORDS[lower]) {
    return KNOWN_CYRILLIC_WORDS[lower];
  }

  for (const [key, val] of Object.entries(KNOWN_CYRILLIC_WORDS)) {
    if (lower.includes(key)) {
      lower = lower.replace(new RegExp(key, 'g'), val);
    }
  }

  for (const [pattern, replacement] of CYRILLIC_PHONETICS) {
    lower = lower.replace(pattern, replacement);
  }

  return lower;
}

/**
 * Cleans and normalizes search query or database string.
 */
export function normalizeText(text: string): string {
  if (!text) return '';

  let normalized = text.trim();

  for (const prefix of PREFIX_PATTERNS) {
    normalized = normalized.replace(prefix, '');
  }

  if (/[\u0400-\u04FF]/.test(normalized)) {
    normalized = transliterateCyrillic(normalized);
  }

  normalized = stripPolishDiacritics(normalized.toLowerCase());
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Normalizes postal code into XX-XXX format.
 */
export function normalizePostalCode(input?: string | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 5) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2, 5)}`;
}

/**
 * Validates XX-XXX format.
 */
export function isValidPostalCode(input?: string | null): boolean {
  if (!input) return false;
  return /^\d{2}-\d{3}$/.test(input.trim());
}

/**
 * Normalizes building number: strips spaces, uppercase letters.
 * " 12 a " -> "12A", "14 / 2" -> "14"
 */
export function normalizeBuildingNumber(input?: string | null): string {
  if (!input) return '';
  let cleaned = input.trim().toUpperCase();

  const slashIdx = cleaned.indexOf('/');
  if (slashIdx !== -1) {
    cleaned = cleaned.substring(0, slashIdx).trim();
  }
  const mIdx = cleaned.indexOf(' M ');
  if (mIdx !== -1) {
    cleaned = cleaned.substring(0, mIdx).trim();
  }
  const mDotIdx = cleaned.indexOf(' M.');
  if (mDotIdx !== -1) {
    cleaned = cleaned.substring(0, mDotIdx).trim();
  }

  return cleaned.replace(/\s+/g, '');
}
