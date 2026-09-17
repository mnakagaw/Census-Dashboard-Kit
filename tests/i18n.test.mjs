import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLanguage,languageLocale,translateText,sourceSeriesLabel,localizedIndicator} from '../scaffold/site/i18n.mjs';

test('browser language chooses Japanese, Spanish or English when no preference exists',()=>{
  assert.equal(resolveLanguage({browserLanguages:['ja-JP','en-US']}),'ja');
  assert.equal(resolveLanguage({browserLanguages:['es-DO','en']}),'es');
  assert.equal(resolveLanguage({browserLanguages:['fr-FR']}),'en');
  assert.equal(languageLocale('ja'),'ja-JP');
});

test('explicit URL language and remembered choice take precedence over browser default',()=>{
  assert.equal(resolveLanguage({query:'es',stored:'ja',browserLanguages:['en-US']}),'es');
  assert.equal(resolveLanguage({stored:'ja',browserLanguages:['es']}),'ja');
  assert.equal(resolveLanguage({query:'xx',stored:'',browserLanguages:['es-MX']}),'es');
});

test('core interface and source-series labels have all three display languages',()=>{
  assert.equal(translateText('Territorial diagnostic','es'),'Diagnóstico territorial');
  assert.equal(translateText('Territorial diagnostic','ja'),'地域診断');
  assert.equal(translateText('Show parent area','ja'),'上位行政区を表示');
  assert.equal(translateText('Zoom in','ja'),'拡大');
  assert.equal(translateText('Louangnamtha · a lower area is currently selected','ja'),'Louangnamtha・下位地域を選択中');
  assert.equal(translateText('Louangnamtha — select this province','ja'),'Louangnamtha — この県全体を選択');
  assert.equal(translateText('Census and national statistics','es'),'Censo y estadísticas nacionales');
  assert.equal(translateText('International institution data sources','ja'),'国際機関データソース');
  assert.equal(translateText('Planning materials and links','ja'),'計画資料・リンク');
  assert.match(translateText('Source-checked material references for 0 of 166 local records; national reference materials also available. Coverage varies by category and period; this is not a count of completed or approved plans.','es'),/^Referencias de materiales verificadas/);
  assert.equal(translateText('Source and acquisition details · Body acquired','ja'),'出典・取得の詳細 · 本文取得済み');
  assert.match(translateText('9 of 40 statistical indicators have a latest confirmed value for Namtha. Each value carries its own source year. 0 selected-area material records retain their own periods.','ja'),/^Namthaでは、統計40指標のうち9指標/);
  assert.equal(translateText('Home','ja'),'Home');
  assert.equal(translateText('Prepared Namtha-diagnostic.csv for Namtha.','ja'),'Namtha用のNamtha-diagnostic.csvを準備しました。');
  assert.equal(translateText('Prepared Namtha-diagnostic.csv for Namtha.','es'),'Se preparó Namtha-diagnostic.csv para Namtha.');
  assert.equal(translateText('not recorded','ja'),'未記録');
  assert.equal(translateText('calculated_from_source_fields','es'),'calculado_a_partir_de_campos_de_fuente');
  assert.equal(translateText('National source country identity does not match this area.','ja'),'全国出典の国識別情報がこの地域と一致しません。');
  assert.equal(translateText('Inspect a map area or table row to highlight its value. The diagnostic area stays unchanged.','ja'),'地図上の地域または表の行を選ぶと値を強調表示します。診断対象地域は変わりません。');
  assert.match(translateText('5 of 5 member areas have comparable observations. Range 27,179–64,530 people. This range describes recorded differences; it does not establish causes or agreed priorities.','ja'),/^構成地域5件のうち5件に比較可能な観測値があります。/);
  assert.match(translateText('5 of 5 member areas have comparable observations. Range 27,179–64,530 people. This range describes recorded differences; it does not establish causes or agreed priorities.','es'),/^5 de 5 áreas integrantes tienen observaciones comparables/);
  assert.equal(translateText('Districts within Louangnamtha','ja'),'Louangnamtha内の郡');
  assert.equal(translateText('Print the HTML report to include legends, sources and every row. No resident agreement or formal approval is inferred.','es'),'Imprima el informe HTML para incluir leyendas, fuentes y todas las filas. No se presupone acuerdo de la población ni aprobación formal.');
  assert.equal(translateText('Selected Louangnamtha, Population, newest comparable year 2024.','ja'),'選択中：Louangnamtha、人口。比較可能な最新年は2024年です。');
  assert.equal(translateText('Administrative level 2 · 2024; observed values only','ja'),'行政階層 2・2024（観測値のみ）');
  assert.match(translateText('Colors use five equal value intervals across Louangnamtha at administrative level 2 for this indicator and period; search does not change the scale. Gray inside the comparison area = No data; pale gray outside it = surrounding context. High values are not automatically better.','ja'),/^この指標・期間について、Louangnamthaの行政階層2を/);
  assert.equal(translateText('5 observed / 5 comparable areas. Search narrows displayed rows only. Ties share a rank.','es'),'5 áreas observadas / 5 comparables. La búsqueda solo limita las filas mostradas. Los empates comparten posición.');
  assert.equal(sourceSeriesLabel({series_family:'census'},{period:'2022'},'2022','es'),'Censo 2022');
  assert.equal(sourceSeriesLabel({series_family:'international_reference'},{series_stage:'medium_projection'},'2026','ja'),'国連中位推計 2026年');
  assert.equal(sourceSeriesLabel({series_family:'international_reference',series_stage_by_period:{2026:'medium_projection'}},null,'2026','en'),'UN medium projection 2026');
});

test('country indicators use explicit language records without bilingual leakage',()=>{
  const indicator={id:'population',name:'Population estimate',theme:'Population and demography',definition:'Estimated resident population.',population:'Resident population',unit:'people',translations:{ja:{name:'推計人口',theme:'人口・動態',definition:'推計居住人口。',population:'居住人口',unit:'人'},es:{name:'Estimación de población',theme:'Población y demografía',definition:'Población residente estimada.',population:'Población residente',unit:'personas'}}};
  assert.deepEqual(localizedIndicator(indicator,'en'),indicator);
  assert.equal(localizedIndicator(indicator,'ja').name,'推計人口');
  assert.equal(localizedIndicator(indicator,'es').definition,'Población residente estimada.');
  assert.doesNotMatch(localizedIndicator(indicator,'en').name,/[/\u3040-\u30ff\u4e00-\u9fff]/u);
});
