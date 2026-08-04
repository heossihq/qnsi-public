# `@heossihq/product-facts-schema`

The shared, product-neutral trust protocol for HEOSSI product facts.

It owns deterministic JSON canonicalization, dual ML-DSA-65 + Ed25519
signature envelopes, public-key fingerprints, published key-document parsing,
signing, and downgrade-resistant verification. Product payload schemas and
product-specific adapters remain in their product repositories.

```ts
import {
	signFactsDocument,
	verifyFactsSignature,
} from "@heossihq/product-facts-schema";
```

Verification requires both signatures over the same canonical bytes. Consumers
should pass a registration-pinned `keysUrl`; a URL supplied only by a payload is
not an identity anchor.
