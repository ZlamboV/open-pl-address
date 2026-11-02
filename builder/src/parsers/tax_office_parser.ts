/**
 * Parser for Ministerstwo Finansów official Tax Offices XML/XSD schema.
 * Source: http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/KodyUrzedowSkarbowych/KodyUrzedowSkarbowych_v8-0E.xsd
 */

export interface ParsedTaxOffice {
  usCode: string;
  name: string;
}

/**
 * Parses XML/XSD enumeration schema to extract 4-digit code and official office name.
 * Handles tags:
 *   <xsd:enumeration value="XXXX">
 *     <xsd:annotation>
 *       <xsd:documentation>NAZWA</xsd:documentation>
 *     </xsd:annotation>
 *   </xsd:enumeration>
 */
export function parseTaxOfficesFromXsd(xsdContent: string): ParsedTaxOffice[] {
  const results: ParsedTaxOffice[] = [];
  const enumRegex = /<xsd:enumeration\s+value="(\d{4})">([\s\S]*?)<\/xsd:enumeration>/g;
  const docRegex = /<xsd:documentation>([\s\S]*?)<\/xsd:documentation>/;

  let match: RegExpExecArray | null;
  while ((match = enumRegex.exec(xsdContent)) !== null) {
    const usCode = match[1];
    const innerContent = match[2];
    const docMatch = docRegex.exec(innerContent);
    const rawName = docMatch ? docMatch[1].trim() : '';

    if (usCode && rawName) {
      results.push({
        usCode,
        name: rawName,
      });
    }
  }

  return results;
}
