import path from 'node:path';
import { access, readFile, writeFile } from 'node:fs/promises';
import { isMain, parseArgs, reportError } from '../lib/cli.mjs';
import { validateDataset } from '../lib/validate.mjs';
import { observedValue } from '../scaffold/site/model.mjs';

const requiredResearch = ['census_catalog', 'geography', 'planning_system', 'local_statistics', 'common_sources'];
const requiredValidation = ['kit_check', 'kit_tests', 'country_validation', 'browser', 'outputs'];
const allowedResearchStatus = new Set(['completed', 'constrained']);
const requiredThemes = ['population_demography','education','health_nutrition','water_sanitation_housing_energy','livelihoods_poverty_economy','access_infrastructure_environment'];
const finalThemeStatus = new Set(['local_data_integrated','checked_no_usable_local_data','blocked_with_evidence','not_applicable']);

async function exists(filename) {
  try { await access(filename); return true; } catch { return false; }
}

function safeProjectPath(projectDir, value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const resolved = path.resolve(projectDir, value);
  const relative = path.relative(projectDir, resolved);
  return relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) ? resolved : null;
}

async function readProjectJson(projectDir,value,label,errors) {
  const filename=safeProjectPath(projectDir,value);
  if(!filename || !await exists(filename)){errors.push(`${label} is missing or outside the project: ${value || ''}`);return null;}
  try{return JSON.parse(await readFile(filename,'utf8'));}
  catch{errors.push(`${label} is not valid JSON: ${value}`);return null;}
}

function validHttpUrl(value) {
  try { const url=new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password && !url.hostname.endsWith('.invalid'); }
  catch { return false; }
}

function validEvidenceText(value) {
  return typeof value === 'string' && value.trim().length > 0 && !/(?:REPLACE(?:_WITH)?(?:_|$)|\b(?:TODO|TBD)\b)/i.test(value);
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

  if (delivery.schema_version !== '0.3') errors.push('DELIVERY schema_version must be 0.3');
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

  const inventoryConfig=delivery.source_table_inventory;
  if(inventoryConfig?.status!=='passed')errors.push('source_table_inventory.status must be passed');
  if(inventoryConfig?.all_adopted_indicators_traced!==true)errors.push('source_table_inventory.all_adopted_indicators_traced must be true');
  if(inventoryConfig?.all_numeric_fields_decided!==true)errors.push('source_table_inventory.all_numeric_fields_decided must be true');
  const inventory=await readProjectJson(projectDir,inventoryConfig?.file,'source_table_inventory.file',errors);
  if(inventory){
    if(!['0.1','0.2'].includes(inventory.schema_version))errors.push('SOURCE_TABLE_INVENTORY schema_version must be 0.1 or 0.2');
    if(!/^\d{4}-\d{2}-\d{2}T/.test(inventory.completed_at||''))errors.push('SOURCE_TABLE_INVENTORY completed_at must be an ISO datetime');
    const sourceIds=new Set((data.sources||[]).map(source=>source.id)),indicatorIds=new Set((data.indicators||[]).map(indicator=>indicator.id));
    const traced=new Set(),seenSources=new Set();
    if(!Array.isArray(inventory.sources)||!inventory.sources.length)errors.push('SOURCE_TABLE_INVENTORY must contain inspected sources');
    for(const source of inventory.sources||[]){
      if(!sourceIds.has(source.source_id))errors.push(`SOURCE_TABLE_INVENTORY has unknown source_id: ${source.source_id}`);
      if(seenSources.has(source.source_id))errors.push(`SOURCE_TABLE_INVENTORY repeats source_id: ${source.source_id}`);seenSources.add(source.source_id);
      if(source.all_tables_checked!==true)errors.push(`SOURCE_TABLE_INVENTORY ${source.source_id} must confirm all_tables_checked`);
      if(!Array.isArray(source.raw_files)||!source.raw_files.length)errors.push(`SOURCE_TABLE_INVENTORY ${source.source_id} must list raw_files`);
      for(const value of source.raw_files||[]){const filename=safeProjectPath(projectDir,value);if(!filename||!await exists(filename))errors.push(`SOURCE_TABLE_INVENTORY raw file is missing or outside the project: ${value}`);}
      if(source.redistribution_review?.status!=='checked'||!validEvidenceText(source.redistribution_review?.terms)||!['include_raw','exclude_raw','metadata_only'].includes(source.redistribution_review?.raw_publication_decision))errors.push(`SOURCE_TABLE_INVENTORY ${source.source_id} needs a final redistribution review`);
      if(!Array.isArray(source.tables)||!source.tables.length)errors.push(`SOURCE_TABLE_INVENTORY ${source.source_id} must list inspected tables, sheets, pages or API fields`);
      for(const table of source.tables||[]){
        if(!validEvidenceText(table.locator))errors.push(`SOURCE_TABLE_INVENTORY ${source.source_id} has a table without a final locator`);
        if(!Array.isArray(table.numeric_fields)||!table.numeric_fields.length)errors.push(`SOURCE_TABLE_INVENTORY ${source.source_id} ${table.locator||''} must list numeric_fields`);
        for(const field of table.numeric_fields||[]){
          for(const key of ['name','meaning','unit','denominator'])if(!validEvidenceText(field[key]))errors.push(`SOURCE_TABLE_INVENTORY field ${field.name||''} needs final ${key} metadata`);
          if(!['adopted','not_adopted'].includes(field.decision))errors.push(`SOURCE_TABLE_INVENTORY field ${field.name||''} needs adopted or not_adopted decision`);
          if(!validEvidenceText(field.reason))errors.push(`SOURCE_TABLE_INVENTORY field ${field.name||''} needs a final reason`);
          if(field.decision==='adopted'){
            if(!indicatorIds.has(field.indicator_id))errors.push(`SOURCE_TABLE_INVENTORY adopted field ${field.name||''} has unknown indicator_id: ${field.indicator_id}`);
            else traced.add(field.indicator_id);
          } else if(field.indicator_id!==null) errors.push(`SOURCE_TABLE_INVENTORY rejected field ${field.name||''} must use null indicator_id`);
        }
      }
    }
    for(const id of indicatorIds)if(!traced.has(id))errors.push(`SOURCE_TABLE_INVENTORY does not trace adopted indicator: ${id}`);
    if(inventory.schema_version==='0.2'){
      const summary=inventory.summary||{},classes=summary.classifications||{},sourceSummaries=Array.isArray(summary.sources)?summary.sources:[];
      const classificationTotal=['adopted','component','excluded','helper'].reduce((sum,key)=>sum+(Number.isInteger(classes[key])?classes[key]:0),0);
      if(summary.source_count!==inventory.sources.length)errors.push('SOURCE_TABLE_INVENTORY 0.2 summary.source_count must match inspected sources');
      if(!Number.isInteger(summary.table_count)||summary.table_count<=0)errors.push('SOURCE_TABLE_INVENTORY 0.2 summary.table_count must be a positive integer');
      if(!Number.isInteger(summary.numeric_field_count)||summary.numeric_field_count<=0)errors.push('SOURCE_TABLE_INVENTORY 0.2 summary.numeric_field_count must be a positive integer');
      if(classificationTotal!==summary.numeric_field_count)errors.push('SOURCE_TABLE_INVENTORY 0.2 classification counts must sum to numeric_field_count');
      if(sourceSummaries.length!==inventory.sources.length)errors.push('SOURCE_TABLE_INVENTORY 0.2 summary.sources must count every inspected source');
      if(!validEvidenceText(inventory.reproduction?.command))errors.push('SOURCE_TABLE_INVENTORY 0.2 must record a reproduction command');
    }
  }

  const themeConfig=delivery.theme_coverage;
  if(themeConfig?.status!=='passed')errors.push('theme_coverage.status must be passed');
  if(themeConfig?.candidates_integrated_or_constrained!==true)errors.push('theme_coverage.candidates_integrated_or_constrained must be true');
  const themeAudit=await readProjectJson(projectDir,themeConfig?.file,'theme_coverage.file',errors);
  if(themeAudit){
    if(themeAudit.schema_version!=='0.1')errors.push('THEME_COVERAGE schema_version must be 0.1');
    if(!/^\d{4}-\d{2}-\d{2}T/.test(themeAudit.completed_at||''))errors.push('THEME_COVERAGE completed_at must be an ISO datetime');
    const sourceIds=new Set((data.sources||[]).map(source=>source.id)),indicatorIds=new Set((data.indicators||[]).map(indicator=>indicator.id)),assigned=new Set();
    const localIndicatorIds=new Set(localRows.map(row=>row.indicator_id));
    for(const id of requiredThemes){const matches=(themeAudit.themes||[]).filter(theme=>theme.id===id);if(matches.length!==1)errors.push(`THEME_COVERAGE must contain exactly one ${id} entry`);}
    for(const theme of themeAudit.themes||[]){
      if(!requiredThemes.includes(theme.id))errors.push(`THEME_COVERAGE has unknown theme id: ${theme.id}`);
      if(!finalThemeStatus.has(theme.status))errors.push(`THEME_COVERAGE ${theme.id} is unfinished: ${theme.status || 'missing status'}`);
      if(!validEvidenceText(theme.note))errors.push(`THEME_COVERAGE ${theme.id} needs a specific final note`);
      if(!Array.isArray(theme.checked_locations)||!theme.checked_locations.length)errors.push(`THEME_COVERAGE ${theme.id} must list checked_locations`);
      for(const check of theme.checked_locations||[])if(!validHttpUrl(check?.url)||!validEvidenceText(check?.result))errors.push(`THEME_COVERAGE ${theme.id} has an invalid or unfinished checked location`);
      for(const id of theme.source_ids||[])if(!sourceIds.has(id))errors.push(`THEME_COVERAGE ${theme.id} has unknown source_id: ${id}`);
      if(theme.status==='local_data_integrated'){
        if(!Array.isArray(theme.indicator_ids)||!theme.indicator_ids.length)errors.push(`THEME_COVERAGE ${theme.id} must list integrated indicator_ids`);
        if(!Array.isArray(theme.source_ids)||!theme.source_ids.length)errors.push(`THEME_COVERAGE ${theme.id} must list source_ids`);
        for(const id of theme.indicator_ids||[]){assigned.add(id);if(!indicatorIds.has(id))errors.push(`THEME_COVERAGE ${theme.id} has unknown indicator_id: ${id}`);else if(!localIndicatorIds.has(id))errors.push(`THEME_COVERAGE ${theme.id} claims local integration without a local observation: ${id}`);}
      } else if(['checked_no_usable_local_data','blocked_with_evidence'].includes(theme.status) && (theme.checked_locations||[]).length<2) errors.push(`THEME_COVERAGE ${theme.id} needs at least two checked locations for a constrained result`);
    }
    for(const id of localIndicatorIds)if(!assigned.has(id))errors.push(`THEME_COVERAGE does not classify locally observed indicator: ${id}`);
  }

  const resourceConfig=delivery.source_resource_inventory;
  if(resourceConfig?.status!=='passed')errors.push('source_resource_inventory.status must be passed');
  if(resourceConfig?.all_expected_resources_dispositioned!==true)errors.push('source_resource_inventory.all_expected_resources_dispositioned must be true');
  const resourceInventory=await readProjectJson(projectDir,resourceConfig?.file,'source_resource_inventory.file',errors);
  if(resourceInventory){
    if(resourceInventory.schema_version!=='0.1')errors.push('SOURCE_RESOURCE_INVENTORY schema_version must be 0.1');
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(resourceInventory.generated_at||''))errors.push('SOURCE_RESOURCE_INVENTORY generated_at must be an ISO datetime');
    if(!Array.isArray(resourceInventory.catalogs)||!resourceInventory.catalogs.length)errors.push('SOURCE_RESOURCE_INVENTORY must contain at least one inspected catalogue');
    const finalStatuses=new Set(['integrated','inspected_not_adopted','not_applicable','unavailable_with_evidence']);
    for(const catalog of resourceInventory.catalogs||[]){
      const label=catalog.catalog_id||'unnamed catalogue',resources=catalog.resources||[];
      if(!validEvidenceText(catalog.catalog_id)||!validEvidenceText(catalog.title)||!validEvidenceText(catalog.publisher)||!validHttpUrl(catalog.catalog_url))errors.push(`SOURCE_RESOURCE_INVENTORY ${label} needs final catalogue identity and URL`);
      if(!Number.isInteger(catalog.expected_resource_count)||catalog.expected_resource_count<1)errors.push(`SOURCE_RESOURCE_INVENTORY ${label} expected_resource_count must be a positive integer`);
      if(catalog.discovered_resource_count!==resources.length)errors.push(`SOURCE_RESOURCE_INVENTORY ${label} discovered_resource_count must equal resources.length`);
      if(catalog.expected_resource_count!==resources.length)errors.push(`SOURCE_RESOURCE_INVENTORY ${label} expected ${catalog.expected_resource_count} resources but records ${resources.length}`);
      const ids=new Set();let acquired=0,integrated=0;
      for(const resource of resources){
        if(!validEvidenceText(resource.resource_id)||ids.has(resource.resource_id))errors.push(`SOURCE_RESOURCE_INVENTORY ${label} has a missing or duplicate resource_id: ${resource.resource_id||''}`);ids.add(resource.resource_id);
        if(!finalStatuses.has(resource.status))errors.push(`SOURCE_RESOURCE_INVENTORY ${label} resource ${resource.resource_id||''} is unfinished: ${resource.status||'missing status'}`);
        if(!validHttpUrl(resource.url))errors.push(`SOURCE_RESOURCE_INVENTORY ${label} resource ${resource.resource_id||''} has an invalid URL`);
        if(resource.status==='integrated'){
          integrated+=1;acquired+=1;
          const filename=safeProjectPath(projectDir,resource.raw_path);
          if(!filename||!await exists(filename))errors.push(`SOURCE_RESOURCE_INVENTORY integrated raw file is missing or outside the project: ${resource.raw_path||''}`);
          if(!/^[0-9a-f]{64}$/i.test(resource.sha256||''))errors.push(`SOURCE_RESOURCE_INVENTORY integrated resource ${resource.resource_id||''} needs a SHA-256 hash`);
        } else if(resource.raw_path){acquired+=1;}
        if(resource.status!=='integrated'&&!validEvidenceText(resource.reason))errors.push(`SOURCE_RESOURCE_INVENTORY non-integrated resource ${resource.resource_id||''} needs a final reason`);
      }
      if(catalog.acquired_resource_count!==acquired)errors.push(`SOURCE_RESOURCE_INVENTORY ${label} acquired_resource_count does not match resource dispositions`);
      if(catalog.integrated_resource_count!==integrated)errors.push(`SOURCE_RESOURCE_INVENTORY ${label} integrated_resource_count does not match resource dispositions`);
    }
  }

  const lessonAudit=safeProjectPath(projectDir,'evidence/COUNTRY_LESSON_AUDIT.md');
  if(!lessonAudit||!await exists(lessonAudit))errors.push('Missing evidence/COUNTRY_LESSON_AUDIT.md');
  else {
    const lessonText=await readFile(lessonAudit,'utf8');
    if(/\|\s*UA(?:0[1-9]|1[0-2])\s*\|[^\n]*\|\s*未実施\s*\|/u.test(lessonText))errors.push('COUNTRY_LESSON_AUDIT still contains unperformed UA checks');
  }

  const geography=delivery.geography_review;
  if(geography?.status!=='passed')errors.push('geography_review.status must be passed');
  if(geography?.stable_url_identity_checked!==true)errors.push('geography_review.stable_url_identity_checked must be true');
  if(geography?.no_geometry_layout_checked!==true)errors.push('geography_review.no_geometry_layout_checked must be true');
  const geographyEvidence=safeProjectPath(projectDir,geography?.evidence_file);
  if(!geographyEvidence||!await exists(geographyEvidence))errors.push(`geography_review.evidence_file is missing or outside the project: ${geography?.evidence_file||''}`);
  const localLevels=[...new Set((data.territories||[]).filter(area=>area.id!==data.country?.national_territory_id).map(area=>area.level))];
  for(const level of localLevels){
    const territories=(data.territories||[]).filter(area=>area.level===level),ids=new Set(territories.map(area=>area.id));
    const boundaryIds=new Set((data.boundaries?.features||[]).map(feature=>feature.properties?.territory_id).filter(id=>ids.has(id)));
    const entry=(geography?.selectable_levels||[]).find(item=>item.level===level),expectedStatus=boundaryIds.size===0?'none':boundaryIds.size===territories.length?'complete':'partial';
    if(!entry){errors.push(`geography_review.selectable_levels is missing ${level}`);continue;}
    if(entry.territory_count!==territories.length||entry.boundary_count!==boundaryIds.size)errors.push(`geography_review ${level} counts do not match the dataset`);
    if(entry.status!==expectedStatus)errors.push(`geography_review ${level} status must be ${expectedStatus}`);
    if(expectedStatus!=='complete'&&entry.unjoined_ids_recorded!==true)errors.push(`geography_review ${level} must record unjoined IDs`);
  }

  const presentation=delivery.period_and_language_review;
  if(presentation?.status!=='passed')errors.push('period_and_language_review.status must be passed');
  for(const key of ['latest_value_per_indicator','source_year_shown_per_value','historical_period_controls_absent','national_context_separated_on_local_views','mixed_language_reviewed'])if(presentation?.[key]!==true)errors.push(`period_and_language_review.${key} must be true`);
  const presentationEvidence=safeProjectPath(projectDir,presentation?.evidence_file);
  if(!presentationEvidence||!await exists(presentationEvidence))errors.push(`period_and_language_review.evidence_file is missing or outside the project: ${presentation?.evidence_file||''}`);

  const planning=data.planning,documentTemplate=planning?.document_template;
  if(!planning?.outputs?.includes('docx'))errors.push('Country delivery must adopt the docx planning output');
  const provisionalOutline=documentTemplate?.status==='provisional_evidence_outline';
  if(!documentTemplate || !['verified_prescribed_index','verified_requirements_based_outline','provisional_evidence_outline'].includes(documentTemplate.status))errors.push('Country delivery needs a verified planning template or an explicitly provisional evidence outline');
  if(provisionalOutline && delivery.research?.planning_system?.status!=='constrained')errors.push('A provisional evidence outline requires research.planning_system.status constrained');
  const sourceGroups=new Map((planning?.source_groups || []).map(group=>[group.id,group]));
  for(const id of ['law','census','international'])if(!sourceGroups.get(id)?.source_ids?.length)errors.push(`planning.source_groups must list at least one ${id} source link`);
  const word=delivery.word_plan;
  if(word?.status!=='passed')errors.push('word_plan.status must be passed');
  if(provisionalOutline){
    if(word?.provisional_outline!==true)errors.push('word_plan.provisional_outline must be true for a provisional evidence outline');
    if(word?.overclaim_review_passed!==true)errors.push('word_plan.overclaim_review_passed must be true for a provisional evidence outline');
    if(word?.outline_checked_against_law!==false)errors.push('word_plan.outline_checked_against_law must be false until the competent-authority basis is verified');
  } else if(word?.outline_checked_against_law!==true)errors.push('word_plan.outline_checked_against_law must be true');
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
