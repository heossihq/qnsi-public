---
title: Query Flow
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Query Flow

How encrypted search queries are processed.

## Query lifecycle

### 1. Query preparation (client)
```
POST /search/v1/query
{
  "index": "documents",
  "query": {
    "match": {"title": "confidential"}
  }
}
```

### 2. Token generation (client SDK)
SDK generates search tokens:
```javascript
const tokens = await sdk.search.generateTokens(query);
```

### 3. Token submission
```
POST /search/v1/execute
{
  "index": "documents",
  "tokens": ["base64-token-1", "base64-token-2"]
}
```

### 4. Server-side matching
- Match tokens against encrypted index
- No decryption performed
- Return encrypted document references

### 5. Document retrieval
```
GET /storage/v1/objects/{objectId}
```

### 6. Client-side decryption
SDK decrypts returned documents.

## Query types

### Simple match
```json
{"match": {"field": "value"}}
```

### Boolean query
```json
{
  "bool": {
    "must": [{"match": {"status": "active"}}],
    "should": [{"match": {"priority": "high"}}]
  }
}
```

### Range query
```json
{"range": {"created": {"gte": "2024-01-01"}}}
```

## Pagination

```json
{
  "query": {...},
  "limit": 20,
  "cursor": "opaque-cursor"
}
```
