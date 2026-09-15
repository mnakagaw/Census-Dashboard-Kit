import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { verifyDelivery } from '../scripts/verify-delivery.mjs';
import { fixture } from './fixture.mjs';
import {planningFixture} from './planning-fixture.mjs';
import { initialState, observedPeriodsForArea, themePeriodCoverage, themeLatestCoverage, latestDisplayPeriod, latestComparisonPeriod, evidenceRows } from '../scaffold/site/model.mjs';
import { renderInternalComparison } from '../scaffold/site/diagnostic.mjs';
import {planDocxBytes} from '../scaffold/site/docx.mjs';

async function readyProject() {
  const root=await mkdtemp(path.join(os.tmpdir(),'census-delivery-')),data=planningFixture('integrated');
  for(const directory of ['data','evidence','raw','site/territorial','site/thematic','site/planning'])await mkdir(path.join(root,directory),{recursive:true});
  await writeFile(path.join(root,'data/dashboard.json'),JSON.stringify(data));
  for(const file of ['SOURCES.md','INDICATOR_INVENTORY.csv','CODE_CROSSWALK.csv','PLANNING_CENSUS_AUDIT.md','VALIDATION.md','ACCEPTANCE.md','validation.json','WORD_RENDER_CHECK.md','GEOGRAPHY_REVIEW.md'])await writeFile(path.join(root,'evidence',file),'verified test evidence');
  await writeFile(path.join(root,'raw','test-fixture'),'synthetic source fields');
  await writeFile(path.join(root,'raw','international-data.pdf'),'synthetic international fields');
  await writeFile(path.join(root,'evidence','WORD_SAMPLE.docx'),planDocxBytes(data,'city','2024'));
  for(const file of ['site/index.html','site/territorial/index.html','site/thematic/index.html','site/planning/index.html','HANDOFF.md'])await writeFile(path.join(root,file),'test artifact');
  const research={};
  for(const key of ['census_catalog','geography','planning_system','local_statistics','common_sources'])research[key]={status:'completed',evidence_files:['evidence/SOURCES.md'],note:'Inspected in the synthetic test'};
  const validation={};
  for(const key of ['kit_check','kit_tests','country_validation','browser','outputs'])validation[key]={status:'passed',evidence_files:[key==='country_validation'?'evidence/validation.json':key==='browser'||key==='outputs'?'evidence/ACCEPTANCE.md':'evidence/VALIDATION.md']};
  const inventory={schema_version:'0.1',completed_at:'2026-09-15T00:00:00Z',sources:[{source_id:'test-source',raw_files:['raw/test-fixture'],redistribution_review:{status:'checked',terms:'Synthetic fixture may be redistributed in the test.',raw_publication_decision:'include_raw'},all_tables_checked:true,tables:[{locator:'Synthetic API response fields',geographic_levels:['city'],periods:['2024'],numeric_fields:data.indicators.map(indicator=>({name:indicator.id,meaning:indicator.definition,unit:indicator.unit,denominator:'Synthetic fixture',decision:'adopted',indicator_id:indicator.id,reason:'Used by the synthetic delivery fixture.'}))}]}]};
  await writeFile(path.join(root,'evidence/SOURCE_TABLE_INVENTORY.json'),JSON.stringify(inventory));
  const checked=[{url:'https://example.org/catalog',result:'Synthetic catalogue checked.'},{url:'https://example.org/sector',result:'Synthetic sector source checked.'}];
  const themes=[
    {id:'population_demography',status:'local_data_integrated',source_ids:['test-source'],indicator_ids:['population'],levels:['city'],checked_locations:checked,note:'Synthetic population values integrated.'},
    {id:'water_sanitation_housing_energy',status:'local_data_integrated',source_ids:['test-source'],indicator_ids:['water'],levels:['city'],checked_locations:checked,note:'Synthetic water values integrated.'},
    ...['education','health_nutrition','livelihoods_poverty_economy','access_infrastructure_environment'].map(id=>({id,status:'checked_no_usable_local_data',source_ids:['test-source'],indicator_ids:[],levels:[],checked_locations:checked,note:'Two synthetic locations were checked; no additional local fixture exists.'}))
  ];
  await writeFile(path.join(root,'evidence/THEME_COVERAGE.json'),JSON.stringify({schema_version:'0.1',completed_at:'2026-09-15T00:00:00Z',themes}));
  const levelRows=[...new Set(data.territories.filter(area=>area.level!=='national').map(area=>area.level))].map(level=>{const ids=new Set(data.territories.filter(area=>area.level===level).map(area=>area.id)),boundaryIds=new Set(data.boundaries.features.map(feature=>feature.properties.territory_id).filter(id=>ids.has(id)));return {level,territory_count:ids.size,boundary_count:boundaryIds.size,status:boundaryIds.size===0?'none':boundaryIds.size===ids.size?'complete':'partial',unjoined_ids_recorded:true};});
  const delivery={schema_version:'0.3',status:'ready',country_id:'TST',completed_at:'2026-09-15T00:00:00Z',research,default_view:{territory_id:'TST',indicator_id:'population',period:'2024'},empty_comparisons:{collapsed_or_suppressed:true},coverage_claims:{qualified_by_indicator_period_level:true},source_table_inventory:{status:'passed',file:'evidence/SOURCE_TABLE_INVENTORY.json',all_adopted_indicators_traced:true,all_numeric_fields_decided:true},theme_coverage:{status:'passed',file:'evidence/THEME_COVERAGE.json',candidates_integrated_or_constrained:true},geography_review:{status:'passed',stable_url_identity_checked:true,no_geometry_layout_checked:true,selectable_levels:levelRows,evidence_file:'evidence/GEOGRAPHY_REVIEW.md'},period_and_language_review:{status:'passed',latest_value_per_indicator:true,source_year_shown_per_value:true,historical_period_controls_absent:true,national_context_separated_on_local_views:true,mixed_language_reviewed:true,evidence_file:'evidence/ACCEPTANCE.md'},word_plan:{status:'passed',outline_checked_against_law:true,sample_file:'evidence/WORD_SAMPLE.docx',render_evidence_file:'evidence/WORD_RENDER_CHECK.md'},validation,artifacts:['site/index.html','site/territorial/index.html','site/thematic/index.html','site/planning/index.html','data/dashboard.json','evidence/WORD_SAMPLE.docx','HANDOFF.md'],limitations:[]};
  await writeFile(path.join(root,'evidence/DELIVERY.json'),JSON.stringify(delivery));
  return {root,data,delivery};
}

test('delivery gate accepts a recorded and verified country product',async()=>{
  const {root}=await readyProject(),result=await verifyDelivery(root);
  assert.equal(result.ready,true);assert.deepEqual(result.errors,[]);assert.ok(result.summary.local_observations>0);
});

test('delivery gate rejects a work-in-progress project and a national-only default when local evidence exists',async()=>{
  const {root,delivery}=await readyProject();
  delivery.status='research_required';delivery.default_view={territory_id:'TST',indicator_id:'population',period:'2025'};
  await writeFile(path.join(root,'evidence/DELIVERY.json'),JSON.stringify(delivery));
  const result=await verifyDelivery(root);assert.equal(result.ready,false);assert.match(result.errors.join('\n'),/status must be ready/);assert.match(result.errors.join('\n'),/default_view must use/);
});

test('delivery gate runs the country dataset validator itself',async()=>{
  const {root,data}=await readyProject();data.schema_version='invented';
  await writeFile(path.join(root,'data/dashboard.json'),JSON.stringify(data));
  const result=await verifyDelivery(root);assert.equal(result.ready,false);assert.match(result.errors.join('\n'),/dataset: schema_version must be 0.2/);
});

test('delivery gate rejects a country product without all source groups or rendered Word evidence',async()=>{
  const {root,data,delivery}=await readyProject();
  data.planning.source_groups=data.planning.source_groups.filter(group=>group.id!=='international');
  delivery.word_plan.render_evidence_file='evidence/ABSENT_WORD_REVIEW.md';
  await writeFile(path.join(root,'data/dashboard.json'),JSON.stringify(data));
  await writeFile(path.join(root,'evidence/DELIVERY.json'),JSON.stringify(delivery));
  const result=await verifyDelivery(root);assert.equal(result.ready,false);
  assert.match(result.errors.join('\n'),/international source link/);assert.match(result.errors.join('\n'),/render_evidence_file/);
});

test('delivery gate rejects a shallow source scan, unfinished theme candidates and false geography counts',async()=>{
  const {root,delivery}=await readyProject();
  const inventory=JSON.parse(await readFile(path.join(root,'evidence/SOURCE_TABLE_INVENTORY.json'),'utf8'));
  inventory.sources[0].tables[0].numeric_fields=inventory.sources[0].tables[0].numeric_fields.filter(field=>field.indicator_id!=='water');
  inventory.sources[0].tables[0].numeric_fields[0].meaning='REPLACE';
  inventory.sources[0].redistribution_review.terms='REPLACE_WITH_TERMS';
  await writeFile(path.join(root,'evidence/SOURCE_TABLE_INVENTORY.json'),JSON.stringify(inventory));
  const themes=JSON.parse(await readFile(path.join(root,'evidence/THEME_COVERAGE.json'),'utf8'));
  themes.themes.find(theme=>theme.id==='education').status='candidate_found_not_integrated';
  await writeFile(path.join(root,'evidence/THEME_COVERAGE.json'),JSON.stringify(themes));
  delivery.geography_review.selectable_levels.find(item=>item.level==='city').boundary_count=0;
  await writeFile(path.join(root,'evidence/DELIVERY.json'),JSON.stringify(delivery));
  const result=await verifyDelivery(root),text=result.errors.join('\n');
  assert.equal(result.ready,false);assert.match(text,/does not trace adopted indicator: water/);assert.match(text,/needs final meaning metadata/);assert.match(text,/needs a final redistribution review/);assert.match(text,/education is unfinished/);assert.match(text,/city counts do not match/);
});

test('delivery gate requires latest-per-indicator presentation evidence',async()=>{
  const {root,delivery}=await readyProject();
  delivery.period_and_language_review.source_year_shown_per_value=false;
  await writeFile(path.join(root,'evidence/DELIVERY.json'),JSON.stringify(delivery));
  const result=await verifyDelivery(root);
  assert.equal(result.ready,false);assert.match(result.errors.join('\n'),/source_year_shown_per_value must be true/);
});

test('initial state prefers the best-covered local indicator and period',()=>{
  const data=fixture();
  data.indicators.unshift({id:'national-latest',name:'National latest',theme:'Context',unit:'x',definition:'National only',source_id:'test',aggregation:'none',measurement_method:'source_reported'});
  data.observations.unshift({territory_id:'TST',indicator_id:'national-latest',period:'2025',value:5,status:'observed',source_id:'test'});
  const state=initialState(data,'');assert.equal(state.metric,'people');assert.equal(state.period,'2024');
});

test('territorial themes distinguish exact-period absence from data acquired in another year',()=>{
  const data=fixture();
  data.indicators.push({id:'poverty',name:'Poverty',theme:'Living standards',unit:'%',definition:'Synthetic historical rate',source_id:'test',aggregation:'none',measurement_method:'source_reported'});
  data.observations.push({territory_id:'TST-A',indicator_id:'poverty',period:'2017',value:23,status:'observed',source_id:'test'});
  assert.deepEqual(observedPeriodsForArea(data,'TST-A','poverty'),['2017']);
  assert.deepEqual(themePeriodCoverage(data,'TST-A',[data.indicators.at(-1)],'2024'),{total:1,exact:0,otherPeriods:['2017']});
});

test('country display selects the latest confirmed year independently for every indicator',()=>{
  const data=fixture();
  data.indicators.push({id:'poverty',name:'Poverty',theme:'Living standards',unit:'%',definition:'Synthetic historical rate',source_id:'test',aggregation:'none',measurement_method:'source_reported'});
  data.observations.push({territory_id:'TST-A',indicator_id:'poverty',period:'2017',value:23,status:'observed',source_id:'test'});
  assert.equal(latestDisplayPeriod(data,'TST-A','people'),'2024');
  assert.equal(latestDisplayPeriod(data,'TST-A','poverty'),'2017');
  assert.equal(latestComparisonPeriod(data,'poverty','city'),'2017');
  assert.deepEqual(themeLatestCoverage(data,'TST-A',[data.indicators.find(row=>row.id==='poverty')]),{total:1,available:1});
  const periods=new Map(evidenceRows(data,'TST-A',null).map(row=>[row.indicator.id,row.period]));
  assert.equal(periods.get('people'),'2024');assert.equal(periods.get('poverty'),'2017');
});

test('all-missing internal comparisons are concise on screen while exports retain their separate contract',()=>{
  const data=fixture();
  data.observations=data.observations.map(row=>row.territory_id==='TST-A'?{...row,value:null,status:'missing'}:row);
  const html=renderInternalComparison(data,'TST','people','2024');
  assert.match(html,/all-missing table are suppressed on screen/);assert.doesNotMatch(html,/<table|<svg class="internal-map"/);
});
