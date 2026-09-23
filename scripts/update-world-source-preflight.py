#!/usr/bin/env python3
"""Build the global country/area identity and source-address preflight.

The generated files contain discovery metadata and official starting addresses,
not census observations or a claim that a source has been acquired.  The
country task must refresh every address and inspect the actual release, tables,
law text, geography, definitions and licence before adoption.
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
WORLD_REGISTRY = ROOT / "config" / "world-country-area-registry.json"
WORLD_PREFLIGHT = ROOT / "config" / "world-source-preflight.json"
PRIORITY_REGISTRY = ROOT / "config" / "jica-priority-country-registry.json"
REPORT = ROOT / "docs" / "research" / "world-2026" / "WORLD_SOURCE_PREFLIGHT_250.md"
USER_AGENT = "Census-Dashboard-Kit/1.8 world source preflight updater"

UN_M49 = "https://unstats.un.org/unsd/methodology/m49/overview/"
UNSD_NSO = "https://unstats.un.org/home/nso_sites/"
UNSD_CENSUS = "https://unstats.un.org/unsd/demographic-social/census/censusdates"
FAOLEX = "https://www.fao.org/faolex/country-profiles/general-profile/en/"
EUROSTAT_CENSUS = "https://ec.europa.eu/eurostat/web/population-demography/population-housing-censuses/information-data"
EUROSTAT_DATA = "https://ec.europa.eu/eurostat/data/database"
GISCO_NUTS = "https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics"
EU_JUSTICE_LAW = "https://e-justice.europa.eu/topics/legislation-and-case-law/national-legislation_en"


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


class M49Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_table = self.in_row = self.in_cell = False
        self.cell_buffer: list[str] = []
        self.row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)
        if tag == "table" and attrs_map.get("id") == "downloadTableEN":
            self.in_table = True
        elif self.in_table and tag == "tr":
            self.in_row, self.row = True, []
        elif self.in_row and tag == "td":
            self.in_cell, self.cell_buffer = True, []

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.cell_buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self.in_cell:
            self.row.append(clean("".join(self.cell_buffer)))
            self.in_cell = False
        elif tag == "tr" and self.in_row:
            if len(self.row) >= 15 and re.fullmatch(r"[A-Z]{3}", self.row[11]):
                self.rows.append(self.row[:15])
            self.in_row = False
        elif tag == "table" and self.in_table:
            self.in_table = False


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
                self.rows.append({"country": name, "agency": label or "National statistical office", "url": self.url.strip()})
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
                "row": "row" in classes, "cells": [],
                "cell": any(value.startswith("col-md-2") for value in classes),
                "text": [], "links": [],
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


# Names used by the official UNSD directories differ from current UN M49 names.
M49_TO_UNSD_ALIASES = {
    "Bolivia (Plurinational State of)": ["Bolivia"],
    "China, Hong Kong Special Administrative Region": ["China, Hong Kong SAR"],
    "China, Macao Special Administrative Region": ["China, Macao SAR"],
    "Czechia": ["Czech Republic"],
    "Democratic People's Republic of Korea": ["Korea, Democratic People's Republic of"],
    "Iran (Islamic Republic of)": ["Iran"],
    "Micronesia (Federated States of)": ["Micronesia, Federated States of"],
    "Naoero": ["Nauru"],
    "Netherlands (Kingdom of the)": ["Netherlands"],
    "Republic of Korea": ["Korea, Republic of"],
    "Republic of Moldova": ["Moldova"],
    "Saint Kitts and Nevis": ["St. Kitts and Nevis"],
    "Saint Lucia": ["St. Lucia"],
    "Saint Pierre and Miquelon": ["St. Pierre and Miquelon"],
    "Saint Vincent and the Grenadines": ["St. Vincent and the Grenadines"],
    "Saint Martin (French Part)": ["Saint Martin"],
    "Sint Maarten (Dutch part)": ["Sint Maarten"],
    "State of Palestine": ["Palestine, State of"],
    "Syrian Arab Republic": ["Syrian Arab Repblic", "Syria"],
    "Türkiye": ["Turkey"],
    "United Kingdom of Great Britain and Northern Ireland": ["United Kingdom"],
    "United States of America": ["United States"],
    "Venezuela (Bolivarian Republic of)": ["Venezuela"],
    "Wallis and Futuna Islands": ["Wallis and Futuna"],
}

# Official or administering-authority entrypoints for M49 areas not represented
# by a usable link in the UNSD NSO directory, plus current replacements for the
# two developed-country acceptance examples.  A relation note prevents a parent
# authority from being mistaken for an independent national authority.
MANUAL_STATISTICS = {
    "AFG": ("National Statistics and Information Authority", "https://nsia.gov.af/", "own_national_statistics_office", "Confirm the current census and survey catalogue and access constraints."),
    "ATG": ("Antigua and Barbuda Statistics Division", "https://statistics.gov.ag/", "own_national_statistics_office", "Confirm current census releases and parish-level tables."),
    "ATA": ("Antarctic Treaty Secretariat", "https://www.ats.aq/", "structural_nonresident_area", "No sovereign national statistical office or permanent resident population is inferred."),
    "ASM": ("United States Census Bureau — Island Areas", "https://www.census.gov/programs-surveys/decennial-census/about/rdo/summary-files.html", "administering_country_census_authority", "Confirm American Samoa products and local Department of Commerce releases separately."),
    "ATF": ("French Southern and Antarctic Lands", "https://taaf.fr/", "territorial_administration_structural_exception", "No permanent resident population is assumed; verify personnel and station statistics with the administration."),
    "BES": ("Statistics Netherlands — Caribbean Netherlands", "https://www.cbs.nl/en-gb/our-services/methods/definitions/caribbean-netherlands", "administering_country_statistics_authority", "Use Caribbean Netherlands tables and do not merge the three public bodies without source support."),
    "BIH": ("Agency for Statistics of Bosnia and Herzegovina", "https://bhas.gov.ba/", "own_national_statistics_office", "Coordinate state, Federation, Republika Srpska and Brčko statistical geography explicitly."),
    "BLM": ("INSEE — overseas local statistics", "https://www.insee.fr/en/accueil", "administering_country_statistics_authority", "Filter the official source specifically to Saint Barthélemy."),
    "BVT": ("Norwegian Polar Institute — Bouvet Island", "https://www.npolar.no/en/themes/bouvet-island/", "structural_nonresident_area", "No permanent resident population is inferred."),
    "CCK": ("Australian Bureau of Statistics", "https://www.abs.gov.au/", "administering_country_statistics_authority", "Confirm Cocos (Keeling) Islands tables and geographic identifiers explicitly."),
    "COD": ("Institut National de la Statistique", "https://ins-rdc.org/", "own_national_statistics_office", "Confirm current census status, surveys and province/territory geography before adoption."),
    "COM": ("Institut National de la Statistique et des Études Économiques et Démographiques", "https://inseed-comores.org/", "own_national_statistics_office", "Confirm island and commune coverage in each source."),
    "CXR": ("Australian Bureau of Statistics", "https://www.abs.gov.au/", "administering_country_statistics_authority", "Confirm Christmas Island tables and geographic identifiers explicitly."),
    "ESH": ("High Commission for Planning of Morocco", "https://www.hcp.ma/", "contested_territory_statistical_entrypoint", "Statistical scope and territorial status require explicit source wording; do not imply international recognition or full coverage."),
    "DMA": ("Dominica Central Statistical Office", "https://stats.gov.dm/", "own_national_statistics_office", "Confirm current census products and parish geography."),
    "ERI": ("Government of Eritrea", "https://shabait.com/", "no_public_nso_catalogue_verified", "Locate an official statistics or census publication and preserve access limitations; do not substitute modeled estimates."),
    "ESP": ("Instituto Nacional de Estadística", "https://www.ine.es/en/", "own_national_statistics_office", "Use the 2021 census dissemination system and its documented API for detailed census tables."),
    "FIN": ("Statistics Finland", "https://stat.fi/en/", "own_national_statistics_office", "Finland uses register-based total population statistics; do not wait for a questionnaire-style decennial release."),
    "FLK": ("Falkland Islands Government — Statistics", "https://www.falklands.gov.fk/policy/statistics", "territorial_statistics_authority", "Keep the territory identity and administering relationship explicit."),
    "FRA": ("Institut national de la statistique et des études économiques", "https://www.insee.fr/en/accueil", "own_national_statistics_office", "Refresh the census and local-statistics catalogue for the requested geography."),
    "GBR": ("Office for National Statistics", "https://www.ons.gov.uk/", "own_national_statistics_office", "Coordinate ONS with National Records of Scotland and NISRA when UK-wide coverage requires them."),
    "GGY": ("States of Guernsey — population and statistics", "https://www.gov.gg/population", "territorial_statistics_authority", "Confirm Bailiwick and island coverage before aggregation."),
    "GIB": ("HM Government of Gibraltar — Statistics", "https://www.gibraltar.gov.gi/statistics", "territorial_statistics_authority", "Treat Gibraltar releases as territorial statistics."),
    "GRD": ("Grenada Central Statistical Office", "https://stats.gov.gd/", "own_national_statistics_office", "Confirm current census products and parish geography."),
    "GLP": ("INSEE — overseas local statistics", "https://www.insee.fr/en/accueil", "administering_country_statistics_authority", "Filter the official source specifically to Guadeloupe."),
    "GUF": ("INSEE — overseas local statistics", "https://www.insee.fr/en/accueil", "administering_country_statistics_authority", "Filter the official source specifically to French Guiana."),
    "HMD": ("Australian Antarctic Division — Heard Island and McDonald Islands", "https://www.antarctica.gov.au/about-antarctica/australian-antarctic-territory/heard-island-and-mcdonald-islands/", "structural_nonresident_area", "No permanent resident population is inferred."),
    "IMN": ("Isle of Man Government — Statistics", "https://www.gov.im/about-the-government/departments/cabinet-office/statistics-isle-of-man/", "territorial_statistics_authority", "Treat Isle of Man releases as territorial statistics."),
    "IOT": ("United Kingdom Government — British Indian Ocean Territory", "https://www.gov.uk/government/organisations/british-indian-ocean-territory", "territorial_administration_structural_exception", "No permanent resident population or ordinary local-government planning system is inferred."),
    "JEY": ("Government of Jersey — Statistics", "https://www.gov.je/Government/JerseyInFigures/Pages/Statistics.aspx", "territorial_statistics_authority", "Treat Jersey releases as territorial statistics."),
    "JPN": ("Statistics Bureau of Japan", "https://www.stat.go.jp/english/", "own_national_statistics_office", "Use e-Stat and the Statistics Bureau census catalogue; preserve municipality codes and census-date geography."),
    "MAF": ("INSEE — overseas local statistics", "https://www.insee.fr/en/accueil", "administering_country_statistics_authority", "Filter the official source specifically to Saint Martin."),
    "KNA": ("Saint Kitts and Nevis Department of Statistics", "https://www.stats.gov.kn/", "own_national_statistics_office", "Keep Saint Kitts and Nevis island and parish classifications explicit."),
    "MHL": ("Economic Policy, Planning and Statistics Office", "https://www.rmieppso.org/", "own_national_statistics_office", "Confirm atoll/island geography and census reference dates."),
    "MSR": ("Montserrat Statistics Department", "https://statistics.gov.ms/", "territorial_statistics_authority", "Treat Montserrat releases as territorial statistics."),
    "MTQ": ("INSEE — overseas local statistics", "https://www.insee.fr/en/accueil", "administering_country_statistics_authority", "Filter the official source specifically to Martinique."),
    "MYT": ("INSEE — overseas local statistics", "https://www.insee.fr/en/accueil", "administering_country_statistics_authority", "Filter the official source specifically to Mayotte."),
    "NCL": ("Institut de la statistique et des études économiques de Nouvelle-Calédonie", "https://www.isee.nc/", "territorial_statistics_authority", "Keep New Caledonia classifications and census geography separate from metropolitan France."),
    "NFK": ("Australian Bureau of Statistics", "https://www.abs.gov.au/", "administering_country_statistics_authority", "Confirm Norfolk Island tables and geographic identifiers explicitly."),
    "NLD": ("Statistics Netherlands", "https://www.cbs.nl/en-gb", "own_national_statistics_office", "Use country and Caribbean-related tables only after confirming their geographic scope."),
    "PCN": ("Pitcairn Islands Government", "https://www.government.pn/", "territorial_administration_limited_statistics", "The very small population and administrative structure require a structural-exception review."),
    "PAK": ("Pakistan Bureau of Statistics", "https://www.pbs.gov.pk/", "own_national_statistics_office", "Inventory census tables, district/tehsil codes and changing boundaries by edition."),
    "PRI": ("Puerto Rico Institute of Statistics", "https://estadisticas.pr/", "territorial_statistics_authority", "Also inspect US Census Puerto Rico products; preserve Commonwealth and federal source definitions."),
    "PRK": ("UNSD national statistical office directory", UNSD_NSO, "no_public_country_entrypoint_verified", "Locate and verify a current DPR Korea official statistical publication or portal; do not substitute modeled estimates for census evidence."),
    "PYF": ("Institut de la statistique de la Polynésie française", "https://www.ispf.pf/", "territorial_statistics_authority", "Treat French Polynesia releases as territorial statistics."),
    "REU": ("INSEE — overseas local statistics", "https://www.insee.fr/en/accueil", "administering_country_statistics_authority", "Filter the official source specifically to Réunion."),
    "SGS": ("Government of South Georgia and the South Sandwich Islands", "https://gov.gs/", "structural_nonresident_area", "No permanent resident population or ordinary municipal planning system is inferred."),
    "SOM": ("Somalia National Bureau of Statistics", "https://nbs.gov.so/", "own_national_statistics_office", "Confirm statistical coverage, federal-member-state geography and source reference periods."),
    "SJM": ("Statistics Norway", "https://www.ssb.no/en/", "administering_country_statistics_authority", "Confirm Svalbard and Jan Mayen separately; do not merge their statistics by name alone."),
    "SPM": ("INSEE — overseas local statistics", "https://www.insee.fr/en/accueil", "administering_country_statistics_authority", "Filter the official source specifically to Saint Pierre and Miquelon."),
    "SXM": ("Department of Statistics Sint Maarten", "https://stats.sintmaartengov.org/", "territorial_statistics_authority", "Do not confuse Sint Maarten with Saint Martin (French Part)."),
    "TKM": ("State Committee of Turkmenistan on Statistics", "https://stat.gov.tm/", "own_national_statistics_office", "Confirm public census tables and download formats before adoption."),
    "TWN": ("Directorate-General of Budget, Accounting and Statistics", "https://eng.stat.gov.tw/", "supplemental_area_statistics_authority", "TWN is an ISO 3166 operational identity that is not a separate current UN M49 country-or-area row. Use DGBAS census and register sources and retain the source's own geographic scope wording."),
    "UMI": ("United States Census Bureau — Island Areas", "https://www.census.gov/programs-surveys/decennial-census/about/rdo/summary-files.html", "structural_nonresident_area", "No permanent resident population is inferred for the grouped minor outlying islands."),
    "USA": ("United States Census Bureau", "https://www.census.gov/", "own_national_statistics_office", "Use Census data.census.gov/API and TIGER/Line geography; never apply a Guatemala indicator ID to the United States."),
    "VCT": ("Saint Vincent and the Grenadines Statistical Office", "https://stats.gov.vc/", "own_national_statistics_office", "Confirm island and parish geography in each census table."),
    "VAT": ("Vatican City State", "https://www.vaticanstate.va/", "microstate_official_entrypoint_limited_statistics", "Verify whether a public statistical table exists; do not infer a conventional census catalogue."),
    "VGB": ("Virgin Islands Government — Statistics Unit", "https://bvi.gov.vg/statistics-unit", "territorial_statistics_authority", "Treat British Virgin Islands releases as territorial statistics."),
    "VIR": ("United States Census Bureau — Island Areas", "https://www.census.gov/programs-surveys/decennial-census/about/rdo/summary-files.html", "administering_country_census_authority", "Confirm US Virgin Islands products and territorial releases separately."),
    "WLF": ("Service Territorial de la Statistique et des Études Économiques", "https://www.statistique.wf/", "territorial_statistics_authority", "Treat Wallis and Futuna releases as territorial statistics."),
    "XKX": ("Kosovo Agency of Statistics", "https://ask.rks-gov.net/", "supplemental_area_statistics_authority", "XKX is a practical supplemental identifier and is not an ISO or UN M49 assignment."),
    "YEM": ("Yemen Central Statistical Organization", "https://cso-ye.org/", "own_national_statistics_office", "Confirm current access, publication date and geographic coverage before adoption."),
}


COUNTRY_ENTRYPOINTS = {
    "ESP": {
        "status": "official_starting_points_verified_2026_09_21",
        "census_system_note": "The 2021 Population and Housing Census is disseminated through detailed national, autonomous-community, province, municipality, district and census-section products. The documented API uses POST and table/variable identifiers supplied by INE.",
        "statistics_and_census": [
            {"title": "INE 2021 Population and Housing Census results", "url": "https://www.ine.es/dyngs/INEbase/en/operacion.htm?c=Estadistica_C&cid=1254736177108&idp=1254735576757&menu=resultados"},
            {"title": "INE 2021 census query system", "url": "https://www.ine.es/Censo2021/Inicio.do?L=1"},
            {"title": "INE 2021 census API documentation", "url": "https://www.ine.es/dyngs/DAB/index.htm?cid=1769"},
            {"title": "INE open data", "url": "https://www.ine.es/datosabiertos/"},
        ],
        "geography_and_codes": [
            {"title": "INE municipality code lists", "url": "https://www.ine.es/daco/daco42/codmun/codmunmapa.htm"},
            {"title": "IGN/CNIG administrative-unit downloads", "url": "https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=CAANE"},
            {"title": "IGN administrative units WFS", "url": "https://www.ign.es/wfs-inspire/unidades-administrativas"},
        ],
        "planning_and_law": [
            {"title": "Consolidated state Land and Urban Rehabilitation Act", "url": "https://www.boe.es/buscar/act.php?id=BOE-A-2015-11723"},
            {"title": "Official State Gazette legislation search", "url": "https://www.boe.es/buscar/"},
        ],
        "planning_caution": "Spain's autonomous communities have their own territorial and urban-planning legislation. Identify the selected area's autonomous-community law, planning instruments and municipal plan; the state land act alone is not a complete local planning index.",
    },
    "FIN": {
        "status": "official_starting_points_verified_2026_09_21",
        "census_system_note": "Finland's population evidence is register based. Current total population structure is published annually by municipality and other municipality-based divisions in StatFin/PxWeb; do not treat the absence of a questionnaire census as missing census evidence.",
        "statistics_and_census": [
            {"title": "Statistics Finland StatFin/PxWeb databases", "url": "https://pxdata.stat.fi/PxWeb/pxweb/en/"},
            {"title": "Population structure", "url": "https://stat.fi/en/statistics/vaerak"},
            {"title": "Population structure documentation", "url": "https://stat.fi/en/documentation/documentation-of-statistics/vaerak"},
            {"title": "Municipal key figures", "url": "https://stat.fi/en/services/statistical-data-services/statistical-databases/municipal-key-figures"},
        ],
        "geography_and_codes": [
            {"title": "National Land Survey division into administrative areas", "url": "https://www.maanmittauslaitos.fi/en/maps-and-spatial-data/datasets-and-interfaces/product-descriptions/division-administrative-areas-raster"},
            {"title": "National Land Survey MapSite downloads", "url": "https://www.maanmittauslaitos.fi/en/e-services/mapsite"},
            {"title": "Statistics Finland population by municipality-based units", "url": "https://stat.fi/en/services/statistical-data-services/geographic-data/population-by-municipality-based-units"},
        ],
        "planning_and_law": [
            {"title": "Ministry of the Environment land-use planning system", "url": "https://ym.fi/en/land-use-planning"},
            {"title": "Finlex updated Land Use Act 132/1999", "url": "https://www.finlex.fi/en/legislation/1999/132"},
            {"title": "Finlex legislation database", "url": "https://www.finlex.fi/en/legislation"},
        ],
        "planning_caution": "Confirm current amendments and terminology in Finnish/Swedish law. Separate regional schemes and plans from municipal strategies, local master plans, detailed plans, land policy and building ordinances.",
    },
    "TWN": {
        "status": "official_starting_points_verified_2026_09_21",
        "census_system_note": "DGBAS publishes a Population and Housing Census and official tables, while current population statistics also use household registration. Keep census, household-register and statistical-area products distinct and retain each source's own coverage wording.",
        "statistics_and_census": [
            {"title": "DGBAS Population and Housing Census", "url": "https://eng.stat.gov.tw/cl.aspx?n=2398"},
            {"title": "DGBAS census catalogue and FAQ", "url": "https://eng.dgbas.gov.tw/News.aspx?n=4136&sms=11641"},
            {"title": "National Statistics population and housing tables", "url": "https://www.stat.gov.tw/News_Content.aspx?n=3093&s=229647"},
            {"title": "Government Data Open Platform", "url": "https://data.gov.tw/en"},
        ],
        "geography_and_codes": [
            {"title": "Official municipality, county and city boundaries", "url": "https://data.gov.tw/en/datasets/7442"},
            {"title": "Official primary statistical release-area map", "url": "https://data.gov.tw/en/datasets/20597"},
            {"title": "Official smallest statistical-area map", "url": "https://data.gov.tw/en/datasets/25128"},
        ],
        "planning_and_law": [
            {"title": "National Land Management Agency Spatial Planning Act", "url": "https://www.nlma.gov.tw/en/legislation/laws/7091"},
            {"title": "National Land Management Agency laws and regulations", "url": "https://www.nlma.gov.tw/en/legislation/laws"},
            {"title": "National Spatial Plan", "url": "https://sptw.nlma.gov.tw/about/plans/national_spatial_plan"},
            {"title": "National Development Council spatial development", "url": "https://www.ndc.gov.tw/en/cp.aspx?n=FABA5CBA6967B769&s=A565BEA498339136"},
        ],
        "planning_caution": "The Spatial Planning Act assigns national and municipality or county (city) plans to different authorities. Verify the current transition from regional planning, the selected municipality/county plan, functional-zone maps and local instruments; do not infer legal status or territorial coverage from the operational TWN identifier.",
    },
}


COMMON_ALIASES = {
    "BOL": ["Bolivia"], "BRN": ["Brunei"], "CPV": ["Cape Verde"],
    "COD": ["DR Congo", "Democratic Republic of Congo"], "COG": ["Republic of Congo"],
    "CIV": ["Ivory Coast"], "CZE": ["Czech Republic"], "GBR": ["United Kingdom", "UK"],
    "IRN": ["Iran"], "KOR": ["South Korea"], "LAO": ["Laos", "Lao PDR"],
    "MDA": ["Moldova"], "MKD": ["Macedonia", "North Macedonia"], "PRK": ["North Korea"],
    "RUS": ["Russia"], "SWZ": ["Eswatini", "Swaziland"], "SYR": ["Syria"],
    "TZA": ["Tanzania"], "TUR": ["Turkey", "Türkiye"], "USA": ["United States", "US", "USA"],
    "VAT": ["Vatican City"], "VEN": ["Venezuela"], "VNM": ["Vietnam"],
    "TWN": ["Taiwan", "Republic of China", "Taiwan (Province of China)"],
    "XKX": ["Kosovo"],
}


def catalogue_url(base: str, params: dict[str, str]) -> str:
    return base + ("&" if "?" in base else "?") + urllib.parse.urlencode(params)


def census_index(payload: bytes) -> dict[str, list[dict[str, object]]]:
    parser = CensusParser()
    parser.feed(payload.decode("utf-8", "replace"))
    by_name: dict[str, list[dict[str, object]]] = {}
    previous_name = ""
    for cells in parser.rows:
        name = census_country_label(str(cells[0]["text"])) or previous_name
        if not name:
            continue
        previous_name = name
        by_name.setdefault(census_label_key(name), []).append({
            "country_label": name,
            "round_1990": cells[1], "round_2000": cells[2], "round_2010": cells[3],
            "round_2020": cells[4], "round_2030": cells[5] if len(cells) > 5 else {"text": "", "links": []},
        })
    return by_name


def matching_rows(index: dict[str, list[dict[str, object]]], candidates: list[str]) -> list[dict[str, object]]:
    direct = next((index[key(value)] for value in candidates if key(value) in index), None)
    if direct is not None:
        return direct
    fuzzy = []
    for value in candidates:
        wanted = key(value)
        fuzzy.extend(rows for label, rows in index.items() if label.endswith(wanted) or label.startswith(wanted))
    return fuzzy[0] if len({id(rows) for rows in fuzzy}) == 1 else []


def main() -> None:
    checked_at = datetime.now(timezone.utc).date().isoformat()
    payloads = {url: fetch(url) for url in (UN_M49, UNSD_NSO, UNSD_CENSUS)}
    snapshots = {url: {"sha256": hashlib.sha256(payload).hexdigest(), "bytes": len(payload)} for url, payload in payloads.items()}

    m49_parser = M49Parser()
    m49_parser.feed(payloads[UN_M49].decode("utf-8", "replace"))
    if len(m49_parser.rows) != 248:
        raise RuntimeError(f"UN M49 country/area universe drifted: {len(m49_parser.rows)}; expected 248")
    nso_parser = NsoParser()
    nso_parser.feed(payloads[UNSD_NSO].decode("utf-8", "replace"))
    nso_by_name = {key(row["country"]): row for row in nso_parser.rows}
    census_by_name = census_index(payloads[UNSD_CENSUS])

    priority = json.loads(PRIORITY_REGISTRY.read_text(encoding="utf-8"))
    priority_by_iso3 = {country["iso3"]: country for country in priority["countries"]}
    identities = []
    for row in m49_parser.rows:
        iso3, iso2, name = row[11], row[10], row[8]
        priority_record = priority_by_iso3.get(iso3)
        aliases = [*COMMON_ALIASES.get(iso3, [])]
        if priority_record:
            aliases.extend([priority_record["name_en"], priority_record["jica_name"]])
        aliases = sorted({value for value in aliases if value and key(value) != key(name)}, key=key)
        identities.append({
            "iso3": iso3, "iso2": iso2, "m49": row[9], "name_en": name, "aliases": aliases,
            "global_region": {"code": row[0], "name": row[1]},
            "region": {"code": row[2] or None, "name": row[3] or None},
            "subregion": {"code": row[4] or None, "name": row[5] or None},
            "intermediate_region": {"code": row[6] or None, "name": row[7] or None},
            "m49_development_flags": {"ldc": row[12] == "x", "lldc": row[13] == "x", "sids": row[14] == "x"},
            "registry_basis": "un_m49_country_or_area",
            "jica_priority": iso3 in priority_by_iso3,
            "classification_warning": "UN M49 identity and grouping do not establish sovereignty, legal boundary status, national statistical authority or the statutory planning unit.",
        })
    identities.append({
        "iso3": "TWN", "iso2": "TW", "m49": None, "iso_numeric": "158", "name_en": "Taiwan", "aliases": COMMON_ALIASES["TWN"],
        "global_region": {"code": "001", "name": "World"},
        "region": {"code": "142", "name": "Asia"},
        "subregion": {"code": "030", "name": "Eastern Asia"},
        "intermediate_region": {"code": None, "name": None},
        "m49_development_flags": {"ldc": None, "lldc": None, "sids": None},
        "registry_basis": "supplemental_iso_3166_operational_identity_not_listed_separately_by_un_m49",
        "jica_priority": False,
        "classification_warning": "TW/TWN and ISO numeric 158 are retained as practical ISO 3166 operational identifiers. Taiwan is not a separate row in the current UN M49 country-or-area list; this entry does not imply a position on status or territorial scope.",
    })
    identities.append({
        "iso3": "XKX", "iso2": "XK", "m49": None, "name_en": "Kosovo", "aliases": ["Kosovo"],
        "global_region": {"code": "001", "name": "World"},
        "region": {"code": "150", "name": "Europe"},
        "subregion": {"code": "039", "name": "Southern Europe"},
        "intermediate_region": {"code": None, "name": None},
        "m49_development_flags": {"ldc": None, "lldc": None, "sids": None},
        "registry_basis": "supplemental_operational_identity_not_assigned_by_un_m49",
        "jica_priority": True,
        "classification_warning": "XK/XKX is a practical operational identifier. It is not an ISO 3166 or UN M49 assignment and does not imply a position on status.",
    })
    identities.sort(key=lambda item: item["iso3"])

    records = []
    for identity in identities:
        iso3, iso2, name = identity["iso3"], identity["iso2"], identity["name_en"]
        candidates = [name, *identity["aliases"], *M49_TO_UNSD_ALIASES.get(name, [])]
        manual = MANUAL_STATISTICS.get(iso3)
        nso = next((nso_by_name[key(value)] for value in candidates if key(value) in nso_by_name), None)
        if manual:
            agency, url, relation, note = manual
            nso = {"country": name, "agency": agency, "url": url}
            nso_origin = "MANUALLY_CURATED_OFFICIAL_ENTRYPOINT"
        elif nso:
            relation, note = "unsd_listed_national_or_area_statistics_office", "Refresh the current agency URL and catalogue before acquisition."
            nso_origin = "UNSD_NSO_DIRECTORY"
        else:
            relation, note = "official_directory_fallback_no_country_entry_matched", "No country-specific NSO link was matched; verify an official authority before adopting any observation."
            nso = {"country": name, "agency": "UNSD national statistical office directory", "url": UNSD_NSO}
            nso_origin = "UNSD_DIRECTORY_FALLBACK_REQUIRES_COUNTRY_AUTHORITY_SEARCH"
        census_rows = matching_rows(census_by_name, candidates)
        latest_listing = census_summary(census_rows, linked_only=False)
        latest_linked_listing = census_summary(census_rows, linked_only=True)
        pack = COUNTRY_ENTRYPOINTS.get(iso3)
        hdx_query = urllib.parse.quote(f"{name} census subnational administrative boundaries")
        regional_candidates = []
        if identity["region"]["name"] == "Europe":
            regional_candidates = [
                {"title": "Eurostat population and housing census access", "url": EUROSTAT_CENSUS, "status": "availability_requires_country_and_geography_check"},
                {"title": "Eurostat database", "url": EUROSTAT_DATA, "status": "availability_requires_country_and_geography_check"},
                {"title": "GISCO NUTS and statistical units", "url": GISCO_NUTS, "status": "coverage_and_legal_geography_require_reconciliation"},
                {"title": "European e-Justice national legislation directory", "url": EU_JUSTICE_LAW, "status": "official_legal_discovery_only"},
            ]
        records.append({
            "iso3": iso3, "iso2": iso2, "m49": identity["m49"], "name_en": name,
            "checked_at": checked_at,
            "world_identity": {
                "registry_basis": identity["registry_basis"], "region": identity["region"],
                "subregion": identity["subregion"], "intermediate_region": identity["intermediate_region"],
                "jica_priority": identity["jica_priority"], "classification_warning": identity["classification_warning"],
            },
            "national_statistics_and_census": {
                "status": "official_entrypoint_catalogued_release_and_tables_not_yet_inspected",
                "national_statistics_office": {**nso, "origin": nso_origin, "authority_relation": relation, "scope_note": note, "directory_source": UNSD_NSO},
                "un_census_rounds": census_rows, "un_census_dates_source": UNSD_CENSUS,
                "latest_un_census_listing": latest_listing,
                "latest_un_census_linked_listing": latest_linked_listing,
                "country_specific_entrypoints": pack["statistics_and_census"] if pack else [],
                "country_system_note": pack["census_system_note"] if pack else None,
                "required_next_step": "Open the official census or register-based population catalogue, inventory every current release/resource/table, and preserve every available administrative level, age-sex table, code list and metadata file before selecting indicators.",
            },
            "planning_law_and_materials": {
                "status": "legal_catalogue_and_regional_discovery_prepared_specific_planning_obligation_requires_text_verification",
                "legal_catalogue": catalogue_url(FAOLEX, {"iso3": iso3}),
                "official_country_entrypoints": pack["planning_and_law"] if pack else [],
                "regional_candidates": regional_candidates,
                "country_caution": pack["planning_caution"] if pack else None,
                "required_next_step": "Identify the current planning, decentralisation and local-government law, the statutory planning unit, implementing rules, responsible-ministry guidance/forms and actual plans, budgets, implementation reports and evaluations. Acquire the controlling text and record article/page locators; do not infer a planning obligation from a regional grouping.",
            },
            "geography_and_codes": {
                "status": "candidate_catalogues_only_official_code_parentage_and_boundary_edition_match_required",
                "geoboundaries_adm1_api": f"https://www.geoboundaries.org/api/current/gbOpen/{iso3}/ADM1/",
                "geoboundaries_adm2_api": f"https://www.geoboundaries.org/api/current/gbOpen/{iso3}/ADM2/",
                "un_salb_catalogue": "https://salb.un.org/en/data",
                "hdx_targeted_search": f"https://data.humdata.org/dataset/?q={hdx_query}",
                "country_specific_entrypoints": pack["geography_and_codes"] if pack else [],
                "regional_candidates": [item for item in regional_candidates if "GISCO" in item["title"]],
                "required_next_step": "Find the official administrative register and code list first, then reconcile names, entity types, parents, effective dates and boundary editions. A reference boundary or NUTS layer is not automatically the country's legal or census geography.",
            },
            "international_data_candidates": {
                "status": "country_queries_prepared_availability_definition_and_subnational_depth_not_yet_accepted",
                "world_bank_country_api": f"https://api.worldbank.org/v2/country/{iso3}?format=json",
                "world_bank_wdi_population_api": f"https://api.worldbank.org/v2/country/{iso3}/indicator/SP.POP.TOTL?format=json&per_page=1000",
                "hdx_country_search": f"https://data.humdata.org/dataset/?q={urllib.parse.quote(name)}",
                "unicef_mics_surveys": "https://mics.unicef.org/surveys",
                "dhs_country_list": "https://dhsprogram.com/Countries/Country-Main.cfm",
                "worldpop_data_portal": "https://www.worldpop.org/datacatalog/",
                "ghsl_data": "https://human-settlement.emergency.copernicus.eu/download.php",
                "undp_human_development_data": "https://hdr.undp.org/data-center",
                "regional_candidates": regional_candidates,
                "required_next_step": "Check the target identity, year, geography, definition, denominator, method, licence and downloadability. Keep census, register, survey, administrative, humanitarian and modelled values separate; international national values never replace local observations.",
            },
            "anti_shortcut_rules": [
                "An entrypoint, directory row, search result or prior recipe is not acquired evidence.",
                "A census date is not proof that detailed tables are published or usable.",
                "One workbook, table, municipality or administrative level does not close a national catalogue.",
                "A legal catalogue hit is not a verified planning obligation until the controlling text and locator are inspected.",
                "UN M49 membership does not establish sovereignty, legal boundary status or a statutory planning authority.",
                "International national values never replace local observations.",
                "A modern register-based system may publish richer annual local data than a decennial census; search the country's actual statistical system.",
            ],
        })

    if len(identities) != 250 or len({item["iso3"] for item in identities}) != 250:
        raise RuntimeError("World registry must contain 248 UN M49 countries/areas plus TWN and XKX supplemental identities")
    if len(records) != 250 or any(not record["national_statistics_and_census"]["national_statistics_office"]["url"] for record in records):
        raise RuntimeError("World source preflight must cover all 250 identities with a statistics authority or explicit structural fallback")
    if any(record["national_statistics_and_census"]["national_statistics_office"]["origin"] == "UNSD_DIRECTORY_FALLBACK_REQUIRES_COUNTRY_AUTHORITY_SEARCH" for record in records):
        unresolved = [record["iso3"] for record in records if record["national_statistics_and_census"]["national_statistics_office"]["origin"] == "UNSD_DIRECTORY_FALLBACK_REQUIRES_COUNTRY_AUTHORITY_SEARCH"]
        raise RuntimeError(f"Country-specific statistics entrypoint missing: {unresolved}")

    registry = {
        "schema_version": "1.0", "as_of": checked_at,
        "definition": "All 248 current UN M49 country-or-area rows plus Taiwan and Kosovo as two explicit operational supplements.",
        "use": "Country-name and code resolution plus discovery context only. Identity does not establish sovereignty, legal boundary status, planning authority, source acquisition or indicator availability.",
        "counts": {"un_m49_countries_and_areas": 248, "supplemental_operational_identities": 2, "total": 250, "jica_priority": sum(item["jica_priority"] for item in identities)},
        "sources": [
            {"id": "UN_M49", "url": UN_M49, "role": "country_area_name_code_and_region_registry"},
            {"id": "ISO_3166_TWN_SUPPLEMENT", "url": "https://www.iso.org/obp/ui/#iso:code:3166:TW", "role": "TWN_operational_identity_context"},
            {"id": "JICA_PRIORITY_XKX_SUPPLEMENT", "url": priority["sources"][0]["url"], "role": "XKX_operational_identity_and_priority_context"},
        ],
        "snapshot_receipt": {UN_M49: snapshots[UN_M49]}, "countries_and_areas": identities,
    }
    preflight = {
        "schema_version": "1.1", "as_of": checked_at,
        "scope": "248 UN M49 countries or areas plus explicit Taiwan and Kosovo operational supplements",
        "meaning": "Source-address preflight only. No linked law, census release, table, boundary or indicator is acquired, matched or adopted by this registry.",
        "census_listing_semantics": {
            "latest_un_census_listing": "Latest completed census date listed by UNSD, whether or not UNSD supplies a link. Wholly parenthesized future/scheduled entries are excluded.",
            "latest_un_census_linked_listing": "Latest completed census listing for which UNSD supplies at least one link. This can be older than the latest UNSD listing and is not proof that the linked material was acquired or adopted.",
        },
        "source_snapshots": snapshots, "records": records,
    }
    WORLD_REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    WORLD_PREFLIGHT.write_text(json.dumps(preflight, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# World country/area source-address preflight", "",
        f"Generated {checked_at}. The machine registry contains 248 UN M49 country-or-area identities plus explicit Taiwan and Kosovo operational supplements (250 total).", "",
        "This file stores discovery addresses and system cautions, not statistical data. Every country build must refresh and inspect the current official catalogue, all resources/tables, governing law, geography and licences before adoption.", "",
        "Spain, Finland and Taiwan include additional verified official starting points so that developed-country, decentralised-law, register-based and non-M49 operational systems do not fall through the JICA-priority workflow.", "",
        "The latest UNSD listing and the latest listing with an UNSD link are separate fields. A newer unlinked census date must not be hidden by, or treated as acquired data from, an older linked edition.", "",
        "| ISO3 | Country or area | UN region / subregion | Statistics authority or structural entrypoint | Census rows | Latest UNSD listing | Latest UNSD-linked listing | Specific pack |", "|---|---|---|---|---:|---|---|---|",
    ]
    for record in records:
        nso = record["national_statistics_and_census"]["national_statistics_office"]
        region = record["world_identity"]["region"]["name"] or "-"
        subregion = record["world_identity"]["subregion"]["name"] or "-"
        census = record["national_statistics_and_census"]
        latest = census["latest_un_census_listing"]
        linked = census["latest_un_census_linked_listing"]
        latest_text = f'{latest["round"]} / {latest["date_text"]} / {"link" if latest["links"] else "no UNSD link"}' if latest else "-"
        linked_text = f'{linked["round"]} / [{linked["date_text"]}]({linked["primary_url"]})' if linked else "-"
        lines.append(f'| {record["iso3"]} | {record["name_en"]} | {region} / {subregion} | [{nso["agency"]}]({nso["url"]}) ({nso["authority_relation"]}) | {len(census["un_census_rounds"])} | {latest_text} | {linked_text} | {"yes" if census["country_specific_entrypoints"] else "-"} |')
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {WORLD_REGISTRY}, {WORLD_PREFLIGHT} and {REPORT}: 250 identities and 250 source preflights")


if __name__ == "__main__":
    main()
