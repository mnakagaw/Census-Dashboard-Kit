# Country-name-only kit acceptance

## User promise

The user changes the single `COUNTRY_NAME` placeholder in `prompts/ONE_COUNTRY_COMPLETE.md` and sends that prompt once to Antigravity, Codex or Claude Code. The AI performs research, acquisition, integration, site and Word production, visual checks and the delivery gate without returning a questionnaire or an initial scaffold as the result.

The generated country directory belongs to the user. The user is encouraged to edit labels, themes, styles, narratives and source adapters, then rerun the build and validation commands. Dominican Republic, Uganda, Laos and Bangladesh are both reference lessons and valid fresh target countries. Selecting one of them requires a new source refresh and build; an old example is not returned as the result.

## What is prepared for all 142 JICA-priority countries and territories

- Source-backed ISO2, ISO3, M49, English/JICA names, supervising offices and priority basis.
- A national statistics-office entrypoint for every record, sourced from the UNSD directory or a recorded official government/agency entrypoint.
- UNSD census-round rows where UNSD publishes them; absence of a row remains explicit.
- A country-filtered FAOLEX legal catalogue, JICA/MOFA planning-context entrypoints and an instruction to identify the specific current planning/decentralization law, guidance, forms and actual planning documents.
- Country-coded geoBoundaries API addresses, UN SALB and a targeted HDX geography search.
- Country-coded WDI queries and fixed catalogues for HDX, MICS, DHS, WorldPop, GHSL and UNDP human-development data.
- Anti-shortcut rules that prevent an entrypoint, census date, first workbook, search result or national value from being treated as completed local evidence.

The universal machine-readable registries are `config/world-country-area-registry.json` and `config/world-source-preflight.json`; the human-readable 250-row review is `docs/research/world-2026/WORLD_SOURCE_PREFLIGHT_250.md`. The JICA 142 registry is an additional priority and operational-context layer. These records are starting addresses, not stored country data. Country work must refresh links, inspect the actual release and legal text, inventory all resources/tables/fields, reconcile geography and record adoption decisions. Spain and Finland are required resolution examples for developed-country, devolved-law and register-based systems. Taiwan is a required operational-supplement example with its own official statistical, planning-law and geographic sources and an explicit status caution.

## Constrained completion

A country can have unpublished, restricted or unavailable local data. The AI still completes the usable site and Word output, records the exact limitation and evidence, suppresses misleading comparisons and finishes every applicable test. Missing data is not replaced with national values or invented estimates. `verify-delivery` accepts a constrained research result only when its evidence and fallback are complete.

## Machine gate

Run:

```sh
npm run verify:kit
```

The command fails unless the canonical prompt has one editable country placeholder, every AI entrypoint binds the same completion contract, all 142 identities and source-address preflights resolve, all four reference countries remain selectable targets, and the required scripts, templates and contracts exist. CI runs this gate on Windows and Ubuntu with the supported Node versions.

This gate verifies kit readiness. A country delivery separately requires `node scripts/verify-delivery.mjs --project <country-directory>` to return `ready: true` from current country evidence.
