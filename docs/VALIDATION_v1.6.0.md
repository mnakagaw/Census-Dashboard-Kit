# Validation record — 1.6.0

Date: 2026-09-16
Scope: JICA priority-country registry, four reference-country cases and country source-preflight integration.

## Controls

- The refresh script reads the six current JICA regional overseas-office directories and uses every `Purview` entry.
- JICA names are normalized against the UN M49 English registry; Kosovo is explicitly retained as `XKX`.
- The official OECD 2024 DAC recipient CSV is matched independently.
- Generation stops unless there are 142 unique priority records, 132 DAC recipients, 113 JICA country pages, Chile and Uruguay.
- Every priority record retains its JICA spelling, normalized country name/code, supervising office and official directory URL.
- Every record keeps national census/planning/geography preflight as unresearched until country-specific evidence is added.
- `loadSourceCatalog`, `sources:plan` and generated `SOURCE_PREFLIGHT` expose priority context without treating it as acquisition.
- The Dominican Republic, Uganda, Laos and Bangladesh are all present in both the JICA priority registry and the country-source catalogue.
- Generated preflight evidence names each case's specific lesson and warns against copying its laws, hierarchy, indicators or terminology.
- Laos retains the completed 2025 census as the newest census operation while keeping 2015 as the newest verified detailed public table set used by the reference build.

## Commands

```sh
python scripts/update-jica-priority-registry.py
npm run check
npm test
npm run sources:plan -- --country Bangladesh --format json
npm run sources:plan -- --country Laos --format json
npm run sources:plan -- --country DOM --format json
npm run sources:plan -- --country Nauru --format json
```

Result on 2026-09-16: `npm run check` verified 47 JavaScript modules and 56 Markdown files. `npm test` passed 151 of 151 tests. The source plans for Laos and the Dominican Republic included all four reference cases and their country-specific source records; Nauru remained explicitly unresearched for national sources.
