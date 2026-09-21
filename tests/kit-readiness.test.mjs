import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyKitReadiness } from '../scripts/verify-kit-readiness.mjs';

test('country-name-only kit is complete for the 142-country priority universe', async () => {
  const result = await verifyKitReadiness();
  assert.equal(result.ready, true);
  assert.equal(result.country_name_only, true);
  assert.equal(result.priority_countries_and_territories, 142);
  assert.equal(result.priority_source_address_preflights, 142);
  assert.equal(result.verified_americas_source_recipes, 28);
  assert.equal(result.canonical_prompt_placeholders, 1);
  assert.deepEqual(result.reference_countries_selectable_as_targets, ['DOM', 'UGA', 'LAO', 'BGD']);
});
