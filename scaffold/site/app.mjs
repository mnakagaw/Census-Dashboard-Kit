import {
  finite, escapeHtml as e, safeUrl, displayValue, statusLabel, evidenceStatus, sourceFor,
  periodsFor, observedPeriodsForArea, themePeriodCoverage, themeLatestCoverage, latestDisplayPeriod, latestComparisonPeriod, latestDisplayMode, observationState, areaObservationState, localLevels, levelLabel, nationalOnly, initialState,
  selectTerritory, territoryLineage, territoryOptionLabel, hierarchyControls, selectHierarchyOption, routeQuery, countryDiagnosticUrl, comparisonScope, comparisonAreas, preferredThematicLevel, comparisonLevelsForScope, normalizeThematicState, comparisonRows, comparisonCompatibility, rankedRows, searchRows, rankingReveal, rankingScrollTop, distribution, adjustedMapZoom,
  seriesFor, observedValue, makeCsv, evidenceCsv, safeFilename, planningMarkdown,
  planningHtml, documentsCsv, mapGeometry, seriesGeometry, pyramidBands
} from './model.mjs';
import {planningSettings,planningDocuments,planningSourceGroups,documentGroups,documentPeriod,officialMapState,hasDocumentReference,selectedGaps,relatedResourceUrl,categoryLabels} from './planning.mjs';
import {renderDocumentGroups,renderDocument} from './planning-view.mjs';
import {comparisonSet,internalComparison,observationMeaning,observationContext,isTerminalTerritory} from './analysis.mjs';
import {renderInternalComparison,diagnosticMarkdown,diagnosticHtml,diagnosticCsv,renderSourceAttribution,seriesSourceLabel} from './diagnostic.mjs';
import {resolveLanguage,languageLocale,translateInterface,translateText,SUPPORTED_LANGUAGES} from './i18n.mjs';
import {planDocxBlob,planningDiagnosticFilename,planningDiagnosticTitle} from './docx.mjs';

const base = new URL('../', import.meta.url);
const app = document.getElementById('app');
const page = document.body.dataset.page || 'home';
const pageNames = {home:'Territorial diagnostic',territorial:'Territorial diagnostic',thematic:'Thematic diagnostic',planning:'Planning materials and links',database:'Data register'};
const storedLanguage=()=>{try{return localStorage.getItem('census-dashboard-language')||'';}catch{return '';}};
let language=resolveLanguage({query:new URLSearchParams(location.search).get('lang'),stored:storedLanguage(),browserLanguages:navigator.languages||[navigator.language]});
let dataset, state, updateStatus;
let areaSearch='', rankSearch='', rankOrder='desc', mapExtent='selected', mapZoom=1, allAreaOpen=false;
const fmt = (value,indicator=currentMetric()) => displayValue(value,languageLocale(language),indicator?.display_decimals ?? 2);
const areaFor = id => dataset.territories.find(area => area.id === id);
const metricFor = id => dataset.indicators.find(indicator => indicator.id === id);
const displayIndicators = () => dataset.indicators.filter(indicator => indicator.display_role!=='calculation_input');
const currentArea = () => areaFor(state.selected);
const currentMetric = () => metricFor(state.metric);
const worldMode = () => ['world','regional'].includes(dataset?.analysis?.kind);
const latestMode = () => latestDisplayMode(dataset);
const comparisonLevelsFor = stateLike => comparisonLevelsForScope(dataset,stateLike);
const link = (url, label, classes='') => safeUrl(url) ? `<a class="${e(classes)}" href="${e(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${e(label)}<span class="sr-only"> (opens a new tab)</span></a>` : `<span>${e(label)} · No source link</span>`;
const button = (action, label, attributes='', classes='button secondary') => `<button type="button" class="${classes}" data-action="${action}" ${attributes}>${label}</button>`;
const routeWithLanguage=(next=state)=>{const query=new URLSearchParams(routeQuery(dataset,next));query.set('lang',language);return query.toString();};
const pageUrl = target => {
  const url = new URL(target==='home' ? './' : `${target}/`,base);
  const next=target==='thematic'?{...state,level:preferredThematicLevel(dataset,state.selected,state.metric,state.level)}:state;
  url.search=routeWithLanguage(next);return url.href;
};
const pageLink = (target, label, classes='button secondary') => `<a class="${classes}" href="${e(pageUrl(target))}">${e(label)}</a>`;
const sourceNote = (indicator, observation, prefix='Source') => {
  const source=sourceFor(dataset,indicator,observation);
  return `<div class="source-note source-note-block"><span>${e(prefix)}</span>${source ? renderSourceAttribution(indicator,observation,source,observation?.period || state?.period,language) : 'No source collected'}${source?.retrieved_at ? `<span>Retrieved ${e(source.retrieved_at.slice(0,10))}.</span>` : ''}</div>`;
};
function periodControl(id='period-select') {
  if(latestMode())return '<div class="latest-period-policy"><span>Display period</span><strong>Latest available for each indicator</strong><small>The source year is shown beside every value.</small></div>';
  const options = periodsFor(dataset,state.metric);
  if (state.period && !options.includes(state.period)) options.unshift(state.period);
  return `<label class="field" for="${id}"><span>Source period</span><select id="${id}" data-control="period">${options.length?options.map(period=>`<option value="${e(period)}" ${period===state.period?'selected':''}>${e(period)}${periodsFor(dataset,state.metric).includes(period)?'':' · no observation for this indicator'}</option>`).join(''):'<option value="">No periods acquired</option>'}</select></label>`;
}
function indicatorControl() {
  const indicators=displayIndicators(),themes=[...new Set(indicators.map(indicator=>indicator.theme || 'Other'))];
  return `<label class="field grow" for="indicator-select"><span>Theme / indicator</span><select id="indicator-select" data-control="metric">${themes.map(theme=>`<optgroup label="${e(theme)}">${indicators.filter(indicator=>(indicator.theme||'Other')===theme).map(indicator=>`<option value="${e(indicator.id)}" ${indicator.id===state.metric?'selected':''}>${e(indicator.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
}
function areaControls() {
  const areas=dataset.territories.filter(area=>!territoryLineage(dataset,area.id).slice(0,-1).some(parent=>isTerminalTerritory(dataset,parent)));
  const groups=[...new Set(areas.map(area=>area.level))];
  const hits=areaSearch ? areas.filter(area=>[area.name,area.id,area.official_code].some(value=>String(value||'').toLocaleLowerCase().includes(areaSearch.toLocaleLowerCase()))) : [];
  const hierarchy=(['territorial','planning'].includes(page)||worldMode())?hierarchyControls(dataset,state.selected).filter(control=>!comparisonSet(dataset,control.parent.id).terminal):[];
  const flatSelector=`<label class="field" for="area-select"><span>Selected area${hierarchy.length?' · all records':''}</span><select id="area-select" data-control="area">${groups.map(level=>`<optgroup label="${e(levelLabel(level))}">${areas.filter(area=>area.level===level).map(area=>`<option value="${e(area.id)}" ${area.id===state.selected?'selected':''}>${e(territoryOptionLabel(dataset,area))}${area.level==='national'?(worldMode()?' · world':' · national'):''}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
  const search=`<label class="field" for="area-search"><span>Find an area by name or code</span><input id="area-search" type="search" data-control="area-search" value="${e(areaSearch)}" autocomplete="off" placeholder="Name or code"></label>${areaSearch?`<div class="search-results" aria-label="Area search results">${hits.length?hits.slice(0,50).map(area=>button('select',`${e(area.name)}<small>${e(levelLabel(area.level))} · ${e(area.official_code || area.id)}</small>`,`data-id="${e(area.id)}"`,'result-button')).join(''):'<p>No matching areas.</p>'}${hits.length>50?`<p>${hits.length} matches; narrow your search to see more.</p>`:''}</div>`:''}`;
  if(!hierarchy)return `<div class="area-controls simple-area-controls">${flatSelector}<div class="area-support-row">${search}${state.selected!==dataset.country.national_territory_id?button('national',worldMode()?'Return to world view':'Return to national view','','text-button'):''}</div></div>`;
  const selectedLineage=territoryLineage(dataset,state.selected);
  const hierarchyFields=hierarchy.map((control,index)=>{
    const types=[...new Set(control.options.slice(1).map(option=>areaFor(option.targetId)?.type).filter(Boolean))];
    const level=control.levels.map(levelLabel).join(' / '),typeLabel=types.length?types.map(value=>value.charAt(0).toUpperCase()+value.slice(1).replaceAll('_',' ')).join(' / '):level;
    const pathArea=selectedLineage[index+1];
    const optionLabel=option=>{
      const target=areaFor(option.targetId);
      if(!option.value)return control.parent.level==='national'?`${control.parent.name} — national view`:`No ${typeLabel.toLowerCase()} selected — use ${control.parent.name}`;
      if(target&&control.context&&pathArea?.id===target.id)return `${territoryOptionLabel(dataset,target)} — select this ${target.type || target.level}`;
      return target?territoryOptionLabel(dataset,target):option.label;
    };
    const contextLabel=control.context?`${pathArea?.name||control.parent.name} · a lower area is currently selected`:'';
    return `<label class="field hierarchy-step" for="hierarchy-${index}"><span><b>${index+1}</b><em>${e(typeLabel)}</em><small>${e(level)}</small></span><select id="hierarchy-${index}" data-control="hierarchy" data-parent="${e(control.parent.id)}">${control.context?`<option value="context" selected disabled>${e(contextLabel)}</option>`:''}${control.options.map(option=>`<option value="${e(option.value)}" ${option.value===control.value?'selected':''}>${e(optionLabel(option))}</option>`).join('')}</select></label>`;
  }).join('');
  return `<div class="area-controls guided-area-controls"><div class="area-picker-intro"><strong>Select the area to diagnose</strong><span>Choose the broad area first. The next list is limited to places inside it. To return from a lower area, select the upper area again.</span></div><div class="hierarchy-controls">${hierarchyFields}</div><div class="area-quick-actions">${state.selected!==dataset.country.national_territory_id?button('national',worldMode()?'Return to world view':'Return to national view','','text-button'):''}<details class="micro-details all-area-selector" data-all-area-selector ${allAreaOpen?'open':''}><summary>Search or jump to another area</summary><div class="all-area-tools">${flatSelector}${search}</div></details></div></div>`;
}
function thematicScopeControl() {
  const scope=comparisonScope(dataset,state) || currentArea();
  const areas=dataset.territories.filter(area=>area.level==='national'||(!isTerminalTerritory(dataset,area)&&dataset.territories.some(child=>territoryLineage(dataset,child.id).slice(0,-1).some(parent=>parent.id===area.id))));
  const groups=[...new Set(areas.map(area=>area.level))];
  return `<label class="field thematic-scope-field" for="thematic-scope"><span>Area to compare within</span><select id="thematic-scope" data-control="thematic-scope">${groups.map(level=>`<optgroup label="${e(levelLabel(level))}">${areas.filter(area=>area.level===level).map(area=>`<option value="${e(area.id)}" ${area.id===scope.id?'selected':''}>${e(territoryOptionLabel(dataset,area))}${area.level==='national'?' · national':''}</option>`).join('')}</optgroup>`).join('')}</select><small>${scope.level==='national'?`Comparing ${e(levelLabel(state.level).toLowerCase())} areas across ${e(dataset.country.name)}.`:`Comparing ${e(levelLabel(state.level).toLowerCase())} areas inside ${e(scope.name)}.`}</small></label>`;
}
function hierarchyNavigation() {
  const lineage=territoryLineage(dataset,state.selected);
  return `<nav class="hierarchy-navigation" aria-label="Area hierarchy">${lineage.map(area=>area.id===state.selected?`<span aria-current="location">${e(area.name)}</span>`:button('select',e(area.name),`data-id="${e(area.id)}"`,'text-button')).join('<span aria-hidden="true"> › </span>')}</nav>`;
}
function countryDetailLink() {
  const target=countryDiagnosticUrl(dataset,state,base);
  if(!target)return '';
  const localized=new URL(target);localized.searchParams.set('lang',language);
  return `<p class="country-detail-link"><a class="button secondary" href="${e(localized.href)}">Open ${e(currentArea().name)} country diagnostic</a><small>The selected period is retained. An indicator is carried across only through an explicit concept mapping; otherwise the country edition explains its separate default indicator. Country data are not estimated from world values. Browser Back returns to this world selection.</small></p>`;
}
function identity(area=currentArea()) {
  return `<p class="identity">${e(levelLabel(area.level))} · ${e(area.type)}${area.official_code ? ` · Code ${e(area.official_code)}` : ` · Provider ID ${e(area.id)}`}</p><details class="micro-details"><summary>Area identity and boundary edition</summary><p>Code system: ${e(area.code_system || 'Not specified')}. Boundary edition: ${e(area.boundary_version || 'Not verified')}. ${e(dataset.country.geography_note || '')}</p></details>`;
}
function stateMessage(result, local = currentArea().level !== 'national') {
  if (finite(result.value)) return '';
  const explanation = result.status==='not_collected' ? `${local?'Local observations':'Observations'} for this indicator have not been collected.` : result.status==='missing' ? (latestMode()?'No confirmed observation is available for this selected area.':'No observation is available for the selected source period.') : `This observation is ${statusLabel(result.status).toLowerCase()}.`;
  return `<p class="missing-note">${e(explanation)} ${latestMode()?'The selected area and indicator are retained.':'The selected area, indicator and period are retained.'}</p>`;
}
function countCoverage() {
  const local=dataset.territories.filter(area=>area.level!=='national');
  return {local:local.length, observed:new Set(dataset.observations.filter(row=>row.territory_id!==dataset.country.national_territory_id&&observedValue(row)!==null).map(row=>row.territory_id)).size};
}
function scopeBanner() {
  const coverage=countCoverage();
  const pilot=dataset.analysis?.pilot;
  if(pilot?.primary_series_family==='census' && !pilot.available_series_families?.includes('census'))return '<div class="scope-banner"><strong>Census data from the national source are the intended primary series and have not yet been integrated in this build.</strong> Values currently shown are reference series for country context and remain separate from future census observations.</div>';
  if(pilot?.primary_series_family==='census' && pilot.census_adapter_status==='partial')return `<div class="scope-banner"><strong>The primary census population series currently covers ${e(pilot.census_country_ids.join(', '))}; the seven-country total is unavailable.</strong> ${e(pilot.census_pending_country_ids.join(', '))} remain pending. Country years, methods and source precision are retained. International reference indicators remain separate context series.</div>`;
  if(worldMode())return '<div class="scope-banner"><strong>Source first, complete cover second.</strong> An exact observation for the selected area has priority. Only indicators with an approved method may be calculated from a complete, non-overlapping membership cover. A country total makes missing municipalities beneath it irrelevant. Percentages and non-additive measures are never simply averaged.</div>';
  return nationalOnly(dataset) ? `<div class="scope-banner"><strong>National statistics; no local observations are integrated.</strong> ${coverage.local ? `${coverage.local} reference areas are selectable.` : 'No local area registry has been collected.'} This is a coverage statement for the whole dataset, not evidence that local indicators are available. National figures are not local estimates.</div>` : `<div class="scope-banner"><strong>Acquired evidence, with explicit gaps.</strong> Across all recorded indicators and periods, ${coverage.observed} of ${coverage.local} local areas have at least one observation. This does not mean that every indicator, period or administrative level is covered; each comparison states its exact coverage.</div>`;
}
function updateBanner() {
  const sourceUpdate=planningSettings(dataset).update;
  const stopped=updateStatus?.status==='stopped'?updateStatus:sourceUpdate?.status==='stopped'?sourceUpdate:null;
  return stopped?`<p class="notice update-stopped" role="status"><strong>Update stopped — showing the last verified data.</strong> ${e(stopped.message)} Last successful update: ${e(stopped.last_success_at || 'Not recorded')}. Data edition: ${e(dataset.generated_at)}. Checked ${e(stopped.checked_at)}.</p>`:'';
}
function mapPanel({thematic=false,planning=false}={}) {
  const allFeatures=dataset.boundaries?.features || [];
  const selected=currentArea();
  const worldLocation=worldMode()&&!thematic&&!planning;
  // Location follows the navigation hierarchy, independently of lower comparison cohorts.
  const childIds=new Set(worldLocation&&!isTerminalTerritory(dataset,selected)?dataset.territories.filter(area=>area.parent_id===selected.id).map(area=>area.id):[]);
  const targetLevel = worldLocation&&childIds.size?areaFor([...childIds][0])?.level:thematic ? state.level : selected.level==='national' ? localLevels(dataset)[0] : selected.level;
  const rows=thematic?comparisonRows(dataset,state):[];
  const scope=thematic?comparisonScope(dataset,state):selected;
  const parent=areaFor(selected.parent_id);
  const scopedIds=new Set(thematic?comparisonAreas(dataset,state).map(area=>area.id):[]);
  // Keep the complete boundary layer in the SVG even when the view is fitted to
  // one comparison area. This gives zoom-out a real geographic context instead
  // of revealing an empty canvas around the selected parent.
  const levelFeatures=allFeatures.filter(feature=>worldLocation&&childIds.size?childIds.has(feature.properties?.territory_id):areaFor(feature.properties?.territory_id)?.level===targetLevel);
  const scopeFeature=thematic&&scope?.level!==targetLevel?allFeatures.find(feature=>feature.properties?.territory_id===scope?.id):null;
  const parentFeature=mapExtent==='parent'&&parent&&parent.level!=='national'?allFeatures.find(feature=>feature.properties?.territory_id===parent.id):null;
  const outlineFeatures=[scopeFeature,parentFeature].filter((feature,index,list)=>feature&&list.findIndex(item=>item?.properties?.territory_id===feature.properties?.territory_id)===index);
  const features=[...levelFeatures,...outlineFeatures.filter(feature=>!levelFeatures.includes(feature))];
  const defaultFitId=scope?.level==='national'||worldLocation&&childIds.size?'':scope?.id;
  const fitId=mapExtent==='country'?'':mapExtent==='parent'&&parentFeature?parent.id:defaultFitId;
  const geometry=mapGeometry(features,fitId);
  const stats=distribution(rows);
  const values=new Map(rows.map(row=>[row.area.id,row.value]));
  const comparisonById=new Map(rows.map(row=>[row.area.id,row]));
  const mapSettings=planningSettings(dataset).map;
  const colour = id => {
    if(planning)return officialMapState(dataset,id).color;
    if(!thematic)return '#c1d9d1';
    const value=values.get(id);
    if(!finite(value))return '#dedfdf';
    if(stats.min===stats.max)return '#47937e';
    const colours=['#dcece5','#bad8ca','#85bba5','#4a977c','#226c57'];
    return colours[Math.min(4,Math.floor(5*(value-stats.min)/(stats.max-stats.min)))];
  };
  const title=planning?(mapSettings.mode==='official_status'?`Documented institutional states · ${categoryLabels[mapSettings.category]} · ${mapSettings.period}`:'Material references by area'+(mapSettings.category?' · '+categoryLabels[mapSettings.category]:'')+(mapSettings.period?' · '+mapSettings.period:'')):thematic?`${currentMetric()?.name || 'Indicator'} · ${state.period || 'No period'}`:'Location';
  const sourceIds=[...new Set(features.map(feature=>feature.properties?.source_id).filter(Boolean))];
  const boundarySources=dataset.sources.filter(source=>sourceIds.includes(source.id));
  const outlineIds=new Set(outlineFeatures.map(feature=>feature.properties?.territory_id));
  const contextPaths=thematic?geometry.paths.filter(path=>!outlineIds.has(path.id)&&!scopedIds.has(path.id)):[];
  const interactivePaths=geometry.paths.filter(path=>!outlineIds.has(path.id)&&(!thematic||scopedIds.has(path.id)));
  const chosenTab=interactivePaths.find(path=>path.id===state.selected)?.id || interactivePaths[0]?.id;
  const parentExtentAvailable=!!parent&&parent.level!=='national'&&(!thematic||scope?.id!==parent.id)&&allFeatures.some(feature=>feature.properties?.territory_id===parent.id);
  const extentActions=selected.level!=='national'&&geometry.paths.length?`<div class="map-view-actions" aria-label="Map extent">${mapExtent!=='selected'?button('map-extent',thematic?'Fit comparison area':'Fit selected area','data-extent="selected"','text-button'):''}${parentExtentAvailable&&mapExtent!=='parent'?button('map-extent','Show parent area',`data-extent="parent" title="${e(parent.name)}"`,'text-button'):''}${mapExtent!=='country'?button('map-extent','Show whole country','data-extent="country"','text-button'):''}</div>`:'';
  const zoomWidth=760/mapZoom,zoomHeight=400/mapZoom,zoomX=(760-zoomWidth)/2,zoomY=(400-zoomHeight)/2;
  const zoomLabel=`${Math.round(mapZoom*100)}%`;
  return `<section class="panel map-panel" aria-labelledby="map-title"><div class="panel-heading"><div><p class="eyebrow">${e(levelLabel(targetLevel))} reference boundaries</p><h2 id="map-title">${e(title)}</h2></div>${extentActions}</div>
  ${geometry.paths.length ? `<div class="map-canvas"><div class="map-zoom-controls" role="group" aria-label="Map zoom"><button type="button" data-action="map-zoom-out" aria-label="Zoom out" ${mapZoom<=.5?'disabled':''}>−</button><button type="button" data-action="map-zoom-reset" aria-label="Reset map zoom">${e(zoomLabel)}</button><button type="button" data-action="map-zoom-in" aria-label="Zoom in" ${mapZoom>=4?'disabled':''}>+</button></div><svg class="geographic-map" data-map-svg viewBox="${zoomX.toFixed(2)} ${zoomY.toFixed(2)} ${zoomWidth.toFixed(2)} ${zoomHeight.toFixed(2)}" role="group" aria-label="${e(title)}. Select an area with Enter. Arrow keys move between boundaries."><title>${e(title)} — ${e(dataset.country.name)}; ${fitId&&geometry.selectedHasGeometry?`view fitted to ${e(mapExtent==='parent'?parent?.name:scope?.name || selected.name)}`:'whole available boundary layer'}</title><rect x="${zoomX.toFixed(2)}" y="${zoomY.toFixed(2)}" width="${zoomWidth.toFixed(2)}" height="${zoomHeight.toFixed(2)}" fill="#f4f8f7"/>${contextPaths.map(path=>`<path d="${path.d}" fill="#edf2f0" fill-rule="evenodd" class="map-area map-context-area" aria-hidden="true" pointer-events="none"/>`).join('')}${interactivePaths.map(path=>{const area=areaFor(path.id),value=values.get(path.id),comparisonRow=comparisonById.get(path.id);const label=`${area?.name || path.id}${thematic?`: ${finite(value)?fmt(value)+' '+currentMetric().unit:'No data'} for ${comparisonRow?.period || state.period}`:''}`;return `<path d="${path.d}" fill="${colour(path.id)}" fill-rule="evenodd" class="map-area ${path.id===state.selected?'selected':''}" role="button" aria-label="${e(label)}" aria-pressed="${path.id===state.selected}" tabindex="${path.id===chosenTab?'0':'-1'}" data-action="select" data-id="${e(path.id)}" data-map-id="${e(path.id)}"><title>${e(label)}</title></path>`;}).join('')}${outlineIds.size?geometry.paths.filter(path=>outlineIds.has(path.id)).map(path=>`<path d="${path.d}" fill="none" fill-rule="evenodd" class="map-scope-outline" aria-hidden="true" pointer-events="none"/>`).join(''):''}</svg></div>` : '<div class="map-unavailable"><strong>No joined boundaries available for this level.</strong><p>Use the area selector and search. Acquired statistics and documents remain accessible.</p></div>'}
  ${selected.level!=='national'&&!childIds.size&&!features.some(feature=>feature.properties?.territory_id===selected.id)&&!scopeFeature?`<p class="missing-note">No boundary is joined to ${e(selected.name)} at this map level. No nearby polygon is substituted.</p>`:''}
  <p class="map-legend">${planning?(mapSettings.mode==='official_status'?`${mapSettings.statuses.map(status=>`<span class="legend-item"><svg width="12" height="12" aria-hidden="true"><rect width="12" height="12" fill="${e(status.color)}"/></svg> ${e(status.label)}</span>`).join(' · ')}. Gray = no matched evidence; amber = conflicting evidence. States apply only to ${e(mapSettings.period)} and this document category. Select an area to inspect the cited evidence.`:`Green = a source-checked material reference is available; gray = no reference collected. ${mapSettings.period?'Applies only to '+e(mapSettings.period)+'.':'Includes different document periods.'}${mapSettings.category?' Category: '+e(categoryLabels[mapSettings.category])+'.':''} These are collection states, not counts of approved plans.`):thematic?`Colors use five equal value intervals across ${e(scope?.level==='national'?dataset.country.name:scope?.name || dataset.country.name)} at ${e(levelLabel(state.level).toLowerCase())} for this indicator and period; search does not change the scale. Gray inside the comparison area = No data; pale gray outside it = surrounding context. High values are not automatically better.`:'A location map. Fill colors do not represent population or service levels.'} <span class="legend-selected">Gold outline</span> = ${thematic&&scopeFeature?'comparison area; selected lower area is also outlined':'selected area'}.</p>
  <p class="source-note">Boundary source: ${boundarySources.length?boundarySources.map(source=>link(source.url,source.name)).join(' · '):'See the source register; boundary authority and edition must be verified.'} Reference boundaries are not a legal boundary certification. Keyboard: arrows / Home / End, then Enter or Space.</p>${dataset.country.geography_note?`<p class="source-note"><strong>Geographic scope:</strong> ${e(dataset.country.geography_note)}</p>`:''}</section>`;
}
function facts() {
  const priority=displayIndicators().filter(indicator=>/population|household/i.test(indicator.name)).slice(0,3);
  const indicators=priority.length?priority:dataset.indicators.slice(0,3);
  return `<div class="basic-facts">${indicators.map(indicator=>{const available=periodsFor(dataset,indicator.id),fallback=dataset.analysis?.default_period_by_indicator?.[indicator.id],period=latestMode()?latestDisplayPeriod(dataset,state.selected,indicator.id):available.includes(state.period)?state.period:fallback||state.period;const result=areaObservationState(dataset,state.selected,indicator.id,period);return `<div class="fact"><span>${e(indicator.name)}</span><strong>${fmt(result.value,indicator)}</strong><small>${e(result.row?.unit || indicator.unit)} · ${e(result.row?.period || period || 'No source period')} · ${e(evidenceStatus(indicator,result.row,result.status))}</small>${result.provenance==='areadata_calculated'?`<small>${e(result.note)}</small>`:''}</div>`;}).join('')}</div>`;
}
function seriesFigure(indicator, territoryId=state.selected) {
  const series=seriesFor(dataset,territoryId,indicator.id);
  const observed=series.filter(row=>observedValue(row)!==null);
  if(!observed.length)return '<p class="small-note">No acquired time series for this area. National series are not substituted.</p>';
  const area=areaFor(territoryId);
  const geo=seriesGeometry(series.map(row=>observationContext(dataset,area,indicator,row).comparable?row:{...row,status:'missing',value:null}));
  const sourceIds=[...new Set(observed.map(row=>row.source_id))];
  const sources=sourceIds.map(id=>dataset.sources.find(source=>source.id===id)).filter(Boolean);
  return `<figure class="series"><figcaption>${e(area.name)} · ${e(indicator.name)} · ${e(series[0].period)}${series.length>1?`–${e(series.at(-1).period)}`:''} · ${e(indicator.unit)}</figcaption>
  ${geo&&geo.points.length>1?`<svg viewBox="0 0 600 170" role="img" aria-label="${e(indicator.name)} time series for ${e(area.name)}. Exact values and sources are in the table below."><title>${e(area.name)} · ${e(indicator.name)} · ${e(indicator.unit)}</title><line x1="40" y1="140" x2="580" y2="140" stroke="#c8d5d7"/>${geo.segments.map(points=>`<polyline points="${points}" fill="none" stroke="#267966" stroke-width="2.5"/>`).join('')}${geo.points.map(point=>`<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3" fill="#267966"><title>${e(point.row.period)}: ${e(fmt(point.row.value,indicator))} ${e(indicator.unit)}</title></circle>`).join('')}<text x="3" y="21">${e(fmt(geo.max,indicator))}</text><text x="3" y="135">${e(fmt(geo.min,indicator))}</text><text x="40" y="161">${e(series[0].period)}</text><text x="580" y="161" text-anchor="end">${e(series.at(-1).period)}</text></svg><p class="small-note">Source periods in sequence. Missing or incompatible observations break the line; no missing values are estimated.</p>`:'<p class="small-note">Fewer than two comparable observations; no trend is inferred.</p>'}
  <p class="source-note">Series: ${e([...new Set(observed.map(row=>seriesSourceLabel(indicator,row,row.period,language)))].join(', '))}. Exact sources follow.</p>
  <details><summary>Time-series values and sources (${series.length})</summary><div class="table-scroll"><table><caption>${e(area.name)} · ${e(indicator.name)} · ${e(indicator.unit)}</caption><thead><tr><th scope="col">Period</th><th scope="col">Value</th><th scope="col">Status</th><th scope="col">Source</th></tr></thead><tbody>${series.map(row=>{const source=sourceFor(dataset,indicator,row);return `<tr><td>${e(row.period)}</td><td>${fmt(observedValue(row),indicator)} ${e(observationMeaning(indicator,row).unit)}</td><td>${e(statusLabel(row.status))}${observationContext(dataset,area,indicator,row).comparable?'':'<br>'+e(observationContext(dataset,area,indicator,row).reason)}</td><td>${renderSourceAttribution(indicator,row,source,row.period,language)}</td></tr>`;}).join('')}</tbody></table></div></details>
  ${button('series-csv','Time series CSV',`data-id="${e(indicator.id)}" data-territory="${e(territoryId)}"`,'text-button')}</figure>`;
}
function populationContext(indicator,result) {
  const config=dataset.analysis?.population_context,area=currentArea();
  if(!config||indicator.id!==config.primary_indicator_id||!['national','country'].includes(area.level))return '';
  const reference=metricFor(config.reference_indicator_id);
  if(!reference)return '';
  const referenceResult=areaObservationState(dataset,area.id,reference.id,config.reference_period);
  if(!finite(referenceResult.value))return '';
  const source=sourceFor(dataset,reference,referenceResult.row),stage={period:config.reference_period,series_stage:'medium_projection'};
  const difference=finite(result.value)?referenceResult.value-result.value:null;
  const percent=finite(difference)&&result.value!==0?difference/result.value*100:null;
  const comparisonText=language==='es'?'personas frente al total censal con años distintos. La diferencia refleja el año de referencia y el método; no es un margen de error.':language==='ja'?'人、国ごとに年が異なる国勢調査合計より多い値です。この差は基準年と算出方法の違いであり、誤差幅ではありません。':'people compared with the mixed-year census total. The difference reflects reference year and method; it is not an error margin.';
  return `<aside class="population-context" aria-label="UN population context"><div><span>Same-year international context</span><strong>${fmt(referenceResult.value,reference)}</strong><small>people · ${e(seriesSourceLabel(reference,referenceResult.row || stage,config.reference_period,language))}</small></div><div>${renderSourceAttribution(reference,referenceResult.row || stage,source,config.reference_period,language)}</div>${finite(difference)?`<p><strong>${difference>=0?'+':''}${fmt(difference,reference)}</strong> ${finite(percent)?`(${difference>=0?'+':''}${e(percent.toLocaleString(languageLocale(language),{maximumFractionDigits:1}))}%) `:''}${comparisonText}</p>`:`<p>${e(config.note)}</p>`}</aside>`;
}
function populationPyramid() {
  const records=(dataset.population_pyramids||[]).filter(row=>row.territory_id===state.selected).sort((a,b)=>String(b.period).localeCompare(String(a.period),'en',{numeric:true}));
  const record=records[0];if(!record)return '';
  const bands=pyramidBands(record.bands||[]),maximum=Math.max(1,...bands.flatMap(row=>[row.male,row.female])),width=760,center=380,half=320,rowHeight=24,height=70+bands.length*rowHeight;
  const bars=bands.map((row,index)=>{const y=35+index*rowHeight,male=Math.max(0,row.male)/maximum*half,female=Math.max(0,row.female)/maximum*half;return `<g><rect x="${center-male}" y="${y}" width="${male}" height="18" fill="#456f83"><title>${e(row.age)} · Male ${e(row.male)}</title></rect><rect x="${center}" y="${y}" width="${female}" height="18" fill="#b66f63"><title>${e(row.age)} · Female ${e(row.female)}</title></rect><text x="${center}" y="${y+14}" text-anchor="middle">${e(row.age)}</text></g>`;}).join('');
  const source=dataset.sources.find(item=>item.id===record.source_id);
  return `<section class="panel population-pyramid"><div class="panel-heading"><div><p class="eyebrow">Age and sex structure</p><h2>Population pyramid — ${e(currentArea().name)}</h2></div><strong>${e(record.period)}</strong></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Population pyramid for ${e(currentArea().name)}, ${e(record.period)}"><title>${e(currentArea().name)} · population by age group and sex · ${e(record.period)}</title><line x1="${center}" y1="22" x2="${center}" y2="${height-18}" stroke="#6b7d85"/>${bars}<text x="40" y="20">Male</text><text x="720" y="20" text-anchor="end">Female</text></svg><p class="small-note">Values use the source unit recorded for this age-sex table${record.unit?`: ${e(record.unit)}`:''}. ${source?renderSourceAttribution(null,{source_id:source.id,period:record.period},source,record.period,language):'Source not recorded'}</p></section>`;
}
function lowerAreaReference(indicator,result,period) {
  if(result.value!==null || indicator.aggregation!=='weighted_rate')return '';
  const selected=currentArea(),levels=localLevels(dataset),selectedIndex=selected.level==='national'?-1:levels.indexOf(selected.level);
  let rows=[],referenceLevel='';
  for(const level of levels.slice(selectedIndex+1)) {
    const candidates=dataset.territories.filter(area=>area.level===level&&territoryLineage(dataset,area.id).slice(0,-1).some(parent=>parent.id===selected.id));
    const observed=candidates.map(area=>{const row=observationState(dataset,area.id,indicator.id,period);return {...row,area,comparable:observationContext(dataset,area,indicator,row.row).comparable};}).filter(row=>row.comparable&&finite(row.value));
    if(observed.length){rows=observed;referenceLevel=level;break;}
  }
  const stats=distribution(rows);
  if(!stats.count)return '';
  const level=levelLabel(referenceLevel).toLowerCase(),scope=selected.level==='national'?dataset.country.name:selected.name;
  const label=language==='ja'?`参考：${scope}内の${level}にある出典公表値の中央値 ${fmt(stats.median,indicator)} ${indicator.unit}（観測 ${stats.count}件、公表された0を含む）。${scope}全体の値ではありません。`:language==='es'?`Referencia: mediana de ${stats.count} valores publicados de ${level} dentro de ${scope}: ${fmt(stats.median,indicator)} ${indicator.unit}; incluye los ceros publicados. No es el valor total de ${scope}.`:`Reference: median of ${stats.count} source-reported ${level} values inside ${scope}: ${fmt(stats.median,indicator)} ${indicator.unit}; published zeros are included. This is not the value for ${scope} as a whole.`;
  return `<small class="reference-value">${e(label)}</small>`;
}
function metricCard(indicator) {
  const displayPeriod=latestMode()?latestDisplayPeriod(dataset,state.selected,indicator.id):state.period;
  const nationalPeriod=latestMode()?latestDisplayPeriod(dataset,dataset.country.national_territory_id,indicator.id):state.period;
  const result=areaObservationState(dataset,state.selected,indicator.id,displayPeriod);
  const national=areaObservationState(dataset,dataset.country.national_territory_id,indicator.id,nationalPeriod);
  const meaning=result.provenance==='areadata_calculated'?{...observationMeaning(indicator),comparable:true,reason:''}:observationContext(dataset,currentArea(),indicator,result.row),referenceMeaning=observationContext(dataset,areaFor(dataset.country.national_territory_id),indicator,national.row);
  const local=currentArea().level!=='national';
  const otherPeriods=!latestMode()&&result.value===null?observedPeriodsForArea(dataset,state.selected,indicator.id).filter(period=>period!==String(state.period)):[];
  const periodNotice=otherPeriods.length?`<p class="available-period-note"><strong>No selected-area value for ${e(state.period)}.</strong> Acquired for ${e(otherPeriods.join(', '))}. ${button('use-period',`Show ${otherPeriods[0]}`,`data-period="${e(otherPeriods[0])}" data-metric="${e(indicator.id)}"`,'text-button')}</p>`:'';
  return `<article class="indicator-card"><div class="indicator-heading"><h3>${e(indicator.name)}</h3><span class="unit">${e(meaning.unit)}</span></div><div class="value-row"><strong>${fmt(result.value,indicator)}</strong><span>${e(evidenceStatus(indicator,result.row,result.status))} · ${e(result.row?.period || displayPeriod || 'No source period')}</span>${lowerAreaReference(indicator,result,displayPeriod)}</div>${periodNotice}${stateMessage(result)}${populationContext(indicator,result)}
  ${local?`<p class="national-reference">${worldMode()?'World reference':'National reference'} — ${e(dataset.country.name)}: <strong>${fmt(national.value,indicator)}</strong> ${e(referenceMeaning.unit)} · ${e(national.row?.period || nationalPeriod || 'No source period')}. ${e(evidenceStatus(indicator,national.row,national.status))}.${referenceMeaning.comparable?'':` ${e(referenceMeaning.reason)}`}</p>`:''}
  ${result.status==='calculated'?`<p class="aggregation-note"><strong>Calculated value.</strong> ${e(result.note)} ${result.components.length?`Components: ${e(result.components.map(item=>`${areaFor(item.territory_id)?.name || item.territory_id} (${item.period})`).join(', '))}.`:''}</p>`:result.status==='incomplete'?`<p class="missing-note">${e(result.note)}${finite(result.covered_value)?` Covered subtotal: ${e(fmt(result.covered_value,indicator))} ${e(indicator.unit)}.`:''}</p>`:''}<p class="definition">${e(meaning.definition || 'Definition not acquired.')}</p>${meaning.comparable?'':`<p class="missing-note">${e(meaning.reason)} Its original value remains visible; a comparable trend is not inferred.</p>`}${sourceNote(indicator,result.row || {source_id:indicator.source_id,period:displayPeriod},finite(result.value)&&result.row?'Selected-area source':'Indicator sources; see calculation or gap details')}
  ${latestMode()?'':seriesFigure(indicator)}<div class="actions">${button('compare','Compare this indicator',`data-id="${e(indicator.id)}"`,'text-button')}${button('indicator-csv',latestMode()?'Latest value CSV':'Selected-period CSV',`data-id="${e(indicator.id)}"`,'text-button')}</div>${renderInternalComparison(dataset,state.selected,indicator.id,displayPeriod,{language})}</article>`;
}
function territorial() {
  const contextualId=dataset.analysis?.population_context?.reference_indicator_id;
  const territorialIndicators=displayIndicators().filter(indicator=>indicator.id!==contextualId);
  const themes=[...new Set(territorialIndicators.map(indicator=>indicator.theme || 'Other'))];
  return `<div class="page-actions">${periodControl('territorial-period')}${pageLink('thematic','Compare across areas')}${pageLink('planning','Open planning resources')}</div>
  <div class="territorial-top"><section class="panel selected-profile"><h2>${e(currentArea().name)}</h2>${hierarchyNavigation()}${areaControls()}${identity()}${facts()}</section>${mapPanel()}</div>${populationPyramid()}${countryDetailLink()}
  <nav class="section-index" aria-label="Diagnostic sections">${themes.map((theme,index)=>`<a href="#theme-${index}">${e(theme)}</a>`).join('')}<a href="#source-register">Sources and gaps</a></nav>
  ${themes.map((theme,index)=>{const indicators=territorialIndicators.filter(indicator=>(indicator.theme||'Other')===theme);if(latestMode()){const coverage=themeLatestCoverage(dataset,state.selected,indicators),lowerAvailable=indicators.some(indicator=>{const displayPeriod=latestDisplayPeriod(dataset,state.selected,indicator.id);return internalComparison(dataset,state.selected,indicator.id,displayPeriod).rows.some(row=>row.comparable&&finite(row.value));}),cards=`<div class="indicator-grid">${indicators.map(metricCard).join('')}</div>`;if(coverage.available||lowerAvailable)return `<section id="theme-${index}" class="theme-section"><h2 class="section-title">${e(theme)} <small>${e(currentArea().name)} · latest by item · ${coverage.available}/${coverage.total} selected-area values${lowerAvailable&&coverage.available<coverage.total?' · lower-area data also available':''}</small></h2>${cards}</section>`;return `<details id="theme-${index}" class="theme-section unavailable-theme"><summary><strong>${e(theme)}</strong><span>${e(currentArea().name)} · no acquired selected-area or lower-area value</span></summary><p class="missing-note">No acquired value for this selected area or its configured lower-area comparison. Wider-area references, when present, are kept separate.</p>${cards}</details>`;}const coverage=themePeriodCoverage(dataset,state.selected,indicators,state.period),lowerAvailable=indicators.some(indicator=>internalComparison(dataset,state.selected,indicator.id,state.period).rows.some(row=>row.comparable&&finite(row.value))),cards=`<div class="indicator-grid">${indicators.map(metricCard).join('')}</div>`;if(coverage.exact||lowerAvailable)return `<section id="theme-${index}" class="theme-section"><h2 class="section-title">${e(theme)} <small>${e(currentArea().name)} · ${e(state.period || 'No period')} · ${coverage.exact}/${coverage.total} selected-area values${lowerAvailable&&coverage.exact<coverage.total?' · lower-area data also available':''}</small></h2>${cards}</section>`;const alternatives=coverage.otherPeriods.length?` · acquired: ${e(coverage.otherPeriods.join(', '))}`:'';const hint=coverage.otherPeriods.length?`Acquired for this area in ${e(coverage.otherPeriods.join(', '))}; choose a listed period inside to inspect it.`:'No acquired value for this selected area or its configured lower-area comparison in this period. Wider-area references, when present, are kept separate.';return `<details id="theme-${index}" class="theme-section unavailable-theme"><summary><strong>${e(theme)}</strong><span>${e(currentArea().name)} · ${e(state.period || 'No period')} · 0/${coverage.total}${alternatives}</span></summary><p class="missing-note">${hint}</p>${cards}</details>`;}).join('')}
  <section class="panel diagnostic-outputs"><h2>Diagnostic report — ${e(currentArea().name)}</h2><p>${latestMode()?'Each indicator uses its latest confirmed value and shows its source year. Internal comparisons use that indicator’s displayed year.':'Whole-area evidence and internal differences use the same selected period.'} Definitions, membership and sources remain explicit. Every member row is included, even when the on-screen table scrolls.</p><div class="download-actions">${button('diagnostic-markdown','Editable Diagnostic report')}${button('diagnostic-html','Diagnostic report HTML')}${button('diagnostic-csv','Full diagnostic data CSV')}</div><p class="small-note">Print the HTML report to include legends, sources and every row. No resident agreement or formal approval is inferred.</p></section><div class="end-actions">${pageLink('thematic','Compare across areas')}${pageLink('planning','Open planning resources')}<a href="#top">Back to top</a></div>`;
}
function rankingContent(rows) {
  const ranked=rankedRows(rows,rankOrder), visible=searchRows(ranked,rankSearch);
  const missing=searchRows(rows.filter(row=>!finite(row.value)),rankSearch);
  return `<p class="small-note">${ranked.length} observed / ${rows.length} comparable areas. Search narrows displayed rows only. Ties share a rank.</p>
  <div class="ranking-scroll" role="region" aria-label="Full ranking and unranked areas" tabindex="0"><ol class="ranking-list">${visible.map(row=>`<li class="${row.area.id===state.selected?'selected':''}" data-ranking-id="${e(row.area.id)}"><span class="rank-number">${row.rank}</span>${button('select',e(row.area.name),`data-id="${e(row.area.id)}" data-rank-id="${e(row.area.id)}"`,'rank-area')}<strong>${fmt(row.value)}</strong><small>${e(row.period || state.period)}</small></li>`).join('')}</ol>
  ${!visible.length?'<p class="missing-note">No observed values match this search. No rank is assigned to missing data.</p>':''}
  ${missing.length?`<details><summary>Unranked areas (${missing.length})</summary><ul class="missing-list">${missing.map(row=>`<li class="${row.area.id===state.selected?'selected':''}" data-ranking-id="${e(row.area.id)}" data-unranked="true">${button('select',e(row.area.name),`data-id="${e(row.area.id)}" data-rank-id="${e(row.area.id)}"`,'text-button')}<span>${observedValue(row.row)!==null?`${fmt(observedValue(row.row))} ${e(observationMeaning(currentMetric(),row.row).unit)} · ${e(row.period || state.period)} · `:''}${e(statusLabel(row.status))} · unranked${row.reason?` · ${e(row.reason)}`:''}</span></li>`).join('')}</ul></details>`:''}</div>`;
}
function thematic() {
  const indicator=currentMetric();
  if(!indicator)return '<p class="missing-note">No indicators have been collected. See the source register and acquisition gaps.</p>';
  const rows=comparisonRows(dataset,state), stats=distribution(rows);
  const compatibility=comparisonCompatibility(dataset,state);
  const scope=comparisonScope(dataset,state) || areaFor(dataset.country.national_territory_id);
  const nationalPeriod=latestMode()?latestDisplayPeriod(dataset,dataset.country.national_territory_id,state.metric):state.period;
  const selectedPeriod=latestMode()?latestDisplayPeriod(dataset,state.selected,state.metric):state.period;
  const national=areaObservationState(dataset,dataset.country.national_territory_id,state.metric,nationalPeriod);
  const selected=areaObservationState(dataset,state.selected,state.metric,selectedPeriod),selectedMeaning=observationContext(dataset,currentArea(),indicator,selected.row),nationalMeaning=observationContext(dataset,areaFor(dataset.country.national_territory_id),indicator,national.row);
  const levels=comparisonLevelsFor(state);
  const rank=rankedRows(rows,rankOrder).find(row=>row.area.id===state.selected)?.rank;
  return `<section class="panel controls-panel"><div class="thematic-controls">${thematicScopeControl()}<label class="field" for="comparison-level"><span>Level shown inside this area</span><select id="comparison-level" data-control="level">${levels.length?levels.map(level=>`<option value="${e(level)}" ${level===state.level?'selected':''}>${e(levelLabel(level))}</option>`).join(''):'<option value="">No local areas acquired</option>'}</select></label>${indicatorControl()}${periodControl()}</div><p class="definition">${e(indicator.definition)} Unit: ${e(indicator.unit)}. ${latestMode()?`The newest source year available for the ${e(levelLabel(state.level).toLowerCase())} areas shown inside ${e(scope.name)} is used for the comparison: ${e(state.period || 'none')}. Every displayed value carries its own source year.`:'All comparisons use this indicator and period policy; changing an area retains both. Mixed-period rows show each area\'s actual source year.'}</p></section>
  <div class="summary-grid"><article class="summary"><span>${worldMode()?'World':'National'} value · ${e(evidenceStatus(indicator,national.row,national.status).toLowerCase())}</span><strong>${fmt(national.value)}</strong><small>${e(dataset.country.name)} · ${e(national.row?.period || nationalPeriod || 'No source period')} · ${e(nationalMeaning.unit)}</small></article><article class="summary"><span>Median of comparable local areas</span><strong>${fmt(stats.median)}</strong><small>${e(levelLabel(state.level))} · ${e(state.period)}; observed values only</small></article><article class="summary"><span>Local data coverage</span><strong>${stats.count} / ${rows.length}</strong><small>${rows.length-stats.count} unranked or missing · ${e(state.period)}</small></article><article class="summary"><span>Observed local range</span><strong>${stats.count?`${fmt(stats.min)}–${fmt(stats.max)}`:'No data'}</strong><small>${e(indicator.unit)} · ${e(state.period)} comparison</small></article></div>
  ${!compatibility.comparable?`<p class="notice">${e(compatibility.reason)}</p>`:!stats.count?`<p class="notice"><strong>No comparable local observations for ${e(indicator.name)} · ${e(state.period)}.</strong> ${nationalOnly(dataset)?'Local statistics have not yet been collected.':'This level and period have no observed local values for the selected indicator.'} The national source value is shown separately; no local ranking or local estimates are created.</p>`:''}
  <div class="thematic-grid">${mapPanel({thematic:true})}<section class="panel explorer" aria-labelledby="ranking-title"><h2 id="ranking-title">Find and compare areas</h2><p class="small-note">${e(scope.name)} · ${e(levelLabel(state.level))} · ${e(indicator.name)} · ${e(state.period)} · ${e(indicator.unit)}</p>
  <label class="field" for="ranking-search"><span>Search ranking by name or code</span><input id="ranking-search" type="search" data-control="ranking-search" value="${e(rankSearch)}" placeholder="Name or code"></label><div class="control-row"><label class="field" for="ranking-order"><span>Order</span><select id="ranking-order" data-control="rank-order"><option value="desc" ${rankOrder==='desc'?'selected':''}>Highest first</option><option value="asc" ${rankOrder==='asc'?'selected':''}>Lowest first</option></select></label>${button('show-selected','Show selected in ranking','','text-button')}</div><div id="ranking-content">${rankingContent(rows)}</div></section></div>
  <section class="panel selection-detail"><div><h2>${e(currentArea().name)} — selected area</h2>${hierarchyNavigation()}${identity()}<p class="small-note">Comparison area: <strong>${e(scope.name)}</strong>. Change it in the controls above.</p></div><div><p class="eyebrow">${e(indicator.name)} · ${e(selected.row?.period || selectedPeriod || 'No source period')} · ${e(selectedMeaning.unit)}</p>${!selectedMeaning.comparable?`<p class="notice">${e(selectedMeaning.reason)}</p>`:''}<p class="definition">${e(selectedMeaning.definition)}</p><p class="selected-value">${fmt(selected.value)}</p><p>${e(evidenceStatus(indicator,selected.row,selected.status))}. ${currentArea().level==='national'?'National observations are not part of the local ranking.':selectedPeriod!==state.period?`The selected area’s latest value is from ${e(selectedPeriod)}; ranking uses the common ${e(state.period)} comparison year.`:rank?`Rank ${rank} of ${stats.count} observed areas (${rankOrder==='desc'?'highest':'lowest'} first).`:currentArea().level!==state.level?'This area defines the comparison scope; the map and ranking show its lower areas.':'No local rank.'}</p>${stateMessage(selected)}${sourceNote(indicator,selected.row)}<div class="actions">${pageLink('territorial','Open territorial diagnostic')}${pageLink('planning','Open planning resources')}${button('comparison-csv','Comparison CSV')}</div></div></section>
  ${latestMode()?'':`<section class="panel"><h2>Selected-area history</h2>${seriesFigure(indicator)}</section>`}`;
}
function planning() {
  const settings=planningSettings(dataset),documents=planningDocuments(dataset,state.selected);
  const sourceGroups=planningSourceGroups(dataset);
  const nationalDocuments=state.selected===dataset.country.national_territory_id?[]:planningDocuments(dataset,dataset.country.national_territory_id);
  const refs=new Set(dataset.documents.filter(hasDocumentReference).map(doc=>doc.territory_id));
  const groups=documentGroups(dataset,state.selected);
  const local=dataset.territories.filter(area=>area.level!=='national');
  const visible=displayIndicators();
  const observed=visible.filter(indicator=>{const period=latestMode()?latestDisplayPeriod(dataset,state.selected,indicator.id):state.period;return areaObservationState(dataset,state.selected,indicator.id,period).value!==null;}).length;
  const outputs={docx:button('planning-docx','Download territorial planning diagnostic (Word)','','button'),markdown:button('planning-markdown','Download editable Markdown','','button'),html:button('planning-html','Print-ready HTML'),evidence_csv:button('planning-csv','Evidence CSV'),documents_csv:button('documents-csv','Materials and findings CSV')};
  const links=settings.related_links.filter(item=>!item.territory_id||item.territory_id===state.selected).map(item=>({label:item.label,url:relatedResourceUrl(item.url,base,routeWithLanguage())})).filter(item=>item.url);
  const gaps=selectedGaps(dataset,state.selected);
  if(worldMode()&&currentArea().type!=='country')return '<section class="panel planning-overview"><h2>'+e(settings.title)+'</h2><p>'+e(settings.purpose)+'</p></section><section class="panel planning-controls"><h2>Choose one planning territory</h2>'+areaControls()+identity()+'</section><div class="planning-grid">'+mapPanel({planning:true})+'<section class="panel planning-resources"><h2>'+e(currentArea().name)+'</h2><p class="notice"><strong>This selected area is an analysis scope, not a confirmed legal planning authority.</strong> No territorial planning diagnostic is generated for it. Select one country, then use that country’s source-checked law, responsible body, cycle and subnational hierarchy as its adapter is completed.</p><div class="actions">'+pageLink('territorial','Review territorial evidence')+pageLink('thematic','Compare countries')+pageLink('database','Inspect source data')+'</div></section></div>';
  return '<section class="panel planning-overview"><h2>'+e(settings.title)+'</h2><p>'+e(settings.purpose)+'</p><p class="small-note">Source-checked material references for '+local.filter(area=>refs.has(area.id)).length+' of '+local.length+' local records'+(refs.has(dataset.country.national_territory_id)?'; national reference materials also available':'')+'. Coverage varies by category and period; this is not a count of completed or approved plans.</p></section>'+
  '<section class="panel planning-controls"><h2>Choose an area</h2>'+areaControls()+identity()+'</section>'+
  '<div class="planning-grid">'+mapPanel({planning:true})+'<section class="panel planning-resources"><h2>'+e(currentArea().name)+' — available materials</h2><p>Materials keep their own plan period, fiscal year or quarter. The latest statistical evidence shown below does not filter or relabel them.</p>'+
  (groups.some(group=>group.documents.length)?'<nav class="document-contents" aria-label="Available material categories">'+groups.filter(group=>group.documents.length).map(group=>'<a href="#documents-'+e(group.id)+'">'+e(group.label)+'</a>').join('')+'</nav>':'')+
  renderDocumentGroups(dataset,state.selected)+'</section></div>'+
  '<section class="panel planning-source-register"><h2>Sources used for planning work</h2><p>Laws and guidance, census sources, and international institution datasets are listed separately. A source link records provenance; it does not mean every table or local area was adopted.</p>'+
  (sourceGroups.length?sourceGroups.map(group=>'<section class="source-group"><h3>'+e(group.label)+'</h3><p class="small-note">'+e(group.note)+'</p>'+(group.sources.length?'<ul>'+group.sources.map(source=>'<li>'+link(source.url,source.name)+'<small>'+e(source.publisher||'Publisher not recorded')+' · '+e(statusLabel(source.status))+' · retrieved '+e((source.retrieved_at||'Not recorded').slice(0,10))+'</small></li>').join('')+'</ul>':'<p class="missing-note">No source is registered in this category.</p>')+'</section>').join(''):'<p class="missing-note">The country adapter has not yet classified its planning-law, census and international sources.</p>')+'</section>'+
  '<section class="panel planning-output"><h2>Territorial development planning diagnostic</h2><p class="notice compact">These outputs bring together selected-area statistics, source years, collected references and evidence gaps as diagnostic material for development planning at the applicable territorial level.</p><div class="control-row">'+periodControl('planning-period')+'</div><p>'+observed+' of '+visible.length+' statistical indicators have a latest confirmed value for '+e(currentArea().name)+'. Each value carries its own source year. '+documents.length+' selected-area material records retain their own periods.</p><div class="download-actions">'+settings.outputs.map(format=>outputs[format] || '').join('')+'</div>'+
  (settings.outputs.length?'<p class="small-note">The Word file is titled '+e(planningDiagnosticTitle(dataset))+'. It includes the applicable law or guidance index, a Territorial Diagnostic, and data-based diagnostic content with source years. Materials CSV retains source document periods and findings.</p>':'<p class="missing-note">No generated download format is adopted for this project. Use the source references and territorial evidence; record the country-specific output workflow in the handoff.</p>')+
  (settings.outputs.includes('markdown')||settings.outputs.includes('html')?'<details><summary>Preview planning base</summary><pre class="planning-preview">'+e(planningMarkdown(dataset,state.selected,latestMode()?null:state.period))+'</pre></details>':'')+
  (gaps.length?'<details><summary>Outstanding evidence and next actions</summary><ul>'+gaps.map(gap=>'<li><strong>'+e(statusLabel(gap.status))+'</strong> — '+e(gap.detail)+'<p class="small-note">Next: '+e(gap.next_action || 'Verify the responsible source.')+'</p></li>').join('')+'</ul></details>':'')+'</section>'+
  (links.length?'<section class="panel"><h2>Related investment, finance and services</h2><ul>'+links.map(item=>'<li><a href="'+e(item.url)+'">'+e(item.label)+'</a></li>').join('')+'</ul></section>':'')+
  (nationalDocuments.length?'<section class="panel"><h2>National reference materials — '+e(dataset.country.name)+'</h2><p>National materials are shown separately and are not attributed to '+e(currentArea().name)+'.</p>'+nationalDocuments.map(doc=>renderDocument(dataset,doc)).join('')+'</section>':'')+
  (settings.system?'<section class="panel"><h2>Country planning framework</h2><p>'+e(settings.system.label)+' · '+e(settings.system.scope)+'</p><p>'+e(settings.system.cycle)+'</p>'+settings.system.source_ids.map(id=>sourceNote(null,{source_id:id})).join('')+'</section>':'')+
  '<div class="end-actions">'+pageLink('territorial','Review territorial evidence')+pageLink('thematic','Compare across areas')+'</div>';
}
function home() {
  if(worldMode()) {
    const children=dataset.territories.filter(area=>area.parent_id===dataset.country.national_territory_id);
    return `<section class="home-intro world-intro"><p class="eyebrow">Census Dashboard · ${e(dataset.country.name)}</p><h2>From a region to each country,<br>with every gap visible.</h2><p>Start from the map or one of the registered areas. Population totals use source-reported country totals before any lower-area evidence, so a missing municipality does not distort the regional result.</p><div class="actions">${pageLink('territorial','Explore territorial data','button')}${pageLink('thematic','Compare an indicator')}${pageLink('database','Open data register')}</div></section>
    <div class="territorial-top">${mapPanel()}<section class="panel"><h2>Choose an entry area</h2><p class="small-note">Membership and scope are stated in the source register. Selecting one updates the map, figures, sources and downloads together.</p><div class="region-entry-grid">${children.map(area=>{const lower=dataset.territories.filter(item=>item.parent_id===area.id).length;return `<a class="region-entry" href="${e(new URL(`territorial/?${routeWithLanguage({...state,selected:area.id,level:area.level})}`,base).href)}"><strong>${e(area.name)}</strong><span>${lower?`${lower} lower areas`:'Open country'} →</span></a>`;}).join('')}</div></section></div>
    <div class="entry-grid three"><a class="entry-card" href="${e(pageUrl('territorial'))}"><span class="entry-number">01</span><h2>Territorial diagnostic</h2><p>Read one selected region or country across every acquired theme.</p><strong>Explore a place →</strong></a><a class="entry-card" href="${e(pageUrl('thematic'))}"><span class="entry-number">02</span><h2>Thematic diagnostic</h2><p>Compare compatible countries for one indicator and period.</p><strong>Compare a theme →</strong></a><a class="entry-card" href="${e(pageUrl('planning'))}"><span class="entry-number">03</span><h2>Planning materials</h2><p>Connect selected-area evidence to laws, plans and working materials as country adapters are completed.</p><strong>Open planning →</strong></a></div>
    <section class="panel home-planning"><div><h2>Data register</h2><p>Inspect indicators, definitions, periods, sources and downloadable records used by the dashboard.</p></div>${pageLink('database','Inspect the data register','button')}</section>`;
  }
  const coverage=countCoverage();
  return `<section class="home-intro"><p class="eyebrow">Territorial information and planning</p><h2>Start with an area.<br>Or start with a question.</h2><p>Explore acquired evidence for ${e(dataset.country.name)}, compare like geographic areas when observations are available, and prepare a source-grounded planning outline.</p></section>
  <div class="entry-grid"><a class="entry-card" href="${e(pageUrl('territorial'))}"><span class="entry-number">01</span><h2>Explore an area</h2><p>Geographic selection, basic facts and the latest confirmed value and year for every acquired indicator.</p><strong>Open territorial diagnostic →</strong></a><a class="entry-card" href="${e(pageUrl('thematic'))}"><span class="entry-number">02</span><h2>Compare a theme</h2><p>Choose an indicator. The dashboard selects its newest comparable year and shows the year with every value.</p><strong>Open thematic diagnostic →</strong></a></div>
  <section class="panel home-planning"><div><h2>Turn evidence into planning work</h2><p>Find acquired documents for the same area and download a generic, unapproved planning base with explicit evidence gaps.</p></div>${pageLink('planning','Open planning resources','button')}</section>
  <div class="summary-grid three"><article class="summary"><span>Acquired indicator definitions</span><strong>${dataset.indicators.length}</strong><small>Values and periods vary by indicator</small></article><article class="summary"><span>Reference local areas</span><strong>${coverage.local}</strong><small>${coverage.observed} have one or more acquired observations</small></article><article class="summary"><span>Data edition</span><strong class="date-value">${e(dataset.generated_at.slice(0,10))}</strong><small>Collection status: ${e(statusLabel(dataset.collection?.status))}</small></article></div>
  <section class="panel"><h2>Choose the area to carry into each page</h2>${areaControls()}${identity()}</section>`;
}
function database() {
  const periods=[...new Set(dataset.observations.map(row=>String(row.period)))].sort((a,b)=>b.localeCompare(a,'en',{numeric:true}));
  const observed=dataset.observations.filter(row=>observedValue(row)!==null).length;
  const censusStatus=dataset.analysis?.pilot?.primary_series_family==='census'
    ? 'The project declares census as its primary series. Check the source register and gaps to see which levels and variables have actually been integrated.'
    : 'The current dataset may contain only initial national reference series. Census tables from the national source and local sources must be integrated by the country adapter.';
  return `<section class="home-intro"><p class="eyebrow">Data register</p><h2>Inspect the data behind the dashboard.</h2><p>This supporting page exposes the static country dataset, indicator dictionary, territory register and source records. It does not claim that every census table or local area has been acquired.</p></section>
  <div class="summary-grid three"><article class="summary"><span>Territories</span><strong>${dataset.territories.length}</strong><small>Registered identities and hierarchy</small></article><article class="summary"><span>Source-reported values</span><strong>${observed}</strong><small>Zero is counted; missing is excluded</small></article><article class="summary"><span>Periods</span><strong>${periods.length}</strong><small>${e(periods.at(-1) || '—')}–${e(periods[0] || '—')}</small></article></div>
  <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Variable dictionary</p><h2>${dataset.indicators.length} acquired indicators</h2></div><div class="actions">${button('catalog-csv','Indicator catalog CSV')}${button('observations-csv','All observations CSV')}${button('territories-csv','Territory register CSV')}</div></div><div class="internal-table-scroll" tabindex="0"><table class="internal-table"><thead><tr><th>Theme / indicator</th><th>Definition and population</th><th>Series / unit / aggregation</th><th>Source</th></tr></thead><tbody>${dataset.indicators.map(indicator=>{const source=sourceFor(dataset,indicator);return `<tr><th>${e(indicator.theme)}<small>${e(indicator.name)} · ${e(indicator.id)}</small></th><td>${e(indicator.definition || 'Not acquired')}<small>${e(indicator.population || 'Population not recorded')}</small></td><td>${e(indicator.series_family || 'Not classified')} · ${e(indicator.display_role || 'Not classified')}<small>${e(indicator.unit)} · ${e(indicator.aggregation || 'none')}${dataset.analysis?.aggregation?.rules?.some(rule=>rule.indicator_id===indicator.id)?' · calculated only with full coverage':''}</small></td><td>${source?link(source.url,source.name):'No source registered'}</td></tr>`;}).join('')}</tbody></table></div><p class="small-note">Downloads retain source IDs, value status, series family and data edition. The dashboard’s calculated values are produced at use time and include their component years and audit trail in selected-area evidence exports.</p></section>
  <section class="panel"><h2>Complete the country evidence in stages</h2><ol><li>${e(censusStatus)}</li><li>Acquire census tables from the national source, census years, administrative codes and compatible boundaries for the legal planning level and needed internal-analysis levels.</li><li>Add sector and planning sources only after definitions, periods, populations and geographic correspondence have been checked.</li></ol></section>`;
}
function register() {
  return `<section id="source-register" class="source-register"><h2>Sources, definitions and acquisition gaps</h2><details><summary>Source register (${dataset.sources.length})</summary><ul class="source-list">${dataset.sources.map(source=>`<li><h3>${link(source.url,source.name)}</h3><p>${e(source.publisher)} · ${e(statusLabel(source.status))} · Retrieved ${e(source.retrieved_at || 'Not recorded')} · Reference period ${e(source.reference_period || 'Not recorded')}</p><p>${e(source.note || '')}</p>${source.boundary_source?`<p>Original boundary provider: ${e(source.boundary_source)}${safeUrl(source.source_url)?` · ${link(source.source_url,'Original source')}`:''}</p>`:''}<p>License: ${safeUrl(source.license)?link(source.license,'Source terms'):e(source.license || 'Not recorded')}${safeUrl(source.license_url)?` · ${link(source.license_url,'License source')}`:''}${source.license_detail?` · ${e(source.license_detail)}`:''}</p><small>Raw-file SHA-256: ${e(source.sha256 || 'Not available')}</small></li>`).join('')}</ul></details>
  <details ${dataset.gaps.length?'open':''}><summary>Remaining acquisition gaps (${dataset.gaps.length})</summary><ul class="gap-list">${dataset.gaps.map(gap=>`<li><strong>${e(gap.category.replaceAll('_',' '))} — ${e(statusLabel(gap.status))}</strong><p>${e(gap.detail)}</p><p class="small-note">Next: ${e(gap.next_action || 'Verify with the responsible source.')}</p></li>`).join('') || '<li>No acquisition gaps are listed. This is not a certification of complete national coverage.</li>'}</ul></details><p class="small-note">Data edition ${e(dataset.generated_at)} · Schema ${e(dataset.schema_version)}. Source values, proposals and formal decisions are separate records. Source geography and release dates can differ.</p></section>`;
}
function updateHeader() {
  document.getElementById('dataset-name').textContent=`${dataset.country.name} · data, diagnosis & planning`;
  document.title=`${translateText(pageNames[page],language)} — ${translateText(currentArea().name,language)} | ${translateText(dataset.country.name,language)}`;
  document.querySelectorAll('[data-page-link]').forEach(anchor=>{const target=anchor.dataset.pageLink;anchor.href=pageUrl(target);anchor.dataset.i18n=pageNames[target];anchor.textContent=pageNames[target];if(target===page)anchor.setAttribute('aria-current','page');else anchor.removeAttribute('aria-current');});
  document.querySelectorAll('[data-brand-link]').forEach(anchor=>{const target=new URL('./',base);target.search=routeWithLanguage({...state,selected:dataset.country.national_territory_id,level:'national'});anchor.href=target.href;anchor.setAttribute('aria-label',`${dataset.country.name} · return to the national territorial diagnostic`);});
}
function render() {
  const active=document.activeElement;
  const focusId=active?.id, mapId=active?.dataset.mapId, rankId=active?.dataset.rankId;
  const previousDisclosure=document.querySelector('[data-all-area-selector]');
  if(previousDisclosure)allAreaOpen=previousDisclosure.open;
  const selection=active instanceof HTMLInputElement ? [active.selectionStart,active.selectionEnd] : null;
  updateHeader();
  const periodStatus=latestMode()?(page==='thematic'?`newest comparable year ${state.period}`:'latest confirmed year for each indicator'):`period ${state.period}`;
  app.innerHTML=`<div class="page-heading"><div><p class="eyebrow">${e(dataset.country.name)} · ${e(pageNames[page])}</p><h1>${page==='home'&&!worldMode()?e(dataset.country.name):e(currentArea().name)}</h1></div><div class="actions">${button('share','Share selection')}${button('print','Print page')}</div></div><p id="selection-status" class="sr-only" aria-live="polite">Selected ${e(currentArea().name)}, ${e(currentMetric()?.name || 'no indicator')}, ${e(periodStatus)}.</p><p id="action-status" class="action-status" role="status"></p>${state.notices.map(notice=>`<p class="notice">${e(notice)}</p>`).join('')}${updateBanner()}${page==='planning'?'':scopeBanner()}${({home,territorial,thematic,database,planning}[page] || home)()}${register()}`;
  translateInterface(document,language);
  if(focusId) {const next=document.getElementById(focusId);const disclosure=next?.closest('details');if(disclosure)disclosure.open=true;next?.focus({preventScroll:true});if(selection&&next instanceof HTMLInputElement)try{next.setSelectionRange(...selection);}catch{}}
  if(mapId) [...document.querySelectorAll('[data-map-id]')].find(node=>node.dataset.mapId===state.selected)?.focus({preventScroll:true});
  if(rankId) {
    const next=[...document.querySelectorAll('[data-rank-id]')].find(node=>node.dataset.rankId===rankId);
    const disclosure=next?.closest('details');if(disclosure)disclosure.open=true;
    next?.focus({preventScroll:true});revealRankingSelection();
  }
}
function normalizeLatestState(next) {
  if(page==='thematic')next=normalizeThematicState(dataset,next);
  if(!latestMode())return next;
  const comparisonPeriod=latestComparisonPeriod(dataset,next.metric,next.level,next.selected);
  const areaPeriod=latestDisplayPeriod(dataset,next.selected,next.metric);
  return {...next,period:page==='thematic'?(comparisonPeriod||areaPeriod):(areaPeriod||comparisonPeriod)};
}
function commit(next, {replace=false}={}) {
  state=normalizeLatestState(next);
  const url=new URL(location.href);url.search=routeWithLanguage(state);
  history[replace?'replaceState':'pushState']({},'',url);
  render();
}
function navigate(next) {
  state=normalizeLatestState(next);
  const url=new URL(location.href);url.search=routeWithLanguage(state);
  location.assign(url.href);
}
function revealRankingSelection({focus=false}={}) {
  const row=[...document.querySelectorAll('#ranking-content [data-ranking-id]')].find(node=>node.dataset.rankingId===state.selected);
  const container=row?.closest('.ranking-scroll');
  if(!row || !container)return false;
  const details=row.closest('details');if(details)details.open=true;
  const containerRect=container.getBoundingClientRect(),rowRect=row.getBoundingClientRect();
  container.scrollTop=rankingScrollTop({scrollTop:container.scrollTop,clientHeight:container.clientHeight,scrollHeight:container.scrollHeight,rowTop:rowRect.top-containerRect.top+container.scrollTop,rowHeight:rowRect.height});
  if(focus)row.querySelector('button')?.focus({preventScroll:true});
  return true;
}
function choose(id,{fromMap=false}={}) {
  mapExtent='selected';mapZoom=1;areaSearch='';
  const next=selectTerritory(dataset,state,id);
  if(fromMap && page==='thematic') {
    // Map highlighting does not redefine the comparison cohort.
    next.level=state.level;
    rankSearch=rankingReveal(comparisonRows(dataset,next),id,rankSearch).query;
  }
  commit(next);
  if(fromMap && page==='thematic')revealRankingSelection();
}
function inspectInternal(target) {
  const panel=target.closest('[data-internal-comparison]');
  if(!panel)return;
  const id=target.dataset.internalId;
  const rows=[...panel.querySelectorAll('[data-internal-row]')];
  for(const row of rows)row.classList.toggle('inspected',row.dataset.internalRow===id);
  for(const shape of panel.querySelectorAll('.internal-area'))shape.classList.toggle('inspected',shape.dataset.internalId===id);
  const row=rows.find(item=>item.dataset.internalRow===id);
  const status=panel.querySelector('.internal-inspection');
  if(status&&row)status.textContent=`${row.querySelector('th').innerText.trim().replace(/\s+/g,' ')} — ${row.querySelector('td').innerText.trim().replace(/\s+/g,' ')}. Diagnostic area remains ${currentArea().name}.`;
}
function actionStatus(text) {const target=document.getElementById('action-status');target.textContent=text;}
function download(text, filename, type) {
  const object=URL.createObjectURL(new Blob([text],{type}));
  const anchor=document.createElement('a');anchor.href=object;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(object),1000);actionStatus(`Prepared ${filename} for ${currentArea().name}.`);
}
function downloadBlob(blob,filename) {
  const object=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=object;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(object),1000);actionStatus(`Prepared ${filename} for ${currentArea().name}.`);
}
function seriesCsv(indicatorId, territoryId) {
  const indicator=metricFor(indicatorId), area=areaFor(territoryId);
  const rows=seriesFor(dataset,territoryId,indicatorId),extended=!!dataset.analysis || rows.some(row=>!observationContext(dataset,area,indicator,row).comparable);
  return makeCsv([['Country','Territory','Territory ID','Level','Indicator','Indicator ID','Period','Value','Unit','Status','Source URL','Retrieved at','Data edition',...(extended?['Definition ID','Definition','Population','Method','Comparable context','Comparison reason','Observation boundary edition']:[])],...rows.map(row=>{const context=observationContext(dataset,area,indicator,row),source=context.source;return [dataset.country.name,area.name,area.id,area.level,indicator.name,indicator.id,row.period,observedValue(row),context.unit,row.status,safeUrl(source?.url),source?.retrieved_at,dataset.generated_at,...(extended?[context.definition_id,context.definition,context.population,context.method,context.comparable,context.reason,row.boundary_version]:[])];})]);
}
function catalogCsv() {
  return makeCsv([['Theme','Indicator ID','Indicator','Series family','Display role','Definition','Population','Unit','Measurement method','Configured aggregation','Period policy','Source ID','Data edition'],...dataset.indicators.map(indicator=>[indicator.theme,indicator.id,indicator.name,indicator.series_family,indicator.display_role,indicator.definition,indicator.population,indicator.unit,indicator.measurement_method,indicator.aggregation,indicator.period_policy,indicator.source_id,dataset.generated_at])]);
}
function observationsCsv() {
  return makeCsv([['Territory ID','Indicator ID','Period','Value','Unit','Status','Source ID','Definition ID','Definition','Population','Measurement method','Boundary edition','Footnote','Data edition'],...dataset.observations.map(row=>{const indicator=metricFor(row.indicator_id);return [row.territory_id,row.indicator_id,row.period,observedValue(row),row.unit || indicator?.unit,row.status,row.source_id,row.definition_id || indicator?.definition_id,row.definition || indicator?.definition,row.population || indicator?.population,row.measurement_method || indicator?.measurement_method,row.boundary_version,row.footnote,dataset.generated_at];})]);
}
function territoriesCsv() {
  return makeCsv([['Territory ID','Name','Level','Type','Parent ID','Country ID','Official code','Code system','Boundary edition','Source ID','Data edition'],...dataset.territories.map(area=>[area.id,area.name,area.level,area.type,area.parent_id,area.country_id,area.official_code,area.code_system,area.boundary_version,area.source_id,dataset.generated_at])]);
}
app.addEventListener('change',event=>{
  const control=event.target.dataset.control;
  if(control==='area')choose(event.target.value);
  if(control==='thematic-scope') {
    mapExtent='selected';mapZoom=1;areaSearch='';rankSearch='';
    const next=selectTerritory(dataset,state,event.target.value);
    next.level=preferredThematicLevel(dataset,next.selected,next.metric,next.level);
    // Country datasets can contain hundreds of local areas and large boundary
    // payloads. Reload from the canonical URL when the comparison scope changes
    // so a long synchronous render cannot leave the URL and visible dashboard
    // on different areas.
    navigate(next);
  }
  if(control==='hierarchy') {mapExtent='selected';mapZoom=1;areaSearch='';commit(selectHierarchyOption(dataset,state,event.target.dataset.parent,event.target.value));}
  if(control==='metric') {const metric=event.target.value;commit({...state,metric,requestedMetric:undefined,sourceDataset:undefined,notices:[]});}
  if(control==='period'&&!latestMode())commit({...state,period:event.target.value,notices:[]});
  if(control==='level'){mapExtent='selected';mapZoom=1;commit({...state,level:event.target.value,notices:[]});}
  if(control==='rank-order'){rankOrder=event.target.value;render();}
});
app.addEventListener('input',event=>{
  if(event.target.dataset.control==='area-search'){areaSearch=event.target.value;render();}
  if(event.target.dataset.control==='ranking-search'){rankSearch=event.target.value;document.getElementById('ranking-content').innerHTML=rankingContent(comparisonRows(dataset,state));}
});
app.addEventListener('keydown',event=>{
  const internalTarget=event.target.closest('.internal-area[data-internal-id]');
  if(internalTarget&&['Enter',' '].includes(event.key)){event.preventDefault();inspectInternal(internalTarget);return;}
  const target=event.target.closest('[data-map-id]');
  if(!target)return;
  if(['Enter',' '].includes(event.key)){event.preventDefault();choose(target.dataset.id,{fromMap:true});return;}
  const keys=['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'];
  if(!keys.includes(event.key))return;
  event.preventDefault();const paths=[...target.ownerSVGElement.querySelectorAll('[data-map-id]')],index=paths.indexOf(target);
  const next=event.key==='Home'?0:event.key==='End'?paths.length-1:(index+(['ArrowDown','ArrowRight'].includes(event.key)?1:-1)+paths.length)%paths.length;
  paths.forEach(path=>path.setAttribute('tabindex','-1'));paths[next].setAttribute('tabindex','0');paths[next].focus();
});
app.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target)return;
  const action=target.dataset.action;
  const stem=safeFilename(`${dataset.country.id}-${state.selected}-${latestMode()?'latest':state.period || 'no-period'}`);
  try {
    if(action==='inspect-internal')inspectInternal(target);
    else if(action==='select')choose(target.dataset.id,{fromMap:!!target.dataset.mapId});
    else if(action==='national')choose(dataset.country.national_territory_id);
    else if(action==='map-extent'){mapExtent=['selected','parent','country'].includes(target.dataset.extent)?target.dataset.extent:'selected';mapZoom=1;render();}
    else if(action==='map-zoom-in'){mapZoom=adjustedMapZoom(mapZoom,'in');render();}
    else if(action==='map-zoom-out'){mapZoom=adjustedMapZoom(mapZoom,'out');render();}
    else if(action==='map-zoom-reset'){mapZoom=adjustedMapZoom(mapZoom,'reset');render();}
    else if(action==='use-period'&&!latestMode())commit({...state,period:target.dataset.period,metric:target.dataset.metric||state.metric,notices:[]});
    else if(action==='compare'){state={...state,metric:target.dataset.id};location.href=pageUrl('thematic');}
    else if(action==='show-selected'){
      rankSearch=rankingReveal(comparisonRows(dataset,state),state.selected,rankSearch).query;render();
      if(revealRankingSelection({focus:true}))actionStatus('The selected area is visible in the ranking panel. Missing observations remain unranked.');
      else actionStatus('The selected area has no rank in this comparison set. Its details remain below the map.');
    }
    else if(action==='share'){
      const url=new URL(location.href);url.search=routeQuery(dataset,state);
      if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(url.href);actionStatus('Selection link copied.');return;}catch{}}
      const input=document.createElement('input');input.value=url.href;input.readOnly=true;input.setAttribute('aria-label','Selection link to copy');const status=document.getElementById('action-status');status.textContent='Copy this selection link: ';status.append(input);input.focus();input.select();
    }
    else if(action==='print')window.print();
    else if(action==='diagnostic-markdown')download(diagnosticMarkdown(dataset,state.selected,latestMode()?null:state.period),`${stem}-diagnostic.md`,'text/markdown;charset=utf-8');
    else if(action==='diagnostic-html')download(diagnosticHtml(dataset,state.selected,latestMode()?null:state.period),`${stem}-diagnostic.html`,'text/html;charset=utf-8');
    else if(action==='diagnostic-csv')download(diagnosticCsv(dataset,state.selected,latestMode()?null:state.period),`${stem}-diagnostic.csv`,'text/csv;charset=utf-8');
    else if(action==='planning-markdown')download(planningMarkdown(dataset,state.selected,latestMode()?null:state.period),`${stem}-planning-base.md`,'text/markdown;charset=utf-8');
    else if(action==='planning-docx')downloadBlob(planDocxBlob(dataset,state.selected,latestMode()?null:state.period),planningDiagnosticFilename(dataset,state.selected));
    else if(action==='planning-html')download(planningHtml(dataset,state.selected,latestMode()?null:state.period),`${stem}-planning-base.html`,'text/html;charset=utf-8');
    else if(action==='documents-csv')download(documentsCsv(dataset,state.selected),`${safeFilename(dataset.country.id+'-'+state.selected)}-materials.csv`,'text/csv;charset=utf-8');
    else if(action==='planning-csv')download(evidenceCsv(dataset,state.selected,latestMode()?null:state.period),`${stem}-evidence.csv`,'text/csv;charset=utf-8');
    else if(action==='indicator-csv')download(evidenceCsv(dataset,state.selected,latestMode()?null:state.period,[target.dataset.id]),`${stem}-${safeFilename(target.dataset.id)}.csv`,'text/csv;charset=utf-8');
    else if(action==='series-csv')download(seriesCsv(target.dataset.id,target.dataset.territory),`${safeFilename(target.dataset.territory)}-${safeFilename(target.dataset.id)}-history.csv`,'text/csv;charset=utf-8');
    else if(action==='catalog-csv')download(catalogCsv(),`${safeFilename(dataset.country.id)}-indicator-catalog.csv`,'text/csv;charset=utf-8');
    else if(action==='observations-csv')download(observationsCsv(),`${safeFilename(dataset.country.id)}-observations.csv`,'text/csv;charset=utf-8');
    else if(action==='territories-csv')download(territoriesCsv(),`${safeFilename(dataset.country.id)}-territories.csv`,'text/csv;charset=utf-8');
    else if(action==='comparison-csv'){
      const indicator=currentMetric();
      const entries=comparisonRows(dataset,state),extended=!!dataset.analysis || entries.some(row=>row.status==='incomparable');
      const rows=[['Country','Level','Territory ID','Territory','Code','Indicator ID','Indicator','Period','Value','Unit','Status','Source URL','Data edition',...(extended?['Comparison eligible','Comparison reason','Definition ID','Definition','Population','Method']:[])],...entries.map(row=>{const context=observationContext(dataset,row.area,indicator,row.row);return [dataset.country.name,row.area.level,row.area.id,row.area.name,row.area.official_code,indicator.id,indicator.name,row.period || state.period,observedValue(row.row),context.unit,row.row?.status || row.status,safeUrl(context.source?.url),dataset.generated_at,...(extended?[finite(row.value),row.reason || context.reason,context.definition_id,context.definition,context.population,context.method]:[])];})];
      download(makeCsv(rows),`${safeFilename(dataset.country.id+'-'+state.level+'-'+state.metric+'-'+state.period)}-comparison.csv`,'text/csv;charset=utf-8');
    }
  } catch(error) {actionStatus(`Could not complete this action: ${error.message}. Your selection and evidence are retained.`);}
});
document.querySelectorAll('[data-language]').forEach(control=>control.addEventListener('click',()=>{
  const next=control.dataset.language;if(!SUPPORTED_LANGUAGES.includes(next)||next===language)return;
  language=next;try{localStorage.setItem('census-dashboard-language',language);}catch{}
  const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState({},'',url);if(dataset&&state)render();else translateInterface(document,language);
}));

window.addEventListener('popstate',()=>{language=resolveLanguage({query:new URLSearchParams(location.search).get('lang'),stored:storedLanguage(),browserLanguages:navigator.languages||[navigator.language]});state=normalizeLatestState(initialState(dataset,location.search));mapExtent='selected';mapZoom=1;areaSearch='';rankSearch='';render();});

translateInterface(document,language);
try {
  const response=await fetch(new URL('data/dashboard.json',base));
  if(!response.ok)throw new Error(`Data request returned HTTP ${response.status}`);
  dataset=await response.json();
  if(dataset.schema_version!=='0.2'||!dataset.country||!Array.isArray(dataset.territories)||!Array.isArray(dataset.indicators)||!Array.isArray(dataset.observations))throw new Error('Unsupported or incomplete dataset');
  const statusResponse=await fetch(new URL('data/update-status.json',base),{cache:'no-store'}).catch(()=>null);
  if(statusResponse?.ok)updateStatus=await statusResponse.json().catch(()=>null);
  pageNames.planning='Planning materials and links';
  state=normalizeLatestState(initialState(dataset,location.search));
  if(latestMode()){const url=new URL(location.href);url.search=routeWithLanguage(state);history.replaceState({},'',url);}
  render();
} catch(error) {
  app.innerHTML=`<section class="panel error-panel"><h1>Dashboard data could not be loaded</h1><p>${e(error.message)}</p><p>Serve this folder over HTTP using the project’s local server, then reload. The dataset is stored at <code>data/dashboard.json</code>; no remote service is required after collection.</p><button class="button" id="reload-page">Reload</button></section>`;
  translateInterface(document,language);
  document.getElementById('reload-page').addEventListener('click',()=>location.reload());
}
