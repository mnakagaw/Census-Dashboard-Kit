import {displayValue, evidenceRows, observedValue, safeUrl, statusLabel, evidenceStatus, finite, territoryLineage, mapGeometry, pyramidBands} from './model.mjs';
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
function evidenceTable(dataset,area,rows) {
  const displayed=rows.map(entry=>{
    if(finite(entry.value)||englishText(entry.indicator.theme)!=='National context')return {entry,scope:''};
    const broader=nearestBroaderReference(dataset,area,entry);
    return broader?{entry:broader.entry,scope:`${broader.area.name} reference`}:{entry,scope:''};
  });
  return table([['Indicator and scope','Latest value','Unit','Year / period','Status','Source'],...displayed.map(({entry,scope})=>{
    const {indicator,row,value,status,source,period}=entry;
    return [`${englishText(indicator.name)}${scope?` — ${scope}`:''}`,finite(value)?formattedValue(indicator,value):'—',row?.unit||indicator.unit,row?.period||period||'Not recorded',`${scope?'National context · ':''}${evidenceStatus(indicator,row,status)}`,englishText(source?.name||'No source acquired')];
  })],[2400,1000,1600,900,1200,1800]);
}
function comparablePeerSummary(dataset,area,entry) {
  if(!finite(entry.value))return null;
  const period=entry.row?.period||entry.period,unit=entry.row?.unit||entry.indicator.unit||'';
  const peers=dataset.territories.filter(candidate=>candidate.level===area.level&&candidate.parent_id===area.parent_id).map(candidate=>{
    const row=dataset.observations.find(item=>item.territory_id===candidate.id&&item.indicator_id===entry.indicator.id&&String(item.period)===String(period)&&observedValue(item)!==null);
    const compatible=row&&(!entry.row?.definition_id||!row.definition_id||row.definition_id===entry.row.definition_id)&&(row.unit||entry.indicator.unit)===(entry.row?.unit||entry.indicator.unit);
    return compatible?{area:candidate,value:observedValue(row)}:null;
  }).filter(Boolean).sort((a,b)=>b.value-a.value);
  if(peers.length<2)return null;
  const values=peers.map(item=>item.value).sort((a,b)=>a-b),middle=Math.floor(values.length/2),median=values.length%2?values[middle]:(values[middle-1]+values[middle])/2;
  const rank=peers.findIndex(item=>item.area.id===area.id)+1;
  return rank?{period,unit,peers,median,rank,count:peers.length}:null;
}
function nearestBroaderReference(dataset,area,entry) {
  const ancestors=territoryLineage(dataset,area.id).slice(0,-1).reverse();
  for(const ancestor of ancestors){const match=evidenceRows(dataset,ancestor.id,null,[entry.indicator.id])[0];if(finite(match?.value))return {area:ancestor,entry:match};}
  return null;
}
function evidenceStatement(dataset,area,entry) {
  const {indicator,row,value,source,period}=entry;
  if(!finite(value))return '';
  const unit=row?.unit||indicator.unit||'',displayPeriod=row?.period||period||'period not recorded',peer=comparablePeerSummary(dataset,area,entry);
  const comparison=peer?` Among ${peer.count} comparable ${area.type || area.level} areas in the same parent area, this value ranks ${peer.rank} and the median is ${formattedValue(indicator,peer.median)}${unit?` ${unit}`:''}.`:'';
  return `${englishText(indicator.name)} is ${formattedValue(indicator,value)}${unit?` ${unit}`:''} for ${area.name} (${displayPeriod}).${comparison} Source: ${englishText(source?.name||'source not acquired')}.`;
}
function sectionNarrative(dataset,area,entries) {
  const available=entries.filter(entry=>finite(entry.value)),missing=entries.filter(entry=>!finite(entry.value)),parts=[];
  if(available.length)parts.push(`Confirmed local evidence is available for ${available.length} of ${entries.length} indicators mapped to this section. Values retain their individual source years and should not be read as a single-year composite.`);
  else parts.push(`No confirmed value at ${area.name}'s administrative level is available for the ${entries.length} indicators mapped to this section.`);
  parts.push(...available.map(entry=>evidenceStatement(dataset,area,entry)).filter(Boolean));
  if(missing.length){
    const labels=missing.map(entry=>englishText(entry.indicator.name));
    const broader=missing.map(entry=>({label:englishText(entry.indicator.name),reference:nearestBroaderReference(dataset,area,entry)})).filter(item=>item.reference);
    parts.push(`Local evidence gap: ${labels.join('; ')}. These indicators remain excluded from local comparison and are not inferred from another area.`);
    if(broader.length)parts.push(`Broader-area context is available separately: ${broader.map(({label,reference})=>`${label} — ${reference.area.name}: ${formattedValue(reference.entry.indicator,reference.entry.value)} ${reference.entry.row?.unit||reference.entry.indicator.unit||''} (${reference.entry.row?.period||reference.entry.period})`).join('; ')}. These broader values are not assigned to ${area.name}.`);
  }
  return parts;
}
function svgBase(width,height,content,title){return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${xml(title)}</title><rect width="100%" height="100%" fill="#f7faf9"/><style>text{font-family:Aptos,Arial,sans-serif;fill:#17364a}.label{font-size:13px;font-weight:600}.small{font-size:11px;fill:#53666f}.value{font-size:11px;font-weight:700}.axis{stroke:#aab9bf;stroke-width:1}.selected{stroke:#b47706;stroke-width:3}.area{stroke:#fff;stroke-width:1}</style>${content}</svg>`;}
function locationMapSvg(dataset,area) {
  const level=area.level==='national'?(dataset.territories.find(item=>item.level!=='national')?.level):area.level;
  const features=(dataset.boundaries?.features||[]).filter(feature=>dataset.territories.find(item=>item.id===feature.properties?.territory_id)?.level===level);
  if(!features.length)return null;
  const geometry=mapGeometry(features,area.level==='national'?'':area.id,720,360);if(!geometry.paths.length)return null;
  const paths=geometry.paths.map(path=>`<path d="${path.d}" fill="${path.id===area.id?'#d9b45a':'#bfd9d0'}" class="area ${path.id===area.id?'selected':''}"/>`).join('');
  return svgBase(720,360,`${paths}<text x="18" y="28" class="label">Location of ${xml(area.name)}</text><text x="18" y="348" class="small">Reference boundaries; gold outline marks the selected area.</text>`,`Location of ${area.name}`);
}
function populationPyramidSvg(dataset,area) {
  const record=dataset.population_pyramids?.find(item=>item.territory_id===area.id);if(!record?.bands?.length)return null;
  const bands=pyramidBands(record.bands),max=Math.max(...bands.flatMap(row=>[row.male,row.female]).filter(finite),1),center=360,rowHeight=18,top=42,height=Math.max(210,top+bands.length*rowHeight+34),half=275;
  const bars=bands.map((row,index)=>{const y=top+index*rowHeight,male=Math.max(0,row.male)/max*half,female=Math.max(0,row.female)/max*half;return `<rect x="${center-male}" y="${y}" width="${male}" height="13" fill="#456f83"/><rect x="${center}" y="${y}" width="${female}" height="13" fill="#b66f63"/><text x="${center}" y="${y+11}" text-anchor="middle" class="small">${xml(row.age)}</text>`;}).join('');
  return svgBase(720,height,`<text x="18" y="24" class="label">Population by age and sex — ${xml(area.name)}, ${xml(record.period)}</text><text x="82" y="39" class="small">Male</text><text x="638" y="39" text-anchor="end" class="small">Female</text><line x1="${center}" y1="38" x2="${center}" y2="${height-24}" class="axis"/>${bars}`,`Population pyramid for ${area.name}`);
}
function chartTitleLines(value,maxLength=52) {
  const words=englishText(value).trim().split(/\s+/).filter(Boolean),lines=[];
  for(const word of words) {
    const current=lines.at(-1)||'';
    if(!current)lines.push(word);
    else if(`${current} ${word}`.length<=maxLength)lines[lines.length-1]=`${current} ${word}`;
    else if(lines.length<2)lines.push(word);
    else {lines[1]=`${lines[1].replace(/…$/,'')}…`;break;}
  }
  if(lines.length===2&&lines[1].length>maxLength)lines[1]=`${lines[1].slice(0,maxLength-1).trim()}…`;
  return lines.length?lines:['Indicator'];
}
function comparisonChartSvg(dataset,area,entries) {
  const charts=entries.map(entry=>{
    if(finite(entry.value))return {entry,chartArea:area,peer:comparablePeerSummary(dataset,area,entry),context:'Selected-area value'};
    const broader=nearestBroaderReference(dataset,area,entry);
    return broader?{entry:broader.entry,chartArea:broader.area,peer:comparablePeerSummary(dataset,broader.area,broader.entry),context:`Broader-area context for missing ${area.name} value`}:null;
  }).filter(item=>item?.peer).slice(0,4);if(!charts.length)return null;
  // Reserve the right edge for complete value labels. The chart remains readable
  // when the unit is longer than a symbol (for example people/household).
  // Keep a fixed label gutter on the right. Long units such as
  // "males per 100 females" must remain inside the exported page instead of
  // extending past the SVG viewport after Word scales the image.
  const width=720,rowHeight=104,height=38+charts.length*rowHeight+18,barX=245,barWidth=265;
  const rows=charts.map(({entry,chartArea,peer,context},index)=>{
    const y=38+index*rowHeight,max=Math.max(entry.value,peer.median,1),current=entry.value/max*barWidth,median=peer.median/max*barWidth,lines=chartTitleLines(entry.indicator.name),unit=entry.row?.unit||entry.indicator.unit||'';
    const title=`<text x="18" y="${y+13}" class="label">${lines.map((line,lineIndex)=>`<tspan x="18" dy="${lineIndex?15:0}">${xml(line)}</tspan>`).join('')}</text>`;
    return `${title}<text x="18" y="${y+43}" class="small">${xml(context)} · ${xml(peer.period)} · ${peer.count} comparable areas</text><text x="${barX-8}" y="${y+64}" text-anchor="end" class="small">${xml(chartArea.name)}</text><rect x="${barX}" y="${y+51}" width="${current}" height="16" fill="#267966"/><text x="${Math.min(width-10,barX+current+6)}" y="${y+64}" class="value">${xml(formattedValue(entry.indicator,entry.value))} ${xml(unit)}</text><text x="${barX-8}" y="${y+88}" text-anchor="end" class="small">Peer median</text><rect x="${barX}" y="${y+75}" width="${median}" height="16" fill="#9db7c1"/><text x="${Math.min(width-10,barX+median+6)}" y="${y+88}" class="value">${xml(formattedValue(entry.indicator,peer.median))} ${xml(unit)}</text>`;
  }).join('');
  return svgBase(width,height,`<text x="18" y="24" class="label">Available area values and same-level medians</text>${rows}`,`Indicator comparison for ${area.name}`);
}
function imageParagraph(relationshipId,width,height,alt) {
  const cx=Math.round(width*9525),cy=Math.round(height*9525);
  return `<w:p><w:pPr><w:spacing w:before="120" w:after="160"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${relationshipId.replace(/\D/g,'')||1}" name="${xml(alt)}" descr="${xml(alt)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${xml(alt)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

export function planDocxBytes(dataset,territoryId,period) {
  const area=dataset.territories.find(row=>row.id===territoryId);if(!area)throw new Error('Unknown planning territory');
  const template=requiredTemplate(dataset),settings=planningSettings(dataset),sourceGroups=planningSourceGroups(dataset),evidence=evidenceRows(dataset,territoryId,period),documents=planningDocuments(dataset,territoryId),gaps=selectedGaps(dataset,territoryId);
  const diagnosticTitle=planningDiagnosticTitle(dataset);
  const byTheme=new Map();
  for(const entry of evidence){const theme=englishText(entry.indicator.theme||'Other');if(!byTheme.has(theme))byTheme.set(theme,[]);byTheme.get(theme).push(entry);}
  const body=[],images=[];
  const addSvg=(svg,name,displayWidth=620)=>{
    if(!svg)return '';
    const width=Number(svg.match(/width="([\d.]+)"/)?.[1])||720,height=Number(svg.match(/height="([\d.]+)"/)?.[1])||360,displayHeight=Math.round(displayWidth*height/width),relationshipId=`rId${images.length+2}`;
    images.push({relationshipId,name:`figure-${images.length+1}.svg`,svg});
    return imageParagraph(relationshipId,displayWidth,displayHeight,name);
  };
  const areaLabel=area.id===dataset.country.national_territory_id?dataset.country.name:`${area.name}, ${dataset.country.name}`;
  body.push(paragraph(diagnosticTitle,'Title',{keep:true}),paragraph(areaLabel,'Subtitle'),paragraph(`Territorial evidence organized with the planning index applicable to ${dataset.country.name}. This diagnostic assembles the selected area's confirmed statistics, source years, planning references and evidence gaps for local analysis and consultation.`));
  body.push(paragraph('Document basis','Heading1',{keep:true}),table([
    ['Field','Source-checked or selected value'],['Index title',englishText(template.title)],['Planning reference',englishText(template.authority)],['Planning framework',englishText(settings.system?.label||'Not recorded')],['Planning cycle',englishText(settings.system?.cycle||'Not recorded')],['Area',`${area.name} · ${area.type} · ${area.official_code||'administrative code not recorded'}`],['Statistical evidence policy',period==null?'Latest confirmed value for each indicator; source year shown per row':`Selected period ${period}`],['Index basis',template.status==='verified_prescribed_index'?'Prescribed index verified in the cited source':'Diagnostic structure aligned to the cited governance and planning sources']
  ],[2600,6500]));
  body.push(paragraph('Document control','Heading2',{keep:true}),table([['Item','Value'],['Country and area',`${dataset.country.name} · ${area.name}`],['Dataset edition',dataset.generated_at],['Index basis checked',template.verified_at],['Document type',diagnosticTitle]],[2600,6500]));
  body.push(paragraph('Legal and procedural sources','Heading2',{keep:true}),...template.source_ids.map(id=>listItem(sourceLabel(dataset,id))));
  body.push(paragraph('Source register','Heading1',{keep:true}));
  for(const group of sourceGroups){body.push(paragraph(englishText(group.label),'Heading2',{keep:true}),paragraph(englishText(group.note),'Caption'),...(group.sources.length?group.sources.map(source=>listItem(`${englishText(source.name)} — ${source.url}; ${statusLabel(source.status)}; retrieved ${dateOnly(source.retrieved_at)}`)):[paragraph('No source is registered in this category.') ]));}
  body.push(paragraph('Index based on the applicable law or guidance','Heading1',{keep:true}),...template.sections.map(section=>paragraph(`${section.number} ${englishText(section.title)}`,'TOC1')));
  body.push(paragraph('Territorial Diagnostic','Heading1',{pageBreak:true,keep:true}),paragraph(period==null?'The figures and diagnostic readings use the latest confirmed value available for each indicator and retain every source year. Missing local values remain missing; broader-area values are labelled as context rather than assigned to this area.':'The figures and diagnostic readings use the selected period. Missing values remain missing.'));
  const availableCount=evidence.filter(entry=>finite(entry.value)).length;
  body.push(paragraph('Evidence overview','Heading2',{keep:true}),paragraph(`${availableCount} of ${evidence.length} mapped indicators have a confirmed or fully calculated value for ${area.name}. The chapter narratives below compare like areas only where the indicator, unit and source period support that comparison.`));
  body.push(addSvg(locationMapSvg(dataset,area),`Location of ${area.name}`));
  const pyramid=populationPyramidSvg(dataset,area);if(pyramid)body.push(paragraph('Population structure','Heading2',{keep:true}),addSvg(pyramid,`Population pyramid for ${area.name}`));
  if(!evidence.length)body.push(paragraph('No statistical observation is mapped to this territorial diagnostic.'));
  for(const [sectionIndex,section] of template.sections.entries()) {
    body.push(paragraph(`${section.number} ${englishText(section.title)}`,'Heading1',{pageBreak:sectionIndex===0,keep:true}));
    body.push(paragraph(englishText(section.guidance),'Caption'));
    body.push(paragraph(`Basis in the cited source: ${basisLabel(dataset,section.legal_basis)}`,'Caption'));
    const mapped=(section.indicator_ids||[]).map(id=>evidence.find(entry=>entry.indicator.id===id)).filter(Boolean);
    body.push(paragraph('Diagnostic reading','Heading2',{keep:true}));
    if(mapped.length){
      body.push(...sectionNarrative(dataset,area,mapped).map(value=>paragraph(value)));
      const comparisonChart=comparisonChartSvg(dataset,area,mapped);if(comparisonChart)body.push(addSvg(comparisonChart,`${englishText(section.title)} comparison for ${area.name}`));
      body.push(paragraph('Interpretation boundary','Heading2',{keep:true}),paragraph(`These figures describe recorded conditions and geographic differences. They do not by themselves establish causes, resident priorities, targets or approved interventions. ${section.required?'This subject is retained because the cited framework requires it in the planning evidence base.':'The cited framework treats this subject as optional.'}`));
    } else body.push(paragraph('No dashboard indicator is mapped to this index section. The heading remains because it is part of the source-checked planning index. Evidence and intended planning content must be added before this section can support a decision.'));
  }
  body.push(paragraph('Statistical evidence annex','Heading1',{pageBreak:true,keep:true}),paragraph('This annex lists each mapped indicator once. A dash means that no confirmed value exists for the selected area; it is not zero. Broader-area context mentioned in the narrative is not copied into the selected-area value column.'));
  for(const [theme,rows] of byTheme)body.push(paragraph(theme,'Heading2',{keep:true}),evidenceTable(dataset,area,rows));
  // Keep the material register and the evidence-gap section together.  A
  // page break avoids leaving only a continued table header at the top of the
  // final page when a long statistical annex nearly fills the previous page.
  body.push(paragraph('Acquired planning materials','Heading1',{pageBreak:true,keep:true}));
  if(documents.length)body.push(table([['Material','Period','Acquisition state','Source'],...documents.map(doc=>[doc.title,documentPeriod(doc),acquisitionLabel(doc),sourceName(dataset,doc.source_id)])],[3000,1500,1900,3100]));else body.push(paragraph('No selected-area planning material has been acquired. This does not establish that none exists.'));
  body.push(paragraph('Evidence gaps and next actions','Heading1',{keep:true}),...(gaps.length?gaps.map(gap=>listItem(`${gap.category} — ${statusLabel(gap.status)}: ${gap.detail||'Detail not recorded.'} Next: ${gap.next_action||'Verify with the responsible source.'}`)):[paragraph('No gaps are recorded. This is not a certification of complete evidence.') ]));
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Yu Gothic"/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:pPr><w:spacing w:before="0" w:after="180"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="260"/></w:pPr><w:rPr><w:sz w:val="24"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="240"/><w:spacing w:after="80"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="100"/></w:pPr><w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="404040"/></w:rPr></w:style></w:styles>`;
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="svg" ContentType="image/svg+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const docRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${images.map(image=>`<Relationship Id="${image.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${image.name}"/>`).join('')}</Relationships>`;
  const created=new Date(dataset.generated_at).toISOString();
  const core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(diagnosticTitle)}</dc:title><dc:subject>${xml(`Territorial evidence for ${area.name}, ${dataset.country.name}`)}</dc:subject><dc:creator>Census Dashboard Kit</dc:creator><cp:keywords>territorial development planning diagnostic; territorial evidence; ${xml(dataset.country.id)}</cp:keywords><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`;
  const app=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Census Dashboard Kit</Application><AppVersion>1.2</AppVersion></Properties>`;
  return zipStore([['[Content_Types].xml',contentTypes],['_rels/.rels',rootRels],['word/document.xml',documentXml],['word/styles.xml',styles],['word/_rels/document.xml.rels',docRels],...images.map(image=>[`word/media/${image.name}`,image.svg]),['docProps/core.xml',core],['docProps/app.xml',app]]);
}

export function planDocxBlob(dataset,territoryId,period){return new Blob([planDocxBytes(dataset,territoryId,period)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});}
