import test from 'node:test';
import assert from 'node:assert/strict';
import {planDocxBytes,planningDiagnosticFilename,planningDiagnosticTitle} from '../scaffold/site/docx.mjs';
import {planningFixture} from './planning-fixture.mjs';
import {fixture} from './fixture.mjs';

test('law-aligned Word output contains the verified country index, selected area evidence and source groups',()=>{
  const data=planningFixture('integrated'),bytes=planDocxBytes(data,'city','2024'),raw=new TextDecoder().decode(bytes);
  assert.deepEqual([...bytes.slice(0,4)],[0x50,0x4b,0x03,0x04]);
  for(const expected of ['Territorial Development Planning Diagnostic','River Local Government','Synthetic official development plan index','Territorial Diagnostic','1 Territorial context','2 Priorities and objectives','3 Implementation and monitoring','Data-based diagnostic content','Planning laws and guidance','Census and national statistics','International institution data sources','Acquired planning materials'])assert.match(raw,new RegExp(expected));
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
