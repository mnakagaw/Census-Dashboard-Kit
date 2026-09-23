import path from 'node:path';
import { mkdir, writeFile, lstat, readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { collectCountry } from '../lib/collect.mjs';
import { generateSite } from '../lib/generate.mjs';
import { validateDataset } from '../lib/validate.mjs';
import { writeSourcePreflight, loadSourceCatalog, findCountrySourceRecord, findPriorityCountryRecord, findWorldCountryRecord } from '../lib/source-catalog.mjs';
import { parseArgs, safeSlug, isMain, reportError } from '../lib/cli.mjs';

const repositoryUrl = 'https://github.com/mnakagaw/Census-Dashboard-Kit';
const templateRoot = fileURLToPath(new URL('../', import.meta.url));
const execFileAsync = promisify(execFile);
const sourcePaths = ['.gitattributes', '.github', '.gitignore', 'AGENTS.md', 'README.md', 'START_HERE.md', 'config', 'docs', 'lib', 'package.json', 'package-lock.json', 'prompts', 'references', 'scaffold', 'scripts', 'templates', 'tests'];
const hash = value => createHash('sha256').update(value).digest('hex');

/** Record portable provenance; an archive inside an unrelated checkout is not that checkout's source revision. */
export async function readTemplateReference(root = templateRoot) {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const reference = {
    repository_url: repositoryUrl,
    package_version: pkg.version,
    git_commit: null,
    source_state: { status: 'unavailable', tracked_changes: null, untracked_source_files: null },
    recorded_at: new Date().toISOString(),
  };
  const git = async args => (await execFileAsync('git', args, { cwd: root, windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 })).stdout;
  try {
    const gitRoot = (await git(['rev-parse', '--show-toplevel'])).trim();
    const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
    if (normalize(await realpath(gitRoot)) !== normalize(await realpath(root))) return reference;
    try {
      const commit = (await git(['rev-parse', '--verify', 'HEAD'])).trim();
      if (/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commit)) reference.git_commit = commit;
    } catch { /* A newly initialized checkout can have source changes but no commit yet. */ }
    const entries = (await git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...sourcePaths])).split('\0');
    let tracked = false, untracked = 0;
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i]) continue;
      const state = entries[i].slice(0, 2);
      if (state === '??') untracked++;
      else { tracked = true; if (/[RC]/.test(state)) i++; }
    }
    reference.source_state = { status: tracked || untracked ? 'dirty' : 'clean', tracked_changes: tracked, untracked_source_files: untracked };
  } catch { /* Do not include host paths or command error messages in a distributed artifact. */ }
  return reference;
}

function portableLinks(markdown, sourcePath, artifactPath, destinations, reference) {
  return markdown.replace(/(\[[^\]\n]*\]\()([^\s)]+)(\))/g, (match, before, target, after) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return match;
    const hashAt = target.indexOf('#'), file = hashAt < 0 ? target : target.slice(0, hashAt), anchor = hashAt < 0 ? '' : target.slice(hashAt);
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), file));
    if (resolved.startsWith('../') || path.posix.isAbsolute(resolved)) return match;
    const destination = destinations.get(resolved);
    const url = destination
      ? path.posix.relative(path.posix.dirname(artifactPath), destination) + anchor
      : `${repositoryUrl}/blob/${reference.git_commit || 'main'}/${resolved.split('/').map(encodeURIComponent).join('/')}${anchor}`;
    return before + url + after;
  });
}

async function writeContinuationBundle(outDir) {
  const reference = await readTemplateReference();
  const destinations = new Map([['docs/COUNTRY_AGENT_WORKFLOW.md', 'COUNTRY_AGENT_WORKFLOW.md']]);
  // Bundle the operative contract, not historical review files containing another project's machine paths.
  for (const source of ['docs/AI_FAILURE_MODE_REVIEW.md', 'docs/COUNTRY_COMPLETION_CONTRACT.md', 'docs/COUNTRY_NAME_ONLY_ACCEPTANCE.md', 'docs/REFERENCE_COUNTRY_CASES.md', 'docs/SOURCE_ADAPTER_GUIDE.md', 'docs/COMMON_DATA_AND_SOURCE_REGISTRY.md', 'docs/AREADATA_SOURCE_FEEDBACK.md', 'docs/IMPLEMENTATION_CONTRACT.md', 'docs/PLANNING_DATA_CONTRACT.md', 'docs/ANALYSIS_DATA_CONTRACT.md', 'docs/CENSUS_SERIES_CONTRACT.md', 'docs/PLANNING_CENSUS_METHOD.md', 'docs/02_COMMON_SPEC.md', 'docs/03_COUNTRY_AND_DATA.md', 'templates/ACCEPTANCE.md', 'templates/COUNTRY_START.md', 'templates/TASK_AND_CHANGE.md', 'templates/PLANNING_CENSUS_AUDIT.md', 'templates/SOURCE_TABLE_INVENTORY.json', 'templates/SOURCE_RESOURCE_INVENTORY.json', 'templates/THEME_COVERAGE.json', 'templates/DELIVERY.json', 'templates/country-profile.json']) {
    destinations.set(source, `reference/${source}`);
  }
  reference.documentation = [];
  reference.notes = [
    'Bundled references are the source documents used by this generation. They do not establish UX acceptance or completed country collection.',
    reference.git_commit ? 'The recorded commit identifies the checkout base; dirty source changes are not represented by that commit.' : 'No template commit could be verified. Remote fallback links use main and cannot reproduce an exact source revision.',
  ];
  for (const [source, destination] of destinations) {
    const original = await readFile(path.join(templateRoot, source), 'utf8');
    let content = source.endsWith('.md') ? portableLinks(original, source, destination, destinations, reference) : original;
    if (source === 'docs/COUNTRY_AGENT_WORKFLOW.md') {
      content = content.replace(/^国別出力のルートへコピーされた[^\n]+/m,
        'この国別出力では補助資料を`reference/docs/`、開始・受入様式を`reference/templates/`に同梱している。`TEMPLATE_REFERENCE.json`にテンプレートURL・参照commit・未commit変更の状態を記録した。`scripts/`と`lib/`はそのテンプレートcheckout内で参照する。commitが不明またはsourceがdirtyなら完全な再現は未保証とし、同梱資料と現物を確認して再開する。国別データを初期化しない。');
      content = content.replace(/`templates\/COUNTRY_START\.md`/g, '`reference/templates/COUNTRY_START.md`');
    }
    await mkdir(path.dirname(path.join(outDir, destination)), { recursive: true });
    await writeFile(path.join(outDir, destination), content, 'utf8');
    reference.documentation.push({ source_path: source, artifact_path: destination, source_sha256: hash(original), artifact_sha256: hash(content) });
  }
  await writeFile(path.join(outDir, 'TEMPLATE_REFERENCE.json'), JSON.stringify(reference, null, 2) + '\n');
}

export async function createCountry({ country, out, collect = collectCountry, generate = generateSite }) {
  if (typeof country !== 'string' || !country.trim()) throw new Error('Provide --country <country name or ISO code>');
  const outDir = path.resolve(out || path.join('generated', safeSlug(country)));
  try { await lstat(outDir); throw new Error(`Output already exists; choose a new directory: ${outDir}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path.dirname(outDir), { recursive: true });
  await mkdir(outDir); // Exclusive creation protects another concurrent invocation.
  const rawDir = path.join(outDir, 'raw');
  await mkdir(rawDir);
  try {
    let collectionCountry = country, requestedCountry = country, identity = null;
    if (collect === collectCountry) {
      const catalog = await loadSourceCatalog();
      const countrySource = findCountrySourceRecord(catalog, country);
      const priority = findPriorityCountryRecord(catalog, country);
      const world = findWorldCountryRecord(catalog, country);
      const resolved = countrySource || priority || world;
      if (resolved) {
        collectionCountry = resolved.iso3;
        identity = { iso3: resolved.iso3, iso2: world?.iso2 || priority?.iso2, name: countrySource?.names?.[0] || world?.name_en || priority?.name_en || resolved.iso3 };
      }
    }
    const dataset = await collect({ country: collectionCountry, requestedCountry, identity, rawDir, onProgress: message => console.log(message) });
    const validation = validateDataset(dataset);
    await mkdir(path.join(outDir, 'evidence'), { recursive: true });
    await writeFile(path.join(outDir, 'evidence', 'validation.json'), JSON.stringify({ ...validation, checked_at: new Date().toISOString(), dataset_sha256: createHash('sha256').update(JSON.stringify(dataset)).digest('hex') }, null, 2) + '\n');
    if (validation.errors.length) throw new Error(`Collected data failed validation: ${validation.errors.join('; ')}`);
    await mkdir(path.join(outDir, 'data'), { recursive: true });
    await writeFile(path.join(outDir, 'data', 'dashboard.json'), JSON.stringify(dataset, null, 2) + '\n');
    const sourcePreflight = await writeSourcePreflight(outDir, dataset.country);
    await generate({ dataset, outDir });
    // Store the completion contract with the internal workspace so the AI continues without a user follow-up.
    await writeContinuationBundle(outDir);
    await writeFile(path.join(outDir, 'evidence', 'WORK_STATUS.json'), JSON.stringify({status:'research_required',country_id:dataset.country.id,prepared_at:new Date().toISOString(),message:'Internal workspace preparation completed. Do not show this site as the user delivery. Continue source-ladder research, full table and field inventory, six-theme coverage, geography matching, law-aligned Word outline, integration, browser/output verification, then create DELIVERY.json and pass verify-delivery.mjs.'},null,2)+'\n');
    await writeFile(path.join(outDir, 'AGENTS.md'), `# Country project\n\nCountry: ${dataset.country.name} (${dataset.country.id}).\n\nThe user requested one finished country dashboard, not a staged handoff. Read COUNTRY_AGENT_WORKFLOW.md, reference/docs/COUNTRY_COMPLETION_CONTRACT.md, reference/docs/COUNTRY_NAME_ONLY_ACCEPTANCE.md, reference/docs/REFERENCE_COUNTRY_CASES.md, reference/docs/AI_FAILURE_MODE_REVIEW.md, evidence/SOURCE_PREFLIGHT.md, TEMPLATE_REFERENCE.json, the bundled reference/docs and reference/templates, and HANDOFF.md if present. DOM, UGA, LAO and BGD are both reference cases and valid fresh targets; if this is one of them, refresh current sources and build a new result rather than returning the stored example. The current generated files are an internal workspace only. Never present or open them as the final result while evidence/WORK_STATUS.json says research_required. Use world_source_preflight as the mandatory starting-address checklist for every country or area; use priority_source_preflight as an additional JICA-specific supplement when present. Neither is proof that a law, table or dataset was acquired or verified. Refresh country sources and follow the source ladder beyond the easiest population file. Inspect the official census catalogue and detailed tables, every resource listed on each dataset page (including all available ADM0/ADM1/ADM2 files, explanatory notes and age-sex tables), all sheets/tables/numeric fields of acquired sources, official codes and selectable-level boundaries, and all six themes in reference/templates/THEME_COVERAGE.json. For register-based systems, inventory the current official annual register tables instead of treating the absence of a decennial questionnaire as missing census evidence. Record adopted and rejected fields in evidence/SOURCE_TABLE_INVENTORY.json and do not leave a usable candidate unintegrated. When regional age-sex data exist, render a population pyramid for every matched area. Research the planning system and actual materials at the correct national, federal, devolved, regional and local levels, and verify the country plan index against law, regulations, official guidance and forms. Add planning.source_groups for law, census and international source links. Add a cited planning.document_template, adopt docx, generate a selected-area Word sample titled “Territorial Development Planning Diagnostic” for non-Spanish-speaking countries or “Diagnóstico Territorial para la Planificación del Desarrollo” for Spanish-speaking countries. For non-Spanish-speaking countries, make the filename, title, headings, fixed prose and displayed indicator labels English; retain proper geographic names in their source spelling. Include at least the territorial diagnostic, population pyramid when available, latest acquired theme values with years and the three source groups, render every page with the isolated renderer, and record the review. Adapt all three pages: the site root is the national Territorial Diagnostic; the header brand resets to that national diagnostic while preserving the indicator; the other menu roles are Thematic Diagnostic and the generic Planning Materials and Links. Do not label the site or output as an official government site or plan. Offer thematic comparison only at geographic levels with actual observations. If a parent has no direct value but children do, state the parent's missing value separately from the child comparison. Label every derived value as Dashboard calculated on screen, CSV and Word. Verify browser behavior, compact no-boundary and all-missing states, stable URLs, language consistency and downloads. Copy reference/templates/DELIVERY.json to evidence/DELIVERY.json only after the recorded checks are true, then run the template script verify-delivery.mjs. Do not return a completion message unless that command passes. SOURCE_PREFLIGHT is a discovery plan, not proof of acquisition or suitability. Never distribute national values across local territories. Keep census, register, sample survey, humanitarian observation and modeled grid values as different evidence types. Keep national context separate from local observations and preserve the DDPT page roles and synchronized selection. Reference: ${repositoryUrl}\n\nDo not overwrite the source template repository. Do not use host Microsoft Word COM. Publish only within the current user's requested destination and authorization.\n`);
    console.log(`Created: ${outDir}`);
    console.log(`Collection: ${dataset.collection.status}; observations: ${dataset.observations.filter(o => o.status === 'observed').length}; territories: ${dataset.territories.length}`);
    console.log('Internal workspace prepared. Do not return it to the user as the deliverable. Continue COUNTRY_AGENT_WORKFLOW.md now; finish research, integration and real browser/output checks, then pass verify-delivery.mjs.');
    return { outDir, dataset, validation, sourcePreflight };
  } catch (error) {
    await writeFile(path.join(outDir, 'COLLECTION_FAILED.txt'), `${new Date().toISOString()}\n${error.message}\nExisting evidence has been retained. Use a new output directory for a fresh collection.\n`);
    throw error;
  }
}

if (isMain(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2), ['country', 'out']);
    if (args.help) console.log('node scripts/create-country.mjs --country "Uganda" [--out generated/uganda]\nPrepares an internal country workspace. The AI must continue the country workflow and pass the delivery gate before reporting completion.');
    else {
      const result = await createCountry(args);
      if (!result.dataset.observations.some(o => o.status === 'observed')) console.warn('No numeric value was collected by the initial adapters. Continue the required official-source research; this internal workspace is not a delivery.');
    }
  } catch (error) { reportError(error); }
}
