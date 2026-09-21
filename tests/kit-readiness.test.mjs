import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyKitReadiness } from '../scripts/verify-kit-readiness.mjs';

test('country-name-only kit has world discovery coverage plus the 142-country priority supplement', async () => {
  const result = await verifyKitReadiness();
  assert.equal(result.ready, true);
  assert.equal(result.country_name_only, true);
  assert.equal(result.world_countries_and_areas, 250);
  assert.equal(result.world_source_address_preflights, 250);
  assert.deepEqual(result.developed_and_supplemental_examples, ['ESP', 'FIN', 'TWN']);
  assert.equal(result.priority_countries_and_territories, 142);
  assert.equal(result.priority_source_address_preflights, 142);
  assert.equal(result.verified_americas_source_recipes, 28);
  assert.equal(result.canonical_prompt_placeholders, 1);
  assert.deepEqual(result.reference_countries_selectable_as_targets, ['DOM', 'UGA', 'LAO', 'BGD']);
});
