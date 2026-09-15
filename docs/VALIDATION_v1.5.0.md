# Validation record — 1.5.0

Validated on 2026-09-16 against the reusable kit and a separate Lao PDR country bundle. The country data and generated country site are not stored in this repository.

## Automated checks

- `npm run check`: passed; 44 JavaScript modules and JSON templates, 43 Markdown files.
- `npm test`: passed; 141/141 tests.
- Country validator: passed with zero errors and zero warnings for 167 territories, 42 indicators and 1,896 observations.
- Delivery gate: ready with zero errors and zero warnings.

## Browser checks

- A terminal administrative area is displayed by its place name alone. `Whole／全体` is used only for an area that contains a selectable lower tier.
- Selecting the same parent again clears the lower-area selection and updates the heading, values, material links, outputs and URL to the parent.
- Thematic comparison keeps the selected parent as its scope and compares only the next lower administrative level; the comparison area can be changed on the thematic page.
- Location maps can fit the selected area, its parent and the country. Zoom out, reset and zoom in do not change the analytical selection or URL.
- The selected-area map, population pyramid and data-bearing comparison maps remain visible. All-missing comparison maps are suppressed.

## Word output

- An 18-page Territorial Development Planning Diagnostic was generated for a terminal area and rendered with the isolated document renderer.
- The document contains a location map, population pyramid, comparison charts, narrative grounded in the displayed observations, the source-aligned planning index, evidence tables and source lists.
- All pages were visually inspected. No clipped chart title, overlap or orphaned blank page was found.
