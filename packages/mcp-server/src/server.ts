import * as readline from 'node:readline';
import { PolishAddressSDK } from '../../ts-sdk/src/index.ts';
import { TOOLS, executeTool } from './tools.ts';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class McpServer {
  private sdk: PolishAddressSDK;
  private isInitialized = false;

  constructor(sdk?: PolishAddressSDK) {
    this.sdk = sdk ?? new PolishAddressSDK();
  }

  public async start(): Promise<void> {
    await this.sdk.initialize();
    this.isInitialized = true;
    console.error('[open-pl-address-mcp] Server ready and listening on stdio');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const request = JSON.parse(trimmed) as JsonRpcRequest;
        await this.handleRequest(request);
      } catch (err: any) {
        console.error('[open-pl-address-mcp] Error parsing JSON-RPC request:', err);
        this.sendError(null, -32700, 'Parse error: invalid JSON');
      }
    });

    rl.on('close', () => {
      console.error('[open-pl-address-mcp] stdio stream closed, shutting down');
      this.sdk.close();
      process.exit(0);
    });
  }

  public async handleRequest(request: JsonRpcRequest): Promise<void> {
    const { id, method, params } = request;

    // Handle notifications (no id)
    if (id === undefined || id === null) {
      if (method === 'notifications/initialized') {
        console.error('[open-pl-address-mcp] Client acknowledged initialized notification');
      }
      return;
    }

    try {
      switch (method) {
        case 'initialize': {
          const clientProtocol = params?.protocolVersion || '2024-11-05';
          this.sendResult(id, {
            protocolVersion: clientProtocol,
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'open-pl-address-mcp',
              version: '1.0.0',
            },
          });
          break;
        }

        case 'ping': {
          this.sendResult(id, {});
          break;
        }

        case 'tools/list': {
          this.sendResult(id, {
            tools: TOOLS,
          });
          break;
        }

        case 'tools/call': {
          if (!params || !params.name) {
            this.sendError(id, -32602, 'Missing required tool name in params');
            return;
          }

          const toolName = params.name;
          const args = params.arguments || {};

          try {
            const output = await executeTool(this.sdk, toolName, args);
            this.sendResult(id, {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(output, null, 2),
                },
              ],
            });
          } catch (execErr: any) {
            this.sendResult(id, {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Tool execution error: ${execErr.message}`,
                },
              ],
            });
          }
          break;
        }

        default: {
          this.sendError(id, -32601, `Method not found: ${method}`);
          break;
        }
      }
    } catch (err: any) {
      console.error(`[open-pl-address-mcp] Internal error handling method ${method}:`, err);
      this.sendError(id, -32603, `Internal error: ${err.message}`);
    }
  }

  private sendResult(id: string | number, result: unknown): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      result,
    };
    process.stdout.write(JSON.stringify(response) + '\n');
  }

  private sendError(id: string | number | null, code: number, message: string, data?: unknown): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data !== undefined ? { data } : {}),
      },
    };
    process.stdout.write(JSON.stringify(response) + '\n');
  }
}
