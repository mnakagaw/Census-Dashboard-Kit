"""One-time maintainer helper for importing the audited Americas source recipes.

This script is intentionally not part of the country-generation workflow. It reads the
strict completion matrix supplied by an Americas project and writes only reusable public
source locations and methodological lessons. It never copies observations or credentials.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


COMPLETED = [
    "ARG", "BOL", "BRA", "CAN", "CHL", "COL", "CRI", "CUB", "DOM", "ECU",
    "GTM", "GUY", "HND", "HTI", "JAM", "MEX", "NIC", "PAN", "PER", "PRI",
    "PRY", "SGS", "SLV", "SUR", "TTO", "URY", "USA", "VEN",
]

LESSONS = {
    "ARG": {
        "aliases": ["Argentina", "アルゼンチン"],
        "reference_years": [2022, 2023, 2024, 2025],
        "domestic_scope": "24 provinces and 529 departments; products use different reference years and universes.",
        "dominant_failure_class": "semantic_and_provenance_reconciliation",
        "acquisition_methods": ["Download and inventory the official INDEC census workbooks and publications.", "Resolve official province and department codes with Argentina Georef."],
        "semantic_cautions": ["Population in private dwellings is not a household-universe water or sewer denominator.", "Disability products limited to urban localities of 5,000 or more inhabitants cannot be generalized to every locality."],
        "geography_cautions": ["Join by verified INDEC/Georef codes; do not merge names alone.", "Retain the period carried by each source instead of forcing one dashboard-wide year."],
        "reuse_actions": ["Record the exact workbook, sheet, field, denominator and Georef code for every adopted value."],
    },
    "BOL": {
        "aliases": ["Bolivia", "Bolivia (Plurinational State of)", "ボリビア"],
        "reference_years": [2024],
        "domestic_scope": "Nine departments are integrated; municipality and TIOC rows require a separate verified adoption.",
        "dominant_failure_class": "scope_and_adoption_boundary",
        "acquisition_methods": ["Acquire the official INE CPV 2024 workbooks and preserve the complete sheet inventory."],
        "semantic_cautions": ["The existence of municipality or TIOC rows upstream does not mean they were integrated or geographically matched."],
        "geography_cautions": ["Keep department, municipality and TIOC classifications distinct."],
        "reuse_actions": ["Recheck whether municipality/TIOC tables and matching boundaries are available before claiming lower-level coverage."],
    },
    "BRA": {
        "aliases": ["Brazil", "Brasil", "ブラジル"],
        "reference_years": [2022],
        "domestic_scope": "States and municipalities using IBGE identifiers.",
        "dominant_failure_class": "premature_catalogue_closure",
        "acquisition_methods": ["Query IBGE SIDRA by exact table, variable, classification, territorial level and period.", "Retain the request parameters and response hashes for state and municipality queries."],
        "semantic_cautions": ["Never use one age-sex table to close housing, water, sanitation, education, employment, disability, migration, health, nutrition or poverty.", "Store numerator, denominator, universe and classification IDs for calculated rates."],
        "geography_cautions": ["Use IBGE municipality codes and the boundary vintage stated by the adopted product."],
        "reuse_actions": ["Search the wider SIDRA catalogue after each table; begin with known useful tables 6326, 6803, 6805, 9605, 9543, 10125, 9923 and 9517, then refresh their current metadata."],
    },
    "CAN": {
        "aliases": ["Canada", "カナダ"],
        "reference_years": [2021, 2022],
        "domestic_scope": "Province/territory, census division and census subdivision products with official StatCan codes.",
        "dominant_failure_class": "large_file_and_evidence_binding",
        "acquisition_methods": ["Use the 2021 Census Profile catalogue or SDMX service and official PR/CD/CSD cartographic products.", "Reject incomplete or corrupt catalogue ZIP files and retain the successful download receipt."],
        "semantic_cautions": ["Keep census measures and later disability estimates distinct by source and year."],
        "geography_cautions": ["Preserve the PR/CD/CSD hierarchy and official geographic identifiers."],
        "reuse_actions": ["Verify archive integrity before extraction and record exact member/table locators."],
    },
    "CHL": {
        "aliases": ["Chile", "チリ"],
        "reference_years": [2024, 2025],
        "domestic_scope": "16 regions, 56 provinces and 346 communes using CUT codes.",
        "dominant_failure_class": "full_table_inventory_and_boundary_exception",
        "acquisition_methods": ["Inventory every official 2024 census workbook and numeric field.", "Use official geographic services and retain the service response used for each boundary layer."],
        "semantic_cautions": ["Do not infer uninspected themes from the absence of a field in one workbook."],
        "geography_cautions": ["Commune 12202 Antártica may retain values without geometry when the official service does not return a feature.", "Treat later boundary geometry as display reference when it does not match the census year."],
        "reuse_actions": ["Keep CUT codes, census year and geometry vintage visible and separate."],
    },
    "COL": {
        "aliases": ["Colombia", "コロンビア"],
        "reference_years": [2018],
        "domestic_scope": "DANE CNPV 2018 departmental products matched through DIVIPOLA.",
        "dominant_failure_class": "cross_table_semantics",
        "acquisition_methods": ["Acquire the official CNPV HTML/XLSX products and inventory every table axis."],
        "semantic_cautions": ["Do not adopt the wrong cross-tab axis as an indicator.", "Retain published numerators and denominators for percentages."],
        "geography_cautions": ["Require a one-to-one DIVIPOLA match before integration."],
        "reuse_actions": ["Record exact table and field locators rather than only the CNPV landing page."],
    },
    "CRI": {
        "aliases": ["Costa Rica", "コスタリカ"],
        "reference_years": [2022],
        "domestic_scope": "Seven provinces and 82 cantons in the 2022 statistical geography.",
        "dominant_failure_class": "dynamic_platform_and_estimate_interpretation",
        "acquisition_methods": ["Capture the official Power BI query objects and responses used for the 2022 results.", "Retain official ArcGIS identifiers COD_UGEP and COD_UGEC."],
        "semantic_cautions": ["The 2022 results include adjusted estimates after partial census coverage; do not label every value as a full enumeration count."],
        "geography_cautions": ["Do not backcast later canton changes into the 2022 statistical geography."],
        "reuse_actions": ["Store the Power BI acquisition recipe, model object names and query parameters."],
    },
    "CUB": {
        "aliases": ["Cuba", "キューバ"],
        "reference_years": [2012, 2023],
        "domestic_scope": "Province-level census tables; later health products remain separate from Census 2012.",
        "dominant_failure_class": "official_archive_recovery",
        "acquisition_methods": ["Use the official ONEI catalogue first, then the preserved official table PDFs in web archives when current links are unavailable.", "Record the exact archived URL, PDF page and table number."],
        "semantic_cautions": ["National urban/rural tables cannot be adopted as province observations.", "Keep later MINSAP health/nutrition evidence separate from Census 2012."],
        "geography_cautions": ["Use the province codes and names documented in the adopted census product."],
        "reuse_actions": ["Do not stop after the national report; enumerate the table-by-table publication set."],
    },
    "DOM": {
        "aliases": ["Dominican Republic", "República Dominicana", "ドミニカ共和国"],
        "reference_years": [2022],
        "domestic_scope": "Provinces and municipalities from Census 2022 with official geographic services.",
        "dominant_failure_class": "origin_block_and_geography_duplicates",
        "acquisition_methods": ["Attempt the ONE origin, then use an Internet Archive id_ replay of the same official object when the origin returns 403.", "Preserve both origin and replay URLs with hashes."],
        "semantic_cautions": ["A normalized DDPT snapshot is not a substitute for retaining the primary official evidence."],
        "geography_cautions": ["Resolve the duplicate municipality code 06001 and the 01001 alias explicitly; do not silently deduplicate features."],
        "reuse_actions": ["Recheck the ONE origin before using the recorded archive fallback."],
    },
    "ECU": {
        "aliases": ["Ecuador", "エクアドル"],
        "reference_years": [2022],
        "domestic_scope": "24 provinces; municipality coverage is not implied.",
        "dominant_failure_class": "blocked_origin_and_adapter_identity_bug",
        "acquisition_methods": ["Use the official census-results host and a verified archived replay only when the live object is blocked."],
        "semantic_cautions": ["Keep only the explicitly integrated ADM1 products; do not infer municipal values."],
        "geography_cautions": ["Use a source-backed province crosswalk."],
        "reuse_actions": ["Key observations by territory, indicator and period; never include source_id in the observation identity.", "Store arrays of source hashes in the declared plural field and test for duplicate observations."],
    },
    "GTM": {
        "aliases": ["Guatemala", "グアテマラ"],
        "reference_years": [2018],
        "domestic_scope": "Departments and municipalities from Census 2018 with official supplemental sources.",
        "dominant_failure_class": "source_binding_and_name_aliases",
        "acquisition_methods": ["Use the official INE Census 2018 portal, report, open data and SEGEPLAN geography services.", "Integrate supplemental health, nutrition and poverty products as distinct sources."],
        "semantic_cautions": ["Health cases are counts, not rates.", "Small-area poverty estimates are not census counts."],
        "geography_cautions": ["Apply only reviewed department/municipality aliases; retain unmatched municipalities as explicit gaps."],
        "reuse_actions": ["Preserve the verified alias ledger and do not normalize names heuristically."],
    },
    "GUY": {
        "aliases": ["Guyana", "ガイアナ"],
        "reference_years": [2022, 2012],
        "domestic_scope": "Ten census regions using official region numbers and names.",
        "dominant_failure_class": "geographic_id_mismatch",
        "acquisition_methods": ["Use Bureau of Statistics 2022 preliminary products and 2012 compendia as separate rounds."],
        "semantic_cautions": ["Do not merge 2012 and 2022 observations into one period."],
        "geography_cautions": ["AreaData IDs 05–09 are not Census Region 5–9; join region number to official name and then to the internal ID.", "Use the official spelling Barima-Waini."],
        "reuse_actions": ["Retain the explicit region-number/name crosswalk."],
    },
    "HND": {
        "aliases": ["Honduras", "ホンジュラス"],
        "reference_years": [2013],
        "domestic_scope": "18 departments and 298 municipalities.",
        "dominant_failure_class": "redatam_and_municipal_report_extraction",
        "acquisition_methods": ["Use the INE Census 2013 catalogue, Redatam and all municipality reports.", "Retain the exact filtered table or report page supporting each zero."],
        "semantic_cautions": ["A displayed zero is valid only after confirming the relevant filtered source row."],
        "geography_cautions": ["Join with official census codes; older COD-AB/SINIT boundaries are reference geometry, not current legal certification."],
        "reuse_actions": ["Require full municipality inventory rather than a representative report."],
    },
    "HTI": {
        "aliases": ["Haiti", "Haïti", "ハイチ"],
        "reference_years": [2003, 2012, 2024],
        "domestic_scope": "Ten departments using Census 2003, later estimates and survey products kept separate.",
        "dominant_failure_class": "old_census_and_incompatible_geographies",
        "acquisition_methods": ["Use IHSI Census 2003 products, IHSI 2024 estimates and EMMUS-V survey tables as separate source families."],
        "semantic_cautions": ["Describe 2024 figures as estimates based on the stated methodology, not as a new census.", "Survey percentages with incompatible regional partitions cannot be recomposed from rounded values."],
        "geography_cautions": ["EMMUS-V separates Aire Métropolitaine and Reste-Ouest; do not fabricate one Ouest value."],
        "reuse_actions": ["Show old census, estimates and survey indicators with their own years and methods."],
    },
    "JAM": {
        "aliases": ["Jamaica", "ジャマイカ"],
        "reference_years": [2011],
        "domestic_scope": "14 parishes from STATIN Census 2011 tables and publications.",
        "dominant_failure_class": "universe_semantics_and_tls_acquisition",
        "acquisition_methods": ["Inventory the STATIN Census 2011 pages, tables and PDFs.", "If an official legal host has a certificate-chain failure, record the host, retrieval method and content hash instead of silently substituting another document."],
        "semantic_cautions": ["Piped water into the dwelling is not JMP basic water.", "Any toilet is not the same as improved sanitation.", "Education and sight-difficulty fields have their own age and enrollment universes."],
        "geography_cautions": ["Use the 14-parish census geography."],
        "reuse_actions": ["Store every indicator universe and denominator alongside the table locator."],
    },
    "MEX": {
        "aliases": ["Mexico", "México", "メキシコ"],
        "reference_years": [2020, 2025],
        "domestic_scope": "States and census municipalities from the INEGI 2020 ITER archive.",
        "dominant_failure_class": "large_table_and_boundary_vintage",
        "acquisition_methods": ["Use the INEGI 2020 ITER archive, its embedded dictionary and catalogue metadata."],
        "semantic_cautions": ["Exclude aggregate rows before municipal aggregation and keep the data dictionary definitions."],
        "geography_cautions": ["Join CVE_ENT, CVE_MUN and CVE_LOC exactly.", "Do not add municipality codes created after Census 2020 merely because they appear in a later boundary service."],
        "reuse_actions": ["Label later geometry as display reference when it is not the census boundary vintage."],
    },
    "NIC": {
        "aliases": ["Nicaragua", "ニカラグア"],
        "reference_years": [2005],
        "domestic_scope": "17 departments/autonomous regions and 153 municipalities.",
        "dominant_failure_class": "multi_volume_reconciliation",
        "acquisition_methods": ["Acquire the four Census 2005 volumes, all 153 municipal reports and INETER geography.", "Retry timed-out assembly downloads with recorded receipts rather than marking the source absent."],
        "semantic_cautions": ["Preserve each table's own denominator when the national volume and local report differ."],
        "geography_cautions": ["Apply the reviewed name/code-vintage exceptions, including Waslala and Mulukukú; do not join by normalized name alone."],
        "reuse_actions": ["Keep the complete municipality-report manifest and the exception crosswalk."],
    },
    "PAN": {
        "aliases": ["Panama", "Panamá", "パナマ"],
        "reference_years": [2023],
        "domestic_scope": "13 provinces/comarcas, 82 districts and 699 corregimientos.",
        "dominant_failure_class": "mixed_geographic_granularity",
        "acquisition_methods": ["Use both official census workbooks and official ArcGIS services with exact parent codes."],
        "semantic_cautions": ["Urban, migration, nutrition and poverty products are published at different geographic levels; never promote them to a finer level."],
        "geography_cautions": ["Require full code-based parentage and reconcile every adopted area; do not use name-only joins."],
        "reuse_actions": ["Store the permitted level for every indicator family."],
    },
    "PER": {
        "aliases": ["Peru", "Perú", "ペルー"],
        "reference_years": [2017],
        "domestic_scope": "Department-level reporting areas in the 2017 census volumes.",
        "dominant_failure_class": "table_interpretation",
        "acquisition_methods": ["Inventory the five official INEI Census 2017 XLSX volumes and their sheet structures."],
        "semantic_cautions": ["POB7–POB9 do not provide residence department by birthplace and cannot support the intended migration indicator.", "An age-14-plus table is not automatically an employment rate."],
        "geography_cautions": ["Keep Provincia de Lima and Región Lima separate."],
        "reuse_actions": ["Record rejected tables and reasons so another agent does not repeat the same false derivation."],
    },
    "PRI": {
        "aliases": ["Puerto Rico", "プエルトリコ"],
        "reference_years": [2020, 2022, 2023],
        "domestic_scope": "78 municipios using Puerto Rico and United States federal statistical identifiers.",
        "dominant_failure_class": "multi_system_semantic_separation",
        "acquisition_methods": ["Use PRCS/ACS estimates, Census 2020 urban-rural products, EIA and PR-BRFSS as separate source families."],
        "semantic_cautions": ["Plumbing completeness is sanitation evidence, not drinking-water evidence.", "Survey estimates and census counts must retain their different methods and years."],
        "geography_cautions": ["Restrict federal queries to Puerto Rico state FIPS 72 and validate municipio identifiers."],
        "reuse_actions": ["Keep each source family independently cited and labelled."],
    },
    "PRY": {
        "aliases": ["Paraguay", "パラグアイ"],
        "reference_years": [2022],
        "domestic_scope": "Departments from Census 2022 and related official workbooks.",
        "dominant_failure_class": "narrow_initial_search",
        "acquisition_methods": ["Search beyond the first population product and acquire the official education, disability, urban, indigenous and NBI workbooks."],
        "semantic_cautions": ["When numerator and denominator come from different acquired tables, cite both and verify compatible universes.", "Missing detailed indigenous rows are missing, not zero."],
        "geography_cautions": ["Use official department identifiers consistently across supplemental workbooks."],
        "reuse_actions": ["Require the six-theme catalogue search even after a population workbook is found."],
    },
    "SGS": {
        "aliases": ["South Georgia and the South Sandwich Islands", "SGSSI", "サウスジョージア・サウスサンドウィッチ諸島"],
        "reference_years": [],
        "domestic_scope": "No permanent resident population; handled as a structural nonresident exception.",
        "dominant_failure_class": "structural_nonresident_exception",
        "acquisition_methods": ["Use the territorial government's population/residency FAQ and institutional description."],
        "semantic_cautions": ["Do not fabricate a resident census edition or interpret temporary personnel as a normal resident population hierarchy."],
        "geography_cautions": ["Reference geography is contextual and does not create local statistical areas."],
        "reuse_actions": ["Route this territory through the explicit nonresident exception contract."],
    },
    "SLV": {
        "aliases": ["El Salvador", "エルサルバドル"],
        "reference_years": [2024],
        "domestic_scope": "14 departments, 44 municipalities and 262 diagnostic districts.",
        "dominant_failure_class": "legal_vs_diagnostic_hierarchy",
        "acquisition_methods": ["Acquire the complete Census 2024 workbook catalogue and official geography services."],
        "semantic_cautions": ["Keep the national residual for people with unallocated residence at national level; never distribute it across local areas."],
        "geography_cautions": ["Municipalities are planning authorities; districts are diagnostic subdivisions and must not be relabelled as the legal planning unit."],
        "reuse_actions": ["Retain all three hierarchy levels and the unallocated national residual explicitly."],
    },
    "SUR": {
        "aliases": ["Suriname", "スリナム"],
        "reference_years": [2012],
        "domestic_scope": "Ten districts from ABS Census 2012 volumes and official poverty methodology.",
        "dominant_failure_class": "mixed_universes",
        "acquisition_methods": ["Acquire the relevant ABS Census 2012 volumes and the poverty methodology as separate products."],
        "semantic_cautions": ["Education fields with different universes must not be merged.", "Use only a documented common household-deprivation definition across districts."],
        "geography_cautions": ["Use the census district geography associated with the adopted tables."],
        "reuse_actions": ["Persist table-specific universe and denominator metadata."],
    },
    "TTO": {
        "aliases": ["Trinidad and Tobago", "トリニダード・トバゴ"],
        "reference_years": [2011],
        "domestic_scope": "15 municipalities from CSO Census 2011 Redatam products.",
        "dominant_failure_class": "redatam_parsing_and_boundary_gap",
        "acquisition_methods": ["Record the CSO Redatam form parameters, responses and exported tables."],
        "semantic_cautions": ["Preserve the published universe and valid-response denominator for every percentage.", "Unsatisfied Basic Needs is not automatically monetary poverty; computer use is not an urban-rural indicator."],
        "geography_cautions": ["When the adopted general boundary source omits Arima, document the explicit display-only relation used instead."],
        "reuse_actions": ["Keep the Redatam request recipe and the one-off Arima geography decision."],
    },
    "URY": {
        "aliases": ["Uruguay", "ウルグアイ"],
        "reference_years": [2023],
        "domestic_scope": "19 departments from Census 2023 microdata and metadata.",
        "dominant_failure_class": "restricted_microdata_processing",
        "acquisition_methods": ["Use the INE ANDA catalogue and access-controlled person microdata only under its terms.", "Aggregate locally, then remove restricted person records from the project."],
        "semantic_cautions": ["Publish only non-disclosive aggregates and retain the methodology, input fingerprint and aggregation code."],
        "geography_cautions": ["Use the department identifiers represented in the census metadata."],
        "reuse_actions": ["Never commit or redistribute restricted microdata; preserve reproducibility through hashes, metadata and code."],
    },
    "USA": {
        "aliases": ["United States", "United States of America", "USA", "米国", "アメリカ合衆国"],
        "reference_years": [2020, 2022, 2023],
        "domestic_scope": "States, counties and county equivalents using Census Bureau geographic identifiers.",
        "dominant_failure_class": "large_bulk_processing_and_state_isolation",
        "acquisition_methods": ["Use Census/ACS bulk table-based summary files, data.census.gov table metadata and official cartographic boundaries.", "Keep CDC and Census products as separately sourced indicator families."],
        "semantic_cautions": ["Keep Census 2020 counts, ACS 2023 five-year estimates, urban-rural classifications and CDC estimates separate."],
        "geography_cautions": ["Use Census geographic identifiers and the boundary vintage appropriate to the displayed level."],
        "reuse_actions": ["Filter indicators to the active country and normalize territory, metric, level, URL, documents and outputs atomically when switching country."],
    },
    "VEN": {
        "aliases": ["Venezuela", "Venezuela (Bolivarian Republic of)", "ベネズエラ"],
        "reference_years": [2011],
        "domestic_scope": "25 ADM1 reporting areas from Census 2011 and an explicitly sourced NBI table.",
        "dominant_failure_class": "official_host_failure_and_adapter_identity_bug",
        "acquisition_methods": ["Use the official INE Census 2011 report and record any government-plan mirror used when the original NBI object cannot be recovered."],
        "semantic_cautions": ["Do not present 2011 evidence as current or infer municipality observations."],
        "geography_cautions": ["Keep the source-backed ADM1 crosswalk and boundary decision."],
        "reuse_actions": ["Apply the same duplicate-observation and plural-hash-field checks as Ecuador."],
    },
}


DOMAINS = [
    "official_statistics_office", "latest_census", "census_results", "table_catalog",
    "machine_readable_data", "administrative_codes", "adm1_adm2_boundaries",
    "planning_law", "planning_guidance", "plans_budgets_implementation_evaluation",
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--matrix", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    matrix = json.loads(Path(args.matrix).read_text(encoding="utf-8"))
    rows = {row["country_area_id"]: row for row in matrix["countries"]}
    missing = sorted(set(COMPLETED) - rows.keys())
    if missing:
        raise SystemExit(f"Missing matrix countries: {missing}")
    if set(COMPLETED) != set(LESSONS):
        raise SystemExit("Lesson registry does not match the 28 completed country/area IDs")

    countries = []
    for iso3 in COMPLETED:
        row = rows[iso3]
        lesson = LESSONS[iso3]
        if not row["country_edition_complete"]:
            raise SystemExit(f"{iso3} is not complete in the strict matrix")
        entrypoints = {}
        for domain in DOMAINS:
            urls = list(dict.fromkeys(row["domains"].get(domain, {}).get("urls") or []))
            if not urls:
                raise SystemExit(f"{iso3} has no retained public entrypoint for {domain}")
            entrypoints[domain] = urls
        edition_status = (
            "verified_structural_nonresident_exception"
            if row["edition_classification"] == "structural_nonresident_exception"
            else "verified_broad_local_statistical_recipe"
        )
        if not row["source_review_complete"]:
            raise SystemExit(f"{iso3} did not complete strict source review")
        depth = row["edition_depth"]
        if edition_status == "verified_broad_local_statistical_recipe" and not (
            depth["domestic_territory_count"] > 0
            and depth["local_observed_indicator_count"] >= 10
            and depth["local_population_available"]
            and depth["local_age_sex_available"]
            and len(depth["local_diagnostic_groups"]) >= 6
        ):
            raise SystemExit(f"{iso3} does not meet the strict resident-edition depth floor")
        if edition_status == "verified_structural_nonresident_exception" and iso3 != "SGS":
            raise SystemExit(f"{iso3} is an unapproved structural exception")
        countries.append({
            "iso3": iso3,
            "m49": row["m49"],
            "name_en": row["name"],
            "aliases": lesson["aliases"],
            "recipe_status": edition_status,
            "verified_at": "2026-09-21",
            "reuse_status": "historically_verified_location_and_method_refresh_required",
            "current_project_evidence_status": "not_acquired_by_source_preflight",
            "census_reference_years": lesson["reference_years"],
            "domestic_scope": lesson["domestic_scope"],
            "statistical_edition": {
                "source_review_complete": row["source_review_complete"],
                "classification": row["edition_classification"],
                "domestic_territory_count": depth["domestic_territory_count"],
                "local_observed_indicator_count": depth["local_observed_indicator_count"],
                "local_population_available": depth["local_population_available"],
                "local_age_sex_available": depth["local_age_sex_available"],
                "local_integrated_themes": depth["local_integrated_themes"],
                "local_diagnostic_groups": depth["local_diagnostic_groups"],
            },
            "planning_readiness": {
                "status": "incomplete",
                "note": "The Americas statistical recipe does not establish a completed planning-law, guidance, plans, budgets, implementation and evaluation package. Re-research these domains for the new country build.",
                "incomplete_domains": row["planning_readiness"]["incomplete_domains"],
            },
            "source_entrypoints": entrypoints,
            "dominant_failure_class": lesson["dominant_failure_class"],
            "acquisition_methods": lesson["acquisition_methods"],
            "semantic_cautions": lesson["semantic_cautions"],
            "geography_cautions": lesson["geography_cautions"],
            "reuse_actions": lesson["reuse_actions"],
        })

    result = {
        "schema_version": "1.0",
        "as_of": "2026-09-21",
        "scope": "Reusable public source locations, acquisition methods, semantic cautions and geography lessons from 28 strict Americas statistical editions, including the SGS structural nonresident exception.",
        "status_boundary": "These recipes record where and how sources were previously inspected. They do not mean that a new project has acquired the files, verified current availability, completed planning research, accepted indicators or passed delivery.",
        "completion_rule": "For resident editions, all 15 themes were terminally reviewed and the completed statistical edition had retained evidence for required statistical domains, local population and age-sex, a domestic hierarchy, at least 10 distinct local observed indicators and at least 6 of 8 local diagnostic groups. A gap closes source review only and never counts as integrated data. SGS uses the explicit nonresident exception.",
        "countries": countries,
    }
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
