# Validation record — 1.8.0

Date: 2026-09-21
Scope: world country/area identity and source-address preflight for country-name-only dashboard projects.

## Controls

- `config/world-country-area-registry.json` contains all 248 current UN M49 country-or-area rows plus explicit Taiwan (`TWN`) and Kosovo (`XKX`) operational supplements, for 250 unique identities.
- `config/world-source-preflight.json` contains one matching discovery record for every identity. Every record has a statistics/census entrypoint, planning/legal catalogue, geography/code candidates, international-data candidates and at least seven anti-shortcut rules.
- The world layer is discovery metadata. It contains no statistical observation rows and never upgrades a directory entry, URL, census date or prior recipe into acquired evidence.
- Official global inputs are the UN M49 registry, the UNSD national statistical-office directory and the UNSD census-date directory. The generator retains their retrieval hashes and byte sizes.
- 188 statistics-authority entrypoints come from the UNSD directory. Another 62 are explicitly curated current official, administering-authority or structural entrypoints for directory gaps, changed authorities and territories that do not have a conventional national system.
- Spain and Finland are developed-country acceptance examples. Taiwan is the non-M49 operational-resolution example. Their packs include official census or population-register dissemination, machine-readable tables/APIs, legal catalogues, planning-law or ministry entrypoints and official administrative geography.
- Register-based, rolling-census, federal, devolved, autonomous-community, overseas and nonresident-area systems remain distinct. The workflow does not force a questionnaire-style decennial census or a municipal planning law onto every identity.
- The existing JICA-priority 142-country/area layer remains a priority and cooperation-context supplement. It is no longer the universe of selectable targets.
- The 28 audited Americas recipes and the four reference-country lessons remain reusable guidance. They do not count as current-project acquisition.
- Japanese names `スペイン`, `フィンランド` and `台湾`, ISO codes and stored English names resolve through the same world registry.
- Re-running `npm run sources:world` against the same official snapshots reproduced all three generated files byte-for-byte.

## Official input snapshots

| Input | SHA-256 | Bytes |
|---|---|---:|
| UN M49 country/area registry | `b9048114f6e7f2abda83bf03d4263c9d7cd1bd7230e3d0461025ee7839a7a1fb` | 1,721,575 |
| UNSD national statistical-office directory | `1234fbd160423a31686c22cc68226d275cbc219f512381ab84b2ad04a074c7f0` | 88,075 |
| UNSD census-date directory | `ec5870ad57f1a1b04a24fdf50571bad3fe1a5f68cd83faeeeee6283885e86c55` | 248,746 |

Generated-file reproducibility hashes:

| Generated file | SHA-256 |
|---|---|
| `config/world-country-area-registry.json` | `5e6b380c5ed5434d9b009729ff957414542065a006d357c5e86e27a660a9b89c` |
| `config/world-source-preflight.json` | `84c89185d6f575f7580071b13cb0434492557bfad05a44e29a9e0740a70ba2e4` |
| `docs/research/world-2026/WORLD_SOURCE_PREFLIGHT_250.md` | `5d648c21783f1394de04a625dc8be77ff9f7352fc3099e7ee12660e7c312cfb5` |

## Commands

```sh
npm run sources:world
npm run check
npm test
npm run verify:kit
node scripts/source-plan.mjs --country スペイン --format json
node scripts/source-plan.mjs --country フィンランド --format json
node scripts/source-plan.mjs --country 台湾 --format json
```

## Result

- `npm run check` verified 49 JavaScript modules, all JSON registries and 63 Markdown files.
- `npm test` passed 168 of 168 tests.
- `npm run verify:kit` returned `ready: true`, 250 world identities, 250 world source-address preflights, 248 UN M49 identities, the Spain and Finland developed-country examples and the Taiwan operational supplement, 142 JICA-priority records and 28 verified Americas recipes.
- Spain resolved to `ESP` with four source-address categories, nine country-specific official entrypoints and zero acquired sources.
- Finland resolved to `FIN` with four source-address categories, ten country-specific official entrypoints and zero acquired sources.
- Taiwan resolved to `TWN` with four source-address categories, eleven country-specific official entrypoints and zero acquired sources.
- All 250 records have a statistics-authority or explicit structural entrypoint. The preflight stores 296 UNSD census-directory rows and zero statistical observation collections.

The validated implementation is the release commit containing this record.
