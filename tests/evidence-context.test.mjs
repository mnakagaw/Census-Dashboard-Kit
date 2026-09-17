import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {analysisFixture} from './analysis-fixture.mjs';
import {evidenceCsv,planningMarkdown} from '../scaffold/site/model.mjs';

test('legacy evidence columns stay stable while declared context keeps original values and reasons',()=>{
 const legacy=evidenceCsv(fixture(),'TST-A','2024');
 assert.equal(legacy.split('\r\n')[0].split(',').length,18);
 const data=analysisFixture(),row=data.observations.find(r=>r.territory_id==='city'&&r.indicator_id==='people'&&r.period==='2024');
 Object.assign(row,{value:2,unit:'thousands',definition_id:'adults',population:'Adults',method:'historic-survey',boundary_version:'old-city'});
 const csv=evidenceCsv(data,'city','2024'),markdown=planningMarkdown(data,'city','2024');
 assert.match(csv,/"2","thousands","observed"/);assert.match(csv,/"Adults","historic-survey",false|"Adults","historic-survey","false"/);
 assert.match(csv,/Observation boundary edition does not match/);assert.match(csv,/"Definition ID"/);
 assert.match(markdown,/2 \| thousands/);assert.match(markdown,/population Adults; method historic-survey/);assert.match(markdown,/Observation boundary edition does not match/);
});

test('localized evidence CSV translates semantic methods and comparison reasons',()=>{
 const data=analysisFixture(),row=data.observations.find(r=>r.territory_id==='city'&&r.indicator_id==='people'&&r.period==='2024');
 Object.assign(row,{method:'calculated_from_source_fields'});
 Object.assign(data.sources.find(source=>source.id==='local'),{geographic_level:'national',country_id:'OTH'});
 for(const language of ['ja','es']) {
   const csv=evidenceCsv(data,'city','2024',undefined,language);
   assert.doesNotMatch(csv,/calculated_from_source_fields|National source country identity does not match this area\./);
   assert.match(csv,language==='ja'?/出典項目から算出/:/calculado_a_partir_de_campos_de_fuente/);
   assert.match(csv,language==='ja'?/全国出典の国識別情報がこの地域と一致しません。/:/La identidad nacional de la fuente no coincide con esta área\./);
 }
});
