# @heossihq/qnsi-mcp

## 0.1.6

### Patch Changes

- Updated dependencies [d9ab7af]
  - @heossihq/qnsi@0.5.3

## 0.1.4

### Patch Changes

- Re-point activation off the unpublished `@heossihq/qnsi-sdk-activation`
  onto `@heossihq/qnsi/activation`, so `npm i @heossihq/qnsi-mcp` resolves
  cleanly (the prior 0.1.3 depended on a now-unpublished package).
- Updated dependencies
  - @heossihq/qnsi@0.2.0

## 0.1.2

### Patch Changes

- Initial tracked CHANGELOG entry. Earlier 0.1.0 and 0.1.1 releases shipped
  the Model Context Protocol server exposing QNSP platform capabilities
  (identity, KMS, vault, storage, search, audit, crypto-inventory, access
  control, billing, tenant) as MCP tools consumable by ChatGPT, Claude
  Desktop, Cursor, Windsurf, and any MCP-compatible client.
- All subsequent releases will be driven by Changesets. See
  https://docs.qnsi.heossi.com/sdk/mcp-server for current capabilities,
  connection strings, and authentication flows.
