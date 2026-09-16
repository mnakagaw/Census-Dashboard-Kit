import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {escapeHtml, nationalOnly} from '../scaffold/site/model.mjs';
import {planningSettings} from '../scaffold/site/planning.mjs';

const scaffold = fileURLToPath(new URL('../scaffold/site/', import.meta.url));
const pages = {home:'Territorial diagnostic', territorial:'Territorial diagnostic', thematic:'Thematic diagnostic', planning:'Planning materials and links', database:'Data register'};
const primaryPages = new Set(['territorial', 'thematic', 'planning']);

export function pageShell({country, page='home'}) {
  if (!(page in pages)) throw new Error(`Unknown generated page: ${page}`);
  const prefix=page==='home'?'./':'../';
  const renderedPage=page==='home'?'territorial':page;
  const links=Object.entries(pages).filter(([key])=>primaryPages.has(key)).map(([key,label])=>`<a href="${prefix}${key}/" data-page-link="${key}" data-i18n="${escapeHtml(label)}"${key===renderedPage?' aria-current="page"':''}>${escapeHtml(label)}</a>`).join('');
  const locale=/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(country.locale || '')?country.locale:'en';
  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="description" content="${escapeHtml(country.name)} territorial evidence, thematic comparison and source-grounded planning aids. Coverage and missing data remain explicit.">
<title>${escapeHtml(pages[renderedPage])} — ${escapeHtml(country.name)}</title>
<link rel="stylesheet" href="${prefix}assets/styles.css">
<script type="module" src="${prefix}assets/app.mjs"></script>
</head>
<body data-page="${renderedPage}" id="top">
<a class="skip-link" href="#app" data-i18n="Skip to content">Skip to content</a>
<header class="site-header"><div class="header-inner"><div class="header-top"><a class="brand" data-brand-link href="${prefix}" title="Return to the dashboard start"><span class="brand-mark" aria-hidden="true">◫</span><span class="brand-title"><span>Census Dashboard</span><small id="dataset-name">${escapeHtml(country.name)} · data, diagnosis &amp; planning</small></span></a><div class="language-switcher" role="group" aria-label="Language" data-i18n-skip><button type="button" data-language="en" aria-label="English" aria-pressed="false">EN</button><button type="button" data-language="es" aria-label="Spanish" aria-pressed="false">ES</button><button type="button" data-language="ja" aria-label="Japanese" aria-pressed="false">日本語</button></div></div><nav class="primary-nav" aria-label="Main pages">${links}</nav></div></header>
<main id="app" class="page-container" tabindex="-1"><p role="status">Loading acquired evidence…</p><noscript><h1>JavaScript is needed for this dashboard</h1><p>Use the local server to open the interactive pages. The acquired dataset is available as <a href="${prefix}data/dashboard.json">dashboard.json</a>.</p></noscript></main>
<footer class="site-footer" data-i18n="Census Dashboard · Source-reported and calculated values are labelled separately · Missing data remain explicit">Census Dashboard · Source-reported and calculated values are labelled separately · Missing data remain explicit</footer>
</body></html>
`;
}

/** Create a portable static site. The caller validates and saves the canonical dataset. */
export async function generateSite({dataset, outDir}) {
  if(!dataset?.country?.id || !Array.isArray(dataset.territories) || !Array.isArray(dataset.indicators) || !Array.isArray(dataset.observations)) throw new Error('generateSite requires a validated dashboard dataset');
  if(!outDir || typeof outDir!=='string')throw new Error('generateSite requires outDir');
  const projectDir=path.resolve(outDir), siteDir=path.join(projectDir,'site');
  await mkdir(path.join(siteDir,'assets'),{recursive:true});
  await mkdir(path.join(siteDir,'data'),{recursive:true});
  const files=[];
  for(const page of Object.keys(pages)) {
    const directory=page==='home'?siteDir:path.join(siteDir,page);
    await mkdir(directory,{recursive:true});
    const filename=path.join(directory,'index.html');
    await writeFile(filename,pageShell({country:dataset.country,page}),'utf8');files.push(filename);
  }
  for(const file of ['app.mjs','model.mjs','analysis.mjs','aggregation.mjs','diagnostic.mjs','docx.mjs','i18n.mjs','planning.mjs','planning-view.mjs','styles.css']) {
    const destination=path.join(siteDir,'assets',file);
    await copyFile(path.join(scaffold,file),destination);files.push(destination);
  }
  const hostingConfig=path.join(siteDir,'.htaccess');
  await copyFile(path.join(scaffold,'.htaccess'),hostingConfig);files.push(hostingConfig);
  const dataFile=path.join(siteDir,'data','dashboard.json');
  // The canonical country dataset remains human-readable in data/dashboard.json.
  // The browser copy is transport data and may contain hundreds of detailed
  // boundaries, so write it compactly to reduce first-load transfer size.
  await writeFile(dataFile,JSON.stringify(dataset)+'\n','utf8');files.push(dataFile);
  const statusFile=path.join(siteDir,'data','update-status.json');
  await writeFile(statusFile,JSON.stringify({status:'current',checked_at:new Date().toISOString(),last_success_at:new Date().toISOString(),data_edition:dataset.generated_at,message:'Last build validated successfully.'},null,2)+'\n');files.push(statusFile);
  const handoffPath=path.join(projectDir,'SITE_README.md');
  const lines=[
    `# ${dataset.country.name} — country dashboard workspace`, '',
    `Data schema: ${dataset.schema_version}. Data edition: ${dataset.generated_at}.`, '',
    '## Scope', '',
    nationalOnly(dataset)?'This internal workspace contains national observations only. It is not the user delivery. Local observations and official country planning materials must be researched, integrated or replaced with a documented usable fallback before completion. National values are never copied into local records.':'This workspace contains some local observations. The AI must still complete country research, choose a locally useful default view, adapt all three pages and pass the delivery gate before presenting it to the user.', '',
    `- ${dataset.territories.length} territory records; ${dataset.indicators.length} indicators; ${dataset.observations.length} observation records.`,
    `- ${dataset.documents.length} acquired document records. Acquisition state does not establish official approval.`, '',
    '## Run and extend', '',
    'Serve the site directory over HTTP using the template’s scripts/serve.mjs. Double-clicking index.html uses file:// and browsers may block the JSON and module requests.',
    'The domain root opens the territorial diagnostic directly. territorial/, thematic/ and planning/ share the same local assets and dataset. The supporting database/ register exposes definitions and source records. Links and fetch URLs work at the domain root or below a hosting subdirectory.',
    'Add verified local observations, source records, document references and official-code joins to the canonical data/dashboard.json, validate it, then run scripts/build-country.mjs from the template. Do not patch generated site/data/dashboard.json as the canonical source.', '',
    '## Available outputs', '',
    `Adopted planning outputs: ${planningSettings(dataset).outputs.join(', ') || 'None; use original references and the country workflow'}. A completed country delivery must include docx and a verified country document_template. The Word output uses the officially prescribed index, or a cited requirements-based outline only when the planning authority prescribes no fixed index. Markdown and print-ready HTML remain working evidence outputs.`,
    'Diagnostic exports: editable Markdown, print-ready HTML with maps, legends and all member rows, and full diagnostic CSV. Internal comparisons do not change the analysis area; municipalities stop subdivision. Existing selected-period and time-series CSV remain available. CSV cells guard spreadsheet formulas in downloaded source strings.', '',
    '## Required acceptance work', '',
    '- Verify national → local A → local B → national selection, metric/period retention, direct links, reload and browser back/forward.',
    '- Verify zero vs missing and lack of local ranks when only national data exist.',
    '- Check map selection and fitting, boundary gaps, official/provider code distinctions and keyboard alternatives.',
    '- Inspect 320, 375, 768 and 1366px widths, actual 200% text zoom, keyboard focus and downloads.',
    '- Compare downloaded Markdown, HTML and CSV against selected area, period, units and sources.',
    '- Record the exact code revision, dataset edition, environment, evidence and checks not performed. Generation is not public-site or accessibility acceptance.', '',
    'Copy reference/templates/DELIVERY.json to evidence/DELIVERY.json only after its statements are true. Run scripts/verify-delivery.mjs from the template checkout and do not report completion until it returns ready: true.', '',
    '## Recorded acquisition gaps', '',
    ...dataset.gaps.map(gap=>`- ${gap.category} (${gap.status}): ${gap.detail} Next: ${gap.next_action || 'Verify the source.'}`), '',
    'This generator does not publish a site or modify a hosting account. Hosting remains a separate, explicitly scoped operation.', ''
  ];
  await writeFile(handoffPath,lines.join('\n'),'utf8');
  return {siteDir, files, handoffPath};
}
