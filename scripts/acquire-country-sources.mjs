import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireSourceManifest, renderAcquisitionMarkdown, validateSourceManifest } from '../lib/source-acquisition.mjs';
import { isMain, parseArgs, reportError } from '../lib/cli.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

export async function acquireCountrySources({ country, project }) {
  if (!/^[A-Za-z]{3}$/.test(country || '')) throw new Error('Provide --country <ISO alpha-3 code>, for example BGD');
  if (!project) throw new Error('Provide --project <country project directory>');
  const iso3 = country.toUpperCase();
  const manifestPath = path.join(root, 'config', 'country-source-manifests', `${iso3.toLowerCase()}.json`);
  const manifest = validateSourceManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
  if (manifest.country.iso3 !== iso3) throw new Error(`Manifest country ${manifest.country.iso3} does not match ${iso3}`);
  const summary = await acquireSourceManifest({ manifest, projectDir: project });
  const evidenceDir = path.join(path.resolve(project), 'evidence');
  await Promise.all([
    writeFile(path.join(evidenceDir, `SOURCE_ACQUISITION_${iso3}.json`), `${JSON.stringify(summary, null, 2)}\n`),
    writeFile(path.join(evidenceDir, `SOURCE_ACQUISITION_${iso3}.md`), renderAcquisitionMarkdown(summary)),
  ]);
  console.log(`${iso3}: ${summary.counts.downloaded}/${summary.counts.listed} official sources downloaded; ${summary.counts.failed} failed.`);
  console.log(`Evidence: ${path.join(evidenceDir, `SOURCE_ACQUISITION_${iso3}.md`)}`);
  if (summary.counts.failed) process.exitCode = 2;
  return summary;
}

if (isMain(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2), ['country', 'project']);
    if (args.help) console.log('node scripts/acquire-country-sources.mjs --country BGD --project <country-project>');
    else await acquireCountrySources(args);
  } catch (error) { reportError(error); }
}
