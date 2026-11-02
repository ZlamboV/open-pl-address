import type { PolishAddressSDK } from 'open-pl-address';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'search_polish_city',
    description:
      'Search for a Polish city or locality by name with support for Polish diacritics and Cyrillic transliteration. Returns SIMC code, gmina TERYT, powiat, and voivodeship.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "City or locality name in Polish or Cyrillic (e.g. 'Warszawa', 'Варшава', 'Krakow', 'Краков', 'Lodz', 'Люблін')",
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'autocomplete_polish_street',
    description:
      'Autocomplete street name within a specific Polish city using SIMC ID. Returns official street name, ULIC ID, cecha (ul., al., pl.), and available building ranges.',
    inputSchema: {
      type: 'object',
      properties: {
        simcId: {
          type: 'string',
          description: "7-digit SIMC code of the city (e.g. '0954995' for Lublin, '0918123' for Warszawa, '0967667' for Poznań)",
        },
        query: {
          type: 'string',
          description: "Street name or fragment in Polish or Cyrillic (e.g. 'Wieniawska', 'Коперника', 'Marszalkowska')",
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default 10)',
        },
      },
      required: ['simcId', 'query'],
    },
  },
  {
    name: 'validate_polish_address',
    description:
      'Strictly validate a Polish address against official TERYT (TERC, SIMC, ULIC) and GUGiK PRG registries. Resolves house number existence, apartment, canonical spelling, and automatic Urząd Skarbowy (Tax Office) for 100% compliance with ZUS Płatnik and InsERT Gratyfikant nexo.',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: "City or locality name (e.g. 'Lublin', 'Warszawa', 'Wrocław')",
        },
        street: {
          type: 'string',
          description: "Street name (optional for small villages without streets, e.g. 'Wieniawska')",
        },
        buildingNumber: {
          type: 'string',
          description: "Building/house number (e.g. '12', '12A', '23')",
        },
        apartment: {
          type: 'string',
          description: "Apartment/flat number if applicable (e.g. '4')",
        },
        postalCode: {
          type: 'string',
          description: "Optional postal code in XX-XXX format (e.g. '20-029')",
        },
      },
      required: ['city', 'buildingNumber'],
    },
  },
  {
    name: 'resolve_urzad_skarbowy',
    description:
      'Determine the official Polish Tax Office (Urząd Skarbowy) and 4-digit Ministry of Finance CRD code based on territorial jurisdiction hierarchy (Priority 1: street + building parity/range, Priority 2: street, Priority 3: city SIMC, Priority 4: gmina TERC). Crucial for PIT-11 and tax declarations.',
    inputSchema: {
      type: 'object',
      properties: {
        terytCode: {
          type: 'string',
          description: "7-digit TERC code of the gmina (e.g. '0663011' for Lublin, '3064011' for Poznań, '1465011' for Warszawa)",
        },
        simcId: {
          type: 'string',
          description: "7-digit SIMC identifier of the city (e.g. '0954995')",
        },
        ulicId: {
          type: 'string',
          description: "5-digit ULIC code of the street if in a city with streets (e.g. '24123')",
        },
        buildingNumber: {
          type: 'string',
          description: "Building/house number (e.g. '12') to resolve parity or range splits across tax offices",
        },
      },
      required: ['terytCode', 'simcId'],
    },
  },
  {
    name: 'find_by_postal_code',
    description:
      'Look up Polish administrative division, city (SIMC), gmina, powiat, voivodeship, and streets by 5-digit postal code (XX-XXX).',
    inputSchema: {
      type: 'object',
      properties: {
        postalCode: {
          type: 'string',
          description: "Polish postal code in format XX-XXX or XXXXX (e.g. '20-071', '00-001', '60-101')",
        },
      },
      required: ['postalCode'],
    },
  },
];

export async function executeTool(
  sdk: PolishAddressSDK,
  name: string,
  args: Record<string, any>
): Promise<unknown> {
  switch (name) {
    case 'search_polish_city': {
      const query = String(args.query || '');
      const limit = typeof args.limit === 'number' ? args.limit : 10;
      return sdk.searchCity(query, limit);
    }

    case 'autocomplete_polish_street': {
      const simcId = String(args.simcId || '');
      const query = String(args.query || '');
      const limit = typeof args.limit === 'number' ? args.limit : 10;
      return sdk.searchStreet(simcId, query, undefined, limit);
    }

    case 'validate_polish_address': {
      const input = {
        miejscowosc: args.city ? String(args.city) : args.miejscowosc ? String(args.miejscowosc) : undefined,
        ulica: args.street ? String(args.street) : args.ulica ? String(args.ulica) : undefined,
        nrDomu: String(args.buildingNumber || args.nrDomu || ''),
        nrLokalu: args.apartment ? String(args.apartment) : args.nrLokalu ? String(args.nrLokalu) : undefined,
        kodPocztowy: args.postalCode ? String(args.postalCode) : args.kodPocztowy ? String(args.kodPocztowy) : undefined,
        simcId: args.simcId ? String(args.simcId) : undefined,
        ulicId: args.ulicId ? String(args.ulicId) : undefined,
      };
      return sdk.validateAndFormatForExport(input);
    }

    case 'resolve_urzad_skarbowy': {
      const params = {
        terytCode: String(args.terytCode || ''),
        simcId: String(args.simcId || ''),
        ulicId: args.ulicId ? String(args.ulicId) : undefined,
        buildingNumber: args.buildingNumber ? String(args.buildingNumber) : undefined,
      };
      return sdk.resolveTaxOffice(params);
    }

    case 'find_by_postal_code': {
      const postalCode = String(args.postalCode || '');
      return sdk.findByPostalCode(postalCode);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
