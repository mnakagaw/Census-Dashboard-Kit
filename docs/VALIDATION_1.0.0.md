# Census Dashboard Kit 1.0.0 validation

Date: 2026-09-15

Environment: Windows 11, Node.js 24, local static server and in-app browser

Source baseline: committed dashboard-kit source revision `86c7d13`; unrelated uncommitted source-tree changes were not copied

## Scope

This record validates the reusable country kit, not a completed national dashboard. The live collection exercise below is a bootstrap acceptance check. Official subnational statistics, legal boundaries, planning laws and local planning materials still require country-specific research and integration.

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| `npm run check` | Pass | 39 JavaScript modules and JSON templates checked; 34 Markdown files and their local links verified |
| `npm test` | Pass | 123 tests passed, 0 failed |
| Country/data invariants | Pass | Zero and missing remain distinct; national sources cannot populate local observations; IDs, hierarchy and boundary editions are validated |
| UX regression | Pass | A lower-area selection is cleared by an explicit parent selection, including the same parent, while metric and period remain selected |
| Output safeguards | Pass | Selected identity, source, period, unit and missing evidence are retained in screen, print and CSV/working-document outputs |

## Live Uganda bootstrap

Command:

```sh
node scripts/create-country.mjs --country "Uganda" --out <new-directory>
```

Result:

- Collection status: `partial`
- World Bank WDI: 12 indicators and 273 national observations
- geoBoundaries: 4 ADM1 reference areas
- Country validation errors: none
- Correctly reported limitations: national statistics only; no verified planning documents collected

The result was served locally and inspected on Home, Territorial Diagnostic, Thematic Diagnostic and Development Plan Materials. The Territorial and Thematic pages showed national observations separately from unavailable local values. The planning page stated that no collected document does not establish plan absence or approval.

The area control was exercised from Uganda to Northern Region and back to Uganda. On the return selection, the URL and page target changed to `territory=UGA`; the previously selected metric `SP.POP.TOTL` and period `2025` remained in the URL. The heading and planning-material target also returned to Uganda.

## Not covered by this record

- Completion of Uganda or any other country adapter
- Login-only or non-public national sources
- Mobile and assistive-technology testing with representative end users
- Deployment of a generated country site
- Legal review of each upstream dataset's redistribution conditions

GitHub repository visibility, template status and Actions runs are recorded after publication in the release history or a follow-up validation update.
