# JICA priority-country registry (142 countries and territories)

Checked: 2026-09-16

## Result

The priority universe contains **142 unique countries and territories**. It is the union of every country or territory named under `Purview` in JICA's six current regional overseas-office directories. It therefore includes countries supervised by a neighboring office as well as countries with their own JICA office.

- 132 are on the OECD DAC List of ODA Recipients for reporting on 2024 flows.
- 10 are cooperation partners outside that DAC list: Antigua and Barbuda, Bahamas, Barbados, Chile, Cook Islands, Saint Kitts and Nevis, Saudi Arabia, Seychelles, Trinidad and Tobago, and Uruguay.
- 113 have a JICA `Where We Work` country page.
- 29 appear only in an office `Purview` list and do not have a country page in the current English index.

The exact machine-readable result is [`config/jica-priority-country-registry.json`](../../../config/jica-priority-country-registry.json). The flat review table is [`JICA_PRIORITY_142.csv`](JICA_PRIORITY_142.csv). Chile and Uruguay are retained; DAC eligibility is metadata, not an exclusion rule.

## Definition and exclusions

JICA's current regional directories are the authority for priority membership. A location such as the France or USA liaison office is not added merely because an office exists there when that office has no `Purview` cooperation-country list. Saudi Arabia is included because the Middle East directory names it as the purview of the Saudi Arabia Field Office.

Names and codes are matched to the UN M49 English registry. Kosovo is retained with the commonly used user-assigned code `XKX` because the JICA and OECD lists include it but UN M49 does not assign it an ISO alpha-3 code. The source name, normalized name, supervising office and directory URL are all retained so the normalization can be audited.

## Sources

- [JICA Where We Work](https://www.jica.go.jp/english/overseas/)
- [JICA offices in Asia](https://www.jica.go.jp/english/about/basic/structure/overseas/asia.html)
- [JICA offices in the Middle East](https://www.jica.go.jp/english/about/basic/structure/overseas/m_east.html)
- [JICA offices in Africa](https://www.jica.go.jp/english/about/basic/structure/overseas/africa.html)
- [JICA offices in North and Latin America](https://www.jica.go.jp/english/about/basic/structure/overseas/america.html)
- [JICA offices in Oceania](https://www.jica.go.jp/english/about/basic/structure/overseas/oceania.html)
- [JICA offices in Europe](https://www.jica.go.jp/english/about/basic/structure/overseas/europe.html)
- [UN M49 country and area codes](https://unstats.un.org/unsd/methodology/m49/overview/)
- [OECD DAC List of ODA Recipients for reporting on 2024 flows](https://webfs.oecd.org/oda/DAClists/DAC-List-of-ODA-Recipients-for-reporting-2024-flows.csv)
- [Japan MOFA country development cooperation policies](https://www.mofa.go.jp/mofaj/gaiko/oda/seisaku/kuni_enjyo_kakkoku.html)

## What this registry proves

It proves priority membership, supervising office, country-code normalization, presence or absence of a JICA country page, and the referenced OECD DAC classification at the recorded date. It does not prove that a national census catalogue, subnational tables, planning law, guidance, official administrative codes or boundaries have been found.

Each record therefore starts with `national_census_planning_and_geography_sources_not_pre_researched`. A country build must still find and inspect those official sources, inventory all resources/tables/fields, match geography, build the three pages and Word diagnostic, and pass the delivery gate. This distinction prevents a 142-row list from being mistaken for 142 completed dashboards.

## Refresh

Run:

```sh
python scripts/update-jica-priority-registry.py
npm test
```

The updater downloads all cited source lists, records SHA-256 receipts, rejects duplicates or unmatched countries, and stops unless the expected 142 priority / 132 DAC / 113 JICA-country-page controls still hold. A changed source count is a review event, not an invitation to force the old total.
