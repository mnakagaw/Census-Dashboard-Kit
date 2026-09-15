import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { verifyDelivery } from '../scripts/verify-delivery.mjs';
import { fixture } from './fixture.mjs';
import { initialState } from '../scaffold/site/model.mjs';
import { renderInternalComparison } from '../scaffold/site/diagnostic.mjs';

async function readyProject() {
  const root=await mkdtemp(path.join(os.tmpdir(),'census-delivery-')),data=fixture();
  for(const directory of ['data','evidence','site/territorial','site/thematic','site/planning'])await mkdir(path.join(root,directory),{recursive:true});
  await writeFile(path.join(root,'data/dashboard.json'),JSON.stringify(data));
  for(const file of ['SOURCES.md','INDICATOR_INVENTORY.csv','CODE_CROSSWALK.csv','PLANNING_CENSUS_AUDIT.md','VALIDATION.md','ACCEPTANCE.md','validation.json'])await writeFile(path.join(root,'evidence',file),'verified test evidence');
  for(const file of ['site/index.html','site/territorial/index.html','site/thematic/index.html','site/planning/index.html','HANDOFF.md'])await writeFile(path.join(root,file),'test artifact');
  const research={};
  for(const key of ['census_catalog','geography','planning_system','local_statistics','common_sources'])research[key]={status:'completed',evidence_files:['evidence/SOURCES.md'],note:'Inspected in the synthetic test'};
  const validation={};
  for(const key of ['kit_check','kit_tests','country_validation','browser','outputs'])validation[key]={status:'passed',evidence_files:[key==='country_validation'?'evidence/validation.json':key==='browser'||key==='outputs'?'evidence/ACCEPTANCE.md':'evidence/VALIDATION.md']};
  const delivery={schema_version:'0.1',status:'ready',country_id:'TST',completed_at:'2026-09-15T00:00:00Z',research,default_view:{territory_id:'TST',indicator_id:'people',period:'2024'},empty_comparisons:{collapsed_or_suppressed:true},coverage_claims:{qualified_by_indicator_period_level:true},validation,artifacts:['site/index.html','site/territorial/index.html','site/thematic/index.html','site/planning/index.html','data/dashboard.json','HANDOFF.md'],limitations:[]};
  await writeFile(path.join(root,'evidence/DELIVERY.json'),JSON.stringify(delivery));
  return {root,data,delivery};
}

test('delivery gate accepts a recorded and verified country product',async()=>{
  const {root}=await readyProject(),result=await verifyDelivery(root);
  assert.equal(result.ready,true);assert.deepEqual(result.errors,[]);assert.equal(result.summary.local_observations,1);
});

test('delivery gate rejects a work-in-progress project and a national-only default when local evidence exists',async()=>{
  const {root,delivery}=await readyProject();
  delivery.status='research_required';delivery.default_view={territory_id:'TST',indicator_id:'people',period:'2025'};
  await writeFile(path.join(root,'evidence/DELIVERY.json'),JSON.stringify(delivery));
  const result=await verifyDelivery(root);assert.equal(result.ready,false);assert.match(result.errors.join('\n'),/status must be ready/);assert.match(result.errors.join('\n'),/default_view must use/);
});

test('delivery gate runs the country dataset validator itself',async()=>{
  const {root,data}=await readyProject();data.schema_version='invented';
  await writeFile(path.join(root,'data/dashboard.json'),JSON.stringify(data));
  const result=await verifyDelivery(root);assert.equal(result.ready,false);assert.match(result.errors.join('\n'),/dataset: schema_version must be 0.2/);
});

test('initial state prefers the best-covered local indicator and period',()=>{
  const data=fixture();
  data.indicators.unshift({id:'national-latest',name:'National latest',theme:'Context',unit:'x',definition:'National only',source_id:'test',aggregation:'none',measurement_method:'source_reported'});
  data.observations.unshift({territory_id:'TST',indicator_id:'national-latest',period:'2025',value:5,status:'observed',source_id:'test'});
  const state=initialState(data,'');assert.equal(state.metric,'people');assert.equal(state.period,'2024');
});

test('all-missing internal comparisons are concise on screen while exports retain their separate contract',()=>{
  const data=fixture();
  data.observations=data.observations.map(row=>row.territory_id==='TST-A'?{...row,value:null,status:'missing'}:row);
  const html=renderInternalComparison(data,'TST','people','2024');
  assert.match(html,/all-missing table are suppressed on screen/);assert.doesNotMatch(html,/<table|<svg class="internal-map"/);
});
