// One-time, exact-string correction for the Lao 2015 source link in separate country projects.
// Source-receipt history is intentionally not rewritten.
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const oldUrl = 'https://www.lsb.gov.la/sdg/en/17-19-2/';
const newUrl = 'https://lao.unfpa.org/en/publications/results-population-and-housing-census-2015-english-version';
const files = ['data/dashboard.json', 'site/data/dashboard.json', 'evidence/THEME_COVERAGE.json'];

const project = process.argv[2];
if (!project) throw new Error('Usage: node scripts/correct-lao-2015-source-link.mjs <existing Lao country project>');
const root = path.resolve(project);
const summary = [];
for (const relative of files) {
  const target = path.join(root, relative);
  const original = await readFile(target, 'utf8');
  const occurrences = original.split(oldUrl).length - 1;
  if (occurrences === 0 && original.includes(newUrl)) {
    summary.push({ file: relative, status: 'already_corrected' });
    continue;
  }
  if (occurrences === 0) throw new Error(`${relative}: old and corrected URLs are both absent`);
  const corrected = original.replaceAll(oldUrl, newUrl);
  JSON.parse(corrected);
  const temporary = `${target}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, corrected, { flag: 'wx' });
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  summary.push({ file: relative, replacements: occurrences });
}
console.log(JSON.stringify({ project: root, summary }, null, 2));
