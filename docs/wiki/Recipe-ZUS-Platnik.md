# Recipe: ZUS Płatnik & PIT-11 Integration

In Poland, payroll departments, HR software providers, and accounting agencies must generate electronic declarations for the Social Insurance Institution (**ZUS**) and the Ministry of Finance (**Ministerstwo Finansów**).

This recipe explains how to use `open-pl-address` to validate employee addresses and generate compliant XML payloads for:
1. **ZUS Płatnik** (KEDU 5.4 / 5.5 XML schema for **ZUS ZUA** and **ZUS ZZA** declarations).
2. **PIT-11** (current form PIT-11(29) for annual employee tax reporting).

---

## 1. Compliance Requirements

### 1.1 The 7-Digit TERC Gmina Rule
Under ZUS technical specifications for KEDU XML, the gmina must be identified by its exact **7-digit TERC code** in element `<kodTerytGminy>`:
```
  [0 6]       [6 3]        [0 1]      [1]
Voivodeship   Powiat       Gmina     Rodzaj
(Lubelskie)  (m. Lublin)  (Lublin)  (1 = gmina miejska)
```
Omitting the 7th type digit (`rodzaj_gminy`) or providing an incorrect county code causes immediate document rejection during Płatnik file verification.

### 1.2 The Tax Residence Rule (*Miejsce Zamieszkania*)
Under Article 45 § 1 of the Polish PIT Act, personal income tax declarations must be sent to the **Urząd Skarbowy competent for the taxpayer's actual place of residence on December 31**. Administrative registration (*zameldowanie*) has no legal authority over PIT-11 jurisdiction.

---

## 2. Full TypeScript / Node.js Implementation

The following complete module validates employee address data and generates valid XML blocks:

```typescript
import { PolishAddressSDK, type NormalizedAddress, type ValidationResult } from 'open-pl-address';

export class PayrollAddressService {
  private sdk: PolishAddressSDK;

  constructor() {
    this.sdk = new PolishAddressSDK();
  }

  public async initialize(): Promise<void> {
    await this.sdk.initialize();
  }

  /**
   * Validates employee address and generates both ZUS KEDU and PIT-11 XML blocks.
   */
  public processEmployeeAddress(rawAddress: {
    miejscowosc: string;
    ulica?: string;
    nrDomu: string;
    nrLokalu?: string;
    kodPocztowy?: string;
  }): {
    validation: ValidationResult;
    keduXml?: string;
    pit11Xml?: string;
  } {
    const validation = this.sdk.validateAndFormatForExport(rawAddress);

    if (!validation.isValid || !validation.normalized) {
      return { validation };
    }

    const keduXml = this.generateKeduAddressBlock(validation.normalized);
    const pit11Xml = this.generatePit11AddressBlock(validation.normalized);

    return {
      validation,
      keduXml,
      pit11Xml
    };
  }

  /**
   * Generates a compliant <adresZamieszkania> block for ZUS KEDU XML.
   */
  public generateKeduAddressBlock(norm: NormalizedAddress): string {
    // In KEDU, postal code is stored without hyphens (e.g., 20029)
    const rawPostal = norm.kodPocztowy.replace('-', '');

    // Format street with official prefix (cecha) if present
    const streetTag = norm.ulica
      ? `<ulica>${this.escapeXml(norm.cechaUlicy ? `${norm.cechaUlicy} ${norm.ulica}` : norm.ulica)}</ulica>`
      : '';

    const localTag = norm.nrLokalu
      ? `<nrLokalu>${this.escapeXml(norm.nrLokalu)}</nrLokalu>`
      : '';

    return `
<adresZamieszkania>
  <kodPocztowy>${rawPostal}</kodPocztowy>
  <miejscowosc>${this.escapeXml(norm.miejscowosc)}</miejscowosc>
  ${streetTag}
  <numerDomu>${this.escapeXml(norm.nrDomu)}</numerDomu>
  ${localTag}
  <nazwaGminy>${this.escapeXml(norm.gmina)}</nazwaGminy>
  <kodTerytGminy>${norm.terytGminaCode}</kodTerytGminy>
  <kodWojewodztwa>${norm.terytGminaCode.substring(0, 2)}</kodWojewodztwa>
</adresZamieszkania>`.trim();
  }

  /**
   * Generates compliant <Naglowek> and <AdresZamieszkania> blocks for PIT-11.
   */
  public generatePit11AddressBlock(norm: NormalizedAddress): string {
    if (!norm.taxOffice) {
      throw new Error(`Cannot generate PIT-11 without resolved Tax Office for ${norm.miejscowosc}`);
    }

    const streetTag = norm.ulica
      ? `<Ulica>${this.escapeXml(norm.ulica)}</Ulica>`
      : '';

    const localTag = norm.nrLokalu
      ? `<NrLokalu>${this.escapeXml(norm.nrLokalu)}</NrLokalu>`
      : '';

    return `
<!-- Formularz PIT-11: Nagłówek Urzędu Skarbowego -->
<Naglowek>
  <KodUrzedu>${norm.taxOffice.usCode}</KodUrzedu>
  <NazwaUrzedu>${this.escapeXml(norm.taxOffice.name)}</NazwaUrzedu>
</Naglowek>

<!-- Formularz PIT-11: Adres Zamieszkania Podatnika -->
<AdresZamieszkania>
  <AdresPolski>
    <Wojewodztwo>${this.escapeXml(norm.wojewodztwo)}</Wojewodztwo>
    <Powiat>${this.escapeXml(norm.powiat)}</Powiat>
    <Gmina>${this.escapeXml(norm.gmina)}</Gmina>
    ${streetTag}
    <NrDomu>${this.escapeXml(norm.nrDomu)}</NrDomu>
    ${localTag}
    <Miejscowosc>${this.escapeXml(norm.miejscowosc)}</Miejscowosc>
    <KodPocztowy>${norm.kodPocztowy}</KodPocztowy>
  </AdresPolski>
</AdresZamieszkania>`.trim();
  }

  private escapeXml(value: string): string {
    return value.replace(/[<>&'"]/g, (c) => {
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

  public close(): void {
    this.sdk.close();
  }
}
```

---

## 3. Execution & Verification

Run the service with a real address:

```typescript
async function test() {
  const service = new PayrollAddressService();
  await service.initialize();

  const result = service.processEmployeeAddress({
    miejscowosc: 'Lublin',
    ulica: 'Wieniawska',
    nrDomu: '12',
    nrLokalu: '4'
  });

  if (result.validation.isValid) {
    console.log('--- ZUS KEDU XML ---');
    console.log(result.keduXml);
    console.log('\n--- PIT-11 XML ---');
    console.log(result.pit11Xml);
  }

  service.close();
}

test();
```

### Generated Output:

```xml
--- ZUS KEDU XML ---
<adresZamieszkania>
  <kodPocztowy>20029</kodPocztowy>
  <miejscowosc>Lublin</miejscowosc>
  <ulica>ul. Wieniawska</ulica>
  <numerDomu>12</numerDomu>
  <nrLokalu>4</nrLokalu>
  <nazwaGminy>Lublin</nazwaGminy>
  <kodTerytGminy>0663011</kodTerytGminy>
  <kodWojewodztwa>06</kodWojewodztwa>
</adresZamieszkania>

--- PIT-11 XML ---
<!-- Formularz PIT-11: Nagłówek Urzędu Skarbowego -->
<Naglowek>
  <KodUrzedu>0610</KodUrzedu>
  <NazwaUrzedu>Pierwszy Urząd Skarbowy w Lublinie</NazwaUrzedu>
</Naglowek>

<!-- Formularz PIT-11: Adres Zamieszkania Podatnika -->
<AdresZamieszkania>
  <AdresPolski>
    <Wojewodztwo>LUBELSKIE</Wojewodztwo>
    <Powiat>m. Lublin</Powiat>
    <Gmina>Lublin</Gmina>
    <Ulica>Wieniawska</Ulica>
    <NrDomu>12</NrDomu>
    <NrLokalu>4</NrLokalu>
    <Miejscowosc>Lublin</Miejscowosc>
    <KodPocztowy>20-029</KodPocztowy>
  </AdresPolski>
</AdresZamieszkania>
```

---

## 4. XML Field Mapping Reference

| Requirement | open-pl-address Property | ZUS KEDU Tag | PIT-11 Tag |
| :--- | :--- | :--- | :--- |
| **Gmina 7-Digit TERC** | `norm.terytGminaCode` | `<kodTerytGminy>` | Implicit via `<Gmina>` |
| **Voivodeship Code** | `norm.terytGminaCode.slice(0, 2)` | `<kodWojewodztwa>` | `<Wojewodztwo>` |
| **Locality Name** | `norm.miejscowosc` | `<miejscowosc>` | `<Miejscowosc>` |
| **Street Name** | `norm.ulica` | `<ulica>` | `<Ulica>` |
| **Building Number** | `norm.nrDomu` | `<numerDomu>` | `<NrDomu>` |
| **Apartment Number**| `norm.nrLokalu` | `<nrLokalu>` | `<NrLokalu>` |
| **Postal Code** | `norm.kodPocztowy` | `<kodPocztowy>` (digits only) | `<KodPocztowy>` (XX-XXX) |
| **Tax Office Code** | `norm.taxOffice.usCode` | N/A | `<KodUrzedu>` |
| **Tax Office Name** | `norm.taxOffice.name` | N/A | `<NazwaUrzedu>` |
