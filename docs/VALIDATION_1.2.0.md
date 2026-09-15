# Census Dashboard Kit 1.2.0 validation

Checked 2026-09-15 on Windows. Implementation commit: `df26bf359cabb5f426380c6af6f0e5d815fea48d`.

## Result

Version 1.2.0 makes a country-specific, law-aligned DOCX and a classified official-source register part of the completed-country contract. A delivery must now include planning-law or official-guidance sources, Census or national-statistics sources, and adopted international-institution sources. The planning page lists their official URLs, publisher, acquisition state and retrieval date under separate headings.

The DOCX generator refuses to run without either a verified official prescribed index or a verified requirements-based outline for a country whose official system has no fixed index. Each section records its source, locator and check date. The output also carries the selected area and statistical period, evidence table, planning materials, source register, gaps and document control.

## Automated checks

- `npm run check`: 44 JavaScript modules and JSON templates, plus 37 Markdown files.
- `npm test`: 132 passed, 0 failed.
- Coverage added for DOCX packaging and refusal of a generic unverified outline; planning source grouping; schema errors; Japanese and Spanish labels; and the delivery gate rejecting missing source groups or missing rendered-Word evidence.
- GitHub Actions `Validate kit` run [34927145425](https://github.com/mnakagaw/Census-Dashboard-Kit/actions/runs/34927145425): passed on Windows and Ubuntu with Node.js 22 and 24.

## DOCX render review

A synthetic, clearly labelled test dataset was used only to verify the reusable output mechanism. `scripts/build-plan-docx.mjs` generated a valid seven-entry DOCX ZIP package. The isolated document renderer converted it through LibreOffice and Poppler to seven PNG pages and a PDF. All seven pages were inspected at original resolution.

The first render exposed long source URLs overflowing a planning-materials table. The table now uses the source name while the full official URLs remain in the source register and legal-basis paragraphs. A second render exposed the document-control table splitting at a page boundary; the section now starts on a new page. The third render had no clipped text, missing table content, broken section order or unintended blank continuation row.

Verified content included the selected territory, data edition and period, outline status, legal and procedural source, the law/Census/international source groups, all three test sections and their legal-basis locators, the statistical evidence annex, acquired planning materials, evidence gaps and document control.

## Scope boundary

This is a reusable-kit validation with synthetic evidence. It does not certify any real country's law, official plan format, Census tables or international data. Each generated country must repeat the source verification, DOCX render review, browser review and output-to-screen checks with its own evidence before `verify-delivery.mjs` can pass.

An automated interactive browser review of the synthetic planning page was not completed in this run because the local in-app browser connection was unavailable. Static generation and runtime behavior are covered by the automated suite; the country-delivery contract continues to require recorded real-browser evidence.
