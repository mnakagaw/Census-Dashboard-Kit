# Census Dashboard Kit

国名とこのPublicリポジトリのURLをCodex、Antigravity、Claude Codeへ渡し、各国の公式資料を調査して国別ダッシュボードを作るためのOSSキットです。

世界の国・地域は、UN M49の248件と明示的な運用補足2件（台湾・Kosovo）の計250件を事前台帳化しています。JICA優先142件はその中の優先タグ・補足情報であり、対象範囲の上限ではありません。スペイン、フィンランドを含む先進国も、台湾のような明示補足対象も、国名だけで開始できます。GitHubに保持するのは国・地域コード、公式統計／国勢調査、計画法制度、行政コード・境界、国際候補の探索開始アドレスと注意事項です。統計データ本体は事前収録せず、案件時点で公式資料を取得・確認します。

## 最短手順：これだけ！

1. 国別ダッシュボードを保存する**空のフォルダー**を作ります。
2. 使用するAIで、そのフォルダーをローカルのProjectとして開きます。
   - [① Codexの設定](#codex-settings)
   - [② Antigravityの設定](#antigravity-settings)
   - [③ Claude Codeの設定](#claude-code-settings)
3. 次の一発作成プロンプトで`［XX国］`だけを書き換え、AIへ送ります。

```text
以下のGitHubを参照して、［XX国］のCensusダッシュボードを作成してください。
https://github.com/mnakagaw/Census-Dashboard-Kit/blob/main/prompts/ONE_COUNTRY_COMPLETE.md
```

4. AIが調査・作成・検証を終えるまで待ちます。作成後は、次の順に進めます。
   - [① 別スレッドで監査する](#post-build-audit)
   - [② スクリーンショットで修正を依頼する](#post-build-fix)
   - [③ Codex Sitesで公開する](#codex-sites-publish)

詳しい完成条件は[一発完成プロンプト](prompts/ONE_COUNTRY_COMPLETE.md)に含まれています。通常は長い指示を自分でコピーしたり、制作工程を一つずつ指示したりする必要はありません。

例として`［XX国］`を`スペイン`または`フィンランド`へ変更しても、AIは[`config/world-source-preflight.json`](config/world-source-preflight.json)の公式入口から調査を開始します。スペインでは国の制度だけでなく自治州の現行法・計画手段を確認し、フィンランドでは質問票型の10年ごとの国勢調査を前提にせず、登録統計と年次自治体表を調べます。

> [!IMPORTANT]
> 利用者が行う依頼は一回です。AIは内部で作業場所の準備、公式資料調査、データ取得・統合、3ページの制作、ブラウザー操作、出力照合、納品ゲートまで連続して実行します。途中の生成サイト、全国値だけの画面、リンク一覧、緑のGitHub Actionsを利用者への成果として返してはいけません。

「完成」は、公開されている全資料が無条件に入手できるという意味ではありません。取得不能・未公開・利用制限がある国では、確認した根拠を残し、取得済み資料で3ページの業務を完結できる代替表示と出力を作った状態を**制約付き完成品**とします。空欄が大量に並ぶ画面や「後で追加調査してください」という引継ぎだけでは完成になりません。

## 作るもの

国別に独立した、次の3ページを基本構成とします。

1. **Territorial Diagnostic** — 選択した地域を人口、教育、保健、水、住宅、生計等から総合的に読む。
2. **Thematic Diagnostic** — 一つのテーマ・指標について地域間を比較する。
3. **Development Plan Materials** — 適用される計画制度、公式計画、統計根拠、予算・実施・評価資料、未取得資料を選択地域ごとに確認し、法規・公式手引きに沿った章立ての編集可能なWordを作る。

国ごとに行政階層、法定の計画主体、言語、指標、統計年、地図、図表、資料形式が違うため、画面を一律に複製しません。共通化するのはページの役割、地域選択の意味、欠測と出典の扱い、取得・検証手順です。

## 環境ごとの設定

### 共通の準備

Codex、Antigravity、Claude Codeのいずれかにログイン済みで、アプリを使える状態から始めます。ここではインストール方法は説明しません。

1. 国別成果を保存する**空の作業フォルダー**を一つ用意します。既存の業務リポジトリやこのキットの原本を直接編集する場所は避けます。
   国別成果のフォルダー名と公開URLは、ISO 3166-1 alpha-3の小文字で統一します（例：バングラデシュ=`bgd`、ラオス=`lao`）。
2. 使用するAIで、そのフォルダーをローカルのプロジェクトまたはワークスペースとして開きます。
3. 下表の権限を設定します。このリポジトリはPublicなので、読むだけならGitHub連携やGitHubの有料契約は不要です。作成物を自分のGitHubへpushする段階では、その利用者のGitHub認証が必要です。
4. [一発作成プロンプト](#one-shot-prompt)で`［XX国］`だけを変更し、AIのチャット欄へ貼り付けます。

| AI | 開始時の設定 |
|---|---|
| **Codex** | 新しいローカルタスクを作り、空フォルダーまたは保存済みプロジェクトを作業場所に指定します。作業フォルダーの読み書き、ターミナル、ネット接続、ブラウザー確認を許可します。クラウドの会話だけではなく、ローカルファイルとコマンドを扱える実行環境を使います。 |
| **Google Antigravity** | 空フォルダーを`Local`プロジェクトとして開きます。国別Projectの設定で、フォルダー外へのアクセスを`Deny`、Project内のコマンドと成果物の確認を`Always Proceed`にします。Web・Chrome操作の接続要求が出たら許可します。 |
| **Claude Code** | 空フォルダーを作業ディレクトリとして開き、そのフォルダーを信頼します。プロジェクト内のRead・Edit、コマンド実行、Web検索・取得を許可します。確認を省略したい場合は許可済み操作の自動承認を使えますが、PC全体を無制限に許可する設定は必須ではありません。 |

3製品とも、必要なのは**Public GitHubの読取、作業フォルダーへの書込、ターミナル、ネット接続、生成サイトを確認するブラウザー**です。プロンプトへ「フルアクセス」と書くだけでは権限は変わらないため、実際の許可画面で設定してください。秘密情報や再配布できない資料をPublic GitHubへ保存する権限は含みません。

<a id="codex-settings"></a>

### ① Codexを使う人：Localタスクで空フォルダーを開く

<details>
<summary><strong>Codexの具体的な開始手順を開く</strong></summary>


1. Codexで`New Task`を押します。
2. 作業場所として、国別成果を保存する空フォルダーまたはそのフォルダーを登録したProjectを選びます。
3. 実行環境は`Local`を選びます。
4. ファイル、ターミナル、ネット、ブラウザーの確認が出た場合は、この国別Projectについて許可します。
5. [一発作成プロンプト](#one-shot-prompt)を貼り付けます。

</details>

<a id="antigravity-settings"></a>

### ② Antigravityを使う人：Project外を拒否して自動実行を設定する

<details>
<summary><strong>AntigravityのProject作成・権限設定・確認画面の説明を開く</strong></summary>


Antigravityを開いた後は、次の順番だけで開始できます。すでに別のProjectを使っている場合も、国別ダッシュボード用に新しいProjectを作ります。

1. Windowsのエクスプローラーで、成果を保存する空フォルダーを作ります。例：`ドキュメント\CountryDashboards\Kenya`。
2. Antigravityの設定画面が開いている場合は、右上の`×`で閉じます。
3. 左側にある**フォルダーに＋が付いたボタン**を押します。
4. `New Project`を押します。
5. `Add Folder`を押し、1で作った空フォルダーを選びます。
6. `Create`を押します。Project名は国名が分かる名前にします。例：`Kenya Dashboard`。
7. 作成したProjectを開き、`New Conversation`を押します。
8. 開始時にModeを聞かれたら`Local`を選びます。これで、選んだフォルダーへ成果が保存されます。
9. 歯車から`Settings`を開き、左側の`Projects`の下にある今作ったProject名を押します。設定はProjectごとに分かれています。別のProject名が選択されていないことを確認します。
10. `Security Preset`を`Custom`にし、次のように設定します。
    - `Outside of folders file access policy`: `Deny`
    - `Terminal Command Auto Execution`: `Always Proceed`
    - `Enable Sandbox Mode`: `Disabled`
    - `Artifact Review Policy`: `Always Proceed`
11. この設定は国別Project内では自動で作業を進め、Project外のファイルアクセスを拒否するためのものです。空の専用フォルダーを使い、認証情報や重要な原本は置かないでください。
12. 右上の`×`で設定を閉じます。
13. チャット入力欄へ`/browser`と入力し、Chromeとの接続確認が出たら許可します。これは最後に生成サイトを実画面で検証するためです。
14. 続けて、[一発作成プロンプト](#one-shot-prompt)を貼り付けます。入力後にModeを再度聞かれたら`Local`を選びます。

#### `Waiting for user input`と表示された場合

Antigravityがコマンドを実行する前に、確認画面を出すことがあります。これはエラーではありません。画面下部で選択肢を一つ選び、右下の`Submit`を押すと作業が続きます。`Skip`を押すと、その操作を実行せず待機したままになる場合があります。

最初に次の表示が出た場合：

```text
Allow cloning repository?
git clone https://github.com/mnakagaw/Census-Dashboard-Kit.git .
```

URLが上と同じで、作成した空フォルダー内で実行しようとしていることを確認し、**③ `Yes, and always allow ... in this project`**を選んで`Submit`を押します。これにより、この国別Project内では同じclone操作を再確認せず実行できます。

| 選択肢 | 意味 | この作業での選び方 |
|---|---|---|
| ① `Yes, allow this time` | 今回だけ許可 | これでも進められますが、同じ確認が再度出ることがあります。 |
| ② `... in this conversation` | 今の会話中は同じ操作を許可 | 一回の会話だけで終える場合に使えます。 |
| ③ `... in this project` | この国別Projectでは同じ操作を許可 | **通常はこちらを選びます。** 中断後に同じProjectで再開する場合にも分かりやすい設定です。 |
| ④ Projectやconversationの限定がない許可 | 他のProjectでも同じ操作を自動許可 | この作業では選ぶ必要はありません。 |
| ⑤ `No` | 実行しない | URL、保存先、コマンドが説明と違う場合に選び、AIへ理由を確認します。 |

以後、`npm run check`、`npm test`、`node scripts/...`など、このキットの検証・生成コマンドで同じ確認が出た場合も、表示されたコマンドがこのProject内を対象としていれば③のProject単位の許可を選べます。公式資料サイトへの接続やChrome接続は、表示された接続先を確認して今回またはProject単位で許可します。

次の場合は、すぐに許可せず⑤`No`を選び、AIへ「何のための操作か、保存先はどこか」を日本語で説明させます。

- GitHubのURLが`https://github.com/mnakagaw/Census-Dashboard-Kit.git`と違う
- 作成した国別Project以外のフォルダーを削除・上書きしようとしている
- パスワード、APIキー、個票などをPublic GitHubへ送ろうとしている
- 依頼していない外部公開、GitHubへのpush、有料サービスの操作をしようとしている

Antigravity公式の画面説明：[Projectの作成](https://antigravity.google/docs/getting-started)、[Projectごとの設定](https://antigravity.google/docs/projects)、[権限の仕組み](https://antigravity.google/docs/permissions)。

</details>

<a id="claude-code-settings"></a>

### ③ Claude Codeを使う人：空フォルダーを信頼して必要な操作を許可する

<details>
<summary><strong>Claude Codeの具体的な開始手順を開く</strong></summary>


1. 国別成果を保存する空フォルダーをClaude Codeの作業フォルダーとして開きます。
2. フォルダーを信頼するか聞かれた場合は、作成した国別フォルダーであることを確認して許可します。
3. Read、Edit、コマンド実行、Web検索・取得の確認が出た場合は、この国別フォルダーについて許可します。
4. [一発作成プロンプト](#one-shot-prompt)を貼り付けます。

</details>

<a id="one-shot-prompt"></a>

## 一発作成プロンプト

`［XX国］`だけを対象国名に変えて送ります。

```text
以下のGitHubを参照して、［XX国］のCensusダッシュボードを作成してください。
https://github.com/mnakagaw/Census-Dashboard-Kit/blob/main/prompts/ONE_COUNTRY_COMPLETE.md
```

<details>
<summary><strong>完全版プロンプト、情報源台帳、中断後の再開方法について読む</strong></summary>


最新版の完全な作業指示は **[`prompts/ONE_COUNTRY_COMPLETE.md`](prompts/ONE_COUNTRY_COMPLETE.md)** です。AIは上の短い依頼からこのファイルを読み、同じ完成条件と納品ゲートを使います。製品別の開始メモは [Codex](prompts/CODEX.md)、[Antigravity](prompts/ANTIGRAVITY.md)、[Claude Code](prompts/CLAUDE_CODE.md) にあります。

142か国・地域それぞれについて、統計局・国勢調査、計画法と関連資料、行政コード・境界、国際データ候補の探索開始アドレスを[`config/jica-priority-source-preflight.json`](config/jica-priority-source-preflight.json)に記録しています。人が読める全件表は[`docs/research/jica-priority-2026/SOURCE_PREFLIGHT_142.md`](docs/research/jica-priority-2026/SOURCE_PREFLIGHT_142.md)です。これはAIが探索を省略しないための案内であり、法令本文や統計表を取得・確認済みとする証拠ではありません。AIは国別案件の中で最新版、本文、表、粒度、利用条件を確認し、取得・地理照合・採用まで進めます。


通常は上の短い一発作成プロンプトだけで開始します。使用するAIがGitHubのリンクを読めない場合に限り、`prompts/ONE_COUNTRY_COMPLETE.md`を開き、コードブロック全体の`COUNTRY_NAME`を対象国名へ変更して貼り付けます。

AIやPCが予期せず終了した場合だけ、同じ作業フォルダーで次の再開用プロンプトを送ります。

```text
この国別案件のHANDOFF.mdと保存済み成果を読み、続きから再開してください。
取得済み原資料と実装を再利用し、残る公式地方データの統合、3ページ、実画面と出力の検証を完了してください。
```

</details>

## 作成後に行うこと

<a id="post-build-audit"></a>

### ① 公開前に読む：別スレッドで完成品を監査する

制作を担当したAIとは別の新規スレッドで監査し、`ACCEPT`になってから公開します。

<details>
<summary><strong>監査の実施方法、監査用プロンプト、再監査の流れを開く</strong></summary>

制作を担当したスレッドを**A**とします。Aが完成報告した後、同じ国別Projectまたは同じ成果フォルダーを開ける**別の新規スレッド**を作り、監査だけを依頼します。Antigravityでは同じProjectの`New Conversation`、Codexでは同じProjectを指定した`New Task`、Claude Codeでは同じフォルダーを開く別セッションです。Aと監査スレッドを同時に編集させず、まずAの作業完了を待ってください。

監査項目と報告形式は[独立完成監査](docs/INDEPENDENT_AUDIT.md)にまとめています。監査スレッドは修正を行わず、実データ、出典、画面操作、地理、出力を独自に確認して、国別成果の`evidence/INDEPENDENT_AUDIT.md`へ結果を保存します。自動テストやAの自己申告を、そのまま合格根拠にしません。

#### 監査スレッドへ貼るプロンプト

```text
この国別ダッシュボードの独立完成監査をしてください。制作や修正はせず、実物と原資料から問題を検出してください。

監査基準：
https://github.com/mnakagaw/Census-Dashboard-Kit/blob/main/docs/INDEPENDENT_AUDIT.md

同じ国別Projectのdata、raw、evidence、site、実ブラウザー、CSV・印刷・DOCXを確認してください。
evidence/DELIVERY.jsonやテスト成功をそのまま信用せず、監査基準に従って代表地域と例外地域を実操作し、元資料の表・列・値・年・地域・出典まで照合してください。

修正は行わず、BLOCKING、MAJOR、MINORの順に、再現手順、期待結果、実結果、根拠、修正後の受入条件を記録してください。
結果を国別Projectのevidence/INDEPENDENT_AUDIT.mdへ保存し、最後にACCEPT、REJECT、INCOMPLETE AUDITのいずれかを明記してください。
```

監査が`REJECT`または`INCOMPLETE AUDIT`なら、Aへ戻り、次を貼ります。監査報告が同じ成果フォルダーに保存されていない環境では、報告全文も一緒に貼り付けます。

```text
別スレッドの独立監査結果を確認してください。
対象：evidence/INDEPENDENT_AUDIT.md
監査基準：https://github.com/mnakagaw/Census-Dashboard-Kit/blob/main/docs/INDEPENDENT_AUDIT.md

指摘を重大度にかかわらず一件ずつ再現し、原因を修正してください。説明やDELIVERY.jsonの合格欄だけを書き換えて解決扱いにせず、データ、出典、地理、画面、出力の実物を直してください。
修正後に通常の検証、実ブラウザー確認、DOCXレンダリング、納品ゲートを再実行し、対応結果をevidence/INDEPENDENT_AUDIT_REMEDIATION.mdへ残してください。
すべて終わったら、同じ監査基準で再監査できる状態にしてください。
```

Aの修正後は、監査スレッドへ「修正版を同じ基準で再監査し、前回指摘の再現結果と最終判定を更新してください」と送ります。監査が`ACCEPT`になるまで、完成品として公開しません。

</details>

<a id="post-build-fix"></a>

### ② 見た目や内容を直したい人：スクリーンショットで修正を依頼する

直したい画面をスクリーンショットに撮り、必要なら枠・矢印・短いメモを書き込み、その画像を**制作したスレッド**へ添付します。変更箇所と、変更後にどう見せたいかを具体的に伝えてください。

#### 例1：特定部分の文字・表示を直す

```text
添付したスクリーンショットの赤枠部分を修正してください。
見出しを「地域診断」に変更し、文字を現在より大きくしてください。
他のレイアウトや機能は変更しないでください。
修正後、実際の画面を開いて表示を確認してください。
```

#### 例2：レイアウトを横3カラムにする

```text
添付したスクリーンショットのカード部分を、PCでは横3カラムにしてください。
スマートフォンでは1カラムに戻し、文字やカードが画面外にはみ出さないようにしてください。
データ、地域選択、リンク、ダウンロード機能は変更しないでください。
修正後、PC幅とスマートフォン幅の両方で確認してください。
```

修正が終わったら、通常の検証を再実行し、必要に応じて[①の独立監査](#post-build-audit)もやり直します。

<a id="codex-sites-publish"></a>

### ③ 公開したい人だけ：Codex Sitesで完成版を公開する

この節は、上の共通プロンプトで国別ダッシュボードが完成した後、**Codex SitesのURLで公開したい人だけ**が行います。AntigravityやClaude CodeでPC内の完成品を作る手順には不要です。共通プロンプトの「外部公開は別途依頼」という条件に対する、明示的な公開依頼になります。

Codex SitesはChatGPTがサイトを保存・配信する機能です。GitHubへpushしなくても使えるため、**Sitesで公開するだけならGitHubアカウントは不要**です。公式案内では現在、ChatGPT Plus、Pro、Business、Enterprise、Eduで利用できます。契約や組織の設定によっては、インターネット一般公開が使えない場合があります。最新条件は[OpenAI公式のSites説明](https://learn.chatgpt.com/docs/sites)を確認してください。

<details>
<summary><strong>Codex Sitesへの公開手順と、貼り付ける公開用プロンプトを開く</strong></summary>

#### 公開する順番

1. 上の[一発作成プロンプト](#one-shot-prompt)で国別ダッシュボードを作り、Codexが納品ゲート、実画面、DOCXまで確認して完成報告するのを待ちます。
2. **同じCodexタスクと同じ国別Projectを開いたまま**にします。新しい空のタスクへ移動しません。
3. 下の「Codex Sites公開用プロンプト」で`［国名］`だけを変更し、そのまま同じチャットへ貼り付けます。
4. SitesまたはHostingの利用確認が表示されたら、今回の国別Projectを対象にしていることを確認して許可します。CLIまたはIDE拡張だけを使っている場合はSitesの公開画面がないため、ChatGPTのデスクトップアプリまたはWeb版で同じローカルProjectを開いて実行します。
5. Codexが返したURLを開き、3ページ、地域選択、資料リンク、DOCX取得が動くことを確認します。**バージョンの保存だけでは公開完了ではありません。** `deployment succeeded`または同等の成功表示とURLの両方を確認します。
6. 新しいSiteは最初、所有者と管理者だけが見られる設定になることがあります。誰でも見られるサイトにする場合は、ChatGPTの`Sites`から該当Siteを開き、`Share` → `Who has access` → `Anyone on the internet`を選びます。この選択肢が表示されない場合は、契約またはWorkspace管理者の設定で一般公開が許可されていません。
7. 最後に、ログインしていないブラウザーまたはシークレットウィンドウでURLを開き、一般利用者として閲覧できることを確認します。

#### Codex Sites公開用プロンプト

```text
このタスクで完成・検証済みの［国名］地域情報・開発計画ダッシュボードを、Codex Sitesで公開してください。
これは、先ほどの共通プロンプトとは別の外部公開依頼です。Sitesへの保存、デプロイ、一般公開まで進めて構いません。

対象は今回作成した国別成果物ディレクトリだけです。
Census-Dashboard-Kitのテンプレート原本や、別の国・別のProjectを公開しないでください。

最初に国別成果物のevidence/DELIVERY.json、検証記録、現在の公開用サイトを確認してください。
Territorial Diagnostic、Thematic Diagnostic、Development Plan Materialsの3ページ、
地域選択、最新版と出典年、公式資料リンク、CSV・印刷・DOCXなど完成済みの機能を維持してください。

Codex Sitesとの互換性を確認し、必要な設定と公開用出力だけを最小限追加・修正してください。
公開用ファイルには、秘密情報、APIキー、個票、再配布できない原資料、作業途中の証拠ファイルを含めないでください。
現在の国別サイトが静的サイトとして動作する場合は、不要なデータベース、ログイン、D1、R2を追加しないでください。
.openai/hosting.jsonはSitesの仕様に合わせて国別成果物側へ作成または更新し、テンプレート原本へ国別のproject_idを書かないでください。

必要な構成変更後に再度ビルドし、3ページの直接URL、ページ間移動、地域選択、資料リンク、ダウンロードを確認してください。
その完成版をSitesへ保存してデプロイし、デプロイが成功するまで確認してください。
可能であれば公開範囲を「Anyone on the internet」に設定してください。
所有者本人の画面操作が必要で設定できない場合だけ、止まっている画面で押す場所を日本語で一つ具体的に示してください。

最後に、次を日本語で報告してください。
・公開されたSitesのURL
・一般公開か、所有者限定か
・公開した国別成果物
・3ページとダウンロードの確認結果
・一般公開に残る操作がある場合は、その一操作

バージョンを保存しただけ、ローカルプレビューが動いただけ、URLがまだ発行されていない状態を公開完了としないでください。
```

</details>

## 開発者向け：コマンドで国別作業場所を作る場合

<details>
<summary><strong>Git、Node.js、生成・検証コマンドを使う手順を開く</strong></summary>

必要条件はGit、Node.js 22以上、ネット接続です。実行時の外部npmパッケージやAPIキーは不要です。Excel・PDF等の抽出には、資料に応じてPythonと対応ライブラリを追加します。

```sh
git clone https://github.com/mnakagaw/Census-Dashboard-Kit.git
node ./Census-Dashboard-Kit/scripts/create-country.mjs --country "Uganda" --out ./uganda-dashboard
```

ここまででできるのはAIが調査・制作するための内部作業場所です。人がこのコマンドだけを実行しても完成品にはなりません。通常の利用者は上のプロンプト一回でAIへ依頼します。

AIは作業場所の準備後、次を読み、公式地方データの統合を連続して進めます。

- `evidence/SOURCE_PREFLIGHT.md` — 国別情報源の所在と国際共通source候補。所在、取得、地理照合、指標採用は別の状態です。
- `COUNTRY_AGENT_WORKFLOW.md` — 一回の依頼内で完遂する調査・実装・検証手順。
- `TEMPLATE_REFERENCE.json` — 使用したキットの版、commit、同梱した仕様のhash。
- `data/dashboard.json` — 国別データ。国別アダプターの正規化先です。

地方資料を統合した後は、キットのルートから検証・再構築します。

```sh
node scripts/validate-country.mjs --project ../uganda-dashboard
node scripts/build-country.mjs --project ../uganda-dashboard
npm run sources:plan -- --country UGA
node scripts/verify-delivery.mjs --project ../uganda-dashboard
```

</details>

## 実装・レビュー担当向け：地域選択の必須動作

<details>
<summary><strong>地図、指標、資料、URL、出力を連動させる規則を開く</strong></summary>

- 最後に明示選択した地域が、上部の分析対象です。
- 市や下位地域を選んだ後、ドロップダウンで同じ所属先の上位地域を選び直すと、下位選択を解除して上位全体へ即時に切り替えます。
- 同じoptionの再選択では通常の`change`が発火しない場合があるため、「現在の所属先表示」と「上位全体を選ぶ操作」を実装上も分けます。
- 上部の地域変更は、地図、見出し、全指標、資料、URL、保存、出力へ一貫して反映します。別の「Zoom selected」操作を更新条件にしません。
- 複数階層は上位から下位へ番号付きで選びます。下位選択中は所属先であることを明示し、同じ上位地域を選び直せば下位を解除できる文言にします。全地域検索は補助操作として分離します。
- 位置図は選択地域、上位行政区、国全体の表示範囲を切り替え、50〜400%の拡大・縮小と100%復帰を使えます。100%からも縮小できることを実画面で確認します。これらは地図の見え方だけを変え、分析対象、指標、資料、URL、出力を変えません。
- 各指標の下部にある内部比較地図や表への注目は、上部の分析対象を変えません。
- 親自身の値がなければ欠測を示します。完全で重複のない被覆と承認済み集計規則がある場合だけ、計算値として明示します。率は単純平均しません。

</details>

## 調査・データ担当向け：値・地域・出典の原則

<details>
<summary><strong>欠測、ゼロ、地域結合、法定計画主体の扱いを開く</strong></summary>

- 全国値を地方値へ配分しません。
- 欠測、ゼロ、非該当、未確認、取得失敗、利用制限を区別します。
- 国勢調査、標本調査、人道観測、行政記録、格子推計を同じ種類の値として自動統合しません。
- 地域名だけで結合せず、公式コード、地域型、親子関係、境界版、有効期間を照合します。
- 法定の計画策定単位と、その内部を診断する下位単位を分けます。District計画でSubcountyを分析しても、Subcountyを法定主体と推定しません。
- リンク発見、本文取得、内容確認、公式な承認状態を別々に記録します。

`config/country-source-registry.json`には国別sourceの出発点、`config/common-subnational-sources.json`には地域粒度を持ち得る国際・複数国source候補を収録しています。加えて、[`config/americas-verified-source-recipes.json`](config/americas-verified-source-recipes.json)には米大陸28国・地域で実際に確認した取得方法・表の意味・地理上の注意を再利用レシピとして収録しています。AreaDataがカバー範囲を広げる際に確認した公開公式sourceは、[AreaData source-feedback loop](docs/AREADATA_SOURCE_FEEDBACK.md)を通じて[`config/areadata-source-feedback.json`](config/areadata-source-feedback.json)へ逐次戻せます。すべて案件時点で再確認が必要です。登録や過去の成功だけで、その国のデータ取得や採用が完了したとは扱いません。

</details>

## リポジトリ管理者向け：GitHub Actions

<details>
<summary><strong>キットの自動テストと管理者用Actionsの説明を開く</strong></summary>

Antigravity、Codex、Claude CodeへこのPublicリポジトリのURLを渡し、PC内に国別ダッシュボードを作るだけなら、**GitHubアカウントは不要**です。この節はリポジトリ管理者向けで、一般利用者の完成品制作手順ではありません。

- **Validate kit** — リポジトリ管理者が変更をpushしたとき、またはpull requestを作ったときに、Windows/Linux、Node.js 22/24でキットの構文検査とテストを自動実行します。一般利用者が押すボタンではありません。
- **Prepare country workspace (not a delivery)** — GitHubへログインし、このリポジトリのActionsを実行できる管理者が、内部作業場所の生成だけを試す任意機能です。結果は7日間のArtifactとして保存されます。完成した国別サイトを作るActionsではありません。

GitHubアカウントが必要になるのは、自分のGitHubへリポジトリを作る、`Use this template`を使う、fork・push・pull requestを行う、またはGitHub Actionsを手動実行する場合です。完成したサイトをPC内だけで使う場合は必要ありません。

Actionsの`success`は、キットのテストまたは内部作業場所の準備が成功したという意味だけです。国別完成品は、AIがローカルで調査・統合・実画面検証を行い、`verify-delivery.mjs`に合格して初めて完成扱いにできます。

</details>

## 開発者向け：Kitのフォルダー構成と詳細文書

<details>
<summary><strong>主要フォルダーと仕様書へのリンクを開く</strong></summary>

```text
START_HERE.md            AIが最初に読む入口
AGENTS.md                自律実行と証拠・UXの必須規則
lib/                     国の解決、内部準備、検証、生成
scripts/                 作業場所準備、再構築、検証、納品ゲート、配信
config/                  国別情報源と国際共通sourceの事前台帳
scaffold/site/           3ページの共通UI
docs/                    データ・計画・分析・制作の契約
templates/               開始票、監査票、42の受入シナリオ
examples/                計画資料の出典付き例
tests/                   選択、欠測、地理、計画、出力等の回帰検査
.github/workflows/       キットCIと管理者用の内部作業場所確認
```

[START_HERE.md](START_HERE.md)から詳しい手順へ進んでください。利用者向けの主要文書は[国別作業手順](docs/COUNTRY_AGENT_WORKFLOW.md)、[独立完成監査](docs/INDEPENDENT_AUDIT.md)、[世界250か国・地域とJICA優先142件の運用](docs/GLOBAL_SOURCE_AND_BUILD_OPERATING_MODEL.md)、[最新版表示方針](docs/LATEST_VALUE_POLICY.md)、[共通UX仕様](docs/02_COMMON_SPEC.md)、[国別データ適応](docs/03_COUNTRY_AND_DATA.md)、[ソースアダプター](docs/SOURCE_ADAPTER_GUIDE.md)、[計画資料契約](docs/PLANNING_DATA_CONTRACT.md)、[分析契約](docs/ANALYSIS_DATA_CONTRACT.md)です。世界250件の探索開始アドレスは[`config/world-source-preflight.json`](config/world-source-preflight.json)、JICA優先補足は[`config/jica-priority-source-preflight.json`](config/jica-priority-source-preflight.json)で機械判定します。生成後のサイトとWordは利用者自身の成果物であり、国別作業ディレクトリで文言、テーマ、資料、公開先を修正・再生成できます。

</details>

## 公開前に確認：ライセンスと第三者データ

コードとこのキット独自の文書は[MIT License](LICENSE)です。取得する国勢調査、境界、計画書、国際データには各提供元の利用条件が適用されます。大容量資料、再配布不可の原本、個票、APIキーはこの公開リポジトリへcommitしません。原本、取得receipt、正規化データ、国別bundleを分け、source ID、上流版、取得条件、hash、地理対応、利用条件を保存してください。

`package.json`の`private: true`はnpmへの誤公開を防ぐ設定です。GitHubリポジトリの公開範囲とは無関係で、このリポジトリ自体はPublicです。
