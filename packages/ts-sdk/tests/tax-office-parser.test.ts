import test from 'node:test';
import assert from 'node:assert';
import { parseTaxOfficesFromXsd } from '../../../builder/src/parsers/tax_office_parser.ts';

test('TaxOfficeParser - extracts 4-digit codes and names from official MF CRD XSD schema', () => {
  const sampleXsd = `
    <?xml version="1.0" encoding="UTF-8"?>
    <xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
      <xsd:simpleType name="TKodUS">
        <xsd:restriction base="xsd:string">
          <xsd:enumeration value="0610">
            <xsd:annotation>
              <xsd:documentation>PIERWSZY URZĄD SKARBOWY W LUBLINIE</xsd:documentation>
            </xsd:annotation>
          </xsd:enumeration>
          <xsd:enumeration value="0611">
            <xsd:annotation>
              <xsd:documentation>DRUGI URZĄD SKARBOWY W LUBLINIE</xsd:documentation>
            </xsd:annotation>
          </xsd:enumeration>
          <xsd:enumeration value="0612">
            <xsd:annotation>
              <xsd:documentation>TRZECI URZĄD SKARBOWY W LUBLINIE</xsd:documentation>
            </xsd:annotation>
          </xsd:enumeration>
        </xsd:restriction>
      </xsd:simpleType>
    </xsd:schema>
  `;

  const parsed = parseTaxOfficesFromXsd(sampleXsd);
  assert.strictEqual(parsed.length, 3);
  assert.deepStrictEqual(parsed[0], {
    usCode: '0610',
    name: 'PIERWSZY URZĄD SKARBOWY W LUBLINIE',
  });
  assert.deepStrictEqual(parsed[1], {
    usCode: '0611',
    name: 'DRUGI URZĄD SKARBOWY W LUBLINIE',
  });
  assert.deepStrictEqual(parsed[2], {
    usCode: '0612',
    name: 'TRZECI URZĄD SKARBOWY W LUBLINIE',
  });
});
