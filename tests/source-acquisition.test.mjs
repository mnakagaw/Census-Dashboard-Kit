import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { acquireSourceManifest, validateSourceManifest } from '../lib/source-acquisition.mjs';

const manifest = {
  schema_version: '1.0',
  country: { iso3: 'BGD', name: 'Bangladesh' },
  checked_at: '2026-09-16',
  scope: 'Fixture',
  sources: [{
    id: 'BGD_TEST_PDF', role: 'test', title: 'Test PDF', publisher: 'Test publisher',
    catalog_url: 'https://example.org/catalog', download_url: 'https://example.org/test.pdf',
    format: 'pdf', expected_content_type: 'application/pdf', minimum_bytes: 8,
    redistribution: 'test-only', note: 'Fixture source.',
  }],
};

test('official source acquisition writes immutable raw bytes and a hash receipt', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'source-acquisition-'));
  const bytes = Buffer.from('%PDF-fixture');
  const fetchImpl = async () => new Response(bytes, { status: 200, headers: { 'content-type': 'application/pdf' } });
  const result = await acquireSourceManifest({ manifest, projectDir, fetchImpl });
  assert.equal(result.result, 'complete_for_manifest');
  assert.equal(result.counts.downloaded, 1);
  assert.match(result.sources[0].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(await readFile(path.join(projectDir, ...result.sources[0].raw_path.split('/'))), bytes);
});

test('official source acquisition rejects an HTML error page', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'source-acquisition-'));
  const fetchImpl = async () => new Response('<html>temporarily unavailable</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  const result = await acquireSourceManifest({ manifest, projectDir, fetchImpl });
  assert.equal(result.result, 'failed');
  assert.match(result.sources[0].error, /expected application\/pdf/);
});

test('acquisition manifests require ISO alpha-3 country codes and public HTTPS URLs', () => {
  assert.throws(() => validateSourceManifest({ ...manifest, country: { iso3: 'bd', name: 'Bangladesh' } }), /ISO alpha-3/);
  assert.throws(() => validateSourceManifest({ ...manifest, sources: [{ ...manifest.sources[0], download_url: 'http://example.org/test.pdf' }] }), /public HTTPS/);
});
