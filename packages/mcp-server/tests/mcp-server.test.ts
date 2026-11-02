import test from 'node:test';
import assert from 'node:assert';
import * as path from 'node:path';
import { PolishAddressSDK } from '../../ts-sdk/src/index.ts';
import { McpServer } from '../src/server.ts';
import { TOOLS, executeTool } from '../src/tools.ts';

test('MCP Server - tools registry defines all 5 required tools', () => {
  const toolNames = TOOLS.map((t) => t.name);
  assert.ok(toolNames.includes('search_polish_city'));
  assert.ok(toolNames.includes('autocomplete_polish_street'));
  assert.ok(toolNames.includes('validate_polish_address'));
  assert.ok(toolNames.includes('resolve_urzad_skarbowy'));
  assert.ok(toolNames.includes('find_by_postal_code'));
  assert.strictEqual(TOOLS.length, 5);
});

test('MCP Server - tool execution against database', async () => {
  const dbPath = path.resolve(process.cwd(), 'data/pl_addresses.sqlite');
  const sdk = new PolishAddressSDK({ dbPath });
  await sdk.initialize();

  // 1. search_polish_city (with Cyrillic)
  const cityResult: any = await executeTool(sdk, 'search_polish_city', { query: 'Люблін' });
  assert.ok(Array.isArray(cityResult), 'Should return array of cities');
  assert.ok(cityResult.length > 0);
  assert.strictEqual(cityResult[0].name, 'Lublin');
  assert.strictEqual(cityResult[0].simcId, '0954995');

  // 2. autocomplete_polish_street
  const streetResult: any = await executeTool(sdk, 'autocomplete_polish_street', {
    simcId: '0954995',
    query: 'Wieniaw',
  });
  assert.ok(Array.isArray(streetResult));
  assert.ok(streetResult.some((s: any) => s.name === 'Wieniawska'));

  // 3. validate_polish_address
  const valResult: any = await executeTool(sdk, 'validate_polish_address', {
    city: 'Lublin',
    street: 'Wieniawska',
    buildingNumber: '12',
    apartment: '4',
  });
  assert.strictEqual(valResult.isValid, true);
  assert.strictEqual(valResult.normalized.nrDomu, '12');
  assert.strictEqual(valResult.normalized.nrLokalu, '4');
  assert.ok(valResult.taxOffice, 'Tax office should be resolved');
  assert.strictEqual(valResult.taxOffice.usCode, '0610');

  // 4. resolve_urzad_skarbowy (Priority 1 street+building check in Lublin)
  const taxResult: any = await executeTool(sdk, 'resolve_urzad_skarbowy', {
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '11181', // Lipowa
    buildingNumber: '3', // odd -> Pierwszy US w Lublinie
  });
  assert.ok(taxResult);
  assert.strictEqual(taxResult.usCode, '0610');
  assert.strictEqual(taxResult.name, 'Pierwszy Urząd Skarbowy w Lublinie');

  // 5. find_by_postal_code
  const pnaResult: any = await executeTool(sdk, 'find_by_postal_code', { postalCode: '20-071' });
  assert.ok(pnaResult);
  assert.strictEqual(pnaResult.postalCode, '20-071');
  assert.ok(pnaResult.cities.length > 0);
  assert.strictEqual(pnaResult.cities[0].name, 'Lublin');

  sdk.close();
});

test('MCP Server - handles JSON-RPC requests via handleRequest', async () => {
  const dbPath = path.resolve(process.cwd(), 'data/pl_addresses.sqlite');
  const sdk = new PolishAddressSDK({ dbPath });
  const server = new McpServer(sdk);
  await sdk.initialize();

  // Capture stdout
  const originalWrite = process.stdout.write;
  const writtenChunks: string[] = [];
  process.stdout.write = (chunk: any) => {
    writtenChunks.push(String(chunk));
    return true;
  };

  try {
    // initialize request
    await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' },
    });

    const initResp = JSON.parse(writtenChunks[writtenChunks.length - 1]);
    assert.strictEqual(initResp.id, 1);
    assert.strictEqual(initResp.result.serverInfo.name, 'open-pl-address-mcp');

    // tools/list request
    await server.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    const listResp = JSON.parse(writtenChunks[writtenChunks.length - 1]);
    assert.strictEqual(listResp.id, 2);
    assert.strictEqual(listResp.result.tools.length, 5);

    // tools/call request
    await server.handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search_polish_city',
        arguments: { query: 'Warszawa' },
      },
    });

    const callResp = JSON.parse(writtenChunks[writtenChunks.length - 1]);
    assert.strictEqual(callResp.id, 3);
    assert.ok(callResp.result.content[0].text.includes('Warszawa'));
  } finally {
    process.stdout.write = originalWrite;
    sdk.close();
  }
});
