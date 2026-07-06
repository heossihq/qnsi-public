---
title: Troubleshooting
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Troubleshooting

Common issues and solutions.

## Authentication issues

### "UNAUTHORIZED" error
**Cause**: Missing or invalid token

**Solutions**:
1. Check Authorization header format: `Bearer <token>`
2. Verify token hasn't expired
3. Refresh token and retry

### "TOKEN_EXPIRED" error
**Cause**: Access token has expired

**Solution**:
```javascript
await client.refreshToken();
// Retry request
```

### "TENANT_MISMATCH" error
**Cause**: Token tenant doesn't match the request tenant context

**Solution**: Ensure token was issued for the correct tenant

## Rate limiting

### "TOO_MANY_REQUESTS" error
**Cause**: Rate limit exceeded

**Solutions**:
1. Check `Retry-After` header
2. Implement exponential backoff
3. Request limit increase if needed

```javascript
if (error.statusCode === 429) {
  await sleep(error.details.retryAfter * 1000);
  // Retry
}
```

## Key/secret not found

### "NOT_FOUND" error
**Causes**:
- Resource doesn't exist
- Wrong tenant context
- Insufficient permissions (shows as not found)

**Solutions**:
1. Verify resource ID/path
2. Check tenant context (header or query)
3. Verify permissions

## Connection issues

### Timeout errors
**Solutions**:
1. Check network connectivity
2. Verify firewall rules
3. Increase timeout setting
4. Check service status

## Getting help

Include in support requests:
- Request ID from error response
- Timestamp
- Endpoint called
- Error message
