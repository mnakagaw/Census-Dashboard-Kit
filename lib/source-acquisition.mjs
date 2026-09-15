import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function invariant(value, message) {
  if (!value) throw new Error(`Invalid acquisition manifest: ${message}`);
}

function publicHttps(value, field) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`Invalid acquisition manifest: ${field} is not a URL`); }
  invariant(url.protocol === 'https:' && !url.username && !url.password, `${field} must be a public HTTPS URL without credentials`);
}

export function validateSourceManifest(manifest) {
  invariant(manifest?.schema_version === '1.0', 'schema_version must be 1.0');
  invariant(/^[A-Z]{3}$/.test(manifest?.country?.iso3), 'country.iso3 must be ISO alpha-3');
  invariant(manifest.country.name && manifest.checked_at && manifest.scope, 'country name, checked_at and scope are required');
  invariant(Array.isArray(manifest.sources) && manifest.sources.length, 'sources are required');
  const ids = new Set();
  for (const source of manifest.sources) {
    invariant(/^[A-Z0-9][A-Z0-9_]+$/.test(source?.id), 'source id must be stable uppercase snake case');
    invariant(!ids.has(source.id), `duplicate source id ${source.id}`);
    ids.add(source.id);
    invariant(source.role && source.title && source.publisher && source.format, `${source.id} metadata is incomplete`);
    publicHttps(source.catalog_url, `${source.id}.catalog_url`);
    publicHttps(source.download_url, `${source.id}.download_url`);
    invariant(source.format === 'pdf', `${source.id} unsupported format ${source.format}`);
    invariant(source.expected_content_type === 'application/pdf', `${source.id} expected_content_type must be application/pdf`);
    invariant(Number.isInteger(source.minimum_bytes) && source.minimum_bytes > 4, `${source.id} minimum_bytes is invalid`);
    invariant(source.redistribution && source.note, `${source.id} reuse metadata is incomplete`);
  }
  return manifest;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function fetchBytes(source, fetchImpl, timeoutMs) {
  const requestedAt = new Date().toISOString();
  const response = await fetchImpl(source.download_url, {
    redirect: 'follow',
    headers: { 'user-agent': 'Census-Dashboard-Kit/1.5 (+official source acquisition)' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${source.id} returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType !== source.expected_content_type) throw new Error(`${source.id} returned ${contentType || 'no content type'}, expected ${source.expected_content_type}`);
  if (bytes.length < source.minimum_bytes) throw new Error(`${source.id} returned only ${bytes.length} bytes`);
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`${source.id} response is not a PDF file`);
  return { bytes, requestedAt, retrievedAt: new Date().toISOString(), contentType, finalUrl: response.url || source.download_url, httpStatus: response.status };
}

export async function acquireSourceManifest({ manifest, projectDir, fetchImpl = fetch, timeoutMs = 180000 }) {
  validateSourceManifest(manifest);
  const project = path.resolve(projectDir);
  const rawRoot = path.join(project, 'raw', 'official', manifest.country.iso3.toLowerCase());
  const receiptRoot = path.join(project, 'evidence', 'source-receipts');
  await Promise.all([mkdir(rawRoot, { recursive: true }), mkdir(receiptRoot, { recursive: true })]);
  const results = [];
  for (const source of manifest.sources) {
    try {
      const downloaded = await fetchBytes(source, fetchImpl, timeoutMs);
      const digest = sha256(downloaded.bytes);
      const relativeRaw = path.posix.join('raw', 'official', manifest.country.iso3.toLowerCase(), source.id.toLowerCase(), `${digest.slice(0, 16)}.${source.format}`);
      const absoluteRaw = path.join(project, ...relativeRaw.split('/'));
      await mkdir(path.dirname(absoluteRaw), { recursive: true });
      await writeFile(absoluteRaw, downloaded.bytes, { flag: 'wx' }).catch(async error => {
        if (error.code !== 'EEXIST') throw error;
        const existing = await readFile(absoluteRaw);
        if (sha256(existing) !== digest) throw new Error(`${source.id} immutable raw path collision`);
      });
      const receipt = {
        source_id: source.id,
        role: source.role,
        country_iso3: manifest.country.iso3,
        title: source.title,
        publisher: source.publisher,
        catalog_url: source.catalog_url,
        requested_url: source.download_url,
        final_url: downloaded.finalUrl,
        requested_at: downloaded.requestedAt,
        retrieved_at: downloaded.retrievedAt,
        status: 'downloaded',
        http_status: downloaded.httpStatus,
        content_type: downloaded.contentType,
        bytes: downloaded.bytes.length,
        sha256: digest,
        raw_path: relativeRaw,
        redistribution: source.redistribution,
        note: source.note,
      };
      const relativeReceipt = path.posix.join('evidence', 'source-receipts', `${source.id.toLowerCase()}-${digest.slice(0, 16)}.json`);
      await writeFile(path.join(project, ...relativeReceipt.split('/')), `${JSON.stringify(receipt, null, 2)}\n`);
      results.push({ ...receipt, receipt_path: relativeReceipt });
    } catch (error) {
      results.push({
        source_id: source.id,
        role: source.role,
        country_iso3: manifest.country.iso3,
        title: source.title,
        publisher: source.publisher,
        catalog_url: source.catalog_url,
        requested_url: source.download_url,
        status: 'failed',
        checked_at: new Date().toISOString(),
        error: error.message,
        note: source.note,
      });
    }
  }
  const summary = {
    schema_version: '1.0',
    country: manifest.country,
    generated_at: new Date().toISOString(),
    manifest_checked_at: manifest.checked_at,
    scope: manifest.scope,
    result: results.every(item => item.status === 'downloaded') ? 'complete_for_manifest' : results.some(item => item.status === 'downloaded') ? 'partial_for_manifest' : 'failed',
    counts: {
      listed: results.length,
      downloaded: results.filter(item => item.status === 'downloaded').length,
      failed: results.filter(item => item.status === 'failed').length,
    },
    sources: results,
    caveat: 'Completion applies only to this acquisition manifest. It does not establish complete census, planning, geography or thematic coverage for the country dashboard.',
  };
  return summary;
}

export function renderAcquisitionMarkdown(summary) {
  const rows = summary.sources.map(source => `| ${source.source_id} | ${source.role || ''} | ${source.title} | ${source.status} | ${source.bytes ?? ''} | ${source.sha256 ?? ''} | ${source.raw_path ?? ''} |`);
  return [
    `# Official source acquisition: ${summary.country.name} (${summary.country.iso3})`,
    '',
    `Generated: ${summary.generated_at}`,
    '',
    summary.scope,
    '',
    `Result: **${summary.result}** — ${summary.counts.downloaded}/${summary.counts.listed} downloaded; ${summary.counts.failed} failed.`,
    '',
    '| Source ID | Role | Title | Status | Bytes | SHA-256 | Raw path |',
    '|---|---|---|---|---:|---|---|',
    ...rows,
    '',
    summary.caveat,
    '',
  ].join('\n');
}
