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
    postalCodes: ['20-001', '20-002', '20-020', '20-024', '20-029', '20-059', '20-071', '20-074', '20-076', '20-080', '20-601'],
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
    postalCodes: ['90-001', '90-006', '90-418'],
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
];
