---
title: SAML Federation
version: 0.0.2
last_updated: 2026-04-23
copyright: 2025 HEOSSI. All rights reserved.
---
# SAML Federation

QNSI supports SAML 2.0 for enterprise SSO and authenticated identity linking.

## Configuration

Register a SAML federation provider:

```json
{
  "id": "saml-main",
  "provider": "saml",
  "name": "Example SAML IdP",
  "enabled": true,
  "metadata": {
    "entityId": "https://idp.example.com",
    "ssoUrl": "https://idp.example.com/sso",
    "certificate": "<certificate_pem_or_base64>"
  }
}
```

## Flow

1. QNSI initiates a SAML flow against the configured provider and receives a signed assertion at its ACS endpoint.
2. QNSI validates:
   - XML signature
   - issuer
   - audience
   - recipient / destination
   - `InResponseTo`
   - replay protection
   - assertion time bounds with clock-skew tolerance
3. The validated assertion is processed by QNSI:
   ```
   POST /auth/federation/saml/acs
   {
     "providerId": "saml-main",
     "samlResponse": "<base64_assertion>",
     "relayState": "<optional_relay_state>",
     "linkMode": false
   }
   ```
4. QNSI either issues access + refresh tokens for sign-in or binds the SAML identity to the current authenticated QNSI user when `linkMode=true`.

## Attribute mapping

Map SAML attributes to QNSI:

| SAML Attribute | QNSI Attribute |
|----------------|----------------|
| `NameID` | External ID |
| `email` | Email |
| `displayName` | Display name |
| `memberOf` | Roles |

## SP metadata

QNSI exposes SP metadata at:
```
GET /auth/federation/:providerId/metadata?type=saml
```

## Security

- Assertions must be signed
- Replay detection is enforced
- Audience, recipient, destination, and `InResponseTo` are validated
- Metadata refresh and certificate rollover are supported
- Encryption supported but optional
