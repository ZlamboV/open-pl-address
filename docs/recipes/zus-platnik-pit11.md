# Recipe 3: ZUS Płatnik & PIT-11 Address & Tax Office Generation

In Poland, reporting employee data to the Social Insurance Institution (**ZUS**) and the Ministry of Finance (**Ministerstwo Finansów**) is governed by strict electronic schemas:
- **ZUS Płatnik**: Uses the **KEDU** XML schema (current version 5.4 / 5.5) for employee registration documents (**ZUS ZUA**, **ZUS ZZA**).
- **PIT-11**: Uses the official Ministry of Finance XSD schema (current form **PIT-11(29)**) to report taxable income and withholdings.

Filing incorrect address codes results in rejected declarations, audit inquiries, or misallocated tax advances.

---

## 1. Regulatory Background: Zameldowanie vs. Miejsce Zamieszkania

> [!IMPORTANT]
> **Adres Zameldowania ≠ Adres do ZUS / PIT**
> - **Zameldowanie**: A legacy administrative registration at the municipal office (*Urząd Gminy / Urząd Miasta*). It has **zero legal relevance** to tax residency or social security jurisdiction.
> - **Miejsce Zamieszkania (Place of Residence)**: Defined by Article 25 of the Polish Civil Code (*Kodeks cywilny*) as the locality in which an individual resides with the intention of permanent stay. This is the **sole determining factor** for PIT-11 and ZUS jurisdiction.

---

## 2. Structure of Required Codes

### A. GUS 7-digit TERC Code (ZUS Płatnik)
ZUS documents require identifying the gmina via its exact 7-digit TERC code:
```
  [0 6]       [6 3]        [0 1]      [1]
Województwo   Powiat       Gmina     Rodzaj
(Lubelskie)  (m. Lublin)  (Lublin)  (1 = gmina miejska)
```
- `Rodzaj gminy` identifiers:
  - `1`: Gmina miejska (urban municipality)
  - `2`: Gmina wiejska (rural municipality)
  - `3`: Gmina miejsko-wiejska (urban-rural municipality)
  - `4`: Miasto w gminie miejsko-wiejskiej (town in an urban-rural municipality)
  - `5`: Obszar wiejski w gminie miejsko-wiejskiej (rural area in an urban-rural municipality)
  - `8`: Dzielnica w m.st. Warszawa (Warsaw district)
  - `9`: Delegatura w m. Kraków / Łódź / Poznań / Wrocław

`open-pl-address` guarantees 100% correct 7-digit TERC codes via the `terytGminaCode` property.

### B. 4-digit MF CRD Tax Office Code (PIT-11)
Ministry of Finance Centralny Rejestr Danych (CRD) identifies tax offices using 4 digits:
- The first 2 digits represent the voivodeship code (e.g. `06` for Lubelskie, `14` for Mazowieckie, `30` for Wielkopolskie).
- The last 2 digits represent the specific inspection unit (e.g. `0610` for Pierwszy US w Lublinie, `1424` for US Warszawa-Mokotów, `3023` for US Poznań-Grunwald).

---

## 3. Generating ZUS KEDU XML (ZUS ZUA / ZUS ZZA)

Here is a TypeScript function using `open-pl-address` to produce valid KEDU XML address blocks:

```typescript
import { PolishAddressSDK, type NormalizedAddress } from 'open-pl-address';

const sdk = new PolishAddressSDK();
await sdk.initialize();

export function generateKeduAddressBlock(norm: NormalizedAddress): string {
  // In ZUS KEDU, ulica is omitted or empty if the locality has no streets
  const streetTag = norm.ulica 
    ? `<ulica>${escapeXml(norm.cechaUlicy ? `${norm.cechaUlicy} ${norm.ulica}` : norm.ulica)}</ulica>` 
    : '';

  const localTag = norm.nrLokalu 
    ? `<nrLokalu>${escapeXml(norm.nrLokalu)}</nrLokalu>` 
    : '';

  return `
    <adresZamieszkania>
      <kodPocztowy>${norm.kodPocztowy.replace('-', '')}</kodPocztowy>
      <miejscowosc>${escapeXml(norm.miejscowosc)}</miejscowosc>
      ${streetTag}
      <numerDomu>${escapeXml(norm.nrDomu)}</numerDomu>
      ${localTag}
      <nazwaGminy>${escapeXml(norm.gmina)}</nazwaGminy>
      <kodTerytGminy>${norm.terytGminaCode}</kodTerytGminy>
      <kodWojewodztwa>${norm.terytGminaCode.substring(0, 2)}</kodWojewodztwa>
    </adresZamieszkania>
  `.trim();
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Example usage:
const validation = sdk.validateAndFormatForExport({
  miejscowosc: 'Lublin',
  ulica: 'Wieniawska',
  nrDomu: '12',
  nrLokalu: '4',
});

if (validation.isValid && validation.normalized) {
  console.log(generateKeduAddressBlock(validation.normalized));
}
```

---

## 4. Generating PIT-11 XML Address & Tax Office Block

Below is the PIT-11 XML block representing Part B (`Dane podatnika`) and Part C (`Urząd Skarbowy`):

```typescript
export function generatePit11Xml(norm: NormalizedAddress): string {
  if (!norm.taxOffice) {
    throw new Error(`Cannot generate PIT-11 without resolved Tax Office for address in ${norm.miejscowosc}`);
  }

  return `
  <!-- Nagłówek formularza PIT-11 -->
  <Naglowek>
    <KodUrzedu>${norm.taxOffice.usCode}</KodUrzedu>
    <NazwaUrzedu>${escapeXml(norm.taxOffice.name)}</NazwaUrzedu>
  </Naglowek>

  <!-- Miejsce zamieszkania podatnika w ostatnim dniu roku podatkowego -->
  <AdresZamieszkania>
    <AdresPolski>
      <Wojewodztwo>${escapeXml(norm.wojewodztwo)}</Wojewodztwo>
      <Powiat>${escapeXml(norm.powiat)}</Powiat>
      <Gmina>${escapeXml(norm.gmina)}</Gmina>
      ${norm.ulica ? `<Ulica>${escapeXml(norm.ulica)}</Ulica>` : ''}
      <NrDomu>${escapeXml(norm.nrDomu)}</NrDomu>
      ${norm.nrLokalu ? `<NrLokalu>${escapeXml(norm.nrLokalu)}</NrLokalu>` : ''}
      <Miejscowosc>${escapeXml(norm.miejscowosc)}</Miejscowosc>
      <KodPocztowy>${norm.kodPocztowy}</KodPocztowy>
    </AdresPolski>
  </AdresZamieszkania>
  `.trim();
}
```

---

## 5. Summary Table for Developers

| Requirement | Handled by `open-pl-address` | Output Property |
| :--- | :--- | :--- |
| **7-digit TERC Gmina Code** | Yes, canonical GUS database | `normalized.terytGminaCode` |
| **7-digit SIMC Locality Code** | Yes, canonical GUS database | `normalized.simcId` |
| **5-digit ULIC Street Code** | Yes, canonical GUS database | `normalized.ulicId` |
| **House Number Validation** | Yes, against official PRG address points | `validation.isValid`, `normalized.nrDomu` |
| **4-digit MF Urząd Skarbowy** | Yes, official CRD XSD schema rules | `taxOffice.usCode`, `taxOffice.name` |
| **Cyrillic Transliteration** | Yes, automatic phonetic normalizer | Handled in `searchCity()` & `searchStreet()` |
