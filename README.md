# Census Dashboard Kit

**Give an AI a country name and this repository URL. It gets a tested starting point for researching official census and planning sources, building a local dashboard, and recording what remains unverified.**

国名とこのPublicリポジトリのURLをAntigravity、Gemini、Claude Code、Codex等へ渡し、各国の公式資料を調査して国別ダッシュボードを作るためのOSSキットです。DDPT（ドミニカ共和国の地域情報・計画策定ダッシュボード）とウガンダ版から得た操作・制作上の教訓を、国別に適応できる形へまとめています。

> [!IMPORTANT]
> `create-country.mjs`の成功は完成を意味しません。初期生成で取得するのはWorld Bank WDIの全国系列、取得可能なgeoBoundaries ADM1参照境界、情報源の事前確認票です。AIは続けて、その国の公式な地方統計、行政コード・境界、計画法、計画手引き、地方計画・予算資料を調査し、採用できる実データを統合して検証します。

## 作るもの

国別に独立した、次の3ページを基本構成とします。

1. **Territorial Diagnostic** — 選択した地域を人口、教育、保健、水、住宅、生計等から総合的に読む。
2. **Thematic Diagnostic** — 一つのテーマ・指標について地域間を比較する。
3. **Development Plan Materials** — 適用される計画制度、公式計画、統計根拠、予算・実施・評価資料、未取得資料を選択地域ごとに確認する。

国ごとに行政階層、法定の計画主体、言語、指標、統計年、地図、図表、資料形式が違うため、画面を一律に複製しません。共通化するのはページの役割、地域選択の意味、欠測と出典の扱い、取得・検証手順です。

## AIへの最短依頼

以下の`COUNTRY`を国名に替えて、そのままAIへ渡せます。

```text
Read https://github.com/mnakagaw/Census-Dashboard-Kit and create a complete COUNTRY census and local-planning dashboard.

Start with START_HERE.md and follow AGENTS.md and docs/COUNTRY_AGENT_WORKFLOW.md. Treat the country name as sufficient input. Use a new output directory and do not rewrite the kit for one country.

You may use the terminal, network, browser, and local files needed for this task. If Node.js 22+, Git, or a document/data reader is missing and your environment permits installation, install only what is needed. Do not ask me to fill a long questionnaire; record reasonable defaults and ask only if the country itself is ambiguous or a decision would materially change the result.

Run the bootstrap, then continue beyond it: find and verify the country's official census catalogue, detailed subnational tables, official geographic codes and boundaries, planning law, planning guidance, local plans, and relevant budget/implementation/evaluation sources. Inventory the actual source tables and numeric columns. Build reusable source adapters, integrate verified local data, and keep unavailable, restricted, failed, missing, zero, and not-applicable states distinct.

Deliver working Territorial Diagnostic, Thematic Diagnostic, and Development Plan Materials pages. Verify representative areas with complete data, sparse data, and special administrative types. Test the selected area across maps, headings, indicators, documents, URLs, and exports. In particular, after selecting a lower area, explicitly reselecting its current parent must clear the lower selection and immediately analyze the parent while keeping the selected indicator and period.

Run npm run check, npm test, and node scripts/validate-country.mjs --project <project-directory>. Test the actual site and downloaded outputs. Record sources, hashes, geographic matching, adopted/rejected indicators, unfinished work, and reproducible commands in the project evidence and HANDOFF.md. A running bootstrap or a list of links is not completion.
```

日本語の短い依頼でも開始できます。

```text
https://github.com/mnakagaw/Census-Dashboard-Kit を読んで、ウガンダ版を作って。
START_HERE.mdから始め、公式の地方統計と計画資料を実際に収集・統合し、3ページと出力を検証するところまで進めて。
```

AIへ「フルアクセス」と書くだけで、そのAIサービスの権限設定が変わるわけではありません。利用するアプリ側で、リポジトリ読取、作業フォルダへの書込、ターミナル、ネット接続を許可してください。秘密情報や再配布不可データをGitへ保存する許可は含みません。

## 人が手元で開始する場合

必要条件はGit、Node.js 22以上、ネット接続です。実行時の外部npmパッケージやAPIキーは不要です。Excel・PDF等の抽出には、資料に応じてPythonと対応ライブラリを追加します。

```sh
git clone https://github.com/mnakagaw/Census-Dashboard-Kit.git
node ./Census-Dashboard-Kit/scripts/create-country.mjs --country "Uganda" --out ./uganda-dashboard
node ./Census-Dashboard-Kit/scripts/serve.mjs --dir ./uganda-dashboard/site --port 4173
```

`http://127.0.0.1:4173/`を開きます。既存の出力先は上書きしません。初期収集が一部失敗しても取得済みの証拠と失敗記録を残しますが、数値を一件も取得できなければ成功終了しません。

生成後は次を読み、公式地方データの統合を続けます。

- `evidence/SOURCE_PREFLIGHT.md` — 国別情報源の所在と国際共通source候補。所在、取得、地理照合、指標採用は別の状態です。
- `COUNTRY_AGENT_WORKFLOW.md` — 初期生成後の調査・実装・検証手順。
- `TEMPLATE_REFERENCE.json` — 使用したキットの版、commit、同梱した仕様のhash。
- `data/dashboard.json` — 国別データ。国別アダプターの正規化先です。

地方資料を統合した後は、キットのルートから検証・再構築します。

```sh
node scripts/validate-country.mjs --project ../uganda-dashboard
node scripts/build-country.mjs --project ../uganda-dashboard
npm run sources:plan -- --country UGA
```

## 地域選択の重要な契約

- 最後に明示選択した地域が、上部の分析対象です。
- 市や下位地域を選んだ後、ドロップダウンで同じ所属先の上位地域を選び直すと、下位選択を解除して上位全体へ即時に切り替えます。
- 同じoptionの再選択では通常の`change`が発火しない場合があるため、「現在の所属先表示」と「上位全体を選ぶ操作」を実装上も分けます。
- 上部の地域変更は、地図、見出し、全指標、資料、URL、保存、出力へ一貫して反映します。別の「Zoom selected」操作を更新条件にしません。
- 各指標の下部にある内部比較地図や表への注目は、上部の分析対象を変えません。
- 親自身の値がなければ欠測を示します。完全で重複のない被覆と承認済み集計規則がある場合だけ、計算値として明示します。率は単純平均しません。

## データの原則

- 全国値を地方値へ配分しません。
- 欠測、ゼロ、非該当、未確認、取得失敗、利用制限を区別します。
- 国勢調査、標本調査、人道観測、行政記録、格子推計を同じ種類の値として自動統合しません。
- 地域名だけで結合せず、公式コード、地域型、親子関係、境界版、有効期間を照合します。
- 法定の計画策定単位と、その内部を診断する下位単位を分けます。District計画でSubcountyを分析しても、Subcountyを法定主体と推定しません。
- リンク発見、本文取得、内容確認、公式な承認状態を別々に記録します。

`config/country-source-registry.json`にはラテンアメリカ20か国とウガンダの出発点、`config/common-subnational-sources.json`には地域粒度を持ち得る10の国際・複数国source候補を収録しています。すべて案件時点で再確認が必要です。登録だけで、その国のデータ取得や採用が完了したとは扱いません。

## GitHub Actions

- **Validate kit** — pushとpull requestでWindows/Linux、Node.js 22/24の構文検査とテストを実行します。
- **Build country baseline** — Actions画面から国名またはISOコードを入力し、初期収集結果を7日間のArtifactとして保存します。

Actionsの`success`は、キットのテストまたは初期生成が成功したという意味です。AIによる国内公式資料の調査・統合、実利用者テスト、外部公開まで完了したという意味ではありません。

## 主な構成

```text
START_HERE.md            AIが最初に読む入口
AGENTS.md                自律実行と証拠・UXの必須規則
lib/                     国の解決、初期収集、検証、生成
scripts/                 初期生成、再構築、検証、配信、source確認
config/                  国別情報源と国際共通sourceの事前台帳
scaffold/site/           3ページの共通UI
docs/                    データ・計画・分析・制作の契約
templates/               開始票、監査票、42の受入シナリオ
examples/                計画資料の出典付き例
tests/                   選択、欠測、地理、計画、出力等の回帰検査
.github/workflows/       CIと手動の国別初期生成
```

[START_HERE.md](START_HERE.md)から詳しい手順へ進んでください。実装時の主要文書は[国別作業手順](docs/COUNTRY_AGENT_WORKFLOW.md)、[共通UX仕様](docs/02_COMMON_SPEC.md)、[国別データ適応](docs/03_COUNTRY_AND_DATA.md)、[ソースアダプター](docs/SOURCE_ADAPTER_GUIDE.md)、[計画資料契約](docs/PLANNING_DATA_CONTRACT.md)、[分析契約](docs/ANALYSIS_DATA_CONTRACT.md)です。

## ライセンスと第三者データ

コードとこのキット独自の文書は[MIT License](LICENSE)です。取得する国勢調査、境界、計画書、国際データには各提供元の利用条件が適用されます。大容量資料、再配布不可の原本、個票、APIキーはこの公開リポジトリへcommitしません。原本、取得receipt、正規化データ、国別bundleを分け、source ID、上流版、取得条件、hash、地理対応、利用条件を保存してください。

`package.json`の`private: true`はnpmへの誤公開を防ぐ設定です。GitHubリポジトリの公開範囲とは無関係で、このリポジトリ自体はPublicです。
