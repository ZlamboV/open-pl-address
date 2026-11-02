#!/usr/bin/env node

import { McpServer } from './server.ts';

const server = new McpServer();
server.start().catch((err) => {
  console.error('[open-pl-address-mcp] Fatal error starting server:', err);
  process.exit(1);
});
