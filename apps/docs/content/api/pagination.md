---
title: Pagination
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/audit-service/src/routes/events.ts
  - /apps/audit-service/src/services/audit-store.ts
---
# Pagination

List endpoints use cursor-based pagination.

## Request Parameters

From `apps/audit-service/src/routes/events.ts`:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Items per page (1-200, default 50) |
| `cursor` | string | Opaque cursor for next page |

**Implementation**: Audit service enforces `limit` between 1-200 with default 50:
```typescript
const limit = Math.min(Math.max(Number(query.limit ?? "50"), 1), 200);
```

## Example request

```
GET /audit/v1/events?limit=20&cursor=eyJsYXN0SWQiOiJ...
```

## Response format

```json
{
	"items": [...],
	"nextCursor": "ZXlK..." 
}
```

## Pagination fields

| Field | Description |
|-------|-------------|
| `items` | Page of results |
| `nextCursor` | Cursor for the next page (or `null`) |

## Iterating pages

```javascript
let cursor = null;
do {
	const response = await api.list({ limit: 100, cursor });
	process(response.items);
	cursor = response.nextCursor;
} while (cursor);
```

## Limits

From code analysis:

| Endpoint | Max Limit | Default Limit | Source |
|----------|-----------|---------------|--------|
| Audit events | 200 | 50 | `audit-service/src/routes/events.ts` |
| Other services | Varies | Varies | Implementation-specific |

## Cursor validity

- Cursors are opaque strings
- Treat cursors as implementation detail and pass them back exactly as received
- Cursors are tied to the original query filters
