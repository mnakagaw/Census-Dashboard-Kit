#!/usr/bin/env python3
"""Refresh the source-backed JICA priority-country registry.

The registry is a starting inventory, not evidence that census or planning
sources have been acquired.  This script deliberately uses only the Python
standard library so it can be rerun by a local coding agent without setup.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import unicodedata
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "config" / "jica-priority-country-registry.json"
RESEARCH_OUTPUT = ROOT / "docs" / "research" / "jica-priority-2026" / "JICA_PRIORITY_142.csv"
USER_AGENT = "Census-Dashboard-Kit/1.5 source registry updater"

JICA_COUNTRIES_URL = "https://www.jica.go.jp/english/overseas/"
JICA_DIRECTORY = {
    "Asia": "https://www.jica.go.jp/english/about/basic/structure/overseas/asia.html",
    "Middle East": "https://www.jica.go.jp/english/about/basic/structure/overseas/m_east.html",
    "Africa": "https://www.jica.go.jp/english/about/basic/structure/overseas/africa.html",
    "North and Latin America": "https://www.jica.go.jp/english/about/basic/structure/overseas/america.html",
    "Oceania": "https://www.jica.go.jp/english/about/basic/structure/overseas/oceania.html",
    "Europe": "https://www.jica.go.jp/english/about/basic/structure/overseas/europe.html",
}
M49_URL = "https://unstats.un.org/unsd/methodology/m49/overview/"
DAC_URL = "https://webfs.oecd.org/oda/DAClists/DAC-List-of-ODA-Recipients-for-reporting-2024-flows.csv"
MOFA_POLICY_URL = "https://www.mofa.go.jp/mofaj/gaiko/oda/seisaku/kuni_enjyo_kakkoku.html"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def clean(value: str) -> str:
    return " ".join(value.split())


def key(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


class JicaDirectoryParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.block_depth = 0
        self.title: str | None = None
        self.purview = False
        self.items: list[str] = []
        self.tag: str | None = None
        self.buffer: list[str] = []
        self.blocks: list[tuple[str, list[str]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)
        if tag == "div":
            classes = (attrs_map.get("class") or "").split()
            if self.block_depth:
                self.block_depth += 1
            elif "common-block-lv2" in classes:
                self.block_depth = 1
                self.title = None
                self.purview = False
                self.items = []
        if self.block_depth and tag in {"p", "li"}:
            self.tag = tag
            self.buffer = []

    def handle_data(self, data: str) -> None:
        if self.block_depth and self.tag:
            self.buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self.block_depth and self.tag == tag:
            text = clean("".join(self.buffer))
            if tag == "p" and text.rstrip(":") == "Purview":
                self.purview = True
            elif tag == "li" and text:
                if self.title is None:
                    self.title = text
                elif self.purview:
                    self.items.append(text)
            self.tag = None
            self.buffer = []
        if tag == "div" and self.block_depth:
            self.block_depth -= 1
            if self.block_depth == 0:
                if self.title and ("Office" in self.title or "Bureau" in self.title) and self.items:
                    self.blocks.append((self.title, self.items))


class CountryLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.href: str | None = None
        self.buffer: list[str] = []
        self.links: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href") or ""
        if re.fullmatch(r"/english/overseas/[^/]+/index\.html", href):
            self.href = href
            self.buffer = []

    def handle_data(self, data: str) -> None:
        if self.href:
            self.buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.href:
            name = clean("".join(self.buffer))
            if name:
                self.links.setdefault(key(name), "https://www.jica.go.jp" + self.href)
            self.href = None
            self.buffer = []


class M49Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.cell_buffer: list[str] = []
        self.row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)
        if tag == "table" and attrs_map.get("id") == "downloadTableEN":
            self.in_table = True
        elif self.in_table and tag == "tr":
            self.in_row = True
            self.row = []
        elif self.in_row and tag == "td":
            self.in_cell = True
            self.cell_buffer = []

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.cell_buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self.in_cell:
            self.row.append(clean("".join(self.cell_buffer)))
            self.in_cell = False
        elif tag == "tr" and self.in_row:
            if len(self.row) >= 12:
                self.rows.append(self.row)
            self.in_row = False
        elif tag == "table" and self.in_table:
            self.in_table = False


JICA_TO_M49 = {
    "Argentine": "Argentina",
    "Bolivia": "Bolivia (Plurinational State of)",
    "Cape Verde": "Cabo Verde",
    "Central African": "Central African Republic",
    "Democratic Republic of Congo": "Democratic Republic of the Congo",
    "Federated States of Micronesia": "Micronesia (Federated States of)",
    "Iran": "Iran (Islamic Republic of)",
    "Kyrgyz Republic": "Kyrgyzstan",
    "Laos": "Lao People's Democratic Republic",
    "Moldova": "Republic of Moldova",
    "Nauru": "Naoero",
    "Palestine": "State of Palestine",
    "Republic of Congo": "Congo",
    "Republic of Cuba": "Cuba",
    "Republic of North Macedonia": "North Macedonia",
    "Saint Christopher and Nevis": "Saint Kitts and Nevis",
    "Saint Vincent": "Saint Vincent and the Grenadines",
    "Syria": "Syrian Arab Republic",
    "Tanzania": "United Republic of Tanzania",
    "Turkey": "Türkiye",
    "Venezuela": "Venezuela (Bolivarian Republic of)",
}

DAC_TO_M49 = {
    "Bolivia": "Bolivia (Plurinational State of)",
    "Cabo Verde": "Cabo Verde",
    "China (People's Republic of)": "China",
    "Iran": "Iran (Islamic Republic of)",
    "Kosovo": "Kosovo",
    "Lao People's Democratic Republic": "Lao People's Democratic Republic",
    "Micronesia": "Micronesia (Federated States of)",
    "Moldova": "Republic of Moldova",
    "Nauru": "Naoero",
    "Syria": "Syrian Arab Republic",
    "Tanzania": "United Republic of Tanzania",
    "Venezuela": "Venezuela (Bolivarian Republic of)",
    "Wallis and Futuna": "Wallis and Futuna Islands",
    "West Bank and Gaza Strip": "State of Palestine",
}


def main() -> None:
    snapshots: dict[str, dict[str, str | int]] = {}

    directory_records: dict[str, list[dict[str, str]]] = defaultdict(list)
    for region, url in JICA_DIRECTORY.items():
        payload = fetch(url)
        snapshots[url] = {"sha256": hashlib.sha256(payload).hexdigest(), "bytes": len(payload)}
        parser = JicaDirectoryParser()
        parser.feed(payload.decode("utf-8", "replace"))
        for office, countries in parser.blocks:
            for country in countries:
                directory_records[country].append({"region": region, "office": country and office, "source_url": url})

    country_payload = fetch(JICA_COUNTRIES_URL)
    snapshots[JICA_COUNTRIES_URL] = {"sha256": hashlib.sha256(country_payload).hexdigest(), "bytes": len(country_payload)}
    country_parser = CountryLinkParser()
    country_parser.feed(country_payload.decode("utf-8", "replace"))

    m49_payload = fetch(M49_URL)
    snapshots[M49_URL] = {"sha256": hashlib.sha256(m49_payload).hexdigest(), "bytes": len(m49_payload)}
    m49_parser = M49Parser()
    m49_parser.feed(m49_payload.decode("utf-8", "replace"))
    m49_by_name = {key(row[8]): row for row in m49_parser.rows}

    dac_payload = fetch(DAC_URL)
    snapshots[DAC_URL] = {"sha256": hashlib.sha256(dac_payload).hexdigest(), "bytes": len(dac_payload)}
    dac_rows = list(csv.DictReader(io.StringIO(dac_payload.decode("cp1252"))))
    dac_iso3: set[str] = set()
    for row in dac_rows:
        name = clean(row["RecipientNameE"])
        target = DAC_TO_M49.get(name, name)
        if target == "Kosovo":
            dac_iso3.add("XK")
            continue
        match = m49_by_name.get(key(target))
        if not match:
            raise RuntimeError(f"OECD recipient cannot be matched to UN M49: {name}")
        dac_iso3.add(match[11])

    countries = []
    used_iso3: set[str] = set()
    for jica_name, offices in directory_records.items():
        target = JICA_TO_M49.get(jica_name, jica_name)
        if target == "Kosovo":
            iso3, m49, official_name = "XKX", None, "Kosovo"
            dac_member = "XK" in dac_iso3
        else:
            match = m49_by_name.get(key(target))
            if not match:
                raise RuntimeError(f"JICA country cannot be matched to UN M49: {jica_name}")
            official_name, m49, iso3 = match[8], match[9], match[11]
            dac_member = iso3 in dac_iso3
        if iso3 in used_iso3:
            raise RuntimeError(f"Duplicate ISO3 after normalization: {iso3}")
        used_iso3.add(iso3)
        country_url = country_parser.links.get(key(jica_name)) or country_parser.links.get(key(target))
        countries.append({
            "iso3": iso3,
            "m49": m49,
            "name_en": official_name,
            "jica_name": jica_name,
            "priority_basis": "current_jica_overseas_office_purview",
            "jica_country_page": country_url,
            "jica_relation": "country_page_and_purview" if country_url else "purview_only",
            "supervising_offices": sorted(offices, key=lambda item: (item["region"], item["office"])),
            "dac_oda_recipient_2024": dac_member,
            "source_preflight": {
                "status": "national_census_planning_and_geography_sources_not_pre_researched",
                "census_official_location": None,
                "planning_law_official_location": None,
                "planning_guidance_official_location": None,
                "official_geography_location": None,
            },
        })

    countries.sort(key=lambda item: item["iso3"])
    count_dac = sum(item["dac_oda_recipient_2024"] for item in countries)
    count_pages = sum(item["jica_country_page"] is not None for item in countries)
    if (len(countries), count_dac, count_pages) != (142, 132, 113):
        raise RuntimeError(
            f"Source universe drifted: priority={len(countries)}, DAC={count_dac}, country_pages={count_pages}; expected 142/132/113"
        )
    for required in ("CHL", "URY", "SAU", "COK", "XKX"):
        if required not in used_iso3:
            raise RuntimeError(f"Required priority record missing: {required}")

    checked_at = datetime.now(timezone.utc).date().isoformat()
    output = {
        "schema_version": "1.0",
        "as_of": checked_at,
        "definition": "Countries and territories named in the Purview lists of JICA's current regional overseas-office directory. Liaison-office locations without a Purview country list are not treated as cooperation targets.",
        "use": "Priority and discovery context only. This registry does not prove that census, planning-law, guidance, geography or local indicator data have been acquired or accepted.",
        "counts": {
            "jica_priority_countries_and_territories": len(countries),
            "dac_oda_recipients_2024": count_dac,
            "non_dac_or_graduated_cooperation_partners": len(countries) - count_dac,
            "jica_country_pages": count_pages,
            "purview_only_without_jica_country_page": len(countries) - count_pages,
        },
        "sources": [
            {"id": "JICA_WHERE_WE_WORK", "url": JICA_COUNTRIES_URL, "role": "country_page_index"},
            *[
                {"id": "JICA_OFFICES_" + re.sub(r"[^A-Z0-9]+", "_", region.upper()).strip("_"), "url": url, "role": "office_and_purview_directory"}
                for region, url in JICA_DIRECTORY.items()
            ],
            {"id": "UN_M49", "url": M49_URL, "role": "country_area_name_and_code_registry"},
            {"id": "OECD_DAC_2024", "url": DAC_URL, "role": "oda_recipient_classification"},
            {"id": "MOFA_COUNTRY_POLICY_INDEX", "url": MOFA_POLICY_URL, "role": "country_cooperation_policy_discovery"},
        ],
        "snapshot_receipt": snapshots,
        "countries": countries,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    RESEARCH_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with RESEARCH_OUTPUT.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["iso3", "m49", "name_en", "jica_name", "dac_oda_recipient_2024", "jica_relation", "supervising_offices", "jica_country_page"])
        for item in countries:
            writer.writerow([
                item["iso3"], item["m49"] or "", item["name_en"], item["jica_name"],
                "yes" if item["dac_oda_recipient_2024"] else "no", item["jica_relation"],
                "; ".join(office["office"] for office in item["supervising_offices"]), item["jica_country_page"] or "",
            ])
    print(f"Wrote {OUTPUT}: 142 priority, 132 DAC, 10 partner; {count_pages} JICA country pages")


if __name__ == "__main__":
    main()
