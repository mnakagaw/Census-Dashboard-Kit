# Census Dashboard Kit 1.2 implementation contract

This contract defines what an AI must preserve when it turns a country name into a country dashboard. The public kit supplies the initial collector, a data contract, three main page roles, reusable source research, and tests. Each country project supplies the verified local evidence and adaptations.

Kit version 1.2.0 keeps `dataset.schema_version = "0.2"` for compatibility. Optional `analysis` and `planning` objects extend the schema without making old country datasets invalid. Version 1.1.0 added a one-shot delivery gate; version 1.2.0 requires a verified country planning outline, DOCX output and classified planning-law, census and international-source links for completed country deliveries.

## Required page roles

1. **Territorial Diagnostic** reads one selected area across all acquired themes.
2. **Thematic Diagnostic** compares compatible areas for one indicator and source period.
3. **Development Plan Materials** connects the same selected area to applicable planning rules, official materials, statistical evidence, gaps, and adopted working outputs.

The generated home page routes users to these roles. A supporting Data Register may expose the indicator dictionary, territory register, observations, and source records. It is not a substitute for the three main roles.

Country-specific evidence controls the administrative hierarchy, legal planning level, internal-analysis level, language, indicator set, periods, map depth, charts, document types, and outputs. Do not freeze one country's institutions, cycle, headings, or available data as the global format.

## Internal workspace preparation and one-shot delivery

- Node.js 22 or later; ES modules; no runtime npm dependency or API key.
- `scripts/create-country.mjs --country <name-or-ISO> --out <new-directory>` prepares an internal AI workspace: it resolves the country, collects WDI national series and an available geoBoundaries ADM1 reference, validates the dataset, generates working files, and writes research evidence. It is never the user delivery.
- The command refuses an existing output directory. Collection failure leaves acquired evidence and a failure receipt.
- `evidence/SOURCE_PREFLIGHT.json` and `.md` separate source-location research from acquisition, geographic matching, and indicator adoption.
- `scripts/build-country.mjs --project <directory>` validates canonical `data/dashboard.json` and regenerates `site/`.
- `scripts/validate-country.mjs --project <directory>` validates without rebuilding.
- `scripts/serve.mjs --dir <project/site> --port 4173` serves only on `127.0.0.1`.
- `lib/collect.mjs` exports `collectCountry({country, rawDir, fetchImpl, onProgress})`.
- `lib/generate.mjs` exports `generateSite({dataset, outDir})`.
- `lib/validate.mjs` exports `validateDataset(dataset)` and returns `{errors, warnings}`.

The AI continues without returning the working site to the user. A country is complete only after it has inspected the country's official census catalogue and detailed tables, official codes and boundaries, planning law and guidance, representative local plans, and relevant sector, budget, implementation, or evaluation sources; integrated the usable local evidence; adapted all three pages; tested the actual site and outputs; recorded `evidence/DELIVERY.json`; and passed `scripts/verify-delivery.mjs`. Source constraints may produce a constrained complete product only when the investigation evidence and usable fallback are both complete.

## Region-selection contract

- The last area explicitly selected in the top hierarchy is the analysis target.
- Selecting a lower area updates the heading, location map, all indicators, documents, URL, saved context, and every generated output without a separate zoom/apply action.
- After a child is selected, explicitly selecting its current parent again clears the child and immediately selects the whole parent. The indicator, source period, and unrelated user notes remain.
- The UI must distinguish a parent shown as lineage or filter context from an action that selects the parent itself. Implement and test a same-option reselection path because a native `change` event may not fire.
- Parent selection must not leave a former child's values, map, documents, or exports on screen.
- A focus action inside one indicator's comparison map or table changes only that indicator's focus. It does not change the top analysis area, other indicators, documents, URL, or output target.
- A parent uses its own source observation first. A calculated value requires an approved rule and complete, non-overlapping, documented membership. Incomplete subtotals never become parent totals, and rates or other non-additive measures are never simply averaged.

## Optional analysis contract

`dataset.analysis` is optional. Without it, direct children in `territories[].parent_id` are comparison candidates. A country adapter may set:

| Field | Contract |
|---|---|
| `analysis.kind` | `country` for this kit's generated country projects. |
| `analysis.terminal_territory_ids` | Verified base municipalities or other areas where ordinary subdivision stops. Smaller data do not make a legal planning authority. |
| `analysis.comparisons[]` | A known parent, complete non-overlapping member IDs, a label, membership note, and source IDs for the geography register. |
| Observation meaning | Optional definition ID, definition, unit, population, method, measurement method, and boundary version preserve differences from the indicator default. Incompatible records remain visible but are excluded from common colors and numeric comparison. |
| `analysis.aggregation` | Only `exact_then_complete_cover` rules for declared indicators may calculate parents. The output retains components, periods, missing IDs, and provenance. |

The full requirements are in [ANALYSIS_DATA_CONTRACT.md](ANALYSIS_DATA_CONTRACT.md). Diagnostic Markdown, print-ready HTML, and full CSV must include every selected-period indicator and every internal-comparison row, including missing or unmapped areas. Print output must not depend on the screen's search, collapse, or scroll state.

## Optional planning contract

`dataset.planning` and extended document records are optional. [PLANNING_DATA_CONTRACT.md](PLANNING_DATA_CONTRACT.md) is authoritative for their fields and validation.

Planning displays and outputs keep statistical periods, multi-year plan periods, fiscal years, and report quarters separate. A discovered link, acquired body, extracted content, cross-checked content, and official status are different states. Budget execution, plan achievement, and an official evaluation score are different measures.

The legal planning unit and its internal-analysis geography must be recorded separately. A District plan may require Subcounty distributions without making Subcounties the legal plan owner.

An old dataset without `planning` keeps default labels and legacy working outputs. It remains readable but cannot pass the country delivery gate until it has a verified `planning.document_template`, the three `planning.source_groups`, adopted `docx` output and rendered sample evidence. Existing unverified free text cannot be promoted to verified evidence during migration.

## Update failure and recovery

`build-country.mjs` validates candidate data and generates inside a managed staging directory before replacing `site/`. It refuses a site containing a symbolic link or Windows junction that could redirect writes. A previous site backup remains in `.build-backups/`.

If validation or generation fails, the last good `site/data/dashboard.json` remains. `evidence/validation.json` records the failure and `site/data/update-status.json` tells a compatible site that the update stopped. A later successful build clears the build failure state but does not erase a separately recorded source-update failure.

## Dataset schema 0.2

```json
{
  "schema_version": "0.2",
  "generated_at": "ISO datetime",
  "country": {
    "id": "UGA",
    "iso2": "UG",
    "name": "Uganda",
    "requested_name": "ウガンダ",
    "locale": "en",
    "national_territory_id": "UGA",
    "geography_note": "..."
  },
  "territories": [
    {
      "id": "UGA",
      "name": "Uganda",
      "level": "national",
      "type": "country",
      "parent_id": null,
      "official_code": null,
      "code_system": "World Bank economy code",
      "boundary_version": null
    }
  ],
  "indicators": [
    {
      "id": "SP.POP.TOTL",
      "name": "Population, total",
      "theme": "Population",
      "unit": "people",
      "definition": "...",
      "source_id": "wb-SP.POP.TOTL",
      "aggregation": "none",
      "measurement_method": "source_reported"
    }
  ],
  "observations": [
    {
      "territory_id": "UGA",
      "indicator_id": "SP.POP.TOTL",
      "period": "2024",
      "value": 1,
      "status": "observed",
      "source_id": "wb-SP.POP.TOTL"
    }
  ],
  "sources": [
    {
      "id": "wb-SP.POP.TOTL",
      "name": "World Bank WDI",
      "url": "https://api.worldbank.org/...",
      "publisher": "World Bank",
      "retrieved_at": "ISO datetime",
      "reference_period": "2000:2026",
      "status": "ready",
      "sha256": "...",
      "raw_path": "raw/example.json",
      "license": "source terms URL",
      "note": "..."
    }
  ],
  "boundaries": {"type": "FeatureCollection", "features": []},
  "documents": [],
  "gaps": [],
  "collection": {"status": "partial", "adapters": ["world-bank", "geoboundaries"], "notes": []}
}
```

The population value `1` is a schema example and must never be reused as evidence. Boundary features require `properties.territory_id`. A geoBoundaries `shapeID` remains a provider ID until an official code crosswalk is verified. National observations belong only to the national territory and are never copied into local records.

## Completion evidence

For the adopted scope, record:

- source URLs, publisher, edition or access date, original-file hash, table/page or API query, reuse conditions, and acquisition state;
- official geographic codes, area type, parentage, boundary version and unmatched records;
- every inspected table and numeric column, including accepted and rejected indicators and reasons;
- representative complete, sparse, and special-type areas tested through selection, diagnostics, materials, URLs, reload, back/forward, and downloads;
- `npm run check`, `npm test`, country validation, actual browser checks, output-content checks, environment, dataset edition, commit, and anything not performed;
- a `HANDOFF.md` with completed work, exact replay commands, the last successful build, current gaps, and the next concrete action.
- an `evidence/DELIVERY.json` grounded in the above records and a passing delivery-gate result. If local observations exist, its default indicator and period must actually support local comparison. All-missing maps, legends and tables are suppressed or collapsed on screen while full audit rows remain in exports.

Use the applicable cases in [the 42-scenario acceptance sheet](../templates/ACCEPTANCE.md). The existence of a scenario is not a passing result. A list of source links, a prepared workspace, or a green CI run does not by itself prove that the country dashboard is complete.
