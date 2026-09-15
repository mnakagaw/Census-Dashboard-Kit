# Census Dashboard Kit 1.1.0 validation

Validation date: 2026-09-15  
Implementation commit: `79fa643`  
Environment: Windows, Node.js 22 or newer contract

## Validated change

Version 1.1.0 changes the user contract from a visible starter site to one request that must continue through country research, integration, browser and output checks, and the delivery gate. `create-country.mjs` remains an internal workspace preparation tool and writes `evidence/WORK_STATUS.json` as `research_required`.

The new `verify-delivery.mjs` gate rejects a completion claim unless the country dataset validates, five research areas have evidence, five validation areas are recorded as passed, the four required site entries and declared artifacts exist, the default view uses a locally observed indicator and period when local observations exist, empty comparisons are suppressed or collapsed, and coverage claims are qualified by indicator, period and level.

The interface now chooses the best-covered local indicator and period for an unqualified first visit. A comparison in which every member value is missing displays one concise explanation instead of an empty map, legend and screen table; its missing-member evidence remains available to CSV and print outputs.

## Automated checks

- `npm run check`: passed. Checked 41 JavaScript modules, JSON templates and 35 Markdown files.
- `npm test`: passed, 128 of 128 tests.
- `node scripts/create-country.mjs --help`: passed and identifies the result as an internal workspace.
- `node scripts/verify-delivery.mjs --help`: passed.
- `git diff --check`: passed.

The regression set includes the same-parent reselection rule: after a city or other lower area is selected, explicitly selecting its current parent again clears the lower selection and immediately analyses the parent while retaining the indicator and period.

## Not represented as completed by these checks

- A fresh Antigravity installation running from one country-name prompt through a real country delivery without intervention.
- Acquisition rights or publication of data that the responsible institution does not make public.
- Mobile and government-user acceptance for a newly generated country.
- External hosting of a generated country site.

Each country delivery must create its own evidence records, run `validate-country.mjs`, perform browser and output checks, and pass `verify-delivery.mjs`. This kit validation cannot be reused as that country evidence.
