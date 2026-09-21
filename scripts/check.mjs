import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const roots = ['lib', 'scripts', 'scaffold', 'tests', 'examples'];
let count = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (file.endsWith('.mjs')) {
      const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
      if (result.status !== 0) throw new Error(`Syntax error: ${file}`);
      count++;
    }
  }
}
for (const root of roots) await walk(root);
JSON.parse(await readFile('package.json', 'utf8'));
JSON.parse(await readFile('templates/country-profile.json', 'utf8'));
JSON.parse(await readFile('templates/DELIVERY.json', 'utf8'));
JSON.parse(await readFile('templates/SOURCE_TABLE_INVENTORY.json', 'utf8'));
JSON.parse(await readFile('templates/SOURCE_RESOURCE_INVENTORY.json', 'utf8'));
JSON.parse(await readFile('templates/THEME_COVERAGE.json', 'utf8'));
JSON.parse(await readFile('config/common-subnational-sources.json', 'utf8'));
JSON.parse(await readFile('config/country-source-registry.json', 'utf8'));
JSON.parse(await readFile('config/americas-verified-source-recipes.json', 'utf8'));
JSON.parse(await readFile('config/jica-priority-country-registry.json', 'utf8'));
JSON.parse(await readFile('config/jica-priority-source-preflight.json', 'utf8'));
JSON.parse(await readFile('config/world-country-area-registry.json', 'utf8'));
JSON.parse(await readFile('config/world-source-preflight.json', 'utf8'));

const markdown = [];
async function collectMarkdown(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectMarkdown(file);
    else if (file.endsWith('.md')) markdown.push(file);
  }
}
await collectMarkdown('.');
const completionEntrypoints = [
  'prompts/ONE_COUNTRY_COMPLETE.md',
  'prompts/ANTIGRAVITY.md',
  'prompts/CODEX.md',
  'prompts/CLAUDE_CODE.md',
  'docs/COUNTRY_COMPLETION_CONTRACT.md',
  'AGENTS.md',
  'GEMINI.md',
  'CLAUDE.md'
];
for (const file of completionEntrypoints) {
  const source = await readFile(file, 'utf8');
  if (!source.includes('ready: true')) throw new Error(`Completion entrypoint must require ready: true: ${file}`);
}
const broken = [];
for (const file of markdown) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/!?\[[^\]\n]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    else target = target.split(/\s+/)[0];
    if (!target || target.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue;
    target = target.split('#')[0].split('?')[0];
    try { target = decodeURIComponent(target); } catch { broken.push(`${file}: invalid encoded link ${target}`); continue; }
    try { await access(path.resolve(path.dirname(file), target)); }
    catch { broken.push(`${file}: missing ${target}`); }
  }
}
if (broken.length) throw new Error(`Broken relative Markdown links:\n${broken.join('\n')}`);
console.log(`Syntax checked ${count} JavaScript modules and JSON templates; verified ${markdown.length} Markdown files.`);
