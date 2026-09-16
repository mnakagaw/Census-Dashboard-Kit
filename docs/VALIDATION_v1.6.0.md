# Validation record — 1.6.0

Date: 2026-09-16
Scope: JICA priority-country registry, 142-country source-address preflight, four reference-country cases and country source-preflight integration.
Validated implementation commit: `b85052d5f3ce4047678ade0a0d6230a4e8826f24`.

## Controls

- The refresh script reads the six current JICA regional overseas-office directories and uses every `Purview` entry.
- JICA names are normalized against the UN M49 English registry; Kosovo is explicitly retained as `XKX`.
- The official OECD 2024 DAC recipient CSV is matched independently.
- Generation stops unless there are 142 unique priority records, 132 DAC recipients, 113 JICA country pages, Chile and Uruguay.
- Every priority record retains its JICA spelling, normalized country name/code, supervising office and official directory URL.
- Every record has ISO2/ISO3 identity and four discovery categories: national statistics/census, planning law/materials, geography/codes and international-data candidates.
- Every record has a national statistics entrypoint; 141 have matching UNSD census-round rows. Kosovo has no matching UNSD census-date row and keeps that absence explicit.
- Every record has a country-filtered FAOLEX catalogue, JICA/MOFA planning entrypoint, geoBoundaries ADM1/ADM2 addresses, UN SALB/HDX discovery and country-coded WDI/HDX queries.
- Discovery addresses remain distinct from acquired, content-verified, geography-matched and accepted evidence. The planning law text and census tables must be inspected in the current country task.
- `loadSourceCatalog`, `sources:plan` and generated `SOURCE_PREFLIGHT` expose priority context without treating it as acquisition.
- The Dominican Republic, Uganda, Laos and Bangladesh are all present in both the JICA priority registry and the country-source catalogue.
- Generated preflight evidence names each case's specific lesson and warns against copying its laws, hierarchy, indicators or terminology.
- Dominican Republic, Uganda, Laos and Bangladesh remain valid fresh target countries; the AI entrypoints require a current source refresh rather than returning a stored example.
- A verified priority identity keeps Cook Islands and Niue in the initial workflow even when the World Bank individual-economy directory does not resolve them; missing WDI remains missing.
- Laos retains the completed 2025 census as the newest census operation while keeping 2015 as the newest verified detailed public table set used by the reference build.

## Commands

```sh
python scripts/update-jica-priority-registry.py
python scripts/update-priority-source-preflight.py
npm run check
npm test
npm run verify:kit
npm run sources:plan -- --country Bangladesh --format json
npm run sources:plan -- --country Laos --format json
npm run sources:plan -- --country DOM --format json
npm run sources:plan -- --country Nauru --format json
npm run sources:plan -- --country "Cook Islands" --format json
npm run sources:plan -- --country Niue --format json
```

Result on 2026-09-16: `npm run check` verified 49 JavaScript modules, all JSON registries and 58 Markdown files. `npm test` passed 154 of 154 tests. `npm run verify:kit` returned `ready: true`, 142 priority identities, 142 source-address preflights, one editable country placeholder and four selectable reference targets. Cook Islands and Niue source plans each returned all four source-address categories. The source plans for Laos and the Dominican Republic included all four reference cases and their detailed country-source records; Nauru retained its distinction between source-address preflight and detailed acquired evidence.
