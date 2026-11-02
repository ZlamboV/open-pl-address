# Polish State Registries Specification

This specification documents the official registers, legal structures, and identifier systems established by the Polish public administration for territorial division, addresses, and tax collection.

---

## 1. Overview of State Registers

Polish address and territorial intelligence is governed by three primary government institutions:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Polish State Registries                         │
└──────────────────┬─────────────────┬─────────────────┬─────────────────┘
                   │                 │                 │
                   ▼                 ▼                 ▼
          ┌────────────────┐ ┌───────────────┐ ┌───────────────┐
          │   GUS TERYT    │ │   GUGiK PRG   │ │    MF CRD     │
          │ (Stat. Office) │ │ (Geodesy HQ)  │ │ (Min. Finance)│
          ├────────────────┤ ├───────────────┤ ├───────────────┤
          │ - TERC (7-dig) │ │ - 8.5M house  │ │ - 4-digit tax │
          │ - SIMC (7-dig) │ │   numbers     │ │   office codes│
          │ - ULIC (5-dig) │ │ - Coordinates │ │ - Territorial │
          │                │ │ - Post codes  │ │   regulations │
          └────────────────┘ └───────────────┘ └───────────────┘
```

1. **Główny Urząd Statystyczny (GUS)**: Maintains the **TERYT** (*Krajowy Rejestr Urzędowego Podziału Terytorialnego Kraju*), defining Poland's administrative tree, localities, and streets.
2. **Główny Urząd Geodezji i Kartografii (GUGiK)**: Maintains the **PRG** (*Państwowy Rejestr Granic i Powierzchni Jednostek Podziału Terytorialnego Kraju*), tracking exact geodetic address points (house numbers and building coordinates).
3. **Ministerstwo Finansów (MF)**: Maintains the **CRD** (*Centralny Rejestr Danych*), defining 4-digit tax office identifiers and decrees regulating their territorial jurisdiction.

---

## 2. GUS TERYT Architecture

The TERYT register comprises three interrelated sub-systems: **TERC**, **SIMC**, and **ULIC**.

### 2.1 TERC — Administrative Units (7 Digits)

The TERC code uniquely identifies every voivodeship, powiat, and gmina in Poland. It consists of exactly 7 digits formatted as:

```
   [W W]         [P P]         [G G]        [R]
Voivodeship     Powiat         Gmina     Type (Rodzaj)
  (2 dig)       (2 dig)       (2 dig)      (1 dig)
```

#### Example Breakdown: `0663011` (m. Lublin)
- `06`: Województwo Lubelskie
- `63`: Miasto na prawach powiatu (City with county rights) Lublin
- `01`: Gmina Lublin
- `1`: Rodzaj gminy = Gmina miejska (Urban municipality)

#### Official `Rodzaj gminy` (Type Digit 7) Classification:
| Code | Name in Polish | English Translation | Practical Meaning |
| :---: | :--- | :--- | :--- |
| `1` | Gmina miejska | Urban municipality | City acting as its own standalone municipality |
| `2` | Gmina wiejska | Rural municipality | Rural territory without urban city rights |
| `3` | Gmina miejsko-wiejska | Urban-rural municipality | Combined municipality containing a town and rural settlements |
| `4` | Miasto w gminie miejsko-wiejskiej | Town in an urban-rural municipality | The urban town portion of a type 3 municipality |
| `5` | Obszar wiejski w gminie miejsko-wiejskiej | Rural area in an urban-rural municipality | The rural territory portion of a type 3 municipality |
| `8` | Dzielnica w m.st. Warszawa | Warsaw district | One of the 18 official districts of Warsaw (e.g., Mokotów, Śródmieście) |
| `9` | Delegatura w miastach na prawach powiatu | City delegature | Administrative delegature in Kraków, Łódź, Poznań, or Wrocław |

> **Critical for ZUS Płatnik**: The Polish Social Insurance Institution (ZUS) mandates the full 7-digit TERC code in KEDU XML schemas (`<kodTerytGminy>`). Submitting 6 digits or omitting the type digit results in document validation failure.

---

### 2.2 SIMC — Populated Localities (7 Digits)

The SIMC (*System Identyfikatorów i Nazw Miejscowości*) system assigns a permanent, unique 7-digit number to every city, town, village, settlement, and hamlet in Poland.

- **Example**: `0954995` identifies the city of **Lublin**; `0918123` identifies **Warszawa**; `0379114` identifies the village of **Biskupice**.
- **Permanence**: SIMC identifiers are immutable. Even if a village changes its gmina affiliation or municipal boundaries change, its SIMC code remains invariant.
- **Hierarchical Linking**: In `open-pl-address`, every city record links directly to its parent TERC code:
  ```sql
  SELECT c.simc_id, c.name, t.wojewodztwo, t.powiat, t.gmina
  FROM cities c
  JOIN terc t ON t.teryt_code = c.teryt_code
  WHERE c.simc_id = '0954995';
  ```

---

### 2.3 ULIC — Streets (5 Digits)

The ULIC (*Rejestr Ulic*) register assigns a 5-digit number to every named street, avenue, square, or boulevard within a municipality.

- **Example**: `24123` identifies **ul. Wieniawska** in Lublin; `11181` identifies **ul. Lipowa**.
- **Cecha (Prefix)**: Every street has an associated official prefix (`cecha`):
  - `ul.` — ulica (street)
  - `al.` — aleja / aleje (avenue)
  - `pl.` — plac (square)
  - `os.` — osiedle (housing estate)
  - `skwer` — skwer (public square/garden)
  - `rondo` — rondo (roundabout)
  - `bulw.` — bulwar (boulevard)

---

## 3. GUGiK PRG — Address Points (House Numbers)

While GUS TERYT standardizes territorial boundaries down to street names, it does **not** register individual building numbers. Individual house numbers and geographic coordinates are maintained by the Head Office of Geodesy and Cartography (**GUGiK**) in the **PRG** (*Państwowy Rejestr Granic*).

### Characteristics of PRG Address Points:
1. **Volume**: Poland contains approximately **8,500,000 official address points**.
2. **Numbering Conventions**:
   - Pure numeric: `1`, `12`, `145`
   - Numeric with alphabetical suffixes: `12A`, `12B`, `34C/1`
   - Fractional / compound ranges: `15/17`, `84/92`
   - Extension markers: `4 bis`, `10/lok. 2`
3. **Postal Code Assignment**: Each PRG address point is linked to its official Poczta Polska Postal Code (`XX-XXX`). On long avenues that cross postal zones, distinct house numbers carry different postal codes.

---

## 4. Villages Without Streets (Miejscowości bezulicowe)

In rural Poland, a large portion of villages and hamlets have no street names. In these localities:
- Building numbers are assigned directly within the village (e.g. `Biskupice 4A`, `Biskupice 12`).
- In official state databases, the `ulic_id` is `NULL`.
- In ERP and tax software, the `ulica` field must remain blank or `null`, and the building number is attached directly to the locality (`miejscowosc`).

### Handling in `open-pl-address`:

The SDK seamlessly handles both urban street addresses and rural streetless addresses:

```typescript
import { PolishAddressSDK } from 'open-pl-address';

const sdk = new PolishAddressSDK();
await sdk.initialize();

// Scenario A: Urban Address with Street
const urbanValidation = sdk.validateBuilding('0954995', '24123', '12'); // Lublin, ul. Wieniawska 12
console.log(urbanValidation.exists); // true

// Scenario B: Rural Village without Street (ulicId is null)
const ruralValidation = sdk.validateBuilding('0379114', null, '4A'); // Biskupice 4A
console.log(ruralValidation.exists); // true
console.log(ruralValidation.postalCode); // "21-020"
```

---

## 5. Text Normalization & Transliteration Specification

Address input frequently contains typos, missing diacritics, or foreign keyboard alphabets. The `TextNormalizer` module applies an automated multi-stage normalization pipeline:

### 5.1 Polish Diacritic Mapping
Polish characters are mapped to ASCII equivalents:
```
ą -> a      Ą -> A
ć -> c      Ć -> C
ę -> e      Ę -> E
ł -> l      Ł -> L
ń -> n      Ń -> N
ó -> o      Ó -> O
ś -> s      Ś -> S
ź -> z      Ź -> Z
ż -> z      Ż -> Z
```

### 5.2 Ukrainian and Russian Cyrillic Transliteration
When characters in Unicode range `[\u0400-\u04FF]` are detected:
1. **Dictionary Lookup**: Checks 63 known Polish administrative cities and common address nouns:
   - `люблін` -> `lublin`
   - `варшава` -> `warszawa`
   - `краків` / `краков` -> `krakow`
   - `лодзь` -> `lodz`
   - `вроцлав` -> `wroclaw`
   - `познань` -> `poznan`
   - `гданськ` -> `gdansk`
   - `вулиця` / `вул` -> stripped
2. **56 Phonetic Substitution Rules**:
   - `щ` -> `szcz`
   - `ч` -> `cz`
   - `ш` -> `sz`
   - `ж` -> `z`
   - `х` -> `ch`
   - `ць` -> `c`
   - `дз` -> `dz`
   - `є` -> `ie`
   - `ї` -> `i`
   - `ю` -> `iu`
   - `я` -> `ia`
   - Apostrophes (`'"`’ʼ`) removed.

This allows search inputs like `"Люблін, вул. Липова 12"` or `"Вроцлав Свидницька 5"` to seamlessly match the canonical records in `< 1 ms`.
