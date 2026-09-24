import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSourceCatalog, findCountrySourceRecord, findPriorityCountryRecord, findPrioritySourceRecord, findWorldCountryRecord, findWorldSourceRecord, buildSourcePreflight, renderSourcePreflightMarkdown } from '../lib/source-catalog.mjs';
import { sourcePlan } from '../scripts/source-plan.mjs';

test('source catalog combines reusable international candidates and pre-researched countries', async () => {
  const catalog = await loadSourceCatalog();
  assert.equal(catalog.coverage.common_sources, 10);
  assert.equal(catalog.coverage.country_records, 32);
  assert.equal(catalog.coverage.world_countries_and_areas, 250);
  assert.equal(catalog.coverage.world_source_preflights, 250);
  assert.equal(catalog.coverage.un_m49_countries_and_areas, 248);
  assert.equal(catalog.coverage.jica_priority_countries, 142);
  assert.equal(catalog.coverage.jica_priority_dac_recipients, 132);
  assert.equal(catalog.coverage.jica_priority_source_preflights, 142);
  assert.equal(catalog.coverage.verified_source_recipes, 28);
  assert.equal(catalog.coverage.areadata_feedback_sources, catalog.areadata_source_feedback.length);
  for (const iso3 of ['BGD', 'LAO', 'UGA']) assert.ok(catalog.areadata_source_feedback.some(source => source.iso3 === iso3));
  assert.ok(!catalog.areadata_source_feedback.some(source => source.url === 'https://www.lsb.gov.la/sdg/en/17-19-2/'));
  assert.ok(catalog.areadata_source_feedback.some(source => source.iso3 === 'LAO'
    && source.url === 'https://lao.unfpa.org/en/publications/results-population-and-housing-census-2015-english-version'));
  assert.ok(catalog.areadata_source_feedback.every(source => source.current_project_evidence_status === 'not_acquired_by_kit_preflight'));
  assert.deepEqual(catalog.coverage.status_model, [
    'catalogued',
    'country_availability_checked',
    'data_acquired',
    'geography_matched',
    'indicator_accepted',
  ]);
  assert.equal(new Set(catalog.common_sources.map(source => source.id)).size, 10);
  assert.ok(catalog.common_sources.every(source => source.catalog_url.startsWith('https://')));
});

test('strict Americas recipes are reusable without becoming current-project acquisitions', async () => {
  const catalog = await loadSourceCatalog();
  assert.equal(catalog.verified_source_recipes.length, 28);
  assert.equal(new Set(catalog.verified_source_recipes.map(recipe => recipe.iso3)).size, 28);
  const brazil = buildSourcePreflight(catalog, { id: 'BRA', name: 'Brazil' });
  assert.equal(brazil.verified_source_recipe.recipe_status, 'verified_broad_local_statistical_recipe');
  assert.equal(brazil.verified_source_recipe.current_project_evidence_status, 'not_acquired_by_source_preflight');
  assert.equal(brazil.summary.acquired_sources, 0);
  assert.match(brazil.verified_source_recipe.semantic_cautions.join(' '), /Never use one age-sex table/i);
  assert.ok(brazil.verified_source_recipe.source_entrypoints.machine_readable_data.length);
  const usa = findCountrySourceRecord(catalog, 'United States');
  assert.equal(usa.iso3, 'USA');
  assert.equal(usa.origin_registry, 'americas-verified-source-recipes');
  const sgs = buildSourcePreflight(catalog, { id: 'SGS', name: 'South Georgia and the South Sandwich Islands' });
  assert.equal(sgs.verified_source_recipe.recipe_status, 'verified_structural_nonresident_exception');
  assert.equal(sgs.verified_source_recipe.planning_readiness.status, 'incomplete');
  assert.match(renderSourcePreflightMarkdown(brazil), /Verified Americas reuse recipe/);
});

test('four completed-country lessons are registered without becoming universal country rules', async () => {
  const catalog = await loadSourceCatalog();
  assert.deepEqual(catalog.reference_country_cases.map(reference => reference.iso3), ['DOM', 'UGA', 'LAO', 'BGD']);
  for (const iso3 of ['DOM', 'UGA', 'LAO', 'BGD']) {
    assert.ok(findPriorityCountryRecord(catalog, iso3));
    assert.ok(findCountrySourceRecord(catalog, iso3));
  }
  const laos = findCountrySourceRecord(catalog, 'ラオス');
  assert.match(laos.census.published_geography, /district/i);
  assert.ok(laos.sources.some(source => source.role === 'planning_law'));
  const preflight = buildSourcePreflight(catalog, { id: 'LAO', name: 'Lao PDR' });
  assert.equal(preflight.reference_country_cases.find(reference => reference.iso3 === 'LAO').requested_country, true);
  assert.match(renderSourcePreflightMarkdown(preflight), /Reference country cases/);
});

test('JICA priority universe is source-backed, unique and retains cooperation partners outside DAC', async () => {
  const catalog = await loadSourceCatalog();
  assert.equal(new Set(catalog.priority_countries.map(country => country.iso3)).size, 142);
  assert.equal(catalog.priority_registry.counts.non_dac_or_graduated_cooperation_partners, 10);
  assert.equal(findPriorityCountryRecord(catalog, 'Chile').iso3, 'CHL');
  assert.equal(findPriorityCountryRecord(catalog, 'Uruguay').iso3, 'URY');
  assert.equal(findPriorityCountryRecord(catalog, 'Bangladesh').dac_oda_recipient_2024, true);
  assert.equal(findPriorityCountryRecord(catalog, 'Cook Islands').dac_oda_recipient_2024, false);
});

test('all 142 priority countries have four-category source addresses and anti-shortcut rules', async () => {
  const catalog = await loadSourceCatalog();
  assert.equal(new Set(catalog.priority_source_records.map(record => record.iso3)).size, 142);
  for (const country of catalog.priority_countries) {
    const record = findPrioritySourceRecord(catalog, country.iso3);
    assert.equal(record.iso3, country.iso3);
    assert.ok(record.national_statistics_and_census.national_statistics_office.url);
    assert.ok(record.planning_law_and_materials.legal_catalogue);
    assert.ok(record.geography_and_codes.geoboundaries_adm1_api);
    assert.ok(record.international_data_candidates.world_bank_country_api);
    assert.ok(record.anti_shortcut_rules.length >= 5);
  }
  assert.equal(catalog.priority_source_records.filter(record => record.national_statistics_and_census.un_census_rounds.length).length, 141);
  assert.deepEqual(catalog.priority_source_records.filter(record => !record.national_statistics_and_census.un_census_rounds.length).map(record => record.iso3), ['XKX']);
});

test('Uganda preflight separates planning level, internal analysis geography and acquisition status', async () => {
  const catalog = await loadSourceCatalog();
  const uganda = findCountrySourceRecord(catalog, 'ウガンダ');
  assert.equal(uganda.iso3, 'UGA');
  assert.match(uganda.planning.planning_level, /District/);
  assert.match(uganda.planning.internal_analysis_geography, /Subcounty/);
  const preflight = buildSourcePreflight(catalog, { id: 'UGA', name: 'Uganda' });
  assert.ok(preflight.country_research.sources.some(source => source.role === 'census_catalog'));
  assert.ok(preflight.country_research.sources.some(source => source.role === 'planning_law'));
  assert.ok(preflight.country_research.sources.some(source => source.stage === 'negative_availability_verified'));
  assert.equal(preflight.summary.acquired_sources, 0);
  assert.ok(preflight.common_candidates.every(source => source.country_status === 'availability_not_checked_for_country'));
});

test('Latin America desk research is reused without being promoted to acquired evidence', async () => {
  const catalog = await loadSourceCatalog();
  const dominican = findCountrySourceRecord(catalog, 'DOM');
  assert.equal(dominican.origin_registry, 'latin-america-20-2026');
  assert.equal(dominican.census.latest_census_year, 2022);
  assert.ok(dominican.sources.length >= 4);
  assert.ok(dominican.sources.every(source => source.stage === 'desk_research_location'));
});

test('Belize has a verified 2022 census location without claiming planning research is complete', async () => {
  const catalog = await loadSourceCatalog();
  const belize = findCountrySourceRecord(catalog, 'ベリーズ');
  assert.equal(belize.iso3, 'BLZ');
  assert.equal(belize.census.usable_detailed_year, 2022);
  assert.match(belize.census.published_geography, /city, town, village or community/i);
  assert.match(belize.planning.planning_level, /Not yet researched/);
  assert.ok(belize.sources.every(source => source.publisher === 'Statistical Institute of Belize'));
});

test('Bangladesh records detailed 2022 census products and keeps planning bodies distinct', async () => {
  const catalog = await loadSourceCatalog();
  const bangladesh = findCountrySourceRecord(catalog, 'バングラデシュ');
  assert.equal(bangladesh.iso3, 'BGD');
  assert.equal(bangladesh.census.usable_detailed_year, 2022);
  assert.match(bangladesh.census.published_geography, /Upazila/i);
  assert.match(bangladesh.planning.planning_level, /Union Parishad/);
  assert.ok(bangladesh.sources.some(source => source.role === 'census_district_report'));
  assert.ok(bangladesh.sources.some(source => source.role === 'planning_law'));
  const preflight = buildSourcePreflight(catalog, { id: 'BGD', name: 'Bangladesh' });
  assert.equal(preflight.priority_context.status, 'jica_priority_country_or_territory');
  assert.match(renderSourcePreflightMarkdown(preflight), /JICA priority registry: \*\*included\*\*/);
});

test('unresearched country still receives common candidates and an explicit research task', async () => {
  const catalog = await loadSourceCatalog();
  const preflight = buildSourcePreflight(catalog, { id: 'JPN', name: 'Japan' });
  assert.equal(preflight.country_research.status, 'source_locations_not_pre_researched');
  assert.equal(preflight.country_research.sources.length, 0);
  assert.equal(preflight.world_context.status, 'world_country_or_area_registry_match');
  assert.equal(preflight.summary.world_source_address_categories, 4);
  assert.ok(preflight.world_source_preflight.national_statistics_and_census.national_statistics_office.url);
  assert.equal(preflight.common_candidates.length, 10);
  assert.ok(preflight.required_actions.some(action => /world preflight/.test(action)));
  assert.match(renderSourcePreflightMarkdown(preflight), /does not mean the listed data were acquired/);
  assert.equal(preflight.areadata_source_feedback.status, 'no_areadata_feedback_registered');
  assert.match(renderSourcePreflightMarkdown(preflight), /AreaData source feedback/);
});

test('source plan can narrow common candidates by theme without implying country availability', async () => {
  const json = JSON.parse(await sourcePlan({ country: 'UGA', theme: 'refugees', format: 'json' }));
  assert.deepEqual(json.common_candidates.map(source => source.id), ['unhcr-refugee-data-finder']);
  assert.equal(json.common_candidates[0].country_status, 'availability_not_checked_for_country');
  const japan = JSON.parse(await sourcePlan({ country: 'Japan', format: 'json' }));
  assert.equal(japan.country.iso3, 'JPN');
  assert.equal(japan.summary.world_source_address_categories, 4);
});

test('source plan accepts a JICA-priority name before national sources are researched', async () => {
  const json = JSON.parse(await sourcePlan({ country: 'Nauru', format: 'json' }));
  assert.equal(json.country.iso3, 'NRU');
  assert.equal(json.priority_context.status, 'jica_priority_country_or_territory');
  assert.equal(json.country_research.status, 'source_locations_not_pre_researched');
  assert.ok(json.priority_source_preflight.national_statistics_and_census.national_statistics_office.url);
  assert.equal(json.summary.priority_source_address_categories, 4);
});

test('all 250 world identities have four source-address categories without claiming acquisition', async () => {
  const catalog = await loadSourceCatalog();
  assert.equal(new Set(catalog.world_countries_and_areas.map(area => area.iso3)).size, 250);
  assert.equal(new Set(catalog.world_source_records.map(record => record.iso3)).size, 250);
  for (const area of catalog.world_countries_and_areas) {
    assert.equal(findWorldCountryRecord(catalog, area.iso3)?.iso3, area.iso3);
    assert.equal(findWorldCountryRecord(catalog, area.name_en)?.iso3, area.iso3);
    const record = findWorldSourceRecord(catalog, area.iso3);
    assert.ok(record.national_statistics_and_census.national_statistics_office.url);
    assert.ok(record.planning_law_and_materials.legal_catalogue);
    assert.ok(record.geography_and_codes.geoboundaries_adm1_api);
    assert.ok(record.international_data_candidates.world_bank_country_api);
    assert.equal(Object.hasOwn(record, 'observations'), false);
    const preflight = buildSourcePreflight(catalog, { id: area.iso3, name: area.name_en });
    assert.equal(preflight.summary.world_source_address_categories, 4);
    assert.equal(preflight.summary.acquired_sources, 0);
  }
});

test('UNSD latest listing is kept separate from the latest linked listing', async () => {
  const catalog = await loadSourceCatalog();
  const worldAlgeria = findWorldSourceRecord(catalog, 'DZA').national_statistics_and_census;
  assert.deepEqual(worldAlgeria.latest_un_census_listing, {
    round: 2020,
    round_period: '2015-2024',
    date_text: '25 September 2022',
    country_label: 'Algeria',
    links: [],
    primary_url: null,
    link_status: 'no_unsd_link_listed',
  });
  assert.equal(worldAlgeria.latest_un_census_linked_listing.round, 2010);
  assert.equal(worldAlgeria.latest_un_census_linked_listing.date_text, '16-30 April 2008');
  assert.equal(worldAlgeria.latest_un_census_linked_listing.primary_url, 'http://rgph2008.ons.dz/');

  const priorityAlgeria = findPrioritySourceRecord(catalog, 'DZA').national_statistics_and_census;
  assert.deepEqual(priorityAlgeria.latest_un_census_listing, worldAlgeria.latest_un_census_listing);
  assert.deepEqual(priorityAlgeria.latest_un_census_linked_listing, worldAlgeria.latest_un_census_linked_listing);
  const markdown = renderSourcePreflightMarkdown(buildSourcePreflight(catalog, { id: 'DZA', name: 'Algeria' }));
  assert.match(markdown, /Latest completed census listed by UNSD: 2020 round \/ 25 September 2022 \/ no UNSD link/);
  assert.match(markdown, /Latest completed listing with an UNSD link: 2010 round \/ \[16-30 April 2008\]\(http:\/\/rgph2008\.ons\.dz\/\) \/ UNSD link listed/);
});

test('current UNSD census labels resolve St., Sint Maarten and numeric footnotes', async () => {
  const catalog = await loadSourceCatalog();
  for (const iso3 of ['KNA', 'LCA', 'SPM', 'VCT', 'SXM', 'NLD']) {
    assert.ok(findWorldSourceRecord(catalog, iso3).national_statistics_and_census.un_census_rounds.length,
      `${iso3} must match its current UNSD census label`);
  }
  assert.deepEqual(
    catalog.world_source_records
      .filter(record => !record.national_statistics_and_census.un_census_rounds.length)
      .map(record => record.iso3),
    ['ALA', 'ATA', 'ATF', 'BVT', 'CCK', 'CXR', 'HMD', 'IOT', 'SGS', 'TWN', 'UMI', 'XKX'],
  );
});

test('Spain, Finland and Taiwan resolve from Japanese names and retain country-system source packs', async () => {
  const catalog = await loadSourceCatalog();
  assert.equal(findWorldCountryRecord(catalog, 'スペイン').iso3, 'ESP');
  assert.equal(findWorldCountryRecord(catalog, 'フィンランド').iso3, 'FIN');
  assert.equal(findWorldCountryRecord(catalog, '台湾').iso3, 'TWN');
  assert.equal(findWorldCountryRecord(catalog, '158').iso3, 'TWN');
  const spain = JSON.parse(await sourcePlan({ country: 'スペイン', format: 'json' }));
  const finland = JSON.parse(await sourcePlan({ country: 'フィンランド', format: 'json' }));
  const taiwan = JSON.parse(await sourcePlan({ country: '台湾', format: 'json' }));
  assert.equal(spain.country.iso3, 'ESP');
  assert.equal(finland.country.iso3, 'FIN');
  assert.equal(taiwan.country.iso3, 'TWN');
  assert.ok(spain.summary.world_country_specific_entrypoints >= 9);
  assert.ok(finland.summary.world_country_specific_entrypoints >= 9);
  assert.ok(taiwan.summary.world_country_specific_entrypoints >= 9);
  assert.match(JSON.stringify(spain.world_source_preflight), /ine\.es/i);
  assert.match(JSON.stringify(spain.world_source_preflight), /boe\.es/i);
  assert.match(spain.world_source_preflight.planning_law_and_materials.country_caution, /autonomous communities/i);
  assert.match(JSON.stringify(finland.world_source_preflight), /pxdata\.stat\.fi/i);
  assert.match(JSON.stringify(finland.world_source_preflight), /finlex\.fi/i);
  assert.match(finland.world_source_preflight.national_statistics_and_census.country_system_note, /register[ -]based/i);
  assert.match(JSON.stringify(taiwan.world_source_preflight), /eng\.stat\.gov\.tw/i);
  assert.match(JSON.stringify(taiwan.world_source_preflight), /nlma\.gov\.tw/i);
  assert.equal(spain.summary.acquired_sources, 0);
  assert.equal(finland.summary.acquired_sources, 0);
  assert.equal(taiwan.summary.acquired_sources, 0);
});

test('structural territories keep explicit exception notes instead of invented conventional systems', async () => {
  const catalog = await loadSourceCatalog();
  for (const iso3 of ['ATA', 'SGS', 'IOT']) {
    const record = findWorldSourceRecord(catalog, iso3);
    assert.match(JSON.stringify(record), /structural|non-resident|administering|no permanent/i);
    assert.equal(buildSourcePreflight(catalog, { id: iso3, name: record.name_en }).summary.acquired_sources, 0);
  }
});
