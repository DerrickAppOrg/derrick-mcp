#!/usr/bin/env node
/**
 * Derrick MCP Server
 * B2B enrichment via the Derrick API — for any MCP-compatible client.
 *
 * Tools are dynamically generated from the Derrick API metadata at startup,
 * so new actions are automatically available without updating this server.
 *
 * Module layout:
 *   config.ts         — constants (URLs, env paths, regex)
 *   api.ts            — HTTP client + API key load/save/resolve
 *   format.ts         — response formatting + last-known credits cache
 *   prompts.ts        — cross-cutting prompt strings (server instructions, pricing)
 *   toolOverrides.ts  — per-tool prompt overrides (workflow + next actions)
 *   tools.ts          — static + dynamic tool registration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadApiKey } from './api.js';
import { SERVER_INSTRUCTIONS } from './prompts.js';
import { registerStaticTools, registerDynamicTools } from './tools.js';

/**
 * Creates a fully configured McpServer with all Derrick tools registered.
 * No transport is attached — the caller decides how to connect (stdio, HTTP, etc).
 */
export async function createMcpServer(): Promise<McpServer> {
  const server = new McpServer(
    { name: 'derrick', version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerStaticTools(server);

  // Warm the API key cache before dynamic tools register.
  loadApiKey();
  await registerDynamicTools(server);

  return server;
}

// -- Main (stdio entrypoint for the npm package) -----------------------------

async function main() {
  const server = await createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
