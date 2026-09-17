# Independent completion audit

Use this audit only after the country-building thread says the dashboard is complete. The auditor must inspect the deliverable independently and must not accept `DELIVERY.json`, a green test run, or the builder's summary as proof by itself.

## Auditor role

- Work in a separate task, conversation, or terminal session from the builder.
- Open the same country project read-only, except for the audit report described below.
- Do not repair code or data during the audit. Record reproducible findings so the builder can fix them.
- Check the actual source files, normalized data, generated pages, browser behavior, downloads, and rendered DOCX.
- Record the dataset edition, kit commit, environment, tested URLs, representative areas, and anything not tested.

Save the result as `evidence/INDEPENDENT_AUDIT.md` in the country project. End with exactly one verdict: `ACCEPT`, `REJECT`, or `INCOMPLETE AUDIT`. `ACCEPT` requires no unresolved blocking or major finding.

## Evidence and data checks

1. Resolve the country, ISO identifiers, official administrative hierarchy, code systems, boundary editions, legal planning unit, and internal diagnostic levels from cited sources.
2. Open the official census catalogue and every acquired workbook, CSV/API payload, and relevant PDF table. Reconcile the actual numeric columns with `SOURCE_TABLE_INVENTORY.json`, adopted indicators, exclusions, and reasons.
3. Check all six themes. Search beyond one population file and beyond national WDI. Confirm whether apparent gaps are truly unavailable, incompatible, restricted, or simply not yet acquired.
4. Trace sample values from the screen and exports back to an exact source table, row/column or PDF page. Verify definition, unit, population, period, geography, status, and source ID.
5. Distinguish zero, missing, suppressed, not applicable, unverified, unavailable, and acquisition failure. Confirm that national values are not shown as local values.
6. Verify every calculated value from its components. Require complete, non-overlapping coverage and an approved aggregation rule. Never accept a simple average of rates as a parent rate.
7. Check that country overview facts and national population have registered sources. Administrative counts must match the territory register and must not imply legal planning authority by themselves.

## Geography and interaction checks

1. Measure territory-to-boundary joins at every selectable level. Check name/code collisions, independent cities, changed boundaries, missing islands, and parent-child membership.
2. Select national, an upper area, a lower area, a data-rich area, a sparse area, and a special administrative case. Confirm heading, map, indicators, documents, URL, CSV, print, and DOCX all use the same selected ID.
3. After selecting a child, select its current parent again. The child must clear immediately and no child value or document may remain.
4. On the thematic page, change comparison area and administrative level. The map, ranking, median, coverage, and selected-area detail must use the same comparison set and common source period.
5. Confirm that zoom in, zoom out, fit parent, and whole-country controls work without changing the analytical selection. Surrounding context should remain understandable.
6. Suppress or collapse maps, legends, and ranking tables when every comparable value is missing. A map of boundaries alone must not look like a data map.
7. The default country entry must be the national Territorial Diagnostic. If a country adapter deliberately adds a separate home page, it must show source-grounded country basics, national population and year, the registered administrative structure, and clear routes to the three work pages. It must not contain a selector whose effect is invisible or gives no next step.

## Content, language, and output checks

1. Every country-page indicator shows its latest confirmed value for the selected area and the source year beside it. Thematic comparisons use one newest compatible common year.
2. Indicator labels explain the measured condition in ordinary language. MPI deprivation indicators must not be described as general outcome prevalence.
3. Review the complete page in every supported language. Find untranslated interface text, mixed-language notices, broken wrapping, overlap, clipped controls, and misleading official-sounding labels.
4. Confirm the planning page lists planning law/guidance, census sources, and international sources separately, with publisher, status, checked date, and working link.
5. Render the DOCX with the isolated document workflow. Verify title, selected territory, legally grounded index, meaningful diagnostic narrative, charts/maps where useful, tables, citations, page breaks, and missing-evidence wording. It must not present itself as an approved government plan.
6. Open direct URLs for all three pages, reload shared URLs, test navigation and brand reset, print all rows, and open every adopted download. Browser console errors and `undefined` access are blocking findings.

## Report format

List findings first, ordered `BLOCKING`, `MAJOR`, `MINOR`. Each finding needs:

- the violated contract or acceptance scenario;
- exact page, area, indicator, file, or source;
- steps to reproduce;
- expected and actual result;
- evidence such as counts, values, source location, screenshot path, or console error;
- the concrete acceptance condition for the repair.

Then list checks that passed with evidence, checks not performed, and the final verdict. Do not reduce severity because the automated gate passed.
