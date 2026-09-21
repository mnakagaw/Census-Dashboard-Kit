import { loadSourceCatalog, findCountrySourceRecord, findPriorityCountryRecord, findWorldCountryRecord, buildSourcePreflight, renderSourcePreflightMarkdown } from '../lib/source-catalog.mjs';
import { parseArgs, isMain, reportError } from '../lib/cli.mjs';

export async function sourcePlan({ country, theme, format = 'markdown' }) {
  if (!country) throw new Error('Provide --country <ISO3, ISO2, M49, or country/area name>');
  if (!['markdown', 'json'].includes(format)) throw new Error('--format must be markdown or json');
  const catalog = await loadSourceCatalog();
  const record = findCountrySourceRecord(catalog, country);
  const priority = findPriorityCountryRecord(catalog, country);
  const world = findWorldCountryRecord(catalog, country);
  const iso3 = record?.iso3 || priority?.iso3 || world?.iso3;
  if (!iso3) throw new Error('Country or area was not found in the 250-entry world registry. Use an ISO3, ISO2, M49, explicit operational code or recognised country/area name.');
  const preflight = buildSourcePreflight(catalog, { id: iso3, name: record?.names?.[0] || world?.name_en || priority?.name_en || iso3 }, { theme });
  return format === 'json' ? `${JSON.stringify(preflight, null, 2)}\n` : renderSourcePreflightMarkdown(preflight);
}

if (isMain(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2), ['country', 'theme', 'format']);
    if (args.help) console.log('node scripts/source-plan.mjs --country "Spain" [--theme education] [--format markdown|json]');
    else process.stdout.write(await sourcePlan(args));
  } catch (error) { reportError(error); }
}
