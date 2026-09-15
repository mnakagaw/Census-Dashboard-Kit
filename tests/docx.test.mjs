import test from 'node:test';
import assert from 'node:assert/strict';
import {planDocxBytes} from '../scaffold/site/docx.mjs';
import {planningFixture} from './planning-fixture.mjs';
import {fixture} from './fixture.mjs';

test('law-aligned Word output contains the verified country index, selected area evidence and source groups',()=>{
  const data=planningFixture('integrated'),bytes=planDocxBytes(data,'city','2024'),raw=new TextDecoder().decode(bytes);
  assert.deepEqual([...bytes.slice(0,4)],[0x50,0x4b,0x03,0x04]);
  for(const expected of ['River Local Government','Synthetic official development plan index','1 Territorial context','2 Priorities and objectives','3 Implementation and monitoring','Planning laws and guidance','Census and national statistics','International institution data sources','Statistical evidence annex','Acquired planning materials'])assert.match(raw,new RegExp(expected));
});

test('Word output refuses a generic country dataset without verified planning-law structure',()=>{
  assert.throws(()=>planDocxBytes(fixture(),'TST','2024'),/verified country planning document template/);
});
