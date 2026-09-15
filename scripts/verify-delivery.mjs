import path from 'node:path';
import { access, readFile, writeFile } from 'node:fs/promises';
import { isMain, parseArgs, reportError } from '../lib/cli.mjs';
import { validateDataset } from '../lib/validate.mjs';
import { observedValue } from '../scaffold/site/model.mjs';

const requiredResearch = ['census_catalog', 'geography', 'planning_system', 'local_statistics', 'common_sources'];
const requiredValidation = ['kit_check', 'kit_tests', 'country_validation', 'browser', 'outputs'];
const allowedResearchStatus = new Set(['completed', 'constrained']);

async function exists(filename) {
  try { await access(filename); return true; } catch { return false; }
}

function safeProjectPath(projectDir, value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const resolved = path.resolve(projectDir, value);
  const relative = path.relative(projectDir, resolved);
  return relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) ? resolved : null;
}

export async function verifyDelivery(project) {
  const projectDir = path.resolve(project);
  const errors = [], warnings = [];
  const dataPath = path.join(projectDir, 'data', 'dashboard.json');
  const manifestPath = path.join(projectDir, 'evidence', 'DELIVERY.json');
  let data, delivery;
  try { data = JSON.parse(await readFile(dataPath, 'utf8')); }
  catch { errors.push('Missing or invalid data/dashboard.json'); }
  try { delivery = JSON.parse(await readFile(manifestPath, 'utf8')); }
  catch { errors.push('Missing or invalid evidence/DELIVERY.json; copy and complete the delivery template only after real checks'); }
  if (!data || !delivery) return { ready: false, errors, warnings };

  const datasetValidation = validateDataset(data);
  errors.push(...datasetValidation.errors.map(message => `dataset: ${message}`));
  warnings.push(...datasetValidation.warnings.map(message => `dataset: ${message}`));

  if (delivery.schema_version !== '0.1') errors.push('DELIVERY schema_version must be 0.1');
  if (delivery.status !== 'ready') errors.push('DELIVERY status must be ready');
  if (delivery.country_id !== data.country?.id) errors.push('DELIVERY country_id must match data/dashboard.json');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(delivery.completed_at || '')) errors.push('DELIVERY completed_at must be an ISO datetime');

  for (const key of requiredResearch) {
    const item = delivery.research?.[key];
    if (!item || !allowedResearchStatus.has(item.status)) { errors.push(`research.${key}.status must be completed or constrained`); continue; }
    if (!Array.isArray(item.evidence_files) || !item.evidence_files.length) errors.push(`research.${key}.evidence_files must identify inspected evidence`);
    if (typeof item.note !== 'string' || !item.note.trim()) errors.push(`research.${key}.note is required`);
    if (item.status === 'constrained' && item.fallback_completed !== true) errors.push(`research.${key}.fallback_completed must be true when status is constrained`);
  }

  for (const [key, item] of Object.entries(delivery.research || {})) {
    for (const value of item?.evidence_files || []) {
      const filename = safeProjectPath(projectDir, value);
      if (!filename || !await exists(filename)) errors.push(`research.${key} evidence file is missing or outside the project: ${value}`);
    }
  }

  for (const key of requiredValidation) {
    const item = delivery.validation?.[key];
    if (item?.status !== 'passed') errors.push(`validation.${key}.status must be passed`);
    if (!Array.isArray(item?.evidence_files) || !item.evidence_files.length) errors.push(`validation.${key}.evidence_files is required`);
  }
  for (const [key, item] of Object.entries(delivery.validation || {})) {
    for (const value of item?.evidence_files || []) {
      const filename = safeProjectPath(projectDir, value);
      if (!filename || !await exists(filename)) errors.push(`validation.${key} evidence file is missing or outside the project: ${value}`);
    }
  }

  const localIds = new Set((data.territories || []).filter(area => area.id !== data.country?.national_territory_id).map(area => area.id));
  const localRows = (data.observations || []).filter(row => localIds.has(row.territory_id) && observedValue(row) !== null);
  const view = delivery.default_view;
  if (!view || !data.territories?.some(area => area.id === view.territory_id) || !data.indicators?.some(indicator => indicator.id === view.indicator_id) || typeof view.period !== 'string') {
    errors.push('default_view must identify an existing territory, indicator and period');
  } else if (localRows.length) {
    const comparable = localRows.filter(row => row.indicator_id === view.indicator_id && String(row.period) === view.period);
    if (!comparable.length) errors.push('Local observations exist, so default_view must use an indicator and period with local observations');
  } else if (delivery.research?.local_statistics?.status !== 'constrained') {
    errors.push('No local observations were integrated; local_statistics must document a constrained result and completed fallback');
  }
  if (delivery.empty_comparisons?.collapsed_or_suppressed !== true) errors.push('empty_comparisons.collapsed_or_suppressed must be true');
  if (delivery.coverage_claims?.qualified_by_indicator_period_level !== true) errors.push('coverage claims must be qualified by indicator, period and level');

  const planning=data.planning,documentTemplate=planning?.document_template;
  if(!planning?.outputs?.includes('docx'))errors.push('Country delivery must adopt the docx planning output');
  if(!documentTemplate || !['verified_prescribed_index','verified_requirements_based_outline'].includes(documentTemplate.status))errors.push('Country delivery needs a verified law-aligned planning.document_template');
  const sourceGroups=new Map((planning?.source_groups || []).map(group=>[group.id,group]));
  for(const id of ['law','census','international'])if(!sourceGroups.get(id)?.source_ids?.length)errors.push(`planning.source_groups must list at least one ${id} source link`);
  const word=delivery.word_plan;
  if(word?.status!=='passed')errors.push('word_plan.status must be passed');
  if(word?.outline_checked_against_law!==true)errors.push('word_plan.outline_checked_against_law must be true');
  for(const key of ['sample_file','render_evidence_file']){
    const value=word?.[key],filename=safeProjectPath(projectDir,value);
    if(!filename || !await exists(filename))errors.push(`word_plan.${key} is missing or outside the project: ${value || ''}`);
    else if(key==='sample_file'){
      const bytes=await readFile(filename);
      if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4b||bytes[2]!==0x03||bytes[3]!==0x04)errors.push('word_plan.sample_file is not a DOCX ZIP package');
    }
  }

  for (const relative of ['site/index.html', 'site/territorial/index.html', 'site/thematic/index.html', 'site/planning/index.html']) {
    if (!await exists(path.join(projectDir, relative))) errors.push(`Missing required page: ${relative}`);
  }
  for (const relative of delivery.artifacts || []) {
    const filename = safeProjectPath(projectDir, relative);
    if (!filename || !await exists(filename)) errors.push(`Declared artifact is missing or outside the project: ${relative}`);
  }
  if (!Array.isArray(delivery.limitations)) errors.push('limitations must be an array, including an empty array when none remain');

  return { ready: errors.length === 0, errors, warnings, summary: { local_observations: localRows.length, territories: data.territories?.length || 0, indicators: data.indicators?.length || 0, documents: data.documents?.length || 0 } };
}

if (isMain(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2), ['project']);
    if (args.help) console.log('node scripts/verify-delivery.mjs --project <country-project>');
    else {
      if (!args.project) throw new Error('Provide --project <country-project>');
      const result = await verifyDelivery(args.project);
      console.log(JSON.stringify(result, null, 2));
      if (!result.ready) process.exitCode = 1;
      else await writeFile(path.join(path.resolve(args.project), 'evidence', 'WORK_STATUS.json'), JSON.stringify({status:'ready',verified_at:new Date().toISOString(),message:'Country research, integration and recorded delivery checks passed the kit delivery gate.'},null,2)+'\n');
    }
  } catch (error) { reportError(error); }
}
