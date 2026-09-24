# AreaData source-feedback correction — 2026-09-24

AreaData bundle `ab485fc3601d2e112e99c8c70dd4c43f2eca8a01` retains seven active discovery leads for Bangladesh, Lao PDR and Uganda. The Lao 2015 census-report lead now points to the [UNFPA/LSB report listing](https://lao.unfpa.org/en/publications/results-population-and-housing-census-2015-english-version). The old LSB SDG 17.19.2 URL remains only as a `superseded_by` history record, not in the source catalog or next-country preflight.

The importer now accepts an optional `supersedes_url` with strict same-country, same-role and same-source-ID checks. A correction retains both origin histories, refuses an unknown or conflicting predecessor and is idempotent. The country reference registry and the separate local Lao country project were also corrected. Original acquisition receipts remain historical records, and no observation value was changed.

Verification: AreaData bundle dry-run and import completed; subsequent dry-run reported seven unchanged active records. `npm run check`, `npm test` (173/173) and `npm run verify:kit` passed, with seven active feedback leads. The corrected local Lao project passed `validate-country` without errors or warnings. This validates source routing, not a newly completed or publicly released country dashboard.
