import * as readline from 'node:readline';
import * as fs from 'node:fs';
import { normalizeBuildingNumber, normalizePostalCode } from '../normalizer.ts';

export interface PrgAddressRecord {
  simcId: string;
  ulicId: string | null;
  cecha: string;
  streetName: string;
  cityName: string;
  buildingNumber: string;
  postalCode: string;
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  terytCode?: string;
}

export interface AggregatedStreetEntry {
  simcId: string;
  ulicId: string | null;
  cecha: string;
  name: string;
  buildingsMap: Record<string, string[]>;
}

export interface AggregatedCityEntry {
  simcId: string;
  terytCode: string;
  name: string;
  postalCodes: Set<string>;
}

export interface AggregatedTercEntry {
  terytCode: string;
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  rodzajGminy: string;
}

/**
 * Streaming parser for PRG Address Points CSV (Państwowy Rejestr Granic).
 * Supports standard GUGiK format (semicolon or comma delimited).
 */
export async function parsePrgCsvStream(
  filePath: string,
  onBatch: (streets: AggregatedStreetEntry[], cities: AggregatedCityEntry[], tercs: AggregatedTercEntry[]) => Promise<void>,
  batchSize: number = 0
): Promise<{ totalRows: number; totalStreets: number }> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PRG CSV file not found: ${filePath}`);
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let delimiter = ';';
  let headers: string[] = [];
  let lineIndex = 0;
  let totalRows = 0;

  // Key: `${simcId}:${ulicId ?? ''}` -> AggregatedStreetEntry with Set of buildings
  const streetMap = new Map<string, {
    simcId: string;
    ulicId: string | null;
    cecha: string;
    name: string;
    buildings: Map<string, Set<string>>;
  }>();

  const cityMap = new Map<string, AggregatedCityEntry>();
  const tercMap = new Map<string, AggregatedTercEntry>();

  let colSimc = -1;
  let colUlic = -1;
  let colCecha = -1;
  let colStreet = -1;
  let colCity = -1;
  let colBuilding = -1;
  let colPna = -1;
  let colWoj = -1;
  let colPow = -1;
  let colGmi = -1;
  let colTeryt = -1;

  for await (const line of rl) {
    if (!line || line.trim() === '') continue;

    if (lineIndex === 0) {
      if (line.includes(';') && !line.includes(',')) delimiter = ';';
      else if (line.includes(',') && !line.includes(';')) delimiter = ',';
      else if (line.includes('\t')) delimiter = '\t';

      headers = line.split(delimiter).map((h) => h.trim().replace(/^"|"$/g, '').toUpperCase());

      // Auto-detect column headers based on GUGiK PRG and Dane.gov.pl naming conventions
      colSimc = headers.findIndex((h) => h.includes('SIMC') || h === 'ID_MIEJSCOWOSCI' || h === 'SYM');
      colUlic = headers.findIndex((h) => h.includes('ULIC') || h === 'ID_ULICY' || h === 'SYM_UL');
      colCecha = headers.findIndex((h) => h.includes('CECHA'));
      colStreet = headers.findIndex((h) => h.includes('ULIC') && h.includes('NAZW') || h === 'ULICA' || h === 'NAZWA_ULICY');
      colCity = headers.findIndex((h) => h.includes('MIEJSC') || h === 'MIEJSCOWOSC' || h === 'NAZWA_MIEJSCOWOSCI');
      colBuilding = headers.findIndex((h) => h.includes('NUMER') || h === 'NR' || h === 'NUMER_PORZADKOWY');
      colPna = headers.findIndex((h) => h.includes('KOD') || h.includes('PNA') || h === 'KOD_POCZTOWY');
      colWoj = headers.findIndex((h) => h.includes('WOJ'));
      colPow = headers.findIndex((h) => h.includes('POW'));
      colGmi = headers.findIndex((h) => h.includes('GMI'));
      colTeryt = headers.findIndex((h) => h === 'TERYT' || h === 'KOD_TERYT' || h === 'TERC');

      lineIndex++;
      continue;
    }

    const parts = line.split(delimiter).map((p) => p.trim().replace(/^"|"$/g, ''));
    totalRows++;

    const simcId = colSimc !== -1 && parts[colSimc] ? parts[colSimc] : '0000000';
    const ulicId = colUlic !== -1 && parts[colUlic] ? parts[colUlic] : null;
    const cecha = colCecha !== -1 && parts[colCecha] ? parts[colCecha] : (ulicId ? 'ul.' : '');
    const cityName = colCity !== -1 && parts[colCity] ? parts[colCity] : 'Nieznana';
    const streetName = colStreet !== -1 && parts[colStreet] ? parts[colStreet] : (ulicId ? 'Główna' : cityName);
    const rawBuilding = colBuilding !== -1 && parts[colBuilding] ? parts[colBuilding] : '';
    const rawPna = colPna !== -1 && parts[colPna] ? parts[colPna] : '';

    const postalCode = normalizePostalCode(rawPna);
    const buildingNumber = normalizeBuildingNumber(rawBuilding);

    const woj = colWoj !== -1 && parts[colWoj] ? parts[colWoj] : '';
    const pow = colPow !== -1 && parts[colPow] ? parts[colPow] : '';
    const gmi = colGmi !== -1 && parts[colGmi] ? parts[colGmi] : '';
    const teryt = colTeryt !== -1 && parts[colTeryt] ? parts[colTeryt] : (simcId.slice(0, 6) + '1');

    // Aggregate TERC
    if (!tercMap.has(teryt)) {
      tercMap.set(teryt, {
        terytCode: teryt,
        wojewodztwo: woj.toUpperCase(),
        powiat: pow,
        gmina: gmi,
        rodzajGminy: teryt.length >= 7 ? teryt.slice(6, 7) : '1',
      });
    }

    // Aggregate City
    let city = cityMap.get(simcId);
    if (!city) {
      city = {
        simcId,
        terytCode: teryt,
        name: cityName,
        postalCodes: new Set<string>(),
      };
      cityMap.set(simcId, city);
    }
    if (postalCode) {
      city.postalCodes.add(postalCode);
    }

    // Aggregate Street & Buildings
    const streetKey = `${simcId}:${ulicId ?? ''}`;
    let street = streetMap.get(streetKey);
    if (!street) {
      street = {
        simcId,
        ulicId: ulicId && ulicId.length > 0 ? ulicId : null,
        cecha,
        name: streetName,
        buildings: new Map<string, Set<string>>(),
      };
      streetMap.set(streetKey, street);
    }

    if (postalCode && buildingNumber) {
      let bSet = street.buildings.get(postalCode);
      if (!bSet) {
        bSet = new Set<string>();
        street.buildings.set(postalCode, bSet);
      }
      bSet.add(buildingNumber);
    }

    // Flush batch if reached (when batchSize > 0)
    if (batchSize > 0 && streetMap.size >= batchSize) {
      const streetBatch: AggregatedStreetEntry[] = [];
      for (const s of streetMap.values()) {
        const buildingsMap: Record<string, string[]> = {};
        for (const [code, set] of s.buildings.entries()) {
          buildingsMap[code] = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        }
        streetBatch.push({
          simcId: s.simcId,
          ulicId: s.ulicId,
          cecha: s.cecha,
          name: s.name,
          buildingsMap,
        });
      }

      await onBatch(streetBatch, Array.from(cityMap.values()), Array.from(tercMap.values()));
      streetMap.clear();
      cityMap.clear();
      tercMap.clear();
    }

    lineIndex++;
  }

  // Final flush
  if (streetMap.size > 0 || cityMap.size > 0) {
    const streetBatch: AggregatedStreetEntry[] = [];
    for (const s of streetMap.values()) {
      const buildingsMap: Record<string, string[]> = {};
      for (const [code, set] of s.buildings.entries()) {
        buildingsMap[code] = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      }
      streetBatch.push({
        simcId: s.simcId,
        ulicId: s.ulicId,
        cecha: s.cecha,
        name: s.name,
        buildingsMap,
      });
    }

    await onBatch(streetBatch, Array.from(cityMap.values()), Array.from(tercMap.values()));
    streetMap.clear();
    cityMap.clear();
    tercMap.clear();
  }

  return { totalRows, totalStreets: streetMap.size };
}
