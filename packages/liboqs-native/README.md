# `@heossihq/liboqs-native`

This workspace package hosts the liboqs Node-API addon used whenever services
set `PQC_LIBOQS_MODULE=@heossihq/liboqs-native`.

Key characteristics:

- **Prebuilds-first** - we generate prebuilt binaries via `prebuildify` and ship
  them under `prebuilds/<platform>-<arch>/node.napi.node`.
- **Auto-fallback** - if a prebuild is missing the `install` script runs
  `node-gyp-build`, compiling from source with the local toolchain.
- **Pure JS surface** - consumers always import `dist/index.js`, which exports
  the `KEM`, `Sig`, `getSupported*`, and `version` helpers expected by
  `@heossihq/qnsi-cryptography`.

## Directory layout

```
packages/liboqs-native/
├── binding.gyp
├── dist/
│   ├── index.js        # Loads the addon via node-gyp-build
│   └── index.d.ts
├── prebuilds/          # Populated by prebuildify (one dir per OS/arch)
├── src/addon.cc        # C++ implementation
└── tools/check-dist.js # Warns when artefacts are missing
```

## Typical workflow

1. Build liboqs and set `OQS_INCLUDE_PATH` / `OQS_LIB_PATH` as described in
   `docs/guides/liboqs-native-build.md`.
2. Run `pnpm --filter @heossihq/liboqs-native prebuild` to populate `prebuilds/`.
3. Verify the addon with `pnpm --filter @heossihq/qnsi-cryptography smoke`.
4. During deployment copy (or download) the prebuilds into this package before
   running `pnpm install`. If no prebuild exists the install step compiles the
   addon transparently.

## Distribution strategy

CI publishes the prebuilds as release artifacts; image build pipelines download
the correct archive for the target platform. Document the liboqs commit,
compiler flags, and platform tuple so health endpoints can report accurate
attestation data.

## License

Licensed under the Business Source License 1.1 (BUSL-1.1) with Change License GPL-2.0-or-later. See [`LICENSE`](./LICENSE) and the repository-level [`LICENSE.md`](../../LICENSE.md).


© 2025 QNSP - HEOSSI, Singapore
