# Americas: 28 verified statistical source recipes

Checked: 2026-09-21. Machine-readable registry: [`config/americas-verified-source-recipes.json`](../../../config/americas-verified-source-recipes.json).

This registry preserves reusable public source locations, acquisition methods, semantic cautions and geography decisions from 27 broad local statistical editions plus the South Georgia and the South Sandwich Islands nonresident exception. It is a starting recipe for a new country build, not evidence that the new build has already acquired or accepted the sources.

Every new build must refresh the URLs and editions, acquire permitted originals, record hashes and exact table/page/API locators, repeat geographic matching, inspect all relevant resources and numeric fields, and pass the current delivery contract. Planning-law, guidance, plan, budget, implementation and evaluation research remains a separate workstream; the 28 statistical recipes do not mark planning readiness complete.

## What took time and why

The dominant delay was not a simple inability to find data. The work repeatedly moved through six different states: locating a source, acquiring an object, understanding its tables, matching geography, adopting indicators and proving the result in the site and outputs. A link or a successful download satisfied only the first or second state.

The avoidable rework came from an earlier permissive completion rule. It allowed unavailable or rejected fields to close both source review and the country edition. A passing test suite then proved consistency with that rule rather than adequate data depth. The corrected rule keeps these decisions separate:

- A documented `unavailable`, `restricted`, `failed_with_evidence` or `not_adopted` item may close **source review** for that item.
- It never becomes observed data and never increases the local indicator or diagnostic-group count.
- A resident statistical edition requires retained evidence for the required source domains, a domestic hierarchy, local population and age-sex, at least 10 distinct local observed indicators and at least 6 of 8 local diagnostic groups.
- A structural exception requires explicit evidence and its own contract; it is not an empty resident dashboard.
- Statistical completion and planning readiness are reported separately.

Other recurring costs were dynamic platforms and blocked origins, table-specific denominators and universes, administrative-code changes, boundary-year differences, large or corrupt downloads, restricted microdata, incomplete catalogue searches, adapter identity bugs and cross-country UI state leaks.

## Country-by-country lessons

The exact reusable URLs for every source domain are in the machine-readable registry. The table below states what a new agent should do with them.

| Country/area | Previously verified source route | Main lesson to replay |
|---|---|---|
| Argentina | INDEC census products and Argentina Georef | Inspect every workbook field and preserve each product's universe and year; private-dwelling population is not a household-service denominator. |
| Bolivia | INE CPV 2024 workbooks | Departments are integrated; municipality and TIOC products require their own verified adoption and geography. |
| Brazil | IBGE Census 2022 and SIDRA | Query exact table, variable and classification IDs. Never use one age-sex table to close unrelated themes. |
| Canada | StatCan Census Profile, SDMX and PR/CD/CSD cartography | Validate large archive integrity and retain exact archive-member and table locators. |
| Chile | INE Census 2024 workbooks and official geographic services | Inventory all sheets and fields; retain Antártica values without inventing missing geometry and label later geometry as display reference. |
| Colombia | DANE CNPV 2018 tables and DIVIPOLA | Confirm the correct table axis and retain numerator, denominator and one-to-one official-code matches. |
| Costa Rica | INEC Power BI objects and official ArcGIS | Preserve the Power BI query recipe and describe adjusted estimates correctly; do not backcast later canton changes. |
| Cuba | ONEI and archived official Census 2012 table PDFs | Enumerate the table set and record archive URL, page and table; national urban/rural values are not province observations. |
| Dominican Republic | ONE Census 2022, archive fallback and official geography | Recheck the origin before replaying the archive; preserve both URLs and resolve duplicate or aliased municipality codes explicitly. |
| Ecuador | Official Census 2022 results and archived fallback | Keep the verified ADM1 scope, prevent duplicate observation identities and store source-hash arrays in the declared schema field. |
| Guatemala | INE Census 2018, open data and SEGEPLAN services | Preserve reviewed municipality aliases and keep health counts and small-area poverty estimates distinct from census rates. |
| Guyana | Bureau of Statistics 2022 preliminary products and 2012 compendia | Join census region number to official name before the internal ID; keep census rounds separate. |
| Honduras | INE Census 2013, Redatam and all municipal reports | A representative municipal report is insufficient; record filtered rows that establish genuine zeros and use exact codes. |
| Haiti | Census 2003, IHSI 2024 estimates and EMMUS-V | Keep census, estimates and survey methods separate; do not reconstruct Ouest from rounded incompatible survey regions. |
| Jamaica | STATIN Census 2011 tables and publications | Preserve every age, enrollment, dwelling and valid-response universe; similar labels do not establish JMP or other international definitions. |
| Mexico | INEGI Census 2020 ITER archive and dictionary | Exclude aggregate rows, join exact geographic codes and do not treat municipalities created later as Census 2020 units. |
| Nicaragua | Census 2005 volumes, 153 municipal reports and INETER | Retain the complete report manifest, table-specific denominators and reviewed code/name-vintage exceptions. |
| Panama | Official census workbooks and ArcGIS | Store the valid geographic level for each indicator family; urban, migration, nutrition and poverty products have different coverage. |
| Peru | Five INEI Census 2017 XLSX volumes | Preserve rejected-table reasons: the inspected migration and labour tables did not support the tempting derived indicators. |
| Puerto Rico | PRCS/ACS, Census 2020, EIA and PR-BRFSS | Keep source families and years distinct; plumbing evidence is not drinking-water evidence and federal queries must remain inside FIPS 72. |
| Paraguay | INE Census 2022 and supplemental workbooks | Continue the six-theme search after finding population; missing indigenous rows remain missing and compatible cross-table denominators must be proved. |
| South Georgia and the South Sandwich Islands | Territorial government FAQ and institutional pages | Apply the documented nonresident exception; do not invent a resident census, municipality hierarchy or service indicators. |
| El Salvador | Census 2024 workbooks and official geography | Keep municipalities as planning authorities and districts as diagnostic subdivisions; retain unallocated-residence population nationally. |
| Suriname | ABS Census 2012 volumes and poverty methodology | Do not merge education fields with different universes; retain table-specific definitions and denominators. |
| Trinidad and Tobago | CSO Redatam and a documented display-boundary exception | Save form parameters and responses, preserve valid-response denominators and do not equate UBN with monetary poverty. |
| Uruguay | INE ANDA Census 2023 metadata and restricted microdata | Aggregate under the access terms, remove person records, and retain only non-disclosive aggregates, fingerprints, metadata and reproducible code. |
| United States | Census/ACS bulk products, cartographic boundaries and CDC | Keep Census counts, ACS estimates and CDC indicators separate; country switching must atomically reset metric, level, URL, text, documents and outputs. |
| Venezuela | INE Census 2011 and an explicitly identified NBI fallback | Keep the old reference year visible, do not infer municipality values, and run the duplicate-observation and hash-schema checks. |

## Required replay order

For a country registered here, the agent follows this order:

1. Open the generated `evidence/SOURCE_PREFLIGHT.md` and read the verified recipe before general web search.
2. Recheck every recorded official URL and publication edition. Use the recorded archive, Power BI, Redatam, API or restricted-access method only after confirming the current official route.
3. Build `SOURCE_RESOURCE_INVENTORY.json` from the complete official catalogue. A known successful table is a starting point, not permission to skip the remaining catalogue.
4. Acquire permitted originals and record request details, bytes, hashes and exact locators in the new project.
5. Inventory all sheets, columns, tables, PDF continuations and API fields. Record both adopted and rejected candidates with reasons.
6. Recreate official-code and boundary crosswalks for the current statistical and geographic vintages. Carry forward an exception only when it still matches the source.
7. Apply the six-theme audit, strict statistical depth gate and separate planning-readiness gate.
8. Run the real browser, CSV, print and DOCX checks. A correct dataset with stale cross-country UI state is still incomplete.

## Maintainer refresh

When a later audited Americas project produces a strict country-completion matrix, a maintainer can rebuild the machine registry without copying observations or private delivery details:

```sh
python scripts/build-americas-recipe-registry.py \
  --matrix <path-to-strict-country-completion-matrix.json> \
  --out config/americas-verified-source-recipes.json
```

The importer accepts only the listed completed country/area set and extracts public source entrypoints plus reusable method cautions. Review the generated diff and rerun the KIT checks before publishing it. The matrix remains evidence of the source project; the generated registry remains a discovery recipe for future projects.

## What this prevents

The registry prevents an agent from starting the 28 cases with a generic search, stopping at the first population file, losing a known dynamic-platform query, repeating a rejected derivation, joining administrative areas by name, or treating historical source success as current acquisition. It also gives an auditor a concrete expected route against which to detect skipped official catalogues and shallow country editions.

It cannot guarantee that a provider has not changed its URL, schema, access policy, law or publication. That is why every recipe is deliberately marked `historically_verified_location_and_method_refresh_required` and every generated preflight still reports zero acquired sources.
