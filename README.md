# Derrick MCP Server

B2B data enrichment tools for any MCP-compatible AI client — find emails, enrich LinkedIn profiles, search companies, and more.

Tools are **dynamically loaded** from the Derrick API at startup, so new actions are available automatically.

## Prerequisites

- A Derrick account with the **Standard plan** ($20/mo) or above
- An API key (get it from: Google Sheets > Derrick menu > burger icon > API)
- Node.js 22+

## Setup

### Claude Desktop

Edit your config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "derrick": {
      "command": "npx",
      "args": ["derrick-mcp"]
    }
  }
}
```

### Claude Code

Add to `.mcp.json` at your project root (or `~/.claude/settings.json` for global):

```json
{
  "mcpServers": {
    "derrick": {
      "command": "npx",
      "args": ["derrick-mcp"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "derrick": {
      "command": "npx",
      "args": ["derrick-mcp"]
    }
  }
}
```

### Other MCP clients

Any client that supports the MCP protocol over stdio can use this server.
The command is `npx derrick-mcp`.

## First use

Once connected, tell the AI:

> "Configure Derrick with my API key: YOUR_KEY"

The key is saved to `~/.derrick-mcp/.env` and persists across sessions.

## Available tools

Two built-in tools are always available:

| Tool | Description |
|------|-------------|
| `derrick_configure` | Save your API key |
| `derrick_account` | Check your credits and account info |

All other tools (find email, enrich profile, search company, etc.) are loaded dynamically from the API. Ask the AI "What can Derrick do?" to see the full list.

## Environment variable

Instead of using `derrick_configure`, you can set the API key as an environment variable:

```json
{
  "mcpServers": {
    "derrick": {
      "command": "npx",
      "args": ["derrick-mcp"],
      "env": {
        "DERRICK_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Development

```bash
cd MCP
npm install
npm run build     # compile TypeScript
npm run dev       # run with tsx (hot reload)
npm start         # run compiled version
```

## Support

- Product site: https://derrick-app.com
- Email: contact@derrick-app.com
- Issues: https://github.com/DerrickAppOrg/derrick-mcp/issues

## Legal

- Privacy policy: https://derrick-app.com/privacy
- Terms of service: https://derrick-app.com/terms

## License

MIT — see [LICENSE](./LICENSE).
