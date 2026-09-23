# 共通データと国別情報源の事前台帳

世界country/area台帳、JICA優先142か国・地域の優先台帳、国別source所在、原本取得・正規化・サイト生成を分ける運用は[世界全体とJICA優先142か国・地域の運用モデル](GLOBAL_SOURCE_AND_BUILD_OPERATING_MODEL.md)に定める。利用者へ完成データの事前収集を開始条件として求めない。

国名だけを受け取ったAIが毎回ゼロから探索しないよう、探索開始台帳、詳細所在調査、検証済み再利用レシピを分けて管理する。

- `config/country-source-registry.json`：国勢調査、計画法、計画手引き、既存計画、公式地域コード・境界の所在。ラテンアメリカ20か国の既存調査を読み込み、ウガンダの確認先を追加している。
- `config/common-subnational-sources.json`：複数国で再利用できる国際機関・国際事業の地域別、地点別、格子別データ源。
- `config/world-country-area-registry.json`：UN M49の248 country/areaと、別根拠で明示した運用補足2件（台湾・Kosovo）の同定台帳。ISO/M49、地域区分、別名、JICA優先タグを持つが、主権・法定計画主体・統計内容を推測しない。
- `config/world-source-preflight.json`：世界250件について、統計機関／国勢調査、計画法・資料、行政コード・境界、国際候補の4区分を示す探索開始台帳。数値データ自体は収録しない。人が確認する一覧は`docs/research/world-2026/WORLD_SOURCE_PREFLIGHT_250.md`である。
- `national_statistics_and_census.latest_un_census_listing`：リンクの有無とは無関係に、UNSDが掲載する最新の実施済み国勢調査roundと日付を示す。これは結果表の取得・公開・採用を意味しない。
- `national_statistics_and_census.latest_un_census_linked_listing`：UNSDがリンクを付けている実施済み国勢調査のうち最新のものを示す。上記より古い場合があり、リンク先を当案件で取得・確認・採用した証拠にはならない。
- `config/jica-priority-country-registry.json`：JICA事務所の現行Purviewによる142か国・地域、ISO/M49、所管事務所、JICA国別ページ、OECD DAC区分。国別sourceを取得済みとする台帳ではない。
- `config/jica-priority-source-preflight.json`：JICA優先142か国・地域すべてについて、統計局・国勢調査、計画法・計画資料、行政コード・境界、国際データ候補の探索開始アドレスと、探索を省略させない必須次工程を記録する。人が確認する一覧は`docs/research/jica-priority-2026/SOURCE_PREFLIGHT_142.md`である。
- `config/americas-verified-source-recipes.json`：米大陸で厳格な統計版基準を満たした27国と、定住人口を持たないSGSの構造的例外について、実際に機能した公式sourceの所在、取得方法、表の意味、行政コード・境界の注意、再実行時の必須確認を記録する。人が読む教訓は[`docs/research/americas-2026/VERIFIED_SOURCE_RECIPES_28.md`](research/americas-2026/VERIFIED_SOURCE_RECIPES_28.md)にある。
- `config/areadata-source-feedback.json`：AreaDataのカバー拡張時に確認した公開公式sourceを、証拠段階・確認日・origin commit付きでKitへ戻す再利用台帳。取込方法と安全境界は[`AREADATA_SOURCE_FEEDBACK.md`](AREADATA_SOURCE_FEEDBACK.md)に定める。AreaDataでの取得・採用状態は、新しいKit案件の取得・採用状態へ引き継がない。

台帳にURLがあることは、その国の数値を取得済み、地理を照合済み、DDPTへ採用済みという意味ではない。次の段階を順に記録する。

1. `catalogued`：資料やAPIの所在と仕様を確認した。
2. `country_availability_checked`：対象国・テーマ・年・粒度で利用可能か確認した。
3. `data_acquired`：許可された原本を取得し、要求・応答・取得日時・hashを保存した。
4. `geography_matched`：統計コード、地域型、境界版、有効期間を照合した。
5. `indicator_accepted`：定義、単位、母集団、分子分母、期間と採用理由を確定した。

## 国別作成で自動生成するもの

`create-country.mjs`はWDI全国値と参照境界を収集した後、対象国について次を生成する。

- `evidence/SOURCE_PREFLIGHT.json`：AIや処理プログラムが読む構造化された調査開始票。
- `evidence/SOURCE_PREFLIGHT.md`：人が確認できる国別情報源と共通候補の一覧。

全250件で世界台帳の統計機関、UNSD国勢調査日程、FAOLEX、geoBoundaries、UN SALB、HDX、WDI等の入口を先に示す。既存の詳細所在調査がある国では、その国の国勢調査・計画制度・境界の候補を追加する。JICA優先142件ではJICA・外務省等の補足を加え、検証済みレシピがある28件では一般検索より先に、過去に成功した公式入口、API／Power BI／Redatam／archive等の取得方法、意味・地理上の注意を表示する。スペインとフィンランドには先進国・登録統計・分権法制、台湾にはUN M49非掲載の運用同定、国勢調査・登録統計、空間計画法制を扱うための国別公式入口を追加している。いずれの場合も、リンクの発見や過去の取得成功は、現在の案件での取得・本文確認・地理照合・採用ではない。リンクの有効性、新版、法令改正、機関改編、データ内容、行政粒度、利用条件を案件時点で再確認する。

サイトを生成せずに台帳を確認する場合は次を使う。

```sh
npm run sources:plan -- --country UGA
npm run sources:plan -- --country DOM --theme refugees
npm run sources:plan -- --country JPN --format json
```

世界250件はISO3、ISO2、M49または明示した運用補足コード、英語名、および実行環境が提供する日本語・スペイン語・フランス語の地域名で指定できる。例えば`スペイン`、`フィンランド`、`台湾`、`ESP`、`FI`、`TWN`を解決できる。

## 計画単位と内部分析単位

所在調査では、法定の計画策定単位と、その計画のために内部を診断する統計単位を別に記録する。ウガンダでDistrictの計画を作る場合、District全体の値に加えて、県内の格差や優先地域を見るSubcounty／Division／Town Council等の統計と境界が必要になる。下位資料があるだけで、その単位を法定計画主体に変更しない。

## 初期登録した共通候補

| 分野 | 主な候補 | 地理 |
|---|---|---|
| 人道・人口・貧困・施設等 | OCHA HDX HAPI | 国、ADM1、ADM2（国・分野別に変動） |
| 難民・避難民・無国籍 | UNHCR Refugee Data Finder | 国、報告地点・地域 |
| 国内避難・帰還・移動 | IOM DTM | 国、ADM1、ADM2 |
| 食料不安・栄養 | IPC-CH | 分析区域、地点、GeoJSON |
| 子ども・女性・WASH等 | UNICEF MICS | 調査報告領域、許可された地理情報 |
| 保健・人口・栄養 | DHS Program | 調査地域、許可された地理情報 |
| 人口分布 | WorldPop | 格子、指定ポリゴン |
| 人口・建築域・都市 | EC JRC GHSL | 格子、都市域、指定ポリゴン |
| 行政境界・履歴 | UN SALB | ADM1、ADM2（提供国・期間のみ） |
| 農業・水生産性 | FAO WaPOR | 格子、流域、灌漑地区等 |

正確な対象範囲、アクセス、保存、再配布、注意事項はJSON台帳を正とする。共通候補は国勢調査の穴を同じ意味の数字で埋めるものではない。国勢調査、標本調査、人道調査、登録統計、モデル推計、リモートセンシングを別の`source`と測定方法で保持する。

## 保存と再利用

Gitには台帳、アダプター、スキーマ、取得手順、小規模で再配布可能な検証資料を保存する。大きな原本・ラスタ・取得応答は、将来のData Commonsの版管理されたオブジェクト保管へ置く。各原本にはsource ID、取得要求、最終URL、取得日時、hash、利用条件、上流版を付ける。

正規化済みデータは原本を上書きせず、処理版、入力hash、地域対応、指標定義を付けて別に保存する。Atlasへは対象国・対象機能で採用した派生bundleだけを渡す。更新失敗で最後の正常bundleを置き換えない。

再配布できない個票・空間ファイルはGitや公開オブジェクト保管へ複製しない。許可されたメタデータ、取得手順、版、必要な申請・認証と、生成可能な派生物の条件を残す。APIキーや認証情報は台帳、ログ、成果物へ保存しない。

## 国を追加する手順

1. 国勢調査の公式入口、表・API・報告書、調査票・辞書、公開粒度を確認する。
2. 計画法・自治体法・州法、現行改正、所管、作成・協議・承認主体、計画手引き・様式、公開済み計画を確認する。
3. 計画策定単位、その上位、および内部分析に必要な下位単位の公式コードと境界候補を確認する。
4. 国別sourceをregistryへ追加し、`checked_at`と証拠段階を記録する。
5. AreaDataで新しい公式sourceを確認した場合はfeedback bundleを生成し、Kit importerで`config/areadata-source-feedback.json`へmergeする。
5. 共通候補の対象国availabilityを照会し、採用・非採用と理由を案件側の台帳へ保存する。
6. 実取得と変換を再実行できるアダプターにし、代表地域で画面・表・出力まで照合する。

世界250件すべてに4区分の探索開始アドレスがある。別レイヤーの詳細な国別source記録・検証済みレシピは重複なしで32か国・地域、世界事前台帳内の追加詳細パックはスペイン・フィンランド・台湾の3件、JICA優先補足は142件である。これらは重なる別レイヤーである。詳細記録がない国でも「検索先が分からない」状態から始めず、国別統計機関と複数の公式・国際目録へ到達できる。法令名、条文、表、最新版、地域粒度は案件内で原文を確認し、詳細記録へ昇格させる。入口を確認済み証拠へ昇格させない。それでも国名だけの実行依頼は有効で、AIが同じ依頼内で所在確認、取得、内容確認、統合、納品ゲートまで進む。

ドミニカ共和国、ウガンダ、ラオス、バングラデシュは[4つの基準国ケース](REFERENCE_COUNTRY_CASES.md)として別途登録する。各ケースは特定の工程上の教訓であり、その国の制度・階層・指標を他国へコピーするテンプレートではない。この4か国自身も新規作成の有効な指定国であり、指定された場合は保存済み見本を返さず、現在の公式sourceを再確認して新しい成果を作る。
