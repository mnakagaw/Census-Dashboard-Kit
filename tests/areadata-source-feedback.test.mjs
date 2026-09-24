import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importAreaDataSourceFeedback } from '../scripts/import-areadata-source-feedback.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));

async function workspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kit-areadata-feedback-'));
  await mkdir(path.join(root, 'config'));
  await cp(path.join(repository, 'config', 'world-country-area-registry.json'), path.join(root, 'config', 'world-country-area-registry.json'), { recursive: true });
  await writeFile(path.join(root, 'config', 'areadata-source-feedback.json'), JSON.stringify({
    schema_version: '1.0',
    as_of: '2026-09-23',
    status_boundary: 'Test registry only; imported sources are not current-project acquisitions.',
    records: [],
  }, null, 2) + '\n');
  return root;
}

function bundle(overrides = {}) {
  return {
    schema_version: '1.0',
    produced_by: 'AreaData',
    exported_at: '2026-09-23T12:00:00Z',
    origin_commit: 'a'.repeat(40),
    sources: [{
      iso3: 'DZA',
      source_id: 'DZA_ONS_RGPH',
      role: 'census_catalog',
      title: 'RGPH census catalogue',
      publisher: 'Office national des statistiques',
      url: 'https://www.ons.dz/spip.php?rubrique390',
      authority_type: 'official_national',
      evidence_stage: 'official_location_verified',
      checked_at: '2026-09-23',
      geographic_levels: ['national'],
      reference_periods: ['2022 listing', '2008 linked edition'],
      formats: ['HTML'],
      license_or_terms: null,
      reuse_note: 'Refresh the catalogue and keep the unlinked 2022 listing separate from the linked 2008 edition.',
      origin_evidence_path: 'evidence/DZA/SOURCE_RESOURCE_INVENTORY.json',
      artifact_sha256: null,
      ...overrides,
    }],
  };
}

test('AreaData feedback import is validated, normalized and idempotent', async () => {
  const root = await workspace();
  try {
    const input = path.join(root, 'bundle.json');
    await writeFile(input, `${JSON.stringify(bundle(), null, 2)}\n`);
    const first = await importAreaDataSourceFeedback({ root, input });
    assert.deepEqual(first, { accepted: 1, inserted: 1, updated: 0, unchanged: 0, total: 1, changed: true, dry_run: false });
    const registry = JSON.parse(await readFile(path.join(root, 'config', 'areadata-source-feedback.json'), 'utf8'));
    assert.equal(registry.records[0].iso3, 'DZA');
    assert.match(registry.records[0].feedback_id, /^AREADATA_DZA_[0-9A-F]{16}$/);
    assert.equal(registry.records[0].current_project_evidence_status, 'not_acquired_by_kit_preflight');
    assert.equal(registry.records[0].origin_events[0].origin_commit, 'a'.repeat(40));
    assert.equal(Object.hasOwn(registry.records[0], 'observations'), false);
    const second = await importAreaDataSourceFeedback({ root, input });
    assert.deepEqual(second, { accepted: 1, inserted: 0, updated: 0, unchanged: 1, total: 1, changed: false, dry_run: false });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('AreaData feedback dry-run does not write and unsafe identities or URLs are rejected', async () => {
  const root = await workspace();
  try {
    const input = path.join(root, 'bundle.json');
    const registryPath = path.join(root, 'config', 'areadata-source-feedback.json');
    const before = await readFile(registryPath, 'utf8');
    await writeFile(input, `${JSON.stringify(bundle(), null, 2)}\n`);
    const result = await importAreaDataSourceFeedback({ root, input, dryRun: true });
    assert.equal(result.changed, true);
    assert.equal(await readFile(registryPath, 'utf8'), before);

    await writeFile(input, `${JSON.stringify(bundle({ iso3: 'ZZZ' }), null, 2)}\n`);
    await assert.rejects(() => importAreaDataSourceFeedback({ root, input, dryRun: true }), /not in the Kit world registry/);
    await writeFile(input, `${JSON.stringify(bundle({ url: 'https://example.org/data?api_key=secret' }), null, 2)}\n`);
    await assert.rejects(() => importAreaDataSourceFeedback({ root, input, dryRun: true }), /credential-like query parameters/);
    await writeFile(input, `${JSON.stringify(bundle({ url: 'http://192.168.1.10/data' }), null, 2)}\n`);
    await assert.rejects(() => importAreaDataSourceFeedback({ root, input, dryRun: true }), /local or private address/);
    await writeFile(input, `${JSON.stringify(bundle({ checked_at: '2026-02-30' }), null, 2)}\n`);
    await assert.rejects(() => importAreaDataSourceFeedback({ root, input, dryRun: true }), /real calendar date/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a corrected URL preserves the old record but removes it from active leads', async () => {
  const root = await workspace();
  try {
    const input = path.join(root, 'bundle.json');
    const oldUrl = 'https://www.ons.dz/old-census-page';
    const newUrl = 'https://www.ons.dz/spip.php?rubrique390';
    await writeFile(input, `${JSON.stringify(bundle({ url: oldUrl }))}\n`);
    await importAreaDataSourceFeedback({ root, input });
    await writeFile(input, `${JSON.stringify(bundle({ url: newUrl, supersedes_url: oldUrl }))}\n`);
    const result = await importAreaDataSourceFeedback({ root, input });
    assert.equal(result.total, 2);
    const registry = JSON.parse(await readFile(path.join(root, 'config', 'areadata-source-feedback.json'), 'utf8'));
    const oldRecord = registry.records.find(record => record.url === oldUrl);
    const newRecord = registry.records.find(record => record.url === newUrl);
    assert.equal(oldRecord.superseded_by, newRecord.feedback_id);
    assert.equal(newRecord.supersedes_feedback_id, oldRecord.feedback_id);
    const again = await importAreaDataSourceFeedback({ root, input });
    assert.equal(again.changed, false);
    await writeFile(input, `${JSON.stringify(bundle({ url: 'https://www.ons.dz/another', supersedes_url: 'https://www.ons.dz/missing' }))}\n`);
    await assert.rejects(() => importAreaDataSourceFeedback({ root, input, dryRun: true }), /unknown feedback record/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
