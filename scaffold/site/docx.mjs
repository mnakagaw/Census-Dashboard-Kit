import {displayValue, evidenceRows, observedValue, safeUrl, statusLabel, evidenceStatus} from './model.mjs';
import {planningDocuments, planningSettings, planningSourceGroups, selectedGaps, documentPeriod, acquisitionLabel} from './planning.mjs';

const encoder=new TextEncoder();
const xml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const text=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'');
const englishText=value=>{
  const original=String(value??'');
  const parts=original.split(/\s+(?:\/|／)\s+/).filter(Boolean);
  return [...parts].reverse().find(part=>/[A-Za-z]/.test(part))||original;
};
const spanishCountry=dataset=>/^es(?:-|$)/i.test(dataset?.country?.locale||'') || (dataset?.country?.languages||[]).some(value=>/^es(?:-|$)/i.test(String(value)));
export const planningDiagnosticTitle=dataset=>spanishCountry(dataset)?'Diagnóstico Territorial para la Planificación del Desarrollo':'Territorial Development Planning Diagnostic';
export const planningDiagnosticFilename=(dataset,territoryId)=>`${dataset.country.id}-${territoryId}-${spanishCountry(dataset)?'diagnostico-territorial-planificacion-desarrollo':'territorial-development-planning-diagnostic'}.docx`;
const run=(value,{bold=false,italic=false}={})=>`<w:r><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Yu Gothic"/>${bold?'<w:b/>':''}${italic?'<w:i/>':''}</w:rPr><w:t xml:space="preserve">${xml(text(value))}</w:t></w:r>`;
const paragraph=(value,style='Normal',options={})=>`<w:p><w:pPr><w:pStyle w:val="${style}"/>${options.keep?'<w:keepNext/>':''}${options.pageBreak?'<w:pageBreakBefore/>':''}</w:pPr>${run(value,options)}</w:p>`;
const listItem=value=>`<w:p><w:pPr><w:pStyle w:val="Normal"/><w:ind w:left="420" w:hanging="220"/></w:pPr>${run(`• ${value}`)}</w:p>`;
const cell=(value,{header=false,width=2400}={})=>`<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>${header?'<w:shd w:fill="D9E8E2"/>':''}</w:tcPr>${paragraph(value,'Normal',{bold:header})}</w:tc>`;
function table(rows,widths=[]) {
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D9D9"/><w:left w:val="single" w:sz="4" w:color="D9D9D9"/><w:bottom w:val="single" w:sz="4" w:color="D9D9D9"/><w:right w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideH w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideV w:val="single" w:sz="4" w:color="D9D9D9"/></w:tblBorders></w:tblPr>${rows.map((row,rowIndex)=>`<w:tr>${row.map((value,index)=>cell(value,{header:rowIndex===0,width:widths[index]||2400})).join('')}</w:tr>`).join('')}</w:tbl>`;
}
function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function header(size) {const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};}
function uint(view,offset,value,size){if(size===2)view.setUint16(offset,value,true);else view.setUint32(offset,value,true);}
function join(parts){const size=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;}
function zipStore(entries) {
  const locals=[],centrals=[];let offset=0;
  for(const [name,body] of entries) {
    const filename=encoder.encode(name),content=typeof body==='string'?encoder.encode(body):body,crc=crc32(content);
    const local=header(30);uint(local.view,0,0x04034b50,4);uint(local.view,4,20,2);uint(local.view,6,0,2);uint(local.view,8,0,2);uint(local.view,10,0,2);uint(local.view,12,0,2);uint(local.view,14,crc,4);uint(local.view,18,content.length,4);uint(local.view,22,content.length,4);uint(local.view,26,filename.length,2);uint(local.view,28,0,2);
    locals.push(local.bytes,filename,content);
    const central=header(46);uint(central.view,0,0x02014b50,4);uint(central.view,4,20,2);uint(central.view,6,20,2);uint(central.view,8,0,2);uint(central.view,10,0,2);uint(central.view,12,0,2);uint(central.view,14,0,2);uint(central.view,16,crc,4);uint(central.view,20,content.length,4);uint(central.view,24,content.length,4);uint(central.view,28,filename.length,2);uint(central.view,30,0,2);uint(central.view,32,0,2);uint(central.view,34,0,2);uint(central.view,36,0,2);uint(central.view,38,0,4);uint(central.view,42,offset,4);centrals.push(central.bytes,filename);
    offset+=30+filename.length+content.length;
  }
  const centralBytes=join(centrals),end=header(22);uint(end.view,0,0x06054b50,4);uint(end.view,8,entries.length,2);uint(end.view,10,entries.length,2);uint(end.view,12,centralBytes.length,4);uint(end.view,16,offset,4);
  return join([...locals,centralBytes,end.bytes]);
}
function requiredTemplate(dataset) {
  const template=planningSettings(dataset).document_template;
  if(!template || !['verified_prescribed_index','verified_requirements_based_outline'].includes(template.status) || !Array.isArray(template.sections) || !template.sections.length)throw new Error('A verified country planning document template is required before DOCX generation');
  return template;
}
function sourceName(dataset,id){return dataset.sources.find(row=>row.id===id)?.name||`Unresolved source ${id}`;}
function sourceLabel(dataset,id){const source=dataset.sources.find(row=>row.id===id);return source?`${source.name}${safeUrl(source.url)?` — ${source.url}`:''}`:`Unresolved source ${id}`;}
function basisLabel(dataset,basis){return `${sourceLabel(dataset,basis.source_id)}; ${basis.locator}; checked ${basis.checked_at}`;}
function formattedValue(indicator,value){return displayValue(value,'en',indicator?.display_decimals ?? 2);}
function dateOnly(value){const match=String(value||'').match(/^\d{4}-\d{2}-\d{2}/);return match?.[0]||String(value||'not recorded');}
function evidenceTable(rows) {
  return table([['Indicator','Latest value','Unit','Year / period','Status','Source'],...rows.map(({indicator,row,value,status,source,period})=>[englishText(indicator.name),observedValue(row)===null?'—':formattedValue(indicator,value),row?.unit||indicator.unit,row?.period||period||'Not recorded',evidenceStatus(indicator,row,status),englishText(source?.name||'No source acquired')])],[2600,1100,1000,1100,1300,2100]);
}
function evidenceStatement(entry,areaName) {
  const {indicator,row,value,source,period}=entry,observed=observedValue(row);
  if(observed===null)return `${englishText(indicator.name)}: no confirmed value is recorded for ${areaName}.`;
  const unit=row?.unit||indicator.unit||'',displayPeriod=row?.period||period||'period not recorded';
  return `${englishText(indicator.name)}: ${areaName} recorded ${formattedValue(indicator,value)}${unit?` ${unit}`:''} in ${displayPeriod}. Source: ${englishText(source?.name||'source not acquired')}.`;
}

export function planDocxBytes(dataset,territoryId,period) {
  const area=dataset.territories.find(row=>row.id===territoryId);if(!area)throw new Error('Unknown planning territory');
  const template=requiredTemplate(dataset),settings=planningSettings(dataset),sourceGroups=planningSourceGroups(dataset),evidence=evidenceRows(dataset,territoryId,period),documents=planningDocuments(dataset,territoryId),gaps=selectedGaps(dataset,territoryId);
  const diagnosticTitle=planningDiagnosticTitle(dataset);
  const byTheme=new Map();
  for(const entry of evidence){const theme=englishText(entry.indicator.theme||'Other');if(!byTheme.has(theme))byTheme.set(theme,[]);byTheme.get(theme).push(entry);}
  const body=[];
  body.push(paragraph(diagnosticTitle,'Title',{keep:true}),paragraph(`${area.name}, ${dataset.country.name}`,'Subtitle'),paragraph(`Territorial evidence organized with the planning index applicable to ${dataset.country.name}. This diagnostic assembles the selected area's confirmed statistics, source years, planning references and evidence gaps for local analysis and consultation.`));
  body.push(paragraph('Document basis','Heading1',{keep:true}),table([
    ['Field','Source-checked or selected value'],['Index title',englishText(template.title)],['Planning reference',englishText(template.authority)],['Planning framework',englishText(settings.system?.label||'Not recorded')],['Planning cycle',englishText(settings.system?.cycle||'Not recorded')],['Area',`${area.name} · ${area.type} · ${area.official_code||'administrative code not recorded'}`],['Statistical evidence policy',period==null?'Latest confirmed value for each indicator; source year shown per row':`Selected period ${period}`],['Index basis',template.status==='verified_prescribed_index'?'Prescribed index verified in the cited source':'Diagnostic structure aligned to the cited governance and planning sources']
  ],[2600,6500]));
  body.push(paragraph('Legal and procedural sources','Heading2',{keep:true}),...template.source_ids.map(id=>listItem(sourceLabel(dataset,id))));
  body.push(paragraph('Source register','Heading1',{keep:true}));
  for(const group of sourceGroups){body.push(paragraph(englishText(group.label),'Heading2',{keep:true}),paragraph(englishText(group.note),'Caption'),...(group.sources.length?group.sources.map(source=>listItem(`${englishText(source.name)} — ${source.url}; ${statusLabel(source.status)}; retrieved ${dateOnly(source.retrieved_at)}`)):[paragraph('No source is registered in this category.') ]));}
  body.push(paragraph('Index based on the applicable law or guidance','Heading1',{keep:true}),...template.sections.map(section=>paragraph(`${section.number} ${englishText(section.title)}`,'TOC1')));
  body.push(paragraph('Territorial Diagnostic','Heading1',{pageBreak:true,keep:true}),paragraph(period==null?'Each theme below uses the latest confirmed value available for every indicator in the selected area and shows its source year. Missing values remain missing.':'Each theme below uses the selected period. Missing values remain missing.'));
  if(!evidence.length)body.push(paragraph('No confirmed statistical observation is recorded for this area.'));
  for(const [theme,rows] of byTheme)body.push(paragraph(theme,'Heading2',{keep:true}),...rows.map(entry=>paragraph(evidenceStatement(entry,area.name))),evidenceTable(rows));
  for(const section of template.sections) {
    body.push(paragraph(`${section.number} ${englishText(section.title)}`,'Heading1',{pageBreak:true,keep:true}));
    body.push(paragraph(englishText(section.guidance)));
    body.push(paragraph(`Basis in the cited source: ${basisLabel(dataset,section.legal_basis)}`,'Caption'));
    body.push(paragraph(section.required?'The cited source identifies this as required content.':'The cited source identifies this as optional content.','Normal',{italic:true}));
    const mapped=(section.indicator_ids||[]).map(id=>evidence.find(entry=>entry.indicator.id===id)).filter(Boolean);
    body.push(paragraph('Data-based diagnostic content','Heading2',{keep:true}));
    if(mapped.length)body.push(...mapped.map(entry=>paragraph(evidenceStatement(entry,area.name))),evidenceTable(mapped));
    else body.push(paragraph('No dashboard indicator is mapped to this index section. The section remains in the index because it is identified by the cited law or guidance.'));
  }
  body.push(paragraph('Acquired planning materials','Heading1',{keep:true}));
  if(documents.length)body.push(table([['Material','Period','Acquisition state','Source'],...documents.map(doc=>[doc.title,documentPeriod(doc),acquisitionLabel(doc),sourceName(dataset,doc.source_id)])],[3000,1500,1900,3100]));else body.push(paragraph('No selected-area planning material has been acquired. This does not establish that none exists.'));
  body.push(paragraph('Evidence gaps and next actions','Heading1',{keep:true}),...(gaps.length?gaps.map(gap=>listItem(`${gap.category} — ${statusLabel(gap.status)}: ${gap.detail||'Detail not recorded.'} Next: ${gap.next_action||'Verify with the responsible source.'}`)):[paragraph('No gaps are recorded. This is not a certification of complete evidence.') ]));
  body.push(paragraph('Document control','Heading1',{pageBreak:true,keep:true}),table([['Item','Value'],['Country and area',`${dataset.country.name} · ${area.name}`],['Dataset edition',dataset.generated_at],['Index basis checked',template.verified_at],['Document type',diagnosticTitle]],[2600,6500]));
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Yu Gothic"/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:pPr><w:spacing w:before="0" w:after="180"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="260"/></w:pPr><w:rPr><w:sz w:val="24"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="240"/><w:spacing w:after="80"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="100"/></w:pPr><w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="404040"/></w:rPr></w:style></w:styles>`;
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const docRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const created=new Date(dataset.generated_at).toISOString();
  const core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(diagnosticTitle)}</dc:title><dc:subject>${xml(`Territorial evidence for ${area.name}, ${dataset.country.name}`)}</dc:subject><dc:creator>Census Dashboard Kit</dc:creator><cp:keywords>territorial development planning diagnostic; territorial evidence; ${xml(dataset.country.id)}</cp:keywords><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`;
  const app=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Census Dashboard Kit</Application><AppVersion>1.2</AppVersion></Properties>`;
  return zipStore([['[Content_Types].xml',contentTypes],['_rels/.rels',rootRels],['word/document.xml',documentXml],['word/styles.xml',styles],['word/_rels/document.xml.rels',docRels],['docProps/core.xml',core],['docProps/app.xml',app]]);
}

export function planDocxBlob(dataset,territoryId,period){return new Blob([planDocxBytes(dataset,territoryId,period)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});}
