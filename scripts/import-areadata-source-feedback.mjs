import { createHash } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const registryPath = 'config/areadata-source-feedback.json';
const worldRegistryPath = 'config/world-country-area-registry.json';
const allowedTopLevel = new Set(['schema_version', 'produced_by', 'exported_at', 'origin_commit', 'sources']);
const allowedSourceFields = new Set([
  'iso3', 'source_id', 'role', 'title', 'publisher', 'url', 'authority_type', 'evidence_stage', 'checked_at',
  'geographic_levels', 'reference_periods', 'formats', 'license_or_terms', 'reuse_note', 'origin_evidence_path', 'artifact_sha256',
]);
const roles = new Set([
  'official_statistics_office', 'census_catalog', 'census_results', 'table_catalog', 'machine_readable_data',
  'administrative_codes', 'boundaries', 'planning_law', 'planning_guidance',
  'plans_budgets_implementation_evaluation', 'international_complement',
]);
const authorityTypes = new Set([
  'official_national', 'official_subnational', 'official_territorial', 'international_organization', 'administering_authority',
]);
const stages = [
  'official_location_identified', 'official_location_verified', 'source_acquired', 'content_inspected',
  'geography_matched', 'indicator_adopted_in_areadata',
];
const stageRank = new Map(stages.map((stage, index) => [stage, index]));

function invariant(value, message) {
  if (!value) throw new Error(`Invalid AreaData source feedback: ${message}`);
}

function exactKeys(object, allowed, label) {
  invariant(object && typeof object === 'object' && !Array.isArray(object), `${label} must be an object`);
  const unknown = Object.keys(object).filter(key => !allowed.has(key));
  invariant(!unknown.length, `${label} contains unsupported fields: ${unknown.join(', ')}`);
}

function text(value, label) {
  invariant(typeof value === 'string' && value.trim(), `${label} must be a non-empty string`);
  invariant(value === value.trim(), `${label} must not contain leading or trailing whitespace`);
  return value;
}

function date(value, label, dateTime = false) {
  text(value, label);
  const pattern = dateTime ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/ : /^\d{4}-\d{2}-\d{2}$/;
  const parsed = Date.parse(value);
  invariant(pattern.test(value) && !Number.isNaN(parsed), `${label} must be a valid ${dateTime ? 'UTC date-time' : 'date'}`);
  if (!dateTime) invariant(new Date(parsed).toISOString().slice(0, 10) === value, `${label} must be a real calendar date`);
  return value;
}

function list(value, label) {
  invariant(Array.isArray(value), `${label} must be an array`);
  const result = value.map((item, index) => text(item, `${label}[${index}]`));
  invariant(new Set(result).size === result.length, `${label} must not contain duplicates`);
  return result.sort((a, b) => a.localeCompare(b, 'en'));
}

function publicUrl(value, label) {
  let url;
  try { url = new URL(text(value, label)); } catch { throw new Error(`Invalid AreaData source feedback: ${label} is not a URL`); }
  invariant(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, `${label} must be a public HTTP(S) URL without credentials`);
  const host = url.hostname.toLowerCase();
  invariant(host && !['localhost', '::1', '[::1]', '0.0.0.0'].includes(host) && !host.endsWith('.local')
    && !/^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host),
  `${label} must not point to a local or private address`);
  for (const key of url.searchParams.keys()) {
    invariant(!/(?:api[-_]?key|token|password|passwd|secret|signature|credential)/i.test(key), `${label} must not contain credential-like query parameters`);
  }
  return url.href;
}

function safeEvidencePath(value, label) {
  text(value, label);
  invariant(!path.isAbsolute(value) && !/^[A-Za-z]:/.test(value), `${label} must be repository-relative`);
  const normalized = value.replaceAll('\\', '/');
  invariant(!normalized.split('/').includes('..'), `${label} must not leave the AreaData repository`);
  return normalized;
}

function feedbackId(source) {
  const key = `${source.iso3}\n${source.role}\n${source.url}`;
  return `AREADATA_${source.iso3}_${createHash('sha256').update(key).digest('hex').slice(0, 16).toUpperCase()}`;
}

function normalizeSource(source, bundle, worldIds, index) {
  exactKeys(source, allowedSourceFields, `sources[${index}]`);
  const iso3 = text(source.iso3, `sources[${index}].iso3`);
  invariant(/^[A-Z]{3}$/.test(iso3) && worldIds.has(iso3), `sources[${index}].iso3 is not in the Kit world registry`);
  const role = text(source.role, `sources[${index}].role`);
  invariant(roles.has(role), `sources[${index}].role is unsupported`);
  const authorityType = text(source.authority_type, `sources[${index}].authority_type`);
  invariant(authorityTypes.has(authorityType), `sources[${index}].authority_type is unsupported`);
  const evidenceStage = text(source.evidence_stage, `sources[${index}].evidence_stage`);
  invariant(stageRank.has(evidenceStage), `sources[${index}].evidence_stage is unsupported`);
  const checkedAt = date(source.checked_at, `sources[${index}].checked_at`);
  invariant(checkedAt <= bundle.exported_at.slice(0, 10), `sources[${index}].checked_at cannot be after exported_at`);
  const artifactSha256 = source.artifact_sha256 ?? null;
  invariant(artifactSha256 === null || /^[0-9a-f]{64}$/.test(artifactSha256), `sources[${index}].artifact_sha256 must be null or lowercase SHA-256`);
  const normalized = {
    iso3,
    source_id: text(source.source_id, `sources[${index}].source_id`),
    role,
    title: text(source.title, `sources[${index}].title`),
    publisher: text(source.publisher, `sources[${index}].publisher`),
    url: publicUrl(source.url, `sources[${index}].url`),
    authority_type: authorityType,
    evidence_stage: evidenceStage,
    checked_at: checkedAt,
    geographic_levels: list(source.geographic_levels, `sources[${index}].geographic_levels`),
    reference_periods: list(source.reference_periods, `sources[${index}].reference_periods`),
    formats: list(source.formats, `sources[${index}].formats`),
    license_or_terms: source.license_or_terms === null || source.license_or_terms === undefined
      ? null : text(source.license_or_terms, `sources[${index}].license_or_terms`),
    reuse_note: text(source.reuse_note, `sources[${index}].reuse_note`),
    origin_evidence_path: safeEvidencePath(source.origin_evidence_path, `sources[${index}].origin_evidence_path`),
    artifact_sha256: artifactSha256,
  };
  invariant(/^[A-Z0-9][A-Z0-9_.-]+$/.test(normalized.source_id), `sources[${index}].source_id is invalid`);
  const event = {
    origin_commit: bundle.origin_commit,
    exported_at: bundle.exported_at,
    evidence_path: normalized.origin_evidence_path,
    evidence_stage: normalized.evidence_stage,
    artifact_sha256: normalized.artifact_sha256,
  };
  return {
    feedback_id: feedbackId(normalized),
    iso3: normalized.iso3,
    source_id: normalized.source_id,
    role: normalized.role,
    title: normalized.title,
    publisher: normalized.publisher,
    url: normalized.url,
    authority_type: normalized.authority_type,
    evidence_stage: normalized.evidence_stage,
    first_seen_at: normalized.checked_at,
    last_verified_at: normalized.checked_at,
    geographic_levels: normalized.geographic_levels,
    reference_periods: normalized.reference_periods,
    formats: normalized.formats,
    license_or_terms: normalized.license_or_terms,
    reuse_note: normalized.reuse_note,
    current_project_evidence_status: 'not_acquired_by_kit_preflight',
    origin_events: [event],
  };
}

function validateBundle(bundle, worldIds) {
  exactKeys(bundle, allowedTopLevel, 'bundle');
  invariant(bundle.schema_version === '1.0', 'schema_version must be 1.0');
  invariant(bundle.produced_by === 'AreaData', 'produced_by must be AreaData');
  date(bundle.exported_at, 'exported_at', true);
  invariant(/^[0-9a-f]{40}$/.test(bundle.origin_commit || ''), 'origin_commit must be a lowercase 40-character Git commit');
  invariant(Array.isArray(bundle.sources), 'sources must be an array');
  const sources = bundle.sources.map((source, index) => normalizeSource(source, bundle, worldIds, index));
  invariant(new Set(sources.map(source => source.feedback_id)).size === sources.length, 'bundle contains duplicate country/role/URL records');
  return sources;
}

function union(left, right) {
  return [...new Set([...left, ...right])].sort((a, b) => a.localeCompare(b, 'en'));
}

function mergeRecord(existing, incoming) {
  for (const field of ['feedback_id', 'iso3', 'role', 'url', 'publisher', 'authority_type']) {
    invariant(existing[field] === incoming[field], `${incoming.feedback_id} conflicts on stable field ${field}`);
  }
  const incomingIsNewer = incoming.last_verified_at >= existing.last_verified_at;
  const events = [...existing.origin_events, ...incoming.origin_events];
  const uniqueEvents = new Map(events.map(event => [`${event.origin_commit}|${event.evidence_path}|${event.evidence_stage}|${event.artifact_sha256 || ''}`, event]));
  return {
    ...existing,
    source_id: incomingIsNewer ? incoming.source_id : existing.source_id,
    title: incomingIsNewer ? incoming.title : existing.title,
    evidence_stage: stageRank.get(incoming.evidence_stage) > stageRank.get(existing.evidence_stage) ? incoming.evidence_stage : existing.evidence_stage,
    first_seen_at: [existing.first_seen_at, incoming.first_seen_at].sort()[0],
    last_verified_at: [existing.last_verified_at, incoming.last_verified_at].sort().at(-1),
    geographic_levels: union(existing.geographic_levels, incoming.geographic_levels),
    reference_periods: union(existing.reference_periods, incoming.reference_periods),
    formats: union(existing.formats, incoming.formats),
    license_or_terms: incomingIsNewer ? incoming.license_or_terms : existing.license_or_terms,
    reuse_note: incomingIsNewer ? incoming.reuse_note : existing.reuse_note,
    current_project_evidence_status: 'not_acquired_by_kit_preflight',
    origin_events: [...uniqueEvents.values()].sort((a, b) => `${a.exported_at}|${a.origin_commit}`.localeCompare(`${b.exported_at}|${b.origin_commit}`, 'en')),
  };
}

export async function importAreaDataSourceFeedback({ root = defaultRoot, input, dryRun = false } = {}) {
  invariant(input, 'input path is required');
  const base = path.resolve(root);
  const output = path.join(base, registryPath);
  const [bundle, registry, world] = await Promise.all([
    readFile(path.resolve(input), 'utf8').then(JSON.parse),
    readFile(output, 'utf8').then(JSON.parse),
    readFile(path.join(base, worldRegistryPath), 'utf8').then(JSON.parse),
  ]);
  invariant(registry?.schema_version === '1.0' && Array.isArray(registry.records), 'Kit feedback registry is invalid');
  const worldIds = new Set(world.countries_and_areas.map(country => country.iso3));
  const incoming = validateBundle(bundle, worldIds);
  const records = new Map(registry.records.map(record => [record.feedback_id, record]));
  let inserted = 0, updated = 0, unchanged = 0;
  for (const source of incoming) {
    const existing = records.get(source.feedback_id);
    if (!existing) {
      records.set(source.feedback_id, source); inserted++;
      continue;
    }
    const merged = mergeRecord(existing, source);
    if (JSON.stringify(existing) === JSON.stringify(merged)) unchanged++;
    else { records.set(source.feedback_id, merged); updated++; }
  }
  const sorted = [...records.values()].sort((a, b) => `${a.iso3}|${a.role}|${a.url}`.localeCompare(`${b.iso3}|${b.role}|${b.url}`, 'en'));
  const next = {
    ...registry,
    as_of: sorted.map(record => record.last_verified_at).sort().at(-1) || registry.as_of,
    records: sorted,
  };
  const content = `${JSON.stringify(next, null, 2)}\n`;
  const previous = `${JSON.stringify(registry, null, 2)}\n`;
  if (!dryRun && content !== previous) {
    const temporary = `${output}.tmp-${process.pid}`;
    try {
      await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, output);
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    }
  }
  return { accepted: incoming.length, inserted, updated, unchanged, total: sorted.length, changed: content !== previous, dry_run: dryRun };
}

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--input') args.input = argv[++index];
    else if (value === '--dry-run') args.dryRun = true;
    else if (value === '--help') args.help = true;
    else throw new Error(`Unknown option: ${value}`);
  }
  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('node scripts/import-areadata-source-feedback.mjs --input <AreaData feedback.json> [--dry-run]');
    } else {
      console.log(JSON.stringify(await importAreaDataSourceFeedback(args), null, 2));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
