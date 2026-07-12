# Changelog

## Unreleased

- Add the `derrick_onboard` MCP prompt: a guided, one-step-at-a-time tutorial that gets a user a real result from a Derrick feature page, right in the chat. Takes an optional `goal` argument (the feature-page title). Served from the server so the behaviour is versioned centrally instead of pasted per feature page, and composes with the existing server instructions.

## 0.3.0

- Send an `X-Derrick-Client: mcp` header on every API call so the backend can distinguish MCP usage from raw public-API calls.

## 0.2.1

- Clean `dist/` before each build to avoid shipping stale artifacts.
- Add `CHANGELOG.md` to the published tarball.

## 0.2.0

- Add `title` to every registered tool.
- Add tool annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`).
- Tool failures now return `isError: true` per the MCP spec.
- Bump `@modelcontextprotocol/sdk` to `^1.29.0`.
- Heartbeat notifications during long-running tool calls (find_email, find_phone) to prevent upstream idle timeouts.

## 0.1.0

- Initial release. Dynamic tool registration from the Derrick API. Static tools: `derrick_configure`, `derrick_account`, `derrick_credits`, `derrick_help`, `derrick_upgrade`.
