# Validation record — 1.8.1

Date: 2026-09-23
Scope: UNSD census-listing semantics and current country-label matching in the world and JICA-priority source preflights.

## Controls

- Every world and JICA-priority census record now keeps `latest_un_census_listing` separate from `latest_un_census_linked_listing`.
- The first field selects the latest completed census date listed by UNSD even when no link is supplied. The second selects the latest completed listing with at least one UNSD link. Neither field proves acquisition, inspection or adoption.
- Wholly parenthesized future or scheduled entries are excluded from the completed-census summaries while the original `un_census_rounds` rows remain preserved.
- Algeria resolves to `2020 / 25 September 2022 / no UNSD link` for the latest listing and `2010 / 16-30 April 2008 / http://rgph2008.ons.dz/` for the latest linked listing. The Kit stores no Algeria 2022 observations; downstream projects may use the linked 2008 edition while still disclosing the newer unlinked UNSD listing.
- The world updater now resolves the current UNSD labels for Saint Kitts and Nevis, Saint Lucia, Saint Pierre and Miquelon, Saint Vincent and the Grenadines and Sint Maarten, and removes trailing numeric footnotes before matching Netherlands.
- The six previously missed identities now have UNSD census rows. The remaining twelve zero-row identities are explicit nonmatches or structural/supplemental cases: `ALA`, `ATA`, `ATF`, `BVT`, `CCK`, `CXR`, `HMD`, `IOT`, `SGS`, `TWN`, `UMI` and `XKX`.
- Generated human-readable tables expose both census fields, and generated country `SOURCE_PREFLIGHT.md` files render both meanings independently.

## Official input snapshots

| Input | SHA-256 | Bytes |
|---|---|---:|
| UN M49 country/area registry | `b9048114f6e7f2abda83bf03d4263c9d7cd1bd7230e3d0461025ee7839a7a1fb` | 1,721,575 |
| UNSD national statistical-office directory | `1234fbd160423a31686c22cc68226d275cbc219f512381ab84b2ad04a074c7f0` | 88,075 |
| UNSD census-date directory | `ec5870ad57f1a1b04a24fdf50571bad3fe1a5f68cd83faeeeee6283885e86c55` | 248,746 |

Generated-file hashes:

| Generated file | SHA-256 |
|---|---|
| `config/world-country-area-registry.json` | `10d224d3dbe8f0cd2e5648a63c2abbd3e5038ddba0ed5f00a55dcf05f25b1aa5` |
| `config/world-source-preflight.json` | `eddf501262be69c8a41a5e0e2bed7e1fce09eb05ba783c836a470dc5b10da970` |
| `config/jica-priority-source-preflight.json` | `17568c1bc6aa16ca4c659b5769d06a7103d6735999c8218ae087788e548658c7` |
| `docs/research/world-2026/WORLD_SOURCE_PREFLIGHT_250.md` | `b871505970803085914cca7ddc2a787df27d38602589c6fd20f3f54cac9950f3` |
| `docs/research/jica-priority-2026/SOURCE_PREFLIGHT_142.md` | `7baa5fc39d9affdf85581d04d762f5739c3c65d9f5310f066aab7951a7631889` |

## Commands and result

```sh
python scripts/update-world-source-preflight.py
python scripts/update-priority-source-preflight.py
npm run check
npm test
npm run verify:kit
```

- `npm run check` verified 49 JavaScript modules and 64 Markdown files.
- `npm test` passed 170 of 170 tests, including the two-field Algeria contract and all six current UNSD label matches.
- `npm run verify:kit` returned `ready: true` for 250 world identities/source preflights, 248 UN M49 identities, 142 JICA-priority records and 28 verified Americas recipes.

The validated implementation is the release commit containing this record.
