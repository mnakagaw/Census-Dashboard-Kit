# Census Dashboard Kit 1.4.0 validation

Date: 2026-09-15

## Scope

Version 1.4.0 changes the country-facing Territorial Diagnostic, Thematic Diagnostic and Planning Materials pages to show the latest confirmed value available for each indicator. Every displayed value carries its own source year. Country pages no longer expose a historical-year selector, time-series chart, old-year switch or history CSV. Historical observations remain in the dataset and source register for audit and future updates.

World, continental and regional dashboards keep their explicit period behavior. A thematic country comparison still uses one indicator, one administrative level and one automatically selected common source year so unlike periods are not ranked together.

## Implemented checks

- Territorial themes are included when the selected area has at least one latest confirmed indicator value, even when indicators have different source years.
- Metric cards, territorial Markdown, print-ready HTML, evidence CSV and Planning Materials use the latest confirmed observation for each indicator and record its actual year.
- Thematic comparison selects the newest year with comparable observations for the chosen indicator and level. Coverage, map, table and selected-area evidence state that year explicitly.
- Country URLs carrying an obsolete `period` value are normalized to the selected indicator's current comparison year; they do not reactivate historical controls.
- The delivery gate requires `latest_value_per_indicator`, `source_year_shown_per_value` and `historical_period_controls_absent` evidence.
- Planning Word output identifies the latest-value policy and includes a `Year / period` column for every statistical evidence row. Planning documents retain their own plan, fiscal or reporting periods.

## Verification

The local release candidate was verified with:

- `npm run check`: 44 JavaScript modules and JSON templates plus 41 Markdown files passed.
- `npm test`: 141 of 141 tests passed, including mixed latest years, comparison-year selection, parent-scoped lower-level comparison, country delivery-gate requirements and Planning Word data generation.
- A read-only copy of the earlier Laos project was rebuilt with the 1.4.0 scaffold and checked in a real browser. On the same national Territorial Diagnostic, population indicators showed 2024, unemployment showed 2025 and provincial poverty indicators showed 2017. Each value displayed its year, and no country period selector or historical-series action was present.
- The Laos Thematic Diagnostic automatically changed an obsolete `period=2024` URL for the MPI indicator to its newest comparable year, 2017. The map, coverage, ranking rows and selected-area value all displayed 2017.
- The Laos Planning Materials page displayed the latest-per-indicator policy and the number of indicators with a latest confirmed value, without a statistical period selector. Planning records continued to show their own document periods.
- An isolated DOCX fixture was generated without a requested historical period and rendered with the bundled LibreOffice/Poppler workflow. All seven pages were visually inspected. The statistical annex showed population 2024 and water 2022 in separate rows with no clipping or overlap.

The Laos copy was used only to verify runtime behavior; it does not certify that project's source content, administrative joins, language coverage or country delivery status. GitHub Actions `Validate kit` on the configured operating-system and Node.js matrix is required on the pushed commit. Test existence is not reported as every country acceptance scenario passing.
