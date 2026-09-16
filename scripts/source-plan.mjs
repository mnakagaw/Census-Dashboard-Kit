import { loadSourceCatalog, findCountrySourceRecord, findPriorityCountryRecord, buildSourcePreflight, renderSourcePreflightMarkdown } from '../lib/source-catalog.mjs';
import { parseArgs, isMain, reportError } from '../lib/cli.mjs';

export async function sourcePlan({ country, theme, format = 'markdown' }) {
  if (!country) throw new Error('Provide --country <ISO3, pre-researched country name, or JICA priority-country name>');
  if (!['markdown', 'json'].includes(format)) throw new Error('--format must be markdown or json');
  const catalog = await loadSourceCatalog();
  const record = findCountrySourceRecord(catalog, country);
  const priority = findPriorityCountryRecord(catalog, country);
  const iso3 = record?.iso3 || priority?.iso3 || String(country).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iso3)) throw new Error('A country outside the researched and JICA priority registries must be specified by ISO3 code.');
  const preflight = buildSourcePreflight(catalog, { id: iso3, name: record?.names?.[0] || priority?.name_en || iso3 }, { theme });
  return format === 'json' ? `${JSON.stringify(preflight, null, 2)}\n` : renderSourcePreflightMarkdown(preflight);
}

if (isMain(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2), ['country', 'theme', 'format']);
    if (args.help) console.log('node scripts/source-plan.mjs --country UGA [--theme refugees] [--format markdown|json]');
    else process.stdout.write(await sourcePlan(args));
  } catch (error) { reportError(error); }
}
