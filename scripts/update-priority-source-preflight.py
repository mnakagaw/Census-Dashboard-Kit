#!/usr/bin/env python3
"""Build a 142-country source-address preflight from official directories.

The output is discovery evidence.  It deliberately distinguishes an official
directory entry or country-filtered catalogue from an acquired and inspected
country source.  Country agents must still verify the current law, census
release, geography and usable tables before adopting data.
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PRIORITY = ROOT / "config" / "jica-priority-country-registry.json"
OUTPUT = ROOT / "config" / "jica-priority-source-preflight.json"
REPORT = ROOT / "docs" / "research" / "jica-priority-2026" / "SOURCE_PREFLIGHT_142.md"
USER_AGENT = "Census-Dashboard-Kit/1.6 source preflight updater"
UNSD_NSO = "https://unstats.un.org/home/nso_sites/"
UNSD_CENSUS = "https://unstats.un.org/unsd/demographic-social/census/censusdates"
FAOLEX = "https://www.fao.org/faolex/country-profiles/general-profile/en/"
MOFA_POLICY = "https://www.mofa.go.jp/mofaj/gaiko/oda/seisaku/kuni_enjyo_kakkoku.html"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def clean(value: str) -> str:
    return " ".join(value.replace("\u2013", "-").split())


def key(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def census_country_label(value: str) -> str:
    """Remove UNSD table headings and numeric footnotes from a country label."""
    value = re.sub(r"\s*\(\d+\)\s*$", "", clean(value))
    return re.sub(r"^(?:AFRICA|AMERICA|ASIA|EUROPE|OCEANIA)\s+Countries or areas\s+", "", value, flags=re.IGNORECASE)


def census_label_key(value: str) -> str:
    """Normalize UNSD country labels without treating headings/footnotes as identity."""
    return key(census_country_label(value))


ROUND_PERIODS = {
    1990: "1985-1994",
    2000: "1995-2004",
    2010: "2005-2014",
    2020: "2015-2024",
    2030: "2025-2034",
}


def census_date_text(value: str) -> str:
    value = clean(value)
    return re.sub(r"^\d{4}\s+round\s*\(\d{4}-\d{4}\)\s*", "", value, flags=re.IGNORECASE)


def completed_census_cell(value: str) -> bool:
    value = census_date_text(value)
    return bool(value and value != "..." and not re.fullmatch(r"\([^)]*\)", value))


def census_summary(rows: list[dict[str, object]], *, linked_only: bool) -> dict[str, object] | None:
    candidates: list[tuple[tuple[int, int, int], dict[str, object]]] = []
    for row_index, row in enumerate(rows):
        for round_year, period in ROUND_PERIODS.items():
            cell = row[f"round_{round_year}"]
            text = census_date_text(str(cell["text"]))
            links = list(dict.fromkeys(str(url) for url in cell["links"] if url))
            if not completed_census_cell(text) or (linked_only and not links):
                continue
            years = [int(year) for year in re.findall(r"(?<!\d)(?:18|19|20)\d{2}(?!\d)", text)]
            sort_year = max(years, default=round_year)
            candidates.append(((round_year, sort_year, row_index), {
                "round": round_year,
                "round_period": period,
                "date_text": text,
                "country_label": census_country_label(str(row["country_label"])),
                "links": links,
                "primary_url": links[0] if links else None,
                "link_status": "unsd_link_listed" if links else "no_unsd_link_listed",
            }))
    return max(candidates, key=lambda item: item[0])[1] if candidates else None


class NsoParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_leaf = self.in_strong = self.in_link = False
        self.name: list[str] = []
        self.label: list[str] = []
        self.url: str | None = None
        self.rows: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)
        if tag == "li" and "leaf" in (attrs_map.get("class") or "").split():
            self.in_leaf, self.name, self.label, self.url = True, [], [], None
        elif self.in_leaf and tag == "strong":
            self.in_strong = True
        elif self.in_leaf and tag == "a" and attrs_map.get("href") and self.url is None:
            self.in_link, self.url, self.label = True, attrs_map["href"], []

    def handle_data(self, data: str) -> None:
        if self.in_strong:
            self.name.append(data)
        if self.in_link:
            self.label.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "strong":
            self.in_strong = False
        elif tag == "a":
            self.in_link = False
        elif tag == "li" and self.in_leaf:
            name, label = clean("".join(self.name)), clean("".join(self.label))
            if name and self.url:
                self.rows.append({"country": name, "agency": label or "National statistical office", "url": self.url})
            self.in_leaf = False


class CensusParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.div_stack: list[dict[str, object]] = []
        self.rows: list[list[dict[str, object]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)
        if tag == "div":
            classes = (attrs_map.get("class") or "").split()
            self.div_stack.append({
                "row": "row" in classes,
                "cells": [],
                "cell": any(value.startswith("col-md-2") for value in classes),
                "text": [],
                "links": [],
            })
        elif tag == "a" and attrs_map.get("href"):
            cell = next((frame for frame in reversed(self.div_stack) if frame["cell"]), None)
            if cell is not None:
                cell["links"].append(attrs_map["href"])

    def handle_data(self, data: str) -> None:
        cell = next((frame for frame in reversed(self.div_stack) if frame["cell"]), None)
        if cell is not None:
            cell["text"].append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "div" or not self.div_stack:
            return
        frame = self.div_stack.pop()
        if frame["cell"]:
            row = next((parent for parent in reversed(self.div_stack) if parent["row"]), None)
            if row is not None:
                row["cells"].append({"text": clean("".join(frame["text"])), "links": frame["links"]})
        if frame["row"] and len(frame["cells"]) >= 5:
            self.rows.append(frame["cells"][:6])


ALIASES = {
    "Argentine": "Argentina", "Bolivia": "Bolivia (Plurinational State of)", "Cape Verde": "Cabo Verde",
    "Central African": "Central African Republic", "Democratic Republic of Congo": "Democratic Republic of the Congo",
    "Federated States of Micronesia": "Micronesia (Federated States of)", "Iran": "Iran (Islamic Republic of)",
    "Kyrgyz Republic": "Kyrgyzstan", "Laos": "Lao People's Democratic Republic", "Moldova": "Republic of Moldova",
    "Palestine": "State of Palestine", "Republic of Congo": "Congo", "Republic of Cuba": "Cuba",
    "Republic of North Macedonia": "North Macedonia", "Saint Christopher and Nevis": "Saint Kitts and Nevis",
    "Saint Vincent": "Saint Vincent and the Grenadines", "Syria": "Syrian Arab Republic",
    "Tanzania": "United Republic of Tanzania", "Turkey": "T\u00fcrkiye", "Venezuela": "Venezuela (Bolivarian Republic of)",
    "Saint Kitts and Nevis": "St. Kitts and Nevis", "Saint Lucia": "St. Lucia",
    "State of Palestine": "Palestine, State of", "T\u00fcrkiye": "Turkey",
    "Saint Vincent and the Grenadines": "St. Vincent and the Grenadines",
}

# UNSD's NSO directory has no usable link for these current JICA-priority names.
# These are official agency/government entrypoints and remain marked as manually
# curated entrypoints, not as proof that a census table was acquired.
MANUAL_NSO = {
    "AFG": ("National Statistics and Information Authority", "https://nsia.gov.af/"),
    "ATG": ("Statistics Division", "https://statistics.gov.ag/"),
    "BIH": ("Agency for Statistics of Bosnia and Herzegovina", "https://bhas.gov.ba/"),
    "COD": ("Institut National de la Statistique", "https://ins-rdc.org/"),
    "COM": ("Institut National de la Statistique et des Etudes Economiques et D\u00e9mographiques", "https://inseed-comores.org/"),
    "DMA": ("Central Statistical Office", "https://stats.gov.dm/"),
    "ERI": ("Government of Eritrea", "https://shabait.com/"),
    "GRD": ("Central Statistical Office", "https://stats.gov.gd/"),
    "KNA": ("Department of Statistics", "https://www.stats.gov.kn/"),
    "MHL": ("Economic Policy, Planning and Statistics Office", "https://www.rmieppso.org/"),
    "PAK": ("Pakistan Bureau of Statistics", "https://www.pbs.gov.pk/"),
    "SOM": ("Somalia National Bureau of Statistics", "https://nbs.gov.so/"),
    "SWZ": ("Central Statistical Office", "https://www.gov.sz/index.php/departments-sp-1832997396/economic-planning-a-development/statistics"),
    "SYR": ("Central Bureau of Statistics", "http://cbssyr.sy/"),
    "VCT": ("Statistical Office", "https://stats.gov.vc/"),
    "XKX": ("Kosovo Agency of Statistics", "https://ask.rks-gov.net/"),
    "YEM": ("Central Statistical Organization", "https://cso-ye.org/"),
}


def catalogue_url(base: str, params: dict[str, str]) -> str:
    return base + ("&" if "?" in base else "?") + urllib.parse.urlencode(params)


def main() -> None:
    priority = json.loads(PRIORITY.read_text(encoding="utf-8"))
    nso_payload, census_payload = fetch(UNSD_NSO), fetch(UNSD_CENSUS)
    nso_parser, census_parser = NsoParser(), CensusParser()
    nso_parser.feed(nso_payload.decode("utf-8", "replace"))
    census_parser.feed(census_payload.decode("utf-8", "replace"))
    nso_by_name = {key(row["country"]): row for row in nso_parser.rows}
    census_by_name: dict[str, list[dict[str, object]]] = {}
    previous_name = ""
    for cells in census_parser.rows:
        name = census_country_label(str(cells[0]["text"])) or previous_name
        if not name:
            continue
        previous_name = name
        census_by_name.setdefault(census_label_key(name), []).append({
            "country_label": name,
            "round_1990": cells[1], "round_2000": cells[2], "round_2010": cells[3],
            "round_2020": cells[4], "round_2030": cells[5] if len(cells) > 5 else {"text": "", "links": []},
        })

    checked_at = datetime.now(timezone.utc).date().isoformat()
    records = []
    for country in priority["countries"]:
        target = ALIASES.get(country["jica_name"], country["name_en"])
        candidates = [country["name_en"], country["jica_name"], target, ALIASES.get(target, target)]
        nso = next((nso_by_name[key(value)] for value in candidates if key(value) in nso_by_name), None)
        nso_origin = "UNSD_NSO_DIRECTORY"
        if not nso:
            agency, url = MANUAL_NSO[country["iso3"]]
            nso = {"country": country["name_en"], "agency": agency, "url": url}
            nso_origin = "MANUALLY_CURATED_OFFICIAL_ENTRYPOINT"
        census_rows = next((census_by_name[key(value)] for value in candidates if key(value) in census_by_name), [])
        if not census_rows:
            fuzzy = []
            for value in candidates:
                wanted = key(value)
                fuzzy.extend(rows for label, rows in census_by_name.items() if label.endswith(wanted) or label.startswith(wanted))
            if len({id(rows) for rows in fuzzy}) == 1:
                census_rows = fuzzy[0]
        latest_listing = census_summary(census_rows, linked_only=False)
        latest_linked_listing = census_summary(census_rows, linked_only=True)
        iso3, iso2, name = country["iso3"], country["iso2"], country["name_en"]
        hdx_query = urllib.parse.quote(f"{name} census subnational administrative boundaries")
        records.append({
            "iso3": iso3, "iso2": iso2, "m49": country["m49"], "name_en": name,
            "checked_at": checked_at,
            "national_statistics_and_census": {
                "status": "official_entrypoint_catalogued_census_release_not_yet_inspected",
                "national_statistics_office": {**nso, "origin": nso_origin, "directory_source": UNSD_NSO},
                "un_census_rounds": census_rows,
                "un_census_dates_source": UNSD_CENSUS,
                "latest_un_census_listing": latest_listing,
                "latest_un_census_linked_listing": latest_linked_listing,
                "required_next_step": "Open the NSO census catalogue, inventory every current census release/resource/table, and preserve all administrative levels and age-sex tables before selecting indicators.",
            },
            "planning_law_and_materials": {
                "status": "country_legal_catalogue_and_cooperation_entrypoints_catalogued_specific_planning_law_requires_text_verification",
                "legal_catalogue": catalogue_url(FAOLEX, {"iso3": iso3}),
                "jica_country_page": country["jica_country_page"],
                "jica_supervising_offices": country["supervising_offices"],
                "mofa_country_policy_index": MOFA_POLICY,
                "undp_evaluation_policy_country_search": "https://nec.undp.org/country-search",
                "required_next_step": "Identify the current planning/decentralization/local-government law, implementing rules, responsible ministry guidance/forms, actual plans, budgets, implementation reports and evaluations; acquire the text and record page/article locators.",
            },
            "geography_and_codes": {
                "status": "candidate_catalogues_only_official_code_and_boundary_match_required",
                "geoboundaries_adm1_api": f"https://www.geoboundaries.org/api/current/gbOpen/{iso3}/ADM1/",
                "geoboundaries_adm2_api": f"https://www.geoboundaries.org/api/current/gbOpen/{iso3}/ADM2/",
                "un_salb_catalogue": "https://salb.un.org/en/data",
                "hdx_targeted_search": f"https://data.humdata.org/dataset/?q={hdx_query}",
                "required_next_step": "Find the official administrative register/code list first, then reconcile names, types, parents, effective dates and boundary editions. Never join by name alone.",
            },
            "international_data_candidates": {
                "status": "country_queries_prepared_availability_and_definition_not_yet_accepted",
                "world_bank_country_api": f"https://api.worldbank.org/v2/country/{iso3}?format=json",
                "world_bank_wdi_population_api": f"https://api.worldbank.org/v2/country/{iso3}/indicator/SP.POP.TOTL?format=json&per_page=1000",
                "hdx_country_search": f"https://data.humdata.org/dataset/?q={urllib.parse.quote(name)}",
                "unicef_mics_surveys": "https://mics.unicef.org/surveys",
                "dhs_country_list": "https://dhsprogram.com/Countries/Country-Main.cfm",
                "worldpop_data_portal": "https://www.worldpop.org/datacatalog/",
                "ghsl_data": "https://human-settlement.emergency.copernicus.eu/download.php",
                "undp_human_development_data": "https://hdr.undp.org/data-center",
                "required_next_step": "Check country, year, geography, definition, denominator, license and downloadability. Keep census, survey, administrative, humanitarian and modeled observations separate.",
            },
            "anti_shortcut_rules": [
                "An entrypoint or search result is not acquired evidence.",
                "A census date is not proof that detailed tables are published.",
                "One workbook, district or administrative level does not close a national catalogue.",
                "A legal catalogue hit is not a verified planning obligation until the text and locator are inspected.",
                "International national values never replace local observations.",
            ],
        })

    if len(records) != 142 or len({record["iso3"] for record in records}) != 142:
        raise RuntimeError("Priority source preflight must contain 142 unique country/territory records")
    if any(not record["national_statistics_and_census"]["national_statistics_office"]["url"] for record in records):
        raise RuntimeError("Every priority record must have a national statistics entrypoint")
    output = {
        "schema_version": "1.1", "as_of": checked_at,
        "scope": "JICA overseas-office purview: 142 countries and territories",
        "meaning": "Source-address preflight only. Every link must be refreshed, acquired, inspected, geographically matched and accepted in the country task.",
        "census_listing_semantics": {
            "latest_un_census_listing": "Latest completed census date listed by UNSD, whether or not UNSD supplies a link. Wholly parenthesized future/scheduled entries are excluded.",
            "latest_un_census_linked_listing": "Latest completed census listing for which UNSD supplies at least one link. This can be older than the latest UNSD listing and is not proof that the linked material was acquired or adopted.",
        },
        "source_snapshots": {
            UNSD_NSO: {"sha256": hashlib.sha256(nso_payload).hexdigest(), "bytes": len(nso_payload)},
            UNSD_CENSUS: {"sha256": hashlib.sha256(census_payload).hexdigest(), "bytes": len(census_payload)},
        },
        "records": records,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# JICA priority 142 source-address preflight", "",
        f"Generated {checked_at}. All 142 records include a national statistics entrypoint, UNSD census-round evidence, a country-filtered legal catalogue, planning-material discovery entrypoints, geography/code candidates and international-data queries.", "",
        "These are discovery addresses. The country agent must inspect the current official release and legal text; this report never upgrades a link to acquired or adopted evidence.", "",
        "The latest UNSD listing and the latest listing with an UNSD link are separate fields. A newer unlinked census date must not be hidden by, or treated as acquired data from, an older linked edition.", "",
        "| ISO3 | Country/territory | National statistics entrypoint | Census rows | Latest UNSD listing | Latest UNSD-linked listing | Planning/legal starting points |", "|---|---|---|---:|---|---|---|",
    ]
    for record in records:
        nso = record["national_statistics_and_census"]["national_statistics_office"]
        planning = record["planning_law_and_materials"]
        census = record["national_statistics_and_census"]
        latest = census["latest_un_census_listing"]
        linked = census["latest_un_census_linked_listing"]
        latest_text = f'{latest["round"]} / {latest["date_text"]} / {"link" if latest["links"] else "no UNSD link"}' if latest else "-"
        linked_text = f'{linked["round"]} / [{linked["date_text"]}]({linked["primary_url"]})' if linked else "-"
        lines.append(f'| {record["iso3"]} | {record["name_en"]} | [{nso["agency"]}]({nso["url"]}) | {len(census["un_census_rounds"])} | {latest_text} | {linked_text} | [FAOLEX]({planning["legal_catalogue"]}) / [JICA]({planning["jica_country_page"] or planning["jica_supervising_offices"][0]["source_url"]}) |')
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} and {REPORT}: 142 complete source-address preflight records")


if __name__ == "__main__":
    main()
