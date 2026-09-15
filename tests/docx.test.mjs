import test from 'node:test';
import assert from 'node:assert/strict';
import {planDocxBytes,planningDiagnosticFilename,planningDiagnosticTitle} from '../scaffold/site/docx.mjs';
import {planningFixture} from './planning-fixture.mjs';
import {fixture} from './fixture.mjs';

test('law-aligned Word output contains the verified country index, selected area evidence and source groups',()=>{
  const data=planningFixture('integrated');
  data.population_pyramids=[{territory_id:'city',period:'2024',unit:'people',source_id:'test-source',bands:[{age:'0–4',male:12,female:11},{age:'5–9',male:10,female:9},{age:'80+',male:1,female:2}]}];
  const bytes=planDocxBytes(data,'city','2024'),raw=new TextDecoder().decode(bytes);
  assert.deepEqual([...bytes.slice(0,4)],[0x50,0x4b,0x03,0x04]);
  for(const expected of ['Territorial Development Planning Diagnostic','River Local Government','Synthetic official development plan index','Territorial Diagnostic','Population structure','Evidence overview','1 Territorial context','2 Priorities and objectives','3 Implementation and monitoring','Diagnostic reading','Interpretation boundary','Statistical evidence annex','Planning laws and guidance','Census and national statistics','International institution data sources','Acquired planning materials','word/media/figure-1.svg','word/media/figure-2.svg','relationships/image'])assert.match(raw,new RegExp(expected));
  assert.ok(raw.includes('image/svg+xml'));
  assert.match(raw,/Confirmed local evidence is available/);
  assert.match(raw,/same parent area/);
  assert.doesNotMatch(raw,/no confirmed value is recorded/i);
  assert.doesNotMatch(raw,/undefined|\[Prepare evidence-based content|Editable working document/);
  assert.equal(planningDiagnosticFilename(data,'city'),'TST-city-territorial-development-planning-diagnostic.docx');
  assert.equal(planningDiagnosticTitle(data),'Territorial Development Planning Diagnostic');
  const spanish=structuredClone(data);spanish.country.locale='es';
  assert.equal(planningDiagnosticFilename(spanish,'city'),'TST-city-diagnostico-territorial-planificacion-desarrollo.docx');
  assert.equal(planningDiagnosticTitle(spanish),'Diagnóstico Territorial para la Planificación del Desarrollo');
});

test('Word output refuses a generic country dataset without verified planning-law structure',()=>{
  assert.throws(()=>planDocxBytes(fixture(),'TST','2024'),/verified country planning document template/);
});
