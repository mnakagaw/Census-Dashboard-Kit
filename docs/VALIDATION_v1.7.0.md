# Validation record — 1.7.0

Date: 2026-09-21
Scope: reusable source recipes and completion-gate lessons from 28 audited Americas country/area editions.

## Controls

- `config/americas-verified-source-recipes.json` contains 28 unique ISO3 records: 27 resident statistical editions and the explicit South Georgia and the South Sandwich Islands nonresident exception.
- Each recipe preserves public source entrypoints, acquisition methods, semantic cautions, geography cautions and required replay actions.
- Every recipe is marked as historical guidance that requires refresh. It starts a new project with zero acquired sources and cannot satisfy current-project evidence, geography or adoption gates.
- Resident recipe records retain the verified depth floor of at least 10 local observed indicators and 6 diagnostic groups. The structural nonresident exception uses a separate explicit contract.
- Planning-law, guidance, plan, budget, implementation and evaluation readiness remains separate and incomplete in the statistical recipe registry.
- Recipe-only countries are resolvable by country name and ISO3 in the source planner. Existing detailed country records remain authoritative and receive the matching recipe as an additional guide.
- Generated `SOURCE_PREFLIGHT` evidence presents the recipe before general discovery sources while preserving the status distinction between located, acquired, interpreted, geographically matched and adopted evidence.
- The common completion contract and independent-audit instructions exclude unavailable, restricted, failed and rejected candidates from observed-depth counts.
- All AI entrypoints instruct agents to replay and refresh the recipe, inventory the complete official catalogue and record current hashes and exact locators.
- The public documentation records the country-specific lessons without local paths, credentials, FTP details or internal task identifiers.

## Commands

```sh
python -m py_compile scripts/build-americas-recipe-registry.py
npm run check
npm test
npm run verify:kit
node scripts/source-plan.mjs --country BRA --format json
node scripts/source-plan.mjs --country USA --format json
node scripts/source-plan.mjs --country SGS --format json
node scripts/source-plan.mjs --country DOM --format json
node scripts/source-plan.mjs --country JPN --format json
```

## Result

- Python compilation passed for the registry importer.
- `npm run check` verified 49 JavaScript modules, the JSON registries and 61 Markdown files.
- `npm test` passed 165 of 165 tests.
- `npm run verify:kit` returned `ready: true`, 142 priority identities, 142 source-address preflights, 28 verified Americas recipes and the four selectable reference-country cases.
- BRA, USA, SGS and DOM source plans exposed their matching recipe and still reported zero current-project acquisitions. SGS used the structural nonresident recipe. JPN resolved through the general priority preflight without receiving an Americas recipe.
- Rebuilding the registry from the strict source matrix produced the same SHA-256 hash as the tracked JSON.

The validated implementation is the release commit containing this record.
