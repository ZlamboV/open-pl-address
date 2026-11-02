/**
 * High-quality seed dataset for testing open-pl-address with official TERYT & PRG codes.
 * Contains complete administrative and address data for Lublin, Warszawa, Kraków, Łódź, and Biskupice.
 */

export interface SeedTerc {
  terytCode: string; // 7 digits
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  rodzajGminy: string;
}

export interface SeedCity {
  simcId: string; // 7 digits
  terytCode: string;
  name: string;
  postalCodes: string[];
}

export interface SeedStreet {
  simcId: string;
  ulicId: string | null; // 5 digits or null
  cecha: string; // ul., al., pl.
  name: string;
  buildingsMap: Record<string, string[]>; // { "postal_code": ["1", "2", "3A"] }
}

export const SEED_TERC: SeedTerc[] = [
  {
    terytCode: '0663011',
    wojewodztwo: 'LUBELSKIE',
    powiat: 'm. Lublin',
    gmina: 'Lublin',
    rodzajGminy: 'gmina miejska',
  },
  {
    terytCode: '0617012',
    wojewodztwo: 'LUBELSKIE',
    powiat: 'świdnicki',
    gmina: 'Biskupice',
    rodzajGminy: 'gmina wiejska',
  },
  {
    terytCode: '1465011',
    wojewodztwo: 'MAZOWIECKIE',
    powiat: 'm. st. Warszawa',
    gmina: 'Warszawa',
    rodzajGminy: 'gmina miejska',
  },
  {
    terytCode: '1261011',
    wojewodztwo: 'MAŁOPOLSKIE',
    powiat: 'm. Kraków',
    gmina: 'Kraków',
    rodzajGminy: 'gmina miejska',
  },
  {
    terytCode: '1061011',
    wojewodztwo: 'ŁÓDZKIE',
    powiat: 'm. Łódź',
    gmina: 'Łódź',
    rodzajGminy: 'gmina miejska',
  },
  {
    terytCode: '0264011',
    wojewodztwo: 'DOLNOŚLĄSKIE',
    powiat: 'm. Wrocław',
    gmina: 'Wrocław',
    rodzajGminy: 'gmina miejska',
  },
];

export const SEED_CITIES: SeedCity[] = [
  {
    simcId: '0954995',
    terytCode: '0663011',
    name: 'Lublin',
    postalCodes: ['20-001', '20-002', '20-020', '20-024', '20-029', '20-059', '20-071', '20-074', '20-076', '20-080', '20-601', '20-711'],
  },
  {
    simcId: '0379114',
    terytCode: '0617012',
    name: 'Biskupice',
    postalCodes: ['21-020'],
  },
  {
    simcId: '0918123',
    terytCode: '1465011',
    name: 'Warszawa',
    postalCodes: ['00-001', '00-028', '00-029', '00-048', '00-504', '00-697', '01-001'],
  },
  {
    simcId: '0950463',
    terytCode: '1261011',
    name: 'Kraków',
    postalCodes: ['30-001', '31-001', '31-019', '31-042'],
  },
  {
    simcId: '0957650',
    terytCode: '1061011',
    name: 'Łódź',
    postalCodes: ['90-001', '90-006', '90-418', '91-604'],
  },
  {
    simcId: '0986283',
    terytCode: '0264011',
    name: 'Wrocław',
    postalCodes: ['50-001', '50-101'],
  },
];

export const SEED_STREETS: SeedStreet[] = [
  // --- LUBLIN ---
  {
    simcId: '0954995',
    ulicId: '24123',
    cecha: 'ul.',
    name: 'Wieniawska',
    buildingsMap: {
      '20-071': ['1', '3', '5', '7', '9'],
      '20-029': ['2', '4', '6', '8', '10', '12', '14'],
    },
  },
  {
    simcId: '0954995',
    ulicId: '09895',
    cecha: 'ul.',
    name: 'Krakowskie Przedmieście',
    buildingsMap: {
      '20-002': ['1', '2', '3', '4', '5', '6', '7', '8'],
      '20-076': ['10', '12', '14', '16', '18', '20', '22', '24', '26', '28'],
    },
  },
  {
    simcId: '0954995',
    ulicId: '11181',
    cecha: 'ul.',
    name: 'Lipowa',
    buildingsMap: {
      '20-020': ['1', '3', '5', '7', '9', '11'],
      '20-024': ['2', '4', '6', '8', '10', '12', '14', '16'],
    },
  },
  {
    simcId: '0954995',
    ulicId: '20743',
    cecha: 'ul.',
    name: 'Spokojna',
    buildingsMap: {
      '20-074': ['1', '2', '3', '4', '8', '9', '10'],
    },
  },
  {
    simcId: '0954995',
    ulicId: '18285',
    cecha: 'al.',
    name: 'Racławickie',
    buildingsMap: {
      '20-059': ['1', '2', '3', '4', '6', '8', '10', '14'],
    },
  },
  {
    simcId: '0954995',
    ulicId: '11244',
    cecha: 'pl.',
    name: 'Litewski',
    buildingsMap: {
      '20-080': ['1', '2', '3'],
    },
  },
  {
    simcId: '0954995',
    ulicId: '25785',
    cecha: 'ul.',
    name: 'Tomasza Zana',
    buildingsMap: {
      '20-601': ['1', '2', '3', '11', '15', '19', '32A', '38', '43'],
    },
  },
  {
    simcId: '0954995',
    ulicId: '08179',
    cecha: 'ul.',
    name: 'Kasztelańska',
    buildingsMap: {
      '20-711': ['1', '5', '10', '25', '29', '31'],
    },
  },

  // --- BISKUPICE (Gmina wiejska - village without streets) ---
  {
    simcId: '0379114',
    ulicId: null,
    cecha: '',
    name: 'Biskupice',
    buildingsMap: {
      '21-020': ['1', '2', '3', '4A', '5', '10', '12', '15', '20', '25', '30'],
    },
  },

  // --- WARSZAWA ---
  {
    simcId: '0918123',
    ulicId: '12192',
    cecha: 'ul.',
    name: 'Marszałkowska',
    buildingsMap: {
      '00-028': ['1', '2', '3', '4', '5', '6', '7'],
      '00-504': ['8', '10', '12', '14', '84/92'],
    },
  },
  {
    simcId: '0918123',
    ulicId: '07455',
    cecha: 'al.',
    name: 'Jerozolimskie',
    buildingsMap: {
      '00-697': ['1', '2', '3', '4', '5', '65', '100'],
    },
  },
  {
    simcId: '0918123',
    ulicId: '14493',
    cecha: 'ul.',
    name: 'Nowy Świat',
    buildingsMap: {
      '00-029': ['1', '2', '3', '4', '5', '15/17', '22', '67'],
    },
  },
  {
    simcId: '0918123',
    ulicId: '22464',
    cecha: 'ul.',
    name: 'Świętokrzyska',
    buildingsMap: {
      '00-048': ['1', '2', '3', '11', '12', '30', '36'],
    },
  },

  // --- KRAKÓW ---
  {
    simcId: '0950463',
    ulicId: '05072',
    cecha: 'ul.',
    name: 'Floriańska',
    buildingsMap: {
      '31-019': ['1', '2', '3', '4', '5', '10', '15', '20'],
    },
  },
  {
    simcId: '0950463',
    ulicId: '19175',
    cecha: 'pl.',
    name: 'Rynek Główny',
    buildingsMap: {
      '31-042': ['1', '2', '3', '4', '5', '10', '20', '30'],
    },
  },

  // --- ŁÓDŹ ---
  {
    simcId: '0957650',
    ulicId: '16280',
    cecha: 'ul.',
    name: 'Piotrkowska',
    buildingsMap: {
      '90-006': ['1', '2', '3', '4', '5', '10'],
      '90-418': ['100', '102', '104', '150'],
    },
  },
  {
    simcId: '0957650',
    ulicId: '00130',
    cecha: 'ul.',
    name: 'Ametystowa',
    buildingsMap: {
      '91-604': ['1', '2', '3', '4', '5'],
    },
  },
];

export interface SeedTaxOffice {
  usCode: string; // 4-digit MF code
  name: string; // Official name
  city: string;
  street: string;
  postalCode: string;
}

export type BuildingParity = 'ALL' | 'EVEN' | 'ODD';

export interface SeedTaxOfficeRule {
  usCode: string;
  terytCode: string;
  simcId: string | null;
  ulicId: string | null;
  buildingParity: BuildingParity;
  buildingFrom: number | null;
  buildingTo: number | null;
  priority: number; // 1: street + range/parity, 2: whole street, 3: city, 4: gmina
}

export const SEED_TAX_OFFICES: SeedTaxOffice[] = [
  // --- LUBLIN & POWIAT LUBELSKI ---
  {
    usCode: '0610',
    name: 'Pierwszy Urząd Skarbowy w Lublinie',
    city: 'Lublin',
    street: 'ul. Sądowa 5',
    postalCode: '20-027',
  },
  {
    usCode: '0611',
    name: 'Drugi Urząd Skarbowy w Lublinie',
    city: 'Lublin',
    street: 'ul. Fabryczna 1a',
    postalCode: '20-301',
  },
  {
    usCode: '0612',
    name: 'Trzeci Urząd Skarbowy w Lublinie',
    city: 'Lublin',
    street: 'ul. Narutowicza 56',
    postalCode: '20-016',
  },

  // --- WARSZAWA ---
  {
    usCode: '1435',
    name: 'Pierwszy Urząd Skarbowy Warszawa-Śródmieście',
    city: 'Warszawa',
    street: 'ul. Lindleya 14',
    postalCode: '02-013',
  },

  // --- KRAKÓW ---
  {
    usCode: '1212',
    name: 'Urząd Skarbowy Kraków-Stare Miasto',
    city: 'Kraków',
    street: 'ul. Grodzka 65',
    postalCode: '31-001',
  },

  // --- ŁÓDŹ ---
  {
    usCode: '1008',
    name: 'Pierwszy Urząd Skarbowy Łódź-Bałuty',
    city: 'Łódź',
    street: 'ul. Zachodnia 47',
    postalCode: '91-066',
  },
  {
    usCode: '1013',
    name: 'Urząd Skarbowy Łódź-Śródmieście',
    city: 'Łódź',
    street: 'ul. Dowborczyków 9/11',
    postalCode: '90-019',
  },

  // --- WROCŁAW ---
  {
    usCode: '0227',
    name: 'Urząd Skarbowy Wrocław-Stare Miasto',
    city: 'Wrocław',
    street: 'ul. Piłsudskiego 27/29',
    postalCode: '50-044',
  },
];

export const SEED_TAX_OFFICE_RULES: SeedTaxOfficeRule[] = [
  // =========================================================================
  // LUBLIN (TERC: 0663011, SIMC: 0954995)
  // Division between Pierwszy US (0610), Trzeci US (0612), and Drugi US (0611)
  // =========================================================================

  // --- PRIORITY 1: Street + building range / parity rules ---
  // ul. Lipowa (ulicId: 24123): Odd numbers belong to Pierwszy US (0610), Even numbers belong to Trzeci US (0612)
  {
    usCode: '0610',
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '11181', // ul. Lipowa
    buildingParity: 'ODD',
    buildingFrom: 1,
    buildingTo: 11,
    priority: 1,
  },
  {
    usCode: '0612',
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '11181', // ul. Lipowa
    buildingParity: 'EVEN',
    buildingFrom: 2,
    buildingTo: 16,
    priority: 1,
  },

  // --- PRIORITY 2: Whole street rules ---
  // Northern and central streets -> Pierwszy US w Lublinie (0610)
  {
    usCode: '0610',
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '24123', // ul. Wieniawska
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 2,
  },
  {
    usCode: '0610',
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '09895', // ul. Krakowskie Przedmieście
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 2,
  },
  {
    usCode: '0610',
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '20743', // ul. Spokojna
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 2,
  },
  {
    usCode: '0610',
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '18285', // al. Racławickie
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 2,
  },
  {
    usCode: '0610',
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '11244', // pl. Litewski
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 2,
  },
  {
    usCode: '0610',
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '08179', // ul. Kasztelańska
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 2,
  },

  // Southern and western streets -> Trzeci US w Lublinie (0612)
  {
    usCode: '0612',
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '25785', // ul. Tomasza Zana
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 2,
  },

  // --- PRIORITY 3: City fallback ---
  // Default for Lublin city when no specific street rule matches -> 0610 (Pierwszy US)
  {
    usCode: '0610',
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: null,
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 3,
  },

  // =========================================================================
  // POWIAT LUBELSKI & OUTSIDE GMINAS -> Drugi US w Lublinie (0611)
  // =========================================================================
  // --- PRIORITY 4: Gmina / Powiat rules ---
  // Biskupice (gmina świdnicka / lubelska border) -> Drugi US w Lublinie (0611)
  {
    usCode: '0611',
    terytCode: '0617012',
    simcId: null,
    ulicId: null,
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 4,
  },
  // Powiat lubelski outer gminas prefix (0609)
  {
    usCode: '0611',
    terytCode: '0609',
    simcId: null,
    ulicId: null,
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 4,
  },

  // =========================================================================
  // OTHER SEED CITIES (Warszawa, Kraków, Łódź, Wrocław)
  // =========================================================================
  {
    usCode: '1435', // Warszawa-Śródmieście
    terytCode: '1465011',
    simcId: '0918123',
    ulicId: null,
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 3,
  },
  {
    usCode: '1212', // Kraków-Stare Miasto
    terytCode: '1261011',
    simcId: '0950463',
    ulicId: null,
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 3,
  },
  {
    usCode: '1008', // Łódź-Bałuty (ul. Ametystowa)
    terytCode: '1061011',
    simcId: '0957650',
    ulicId: '00130',
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 2,
  },
  {
    usCode: '1013', // Łódź-Śródmieście (city default)
    terytCode: '1061011',
    simcId: '0957650',
    ulicId: null,
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 3,
  },
  {
    usCode: '0227', // Wrocław-Stare Miasto
    terytCode: '0264011',
    simcId: '0986283',
    ulicId: null,
    buildingParity: 'ALL',
    buildingFrom: null,
    buildingTo: null,
    priority: 3,
  },
];
