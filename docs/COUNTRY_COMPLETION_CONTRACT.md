# Country completion contract

This contract was written after the Laos and Bangladesh builds. It defines when a country-name-only request may be returned as complete.

## The failure pattern this prevents

A generic AI tends to stop after the first easy national API, a single population file, one representative district, successful scaffolding or a visible local page. Bangladesh showed why this is unsafe: one Gazipur workbook proved that detailed local data existed, but the official catalogue contained 64 district workbooks. The finished build integrated all 64 and expanded from a 6-area example to 507 local statistical areas. Laos similarly showed that acquired source columns can be discarded while the interface reports No data.

Completion is therefore a closure problem, not a page-generation event.

## Mandatory closure sequence

1. **Resolve and isolate.** Resolve country identity and ISO alpha-3; create a new country directory and Task Contract.
2. **Close official catalogues.** Record every expected resource from each official census/statistics catalogue. Every item ends as integrated, unavailable, restricted, failed with evidence, duplicate, superseded, incompatible, or excluded with a source-specific reason.
3. **Audit original content.** Inspect every sheet, field, table, appendix and continued table. Record all numeric fields, including rejected ones.
4. **Close six themes.** Finish the six-theme audit. `candidate_found_not_integrated` is a failed completion state.
5. **Close geography.** Reconcile territory IDs, official codes, hierarchy, boundary editions and unmatched areas. Keep statistics when a shape is absent; never substitute an unverified shape.
6. **Close planning evidence.** Identify the legal planning body, applicable instrument, required content and separate plan/budget/implementation/evaluation states.
7. **Build complete interactions.** Finish all three pages, latest-year display, hierarchy, comparison scope/level, map context and zoom, exports and English/Spanish Word rules.
8. **Counterexample audit.** Test ordinary, sparse, blank-source, unjoined, special-type and terminal regions. Test parent reselection and stale-state removal.
9. **Output parity.** Reconcile screen, CSV and Word territory, value, unit, period, source and calculation status. Render and inspect every Word page.
10. **Gate and publish.** Run the full tests, 42 scenarios, twelve-case audit and delivery gate. Publish only the scoped generated site and verify remote hashes and public behavior.

The completion decision is valid only when `verify-delivery` reports `ready: true`.

## Non-completion states

The agent must continue working when any of these remains:

- an official catalogue has undispositioned resources;
- an acquired workbook/table has uninspected numeric fields;
- a usable candidate is found but not integrated;
- a selectable level has no counted geography decision;
- a child selection survives after its parent becomes the analysis target;
- thematic scope, displayed level, map and ranking disagree;
- a missing direct value is replaced by child data or a national value;
- an all-missing comparison displays a data-looking choropleth;
- the Word document is unrendered, visually unchecked, generic filler or presents itself as an official plan;
- an applicable acceptance scenario says untested or not performed;
- `verify-delivery` returns `ready: false`;
- deployed files have not been read back/compared and the public page has not been checked.

A source may remain unavailable, restricted or unmatched. That is a valid constrained result only when the state, evidence, fallback and next action are explicit and every other workflow is complete.

## Machine evidence required

- `evidence/SOURCE_RESOURCE_INVENTORY.json`
- `evidence/SOURCE_TABLE_INVENTORY.json`
- `evidence/THEME_COVERAGE.json`
- `evidence/CODE_CROSSWALK.csv`
- `evidence/GEOGRAPHY_REVIEW.md`
- `evidence/PLANNING_CENSUS_AUDIT.md`
- `evidence/COUNTRY_LESSON_AUDIT.md`
- `evidence/ACCEPTANCE.md`
- `evidence/VALIDATION.md` and `validation.json`
- `evidence/WORD_RENDER_CHECK.md` and rendered DOCX sample
- `evidence/DELIVERY.json` with a passing gate
- deployment/public verification when publication is requested
- `HANDOFF.md`

## Product-specific entrypoints

`AGENTS.md`, `GEMINI.md` and `CLAUDE.md` all bind the respective AI to this same contract. `prompts/ONE_COUNTRY_COMPLETE.md` is the single prompt. Product wrappers may explain permissions but may not weaken the contract.
