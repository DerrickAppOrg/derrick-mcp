# Changelog

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
