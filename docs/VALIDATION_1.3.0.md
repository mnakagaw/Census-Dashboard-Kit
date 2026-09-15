# Census Dashboard Kit 1.3.0 validation

Date: 2026-09-15

## Scope

Version 1.3.0 responds to a read-only audit of an early Laos country project generated with kit 1.0.0. The audit found that the working server and basic pages could pass while acquired source fields, other official publications, selectable-level boundaries, alternative periods and display-language review remained incomplete. The audited Laos project itself was not modified.

## Implemented checks

- `evidence/SOURCE_TABLE_INVENTORY.json` must cover every acquired source table or sheet, decide every numeric field and record the source redistribution decision. Every dataset indicator must trace to an adopted field.
- `evidence/THEME_COVERAGE.json` must cover six planning-relevant themes. A discovered candidate cannot remain unintegrated in a ready delivery.
- Delivery geography counts must match the actual territories and joined boundary features at every selectable local level. Partial or absent coverage requires recorded unjoined IDs.
- The delivery record must confirm stable shared URLs, compact no-geometry states, discovery of acquired values in other periods, separation of national context on local pages, and a display-language review.
- Territorial Diagnostic collapses themes with no value for the selected area and period. If the same area and indicator has acquired values in another period, it lists those periods and provides a switch action.
- A map with no joined geometry uses a compact empty state rather than occupying the main analytical area.

## Laos audit evidence used to design the change

- The project contained 18 ADM1 and 148 ADM2 territories, but no ADM2 boundary features.
- Its six local population indicators were available in 2024; three province poverty indicators were available in 2017. A single 2024 page filter therefore hid the acquired 2017 values.
- The acquired population CSV contained sex by five-year age group, while only three broad age groups were integrated.
- The acquired OPHI workbook contained deprivation fields beyond the three integrated indicators.
- The page mixed Japanese and English and allowed stale identity parameters in a shared URL.

These observations establish failure modes for the kit. They do not certify the underlying sources, geographic joins or redistribution rights. Country adapters must still verify the official definition, licence and current publication status.

## Verification

The local release candidate was verified with:

- `npm run check`: 44 JavaScript modules and 39 Markdown files passed.
- `npm test`: 134 of 134 tests passed.
- The delivery gate rejected the incomplete 1.0-style Laos project because it has no completed `evidence/DELIVERY.json`.
- A read-only copy of the Laos dataset was rebuilt with 1.3.0 and checked in a real browser. Botene's missing ADM2 boundary uses a compact state; national and unavailable poverty themes are collapsed. Xaignabouli's collapsed 2024 poverty section visibly reports `acquired: 2017`, and `Show 2017` changes the URL to the selected poverty indicator and period and displays the three acquired values.

GitHub Actions `Validate kit` on its configured operating-system and Node.js matrix is required on the pushed commit. The release report identifies the exact commit and run. Test existence is not reported as every country acceptance scenario passing.
