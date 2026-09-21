import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSourceCatalog, findCountrySourceRecord, findPriorityCountryRecord, findWorldCountryRecord, findWorldSourceRecord, buildSourcePreflight } from '../lib/source-catalog.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const requiredFiles = [
  'README.md', 'START_HERE.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md',
  'prompts/ONE_COUNTRY_COMPLETE.md', 'prompts/ANTIGRAVITY.md', 'prompts/CODEX.md', 'prompts/CLAUDE_CODE.md',
  'docs/COUNTRY_AGENT_WORKFLOW.md', 'docs/COUNTRY_COMPLETION_CONTRACT.md', 'docs/REFERENCE_COUNTRY_CASES.md',
  'docs/AI_FAILURE_MODE_REVIEW.md', 'docs/COUNTRY_NAME_ONLY_ACCEPTANCE.md', 'templates/ACCEPTANCE.md',
  'templates/DELIVERY.json', 'templates/SOURCE_RESOURCE_INVENTORY.json', 'templates/SOURCE_TABLE_INVENTORY.json',
  'templates/THEME_COVERAGE.json', 'config/jica-priority-country-registry.json',
  'config/jica-priority-source-preflight.json', 'config/country-source-registry.json',
  'config/world-country-area-registry.json', 'config/world-source-preflight.json',
  'docs/research/world-2026/WORLD_SOURCE_PREFLIGHT_250.md', 'scripts/update-world-source-preflight.py',
  'config/americas-verified-source-recipes.json', 'docs/research/americas-2026/VERIFIED_SOURCE_RECIPES_28.md',
  'scripts/create-country.mjs', 'scripts/source-plan.mjs', 'scripts/verify-delivery.mjs',
];
const completionEntrypoints = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'prompts/ANTIGRAVITY.md', 'prompts/CODEX.md', 'prompts/CLAUDE_CODE.md'];
const references = ['DOM', 'UGA', 'LAO', 'BGD'];

function assert(condition, message) { if (!condition) throw new Error(message); }
function occurrences(source, needle) { return source.split(needle).length - 1; }

export async function verifyKitReadiness(base = root) {
  for (const relative of requiredFiles) await access(path.join(base, relative));
  const prompt = await readFile(path.join(base, 'prompts/ONE_COUNTRY_COMPLETE.md'), 'utf8');
  const code = prompt.match(/```text\s*([\s\S]*?)```/i)?.[1] || '';
  assert(code, 'Canonical prompt must contain one text code block');
  assert(occurrences(code, 'COUNTRY_NAME') === 1, 'Canonical prompt code block must contain exactly one COUNTRY_NAME placeholder');
  for (const phrase of ['docs/COUNTRY_COMPLETION_CONTRACT.md', 'docs/REFERENCE_COUNTRY_CASES.md', 'ready: true', 'Do not stop at setup']) {
    assert(code.includes(phrase), `Canonical prompt is missing required completion phrase: ${phrase}`);
  }
  for (const relative of completionEntrypoints) {
    const source = await readFile(path.join(base, relative), 'utf8');
    assert(source.includes('prompts/ONE_COUNTRY_COMPLETE.md'), `${relative} must point to the canonical prompt`);
    assert(source.includes('docs/COUNTRY_COMPLETION_CONTRACT.md') || source.includes('COUNTRY_COMPLETION_CONTRACT'), `${relative} must bind the completion contract`);
    assert(source.includes('ready: true'), `${relative} must require the final delivery gate`);
    assert(source.includes('DOM') && source.includes('UGA') && source.includes('LAO') && source.includes('BGD'), `${relative} must allow all four reference countries as fresh targets`);
  }

  const catalog = await loadSourceCatalog(base);
  assert(catalog.world_countries_and_areas.length === 250, 'World registry must contain 250 records');
  assert(catalog.world_source_records.length === 250, 'World source-address preflight must contain 250 records');
  assert(catalog.world_registry.counts.un_m49_countries_and_areas === 248, 'World registry must retain 248 UN M49 identities');
  assert(catalog.world_registry.counts.supplemental_operational_identities === 2, 'World registry must retain two explicit supplements');
  assert(catalog.priority_countries.length === 142, 'Priority registry must contain 142 records');
  assert(catalog.priority_source_records.length === 142, 'Priority source-address preflight must contain 142 records');
  assert(catalog.verified_source_recipes.length === 28, 'Americas verified recipe registry must contain 28 records');
  for (const area of catalog.world_countries_and_areas) {
    assert(findWorldCountryRecord(catalog, area.iso3)?.iso3 === area.iso3, `${area.iso3} is not world-resolvable by ISO3`);
    assert(findWorldCountryRecord(catalog, area.name_en)?.iso3 === area.iso3, `${area.iso3} is not world-resolvable by English name`);
    const source = findWorldSourceRecord(catalog, area.iso3);
    assert(source?.national_statistics_and_census?.national_statistics_office?.url, `${area.iso3} lacks a world statistics/census entrypoint`);
    assert(source?.planning_law_and_materials?.legal_catalogue, `${area.iso3} lacks a world planning/legal entrypoint`);
    assert(source?.geography_and_codes?.geoboundaries_adm1_api, `${area.iso3} lacks a world geography/code entrypoint`);
    assert(source?.international_data_candidates?.world_bank_country_api, `${area.iso3} lacks world international-data queries`);
    assert(source.anti_shortcut_rules.length >= 7, `${area.iso3} lacks world anti-shortcut rules`);
    assert(!Object.hasOwn(source, 'observations'), `${area.iso3} source-address preflight must not embed statistical observations`);
  }
  for (const [name, iso3] of [['スペイン', 'ESP'], ['フィンランド', 'FIN'], ['台湾', 'TWN']]) {
    assert(findWorldCountryRecord(catalog, name)?.iso3 === iso3, `${name} does not resolve to ${iso3}`);
    const preflight = buildSourcePreflight(catalog, { id: iso3, name });
    assert(preflight.summary.world_country_specific_entrypoints >= 9, `${iso3} developed-country source pack is too shallow`);
    assert(preflight.summary.acquired_sources === 0, `${iso3} discovery addresses were promoted to acquired data`);
  }
  const names = new Set(), sourceIds = new Set();
  for (const country of catalog.priority_countries) {
    assert(findPriorityCountryRecord(catalog, country.iso3)?.iso3 === country.iso3, `${country.iso3} is not resolvable by ISO3`);
    assert(findPriorityCountryRecord(catalog, country.name_en)?.iso3 === country.iso3, `${country.iso3} is not resolvable by English name`);
    assert(findPriorityCountryRecord(catalog, country.jica_name)?.iso3 === country.iso3, `${country.iso3} is not resolvable by JICA name`);
    names.add(country.iso3); sourceIds.add(country.iso3);
    const preflight = buildSourcePreflight(catalog, { id: country.iso3, name: country.name_en });
    assert(preflight.priority_context.status === 'jica_priority_country_or_territory', `${country.iso3} lost JICA priority context`);
    assert(preflight.priority_source_preflight?.national_statistics_and_census?.national_statistics_office?.url, `${country.iso3} lacks a statistics/census entrypoint`);
    assert(preflight.priority_source_preflight?.planning_law_and_materials?.legal_catalogue, `${country.iso3} lacks a planning/legal discovery entrypoint`);
    assert(preflight.priority_source_preflight?.geography_and_codes?.geoboundaries_adm1_api, `${country.iso3} lacks a geography/code discovery entrypoint`);
    assert(preflight.priority_source_preflight?.international_data_candidates?.world_bank_country_api, `${country.iso3} lacks international-data queries`);
    assert(preflight.reference_country_cases.length === 4, `${country.iso3} preflight lost the four reference lessons`);
  }
  assert(names.size === 142 && sourceIds.size === 142, 'Priority readiness audit must cover 142 unique identities and source preflights');
  for (const iso3 of references) {
    assert(findCountrySourceRecord(catalog, iso3), `${iso3} must retain its detailed country-source record`);
    const preflight = buildSourcePreflight(catalog, { id: iso3, name: findPriorityCountryRecord(catalog, iso3).name_en });
    assert(preflight.reference_country_cases.filter(item => item.requested_country).length === 1, `${iso3} must be selectable as a fresh target, not only a lesson`);
  }
  for (const iso3 of ['ARG', 'BRA', 'CAN', 'DOM', 'JAM', 'SGS', 'USA', 'VEN']) {
    const recipe = catalog.verified_source_recipes.find(item => item.iso3 === iso3);
    assert(recipe, `${iso3} must retain its verified Americas source recipe`);
    const preflight = buildSourcePreflight(catalog, { id: iso3, name: recipe.name_en });
    assert(preflight.verified_source_recipe?.current_project_evidence_status === 'not_acquired_by_source_preflight',
      `${iso3} recipe must not be promoted to current-project evidence`);
  }
  return {
    ready: true,
    country_name_only: true,
    world_countries_and_areas: 250,
    un_m49_countries_and_areas: 248,
    world_source_address_preflights: 250,
    developed_and_supplemental_examples: ['ESP', 'FIN', 'TWN'],
    priority_countries_and_territories: 142,
    priority_source_address_preflights: 142,
    verified_americas_source_recipes: 28,
    reference_countries_selectable_as_targets: references,
    canonical_prompt_placeholders: 1,
    required_files_checked: requiredFiles.length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await verifyKitReadiness(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
