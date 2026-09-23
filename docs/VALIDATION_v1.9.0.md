# Validation record — 1.9.0

Date: 2026-09-23
Scope: recurring AreaData-to-Kit source-feedback loop.

## Implemented contract

- AreaData exports a strict `1.0` bundle containing public official or international-organization source locations, country identity, role, checked date, evidence stage, geographic levels, reference periods, formats, origin commit and repository-relative evidence path.
- `scripts/import-areadata-source-feedback.mjs` validates the bundle against the 250-entry Kit world identity registry and rejects unknown fields, unknown countries, credentials, credential-like query parameters, local/private URLs, unsafe evidence paths and invalid dates or hashes.
- Imported records use a deterministic ID derived from country, role and URL. Reimport is idempotent; later verification can advance the evidence stage and merge periods, formats, geography and origin history without creating a duplicate.
- `config/areadata-source-feedback.json` stores source-discovery metadata only. It contains no observations or raw source bodies.
- `lib/source-catalog.mjs` adds matching AreaData feedback to every generated country `SOURCE_PREFLIGHT.json` and `.md` before generic search.
- Every reused record starts a new Kit project as `not_acquired_by_kit_preflight`, including records adopted in AreaData. URL refresh, acquisition, content inspection, geography matching and indicator acceptance remain new-project work.
- `docs/AREADATA_SOURCE_FEEDBACK.md` defines the Kit → AreaData → Kit operating loop and public-safety boundary.

## Safety and regression tests

- A valid Algeria official-catalogue bundle imports once and reimports without changing the registry.
- Dry-run reports the pending merge without writing.
- Unknown ISO3 identities, credential-like URL parameters, private-network URLs and impossible dates are rejected.
- Existing world, priority, Americas-recipe, source, build, document and delivery contracts remain unchanged.

## Key file hashes before the first AreaData bundle import

| File | SHA-256 |
|---|---|
| `config/areadata-source-feedback.json` | `7ebe006b998e7e2ec4e7c55f057602acc7283e8a97410c9f738e1548b545ade3` |
| `schemas/areadata-source-feedback.schema.json` | `3425f0355acaf9aa0a2845084f142a5c52c74b7a18b12c908412e0552af86d32` |
| `scripts/import-areadata-source-feedback.mjs` | `f60b660b4ce31b08db63d10540316f11a758e7707391a30ec17db5bdc232e3d6` |
| `lib/source-catalog.mjs` | `17994fbef28954e15b262a801b591bb69dbc36bbc3b476ace85ea02de4f2aab8` |

## Commands and result

```sh
npm run check
npm test
npm run verify:kit
```

- `npm run check` verified 51 JavaScript modules, JSON templates and 66 Markdown files.
- `npm test` passed 172 of 172 tests.
- `npm run verify:kit` returned `ready: true`, `areadata_feedback_loop: true`, 250 world source preflights and the unchanged 142 JICA-priority and 28 Americas-recipe layers.
- The initial feedback registry intentionally contains zero records. An AreaData export must pass dry-run and review before the first public Kit import.

The validated implementation is the release commit containing this record.
