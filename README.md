# Astro学習支援AI

**教えて終わり、じゃない。覚えて、次に出す。**

Astro でポートフォリオサイトを1つ作りながら学ぶ道具です。
提出したコードをAIが見て、つまずいた場所を**覚えておき**、あとで似た問題を出し直します。

コードは本物の VS Code で書きます。ブラウザの中の「それっぽいエディタ」ではありません。

---

# はじめかた（学習者の方へ）

## 1. 用意するもの

| | なぜ要るか | 入手先 |
|---|---|---|
| **Node.js 22.5 以上** | この道具と Astro を動かすため | https://nodejs.org （LTS版でOK） |
| **VS Code** | コードを書くため | https://code.visualstudio.com |
| **Gemini APIキー**（下記のAI選択でClaude Codeを使う場合は不要） | AIに採点してもらうため（無料枠あり） | https://aistudio.google.com/api-keys |

Node.js が入っているかは、ターミナル（Windowsはコマンドプロンプト）で `node -v` と打つと分かります。
`v22.5.0` 以上の数字が出ればOKです。

> **すでに Claude Code を使っている方へ**: 初回起動時に「採点に使うAIを選ぶ」画面が出るので、
> そこでClaude Codeを選べばGemini APIキーなしで使えます（ClaudeのPro以上のプランが必要。無料プランでは不可）。
> Claudeの**アプリだけでは使えません**。ターミナル用のClaude Code（`claude` コマンド）が要ります。
> 入っていない・ログインしていない場合は、その画面に出る「Claude Codeを入れる」「Claudeにログイン」ボタンから
> ターミナルが開いて公式の手順が実行され、終わると自動で検出されます。
> どちらを使うかはあとから設定ページ（`settings.html`）でいつでも変更できます。

## 2. ダウンロードする

```bash
git clone https://github.com/<ユーザー名>/<リポジトリ名>.git
```

git を使わない場合は、GitHub の緑色の「Code」ボタン →「Download ZIP」でも大丈夫です。
その場合、Mac では最初の起動時に「開発元が未確認です」と出ることがあります
（右クリック →「開く」で一度許可すれば、次からは出ません）。

## 3. 起動する

ダウンロードしたフォルダの中にある、次のファイルを**ダブルクリック**します。

- **Mac** → `START-Mac.app`
- **Windows** → `START-Windows.bat`

ブラウザが開いたら成功です。ターミナルを自分で触る必要はありません。

> **Mac の方へ**: `START-Mac.app` は、このGitHubのページ上では**フォルダのように見えます**。
> macOSのアプリは中身がフォルダという作りなので、GitHubがそのまま表示しているだけです。
> ダウンロードすれば、ちゃんと1つのアプリとして表示されてダブルクリックできます。

## 4. 最初の設定

1. **プロジェクトを作る場所を決める** — 画面の案内にしたがって、
   ポートフォリオを作るフォルダを選びます（例: デスクトップの中）。
   必要なファイル一式がそこに用意されます。初回はパッケージの取得にネット接続が要ります。
2. **採点に使うAIを選ぶ** — 続けて出る画面で、GeminiかClaude Codeのどちらを使うか選びます。
   Geminiを選ぶ場合はここでAPIキーを入れます（キーはブラウザからGoogleへ直接送られ、
   **このサーバーには保存も送信もされません**）。Claude Codeがこのパソコンで使える状態なら
   自動で検出され、キー入力なしで選べます。あとから `settings.html`（ナビの「設定」）で変更できます。

## 5. 2回目からは

`START-Mac.app` / `START-Windows.bat` をダブルクリックするだけです。学習の記録は残っています。

## 困ったとき

| 症状 | 対処 |
|---|---|
| ダブルクリックしても何も起きない | Node.js が入っているか `node -v` で確認してください |
| Mac で「開発元が未確認」と出る | ファイルを右クリック →「開く」→「開く」 |
| プレビューが真っ白 | 学習画面の「プレビューを起動」を押してください |
| 「利用上限に達しました」と出る | Gemini の無料枠の上限です。時間をおいてからお試しください |
| 「Claudeで採点」が失敗する | 設定ページの「Claude Code 連携」で状態を確認し、出ているボタンからインストール・ログインしてください（ターミナルで `claude auth status` でも確認できます） |

学習の記録はすべて自分のPCの中（`data.db`）にあります。外部には送られません。

---

# 開発者向け

ここから下は、この道具を**開発する人**のための内部資料です。使うだけなら読む必要はありません。

**フォルダ構成（2026-11-11変更）**: 起動フォルダ（学習者に見える場所）には `README.md` /
`START-Mac.app` / `START-Windows.bat` だけを置き、`server.js`・`db.js`・`problems.json`・
`public/`・`scripts/`・`workspace/` 等のアプリ本体一式は全部 `_internal/` の中にまとめた。
実行時データ（`data.db`・`session-secret.local`・`workspace-path.local`・`launcher.log`・
`exhibit-log.jsonl`）や自動ダウンロードする `_node/` もすべて `_internal/` の中に作られる
（これらは `server.js`・`db.js` の `__dirname` 基準のパス解決に従うだけなので、コード側の変更は不要
だった）。`_internal/` はMacでは起動スクリプトが `chflags hidden` を付け、Windowsは以前からの
`attrib +h` で、どちらもFinder/エクスプローラーの既定表示では見えないようにしている。
以下のコマンド例は、すべて `_internal/` の中で実行する前提に読み替えること。

## 起動

```bash
cd _internal
node server.js
# → http://localhost:8787
```

既定でローカルモード（ログインなし・`127.0.0.1` のみで待ち受け・この端末の単一ユーザー）。
2026-10-27 に既定を反転させた。付け忘れると全ネットワーク面で待ち受けてしまう向きは危険だったため。
Googleログインを使う構成（卒研の報告書用に残している）で動かす場合だけ `LOCAL_MODE=0` を付ける:

```bash
cd _internal
LOCAL_MODE=0 GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com node server.js
```

### サーバーを借りて公開する場合

**`PUBLIC_MODE=1` を必ず付けること。** これが無いと、誰でもゲストログインして
`/api/claude`（このサーバー上で `claude` CLI を実行する）等を叩ける状態になる。

```bash
cd _internal
PUBLIC_MODE=1 GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com node server.js
```

`PUBLIC_MODE=1` は以下を行う:

- `/api/claude` `/api/pick-folder` `/api/open-editor` `/api/preview/start`
  `/api/workspace/create` `/api/reset-all`（学習者自身のPCを操作する前提のAPI）を403で塞ぐ
- `GOOGLE_CLIENT_ID` が無いと起動を拒否する（無いとゲストログインだけが入口になるため）
- `LOCAL_MODE=1` と同時に指定すると起動を拒否する

**これらの API を塞ぐと、プロジェクトの作成・コードの読み込み・プレビュー起動ができなくなる。**
これは File System Access API（ブラウザ側でローカルファイルを扱う仕組み。対応は Chrome/Edge のみ）
で代替する設計だが、**まだ実装していない**。詳細: `.company/engineering/docs/astro-study-ai-distribution-design.md`

ホスティングは永続ディスクが必要（`data.db` に `node:sqlite` を使用）。Vercel・Netlify 等の
サーバーレスは不可。Fly.io・Render・VPS などを検討すること。

サーバー本体は依存パッケージなし（Node 22.5+ のみ。組み込みの `node:sqlite` を使用するため）。
`npm install` は不要（2026-10-27に実行プレビューを廃止し、唯一の依存だった `@webcontainer/api` を外したため）。

### ログイン（Googleアカウント、P2で追加）

学習の記録（弱点・履歴・クリア状況）はGoogleアカウントごとに保存される。ログインしないと `index.html` / `study.html` / `notebook.html` は使えない。

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) で「認証情報を作成」→「OAuth クライアント ID」→アプリケーションの種類は「ウェブ アプリケーション」を選ぶ
2. 「承認済みの JavaScript 生成元」に `http://localhost:8787`（本番公開する場合はそのドメインも）を追加
3. 発行された「クライアント ID」（`xxxxx.apps.googleusercontent.com` の形式。クライアントシークレットは不要）を環境変数 `GOOGLE_CLIENT_ID` に設定してサーバーを起動する

`GOOGLE_CLIENT_ID` 未設定のまま起動した場合、ログイン画面は表示されるがGoogleログインは機能しない（サーバーが警告ログを出す）。
認証方式はGoogle Identity Services（IDトークンをサーバーで検証。`google-auth-library`等の追加npmパッケージは使わず、Googleのtokeninfoエンドポイントを直接呼んで検証している）。セッションはHttpOnly Cookie（署名付き、`session-secret.local`に秘密鍵を保存。gitignore済み）。

## 学習者のプロジェクトの場所（2026-10-27変更）

以前は `workspace/my-portfolio` 決め打ちだったが、**どこに作るかを学習者が指定する**方式にした。

- 初回はホーム画面に「まず、プロジェクトを作る場所を決めましょう」が出る。場所が決まるまで他のカードは出さない。
- 「フォルダを選ぶ…」でOS標準のフォルダ選択ダイアログが開く（macOS=osascript / Windows=PowerShell の FolderBrowserDialog / Linux=zenity）。選ぶのは「どこに作るか」の親フォルダで、その中にプロジェクトのフォルダを作る。パスを直接書いてもよい。
- 選んだ場所は `workspace-path.local`（gitignore済み）に保存する。デモ機はゲストが入れ替わるのでユーザー単位ではなく機械単位。
- 雛形は `workspace/_initial/`（src・astro.config.mjs・package.json）。
- **依存パッケージ**: 同梱のキャッシュ `workspace/_deps/node_modules` があればコピーする（約4秒・ネット不要）。無ければ `npm install` にフォールバックする（2026-10-27追加。約7秒・要ネット）。キャッシュは153MBで gitignore 済みのため、**リポジトリを clone した学習者の手元には存在せず、必ずこちらを通る**。雛形には `package-lock.json` を同梱し、学習者ごとにバージョンがぶれないようにしている（astro 4.16.19 / @astrojs/preact 3.5.4 / preact 10.29.8）。
- `workspace/my-portfolio` は、もう学習の場所ではなく**依存パッケージのキャッシュ**として残している。

危険な場所に作らないよう、絶対パスであること・システムフォルダでないこと・親が存在すること・対象が空であることを検査してから作る。

## 類題生成の回帰テスト

```bash
cd _internal
GEMINI_API_KEY=xxxx npm run test:generation
```

弱点履歴のパターンごとに実際にAIへ類題を生成させ、`targetTags`・`answerPatterns`・JSONスキーマの妥当性を機械的にチェックする（`scripts/test-generation.js`）。CIではなく、モデルやプロンプトを変えたときにローカルで都度実行する運用を想定。

## ページ構成（v2で複数ページ化）

| ページ | 役割 |
|--------|------|
| `index.html` ホーム | 学習の全体像。統計・単元マップ（クリックで挑戦）・直近の履歴・つづきから学習 |
| `study.html` 学習する | 中核ループの実行場所。もんだい＋AI先生の結果（左）×プレビュー（右）の2カラム。コードを書く場所はVS Code側なので、この画面にエディタは無い。Gemini APIキーの入力も右上のここ |
| `notebook.html` 苦手ノート | 弱点の詳細（根拠メモ・回数・最終確認）・学習のあゆみ・記憶のリセット |
| `login.html`（直接は開かない） | Googleログイン専用ページ（P2）。study.htmlで未ログインだと自動的にここへ飛ばされ、ログイン後は元のページへ戻る（COOPヘッダーを外した今もこの形を維持している。ローカルモードではそもそもログインしない） |

## AIプロバイダ

| プロバイダ | 用途 | 備考 |
|-----------|------|------|
| Gemini API | 採点・類題生成（既定） | BYOK方式。キーはブラウザ→Google直送でサーバーを経由しない（本番設計どおり） |
| Claude Code（任意・2026-11-11追加） | 採点（学習画面で「Claudeで採点」を選んだ場合） | 学習者のPCにインストール・ログイン済みの `claude` CLIをサーバーがspawnする。`/api/claude/status`（`claude auth status --json`）で自動検出し、使えないときはチェックを無効化する。類題生成は対象外（Gemini固定） |

2026-09-24にローカルAI（Ollama / `qwen3-coder:30b`）のコードをすべて削除し、Gemini一本にした。プロバイダ切替のプルダウンも廃止し、学習ページ右上はGemini APIキーの入力欄だけになっている。
2026-11-11にClaude Codeでの採点を選択肢として復活（初回起動時のAI選択画面・`settings.html`）。ただしこれはGeminiの代替であり、プルダウン相当のUIが完全に復活したわけではない。
2026-11-14にインストール・ログインの案内を追加。未インストール/未ログインのとき画面のボタンから `/api/claude/open-terminal` を呼ぶと、ターミナル（Macは `.command`、WindowsはPowerShell）が開いて公式コマンド（`curl -fsSL https://claude.ai/install.sh | bash` / `irm https://claude.ai/install.ps1 | iex`、ログインは `claude auth login --claudeai`）を実行する。完了は画面が3秒おきに `/api/claude/status` を見て自動検出する。`claude` の場所は「見つからない」をキャッシュせず、`~/.local/bin` も直接見る。

## 画面まわりの仕様（2026-09-24変更）

- **もんだいは常時表示**。以前は左上の「◀」でパネルごと隠せて、その状態が`localStorage`に残るため、リロードしても問題文が出てこない（＝「問題文が無い」ように見える）事故が起きた。折りたたみ機能ごと廃止した
- **ブラウザ内エディタは廃止**（VS Code拡張への一本化に伴う移行順序のE4。拡張が `PUT /api/answer` でコードを送れるようになってから消した）。エクスプローラー・タブ・行番号・textareaと、それらのCSSは削除済み
- **学習画面はもんだい＋AI先生（左）×プレビュー（右）の2カラム**。ページ全体はスクロールさせず（`body.study-page { height:100vh; overflow:hidden }`）、**もんだいとAI先生の中身（`.scroll-area`）だけがそれぞれの枠内でスクロールする**。問題文を読んでいる途中でプレビューが視界から消えないようにするため
  - 左カラムの高さ配分: もんだいが余りを全部もらう（`flex: 1 1 0`）／AI先生は中身なりの高さで、長い講評が来ても42%で頭打ち（`flex: 0 0 auto; max-height: 42%`）。AI先生を縮み可（`flex-shrink:1`）にすると、もんだいが長いときに一緒に潰れて講評が読めなくなる
  - 横幅が1000px以下のときは1カラムに落とし、ページのスクロールを許す（高さで詰むほうが困るため）
- **プレビューはWebContainerをやめ、VS Codeで動いている `astro dev` を`<iframe>`でそのまま表示する**。ブラウザ内にAstro実行環境を作る必要がなくなったため、`study-preview.js` / `preview-window.*` / `webcontainer-connect.html` と `/webcontainer/connect/` ルートは削除した
  - **`study.html` をCOOP/COEPの対象から外すこと**（`server.js` の `NEEDS_CROSS_ORIGIN_ISOLATION`）。`Cross-Origin-Embedder-Policy: require-corp` が付いていると、CORPヘッダーを返さない `astro dev` のページをiframeに読み込めず、プレビューが必ず真っ白になる
  - ポートは `GET /api/preview` を3秒間隔で見に行き、拡張が実際に使っているポートへ自動で追従する（まだ`/api/preview`が無い場合・拡張を使っていない場合は、画面のポート入力欄の値をそのまま使う）
  - 同じポートのときは`src`を入れ直さない（毎回入れ直すとプレビューが点滅するため）
- **解答はVS Codeから届く**。`GET /api/answer` を2秒間隔で見に行き、届いたら「VS Codeから解答が届きました（時刻）: ファイル名…」と、もんだい側のチェックリスト（作成済み／まだ）を更新する。**採点は今までどおり手動**（「提出して、みてもらう」を押したときだけGeminiを呼ぶ）

## 実装済みの中核ループ

1. **出題**: 固定の20ステップ・8フェーズ（`problems.json`。base→header→hero→works→rest→interact→content→routing）を順番に進めると、1つのポートフォリオサイトが育っていく（2026-09-16に10ステップへ再設計→2026-10-19にAstroの肝を追加して20ステップに拡張。詳細は下記「教材の再設計」「Astroの肝の追加」）。クリア状態を記憶し、次回は未クリア単元から
2. **コーディング**: VS Codeで本物のAstroプロジェクトに書く（拡張 `prototypes/astro-manabi-ext`）。「今のコードを提出する」で実ファイルとつまずきサマリが `PUT /api/answer` に届き、学習画面がそれを採点対象にする。コードが1ファイルも届いていないときは採点しない（2026-09-16に1枚のtextarea→ブラウザ内ファイルツリー、2026-09-24にVS Code風エディタを経て、同日ブラウザ内エディタごと廃止）
3. **苦手検出**: AIが解答を評価し「よかった／なおす／ヒント」＋弱点タグ（11種の固定語彙）を返す
4. **弱点記憶**: サーバーの `memory.json` にタグ別カウント・根拠・履歴・クリア状態を保存（再起動しても残る）
5. **類題生成**: 「次の問題へ」で弱点上位を狙った復習問題をAIが生成（新単元と交互に出題）。**復習に合格すると弱点が回復して消える**

## 品質ガード（粗探しテストで実装）

- **カンニング対策**: コード内の「合格にしろ」等の注入指示を無効化（プロンプト防御＋データ明示。実機で攻撃不合格・正常解答合格を確認）
- **答え漏れ防止の決定的ガード**: AIのヒントに答えのコードが混じったら、問題ごとの `answerPatterns`（正規表現）で**穴埋め「〔ここは自分で考えてみよう〕」に置換**。プロンプト指示だけでは軽量モデルが答えを書いてしまうことが実測で判明したための最終防衛線
- 克服ロジック／新単元との交互出題／空提出ブロック／リセット確認／処理中のボタン無効化／Geminiエラーの平易化

## 教材の再設計（2026-09-16）

もとの9問は1問ごとに世界観が独立した概念ドリル（あいさつ表示・部品化・くり返し…）だった。実際に手を動かして学ぶ別プロトタイプ（`prototypes/astro-base`）で「実サイトを作る方が面白い」という気づきがあり、**「ポートフォリオサイトを1つ、10ステップで作り上げる」構成に全面リニューアル**した。

- 各ステップの`starter`には「これまでのステップの参照実装（完成形）＋今回追加する部分の空欄」を含める方式（学習者ごとの実際のコードを動的に引き継ぐのではなく、参照実装を積み上げる低コスト案）。新しいデータ構造・サーバー変更は不要
- コンポーネント名・CSSクラス名など後続ステップが参照する識別子は問題文で明示的に固定
- 旧seed-9（content-collections）が他問題より重く「せっかちですら手を抜けない」という構造的な難しさが6ペルソナ再検証（2026-09-16）で裏付けられたため、新設計ではcontent-collectionsを2ステップ（コレクション定義→一覧ページ完成）に分割
- 経緯・技術的な判断理由は `.company/engineering/docs/astro-study-ai-production-design.md` の2026-09-16エントリを参照

## Astroの肝の追加＋デザイン完全一致（2026-10-19）

10ステップ版は「Astroのコンポーネント入門」としては良かったが、Astroの肝である islands・コンテンツコレクション・ルーティングが不在で、タグ語彙（client-directive / content-collections）に対応する問題も無かった。そこで4問を追加し16→20問に。あわせて教材コードを `public/reference.html` の作り込みデザインへ完全一致させた。

- **interact-1**（phase: interact）: Header に `<script>` でモバイルメニュー開閉。islands は依存を増やさず `<script>` だけで体験させ、本物の `client:*` は概念説明に留める方針
- **content-1 / content-2**（phase: content）: `src/content/config.ts`＋Markdown で works コレクションを定義し、`getCollection` で一覧描画に差し替え
- **routing-1**（phase: routing）: `src/pages/works/[slug].astro`＋`getStaticPaths`＋`entry.render()` で作品詳細ページ
- **デザイン完全一致**: global.css を `--accent` 系トークン・明朝体（Shippori Mincho）・`.wrap`・`.btn`(角丸4px) 等のデザインシステムに。Hero/Works/About/CTA/Contact/Footer を reference.html と同じ構造・クラス名へ書き換え（セクションも追加）。`workspace/my-portfolio` に完成版を実装し `astro build` で検証済み
- roadmap.html にフェーズタブを追加（⑥動き・⑦コンテンツ・⑧ルーティング）

### 2026-11-19 追記: 詳細ページを1つ手でつくる単元（routing-0）

- **routing-0**（phase: routing・routing-1 の前）: `src/pages/works/project-01.astro` を手で1つ作り、「ファイルの置き場所＝URL」と `../../` の import を先に体験させる。`/works/project-02` は404のまま残し、手で作ると困ることを次の単元の動機にする
- **routing-1** はこの1ページを `[slug].astro` に作り替える流れに変更。`project-01.astro` を残すと `/works/project-01` だけ手書きのページが優先されて表示されるので、名前を変える手順と「残っていない」の評価観点を足した（starter.files に入れて、残っていれば採点で中身も読まれる）
- 採点のプロンプトに「作業フォルダに無いファイル」を渡すようにした（study.js）。渡さないと、AI はファイルが本当に無いのか判断できなかった
- 確認: テスト用コピーで、routing-0 の模範解答 → 合格、routing-1 で project-01.astro を残す → 不合格（残っていると指摘）、消す → 合格（残っていないことも確認）。いずれも Claude Code の実際の採点
- 既に routing-1 をクリアした人は、routing-0 が未クリアとして出る

### 2026-11-19 追記: 「動き」の単元を外し、完成イメージをチュートリアルの完成形にした

- **interact-1（スマホ用メニューの開閉）を外した。** roadmap のタブ（⑦ 動き）と用語集の「動き」のまとまりも外し、タブの番号を詰めた（⑦ コンテンツ・⑧ ルーティング・⑨ アイランド）。island-1 の書き出しにあった interact-1 への言及も書き換えた。後の単元の雛形に Header は出てこないので、ほかの単元には影響しない
- **完成イメージを作り直した。** 以前の `public/reference.html` は手書きのデザイン見本で、チュートリアルで実際にできあがるものと合っていなかった。いまは `public/reference/` に、チュートリアルを最後までやったポートフォリオを astro build したものを置いている（トップ＝`index.html`、作品の詳細ページ＝`works/project-0N.html`、タグの絞り込みの島も動く）
  - 作り直し方: `cd _internal && npm run build:reference`（`scripts/build-reference.js`。依存は `workspace/_deps/node_modules` を使うので開発機でだけ実行できる）。**教材（problems.json）を変えたら実行して合わせること**
  - 学習者は自分の index.astro に変更を重ねるので、後半の模範解答（content-2・island-1）で省かれている「その他」のセクション（rest-1）と `<style>`（works-3＋rest-2）も残して組み立てている
  - 学習画面とプレビュー用の別タブでは、いまの単元の previewPath に合わせて完成イメージのページを出す（詳細ページの単元なら詳細ページ）。完成イメージを出している間は「プレビューが止まっています」の案内で覆わない

### 2026-11-19 追記2: 島のカードを Card.astro と同じ形にした

- island-1 の WorksFilter.jsx が、works で作った `Card.astro` とは別のカード（サムネ無しの `.wf-card`）を描いていたため、アイランドの単元で作品カードの見た目が変わり、完成イメージも works の単元と合っていなかった
- 島（`.jsx`）からは `.astro` の部品を呼べないので、`Card.astro` と同じHTML（`.work-card`・`.work-thumb`・`.work-body`・`.work-tags`・詳細ページへの「詳しく見る」）を `.jsx` に書く形にした。`Card.astro` の `<style>` は島に効かないので、同じCSSを貼り付け用の `WorksFilter.css` に入れた。説明・手順・評価観点にも反映
- content-2・island-1 の模範解答の `index.astro` を、省略なしのファイル丸ごとにした（省略版を丸写しすると About・Contact などのセクションと `<style>` が消えていた）。build-reference.js はこの island-1 の模範解答をそのまま使う
- 確認: 完成イメージと、island-1 の模範解答を入れた学習者のプレビューで、カードの形・幅・リンク・タグの絞り込みが一致。island-1 の模範解答は Claude Code の採点で合格

### 2026-11-19 追記3: 作品一覧ページ（routing-2）

- Works の「すべて見る →」が works-1 の `/#works`（同じページの中）のまま、どの単元でも変わっていなかった
- **routing-2「作品一覧ページをつくる」**（routing-1 の後・island-1 の前）を追加。`src/pages/works/index.astro` が `/works` になること（フォルダの index.astro はフォルダのURL）を、getCollection と Card の復習を兼ねて扱う。最後にトップの「すべて見る →」を `/works` に向ける。`<style>` はファイルの中だけに効くので、並べ方のCSSも一覧ページに書く
- island-1 の模範解答の index.astro も `/works` に合わせた。完成イメージに一覧ページ（`reference/works.html`）を追加し、previewPath が `/works` の単元ではそれを出す
- 確認: 学習者のプレビューと完成イメージの両方で「すべて見る」から一覧ページへ移動し、カード3枚が詳細ページにつながる。routing-2 の模範解答は Claude Code の採点で合格

### 2026-11-19 追記4: お問い合わせ（Contact）のセクションを外した

- rest-1 の `<section id="contact">`（連絡先とフォーム）と、rest-2 のそのCSS（`.contact-grid`・`.form-field` など）を外した。説明・手順・評価観点・答え隠しのパターンも合わせた
- ナビ（header-1〜3）とフッター（rest-3）の「Contact」リンクを外した（4本 → 3本。header-1・header-3 の「4つ」の記述も3つに）
- CTA帯の「Contactへ」ボタンは行き先が無くなるので、「メールを送る」（`mailto:you@example.com`）にした
- 後半のファイル丸ごとの模範解答（content-2・routing-2・island-1）と完成イメージも作り直した
- 確認: 学習者のプレビューと完成イメージで、セクションは top・works・copy・about・cta の5つ、ナビ・フッターは3本、ページ内リンクの行き先切れなし。rest-1・rest-2 の模範解答は Claude Code の採点で合格
- あわせて、フッター（rest-3）の SNS アイコン（`.social-row`・`.social-btn`）も外した。rest-3 の模範解答は採点で合格
- CTA帯（メールを送る）も外し、代わりに **History（これまでのこと）** の年表セクションを rest-1（HTML）・rest-2（CSS: `::before` の点。左の線は付けない）に入れた。CTA の `mailto:` は使わない。rest-1・rest-2 は採点で合格

### 2026-11-19 追記5: 実務の作り方に合わせて組み立て方を直した

実務で作られている Astro 5 のサイトと突き合わせて、教材の組み立て方が実務と違う3点を直した。

- **Header を BaseLayout に置く**: header-1 で Header を BaseLayout の `<slot />` の上に置き、index.astro の空の `<header></header>` を消す。以降のページ（詳細ページ・作品一覧ページを含む）は `<Header />` も import も書かない。rest-3 の説明も「Header と同じようにフッターも BaseLayout に」に
- **どのページでも使う形は global.css に**: works-2 で `.section`・`.section-head`・`.works-grid` を global.css の最後に書き足し、作品カードの見た目だけを index.astro の `<style>` に。routing-2 の一覧ページは並べ方のCSSを書き直さなくてよくなり、island-1 の WorksFilter.css からも `.works-grid` を外した。works-2 の説明に global.css と `<style>` の使い分けを追加
- **フォルダ名を `src/layouts/` に**（Astro の公式ドキュメントと同じ複数形）
- 「答えを見る」のコピーボタンを、ファイルが2つ以上の答えではファイルごとに出すようにした（works-2 は global.css と index.astro）
- 確認: 完成イメージは見た目が変わらず、どのページもヘッダー・フッターが1つずつ、一覧ページも3列。header-1・works-2・rest-3・routing-0・routing-2 の模範解答は Claude Code の採点で合格。教材の完成コード（ルーティングまで）は Astro 5 でも警告なしで build できた

### 2026-11-19 追記6: クラス名の接頭辞 `c-` を外した

- `c-` は FLOCSS の「何度も使う小さな見た目の部品」の印だったが、教材で教える Astro のコンポーネント（.astro）と紛らわしく、`c-wrap` は分け方でもレイアウト用だったため、接頭辞を外した: `c-wrap` → `inner`、`c-eyebrow` → `eyebrow`、`c-btn`・`c-btn-primary` → `btn`・`btn-primary`、`c-link-arrow` → `link-arrow`（151か所。見た目は変わらない）

以下の「ユーザーテスト」「ペルソナ一括実験」節は、再設計前の旧9問に対する記録（過去ログとして残す）。

## ユーザーテスト（初心者ペルソナ・2026-07-15）

「HTML/CSSは書けるがAstro知識ゼロの学生」になりきり、AIのフィードバックだけを頼りに1セッション学習するテストを実施。**まちがえる→苦手が記録される→復習問題が出る→克服して苦手が消える、のループが体験として成立することを確認**。あわせて発見・修正した問題:

| 発見 | 対応 |
|------|------|
| 弱点の信号が弱いと、復習問題が弱点と無関係になる（js-basicsの復習を頼んだらHTML/CSSだけの問題が出た） | ✅ 生成結果を検証: 狙いタグが記録済みの苦手と一致しなければリトライ→ダメならシード問題へ正直にフォールバック。プロンプトにも「Astroの問題にする」「履歴にあるタグだけ」を明記 |
| 合格した解答に幻覚の指摘をして、存在しない弱点を記録する（---があるのに「---が不足」と指摘） | ✅ 合格時は弱点を記録しないルールに（回復のみ。不合格時の指摘だけを信頼する） |
| 答えマスクが「const付き」しか想定しておらず `name = 'アストロ'` がすり抜けた | ✅ パターン追加 |
| AI出力にまれに中国語が混入（「丰富」等）・自己矛盾した指摘 | ✅ 2026-08-26部分対応。`public/prompts.js`の`looksChineseContaminated()`で決定的に検知し、類題生成（`validateGenerated`）・採点（`onSubmit`のgood/fix/hint）の両方で検知時に1回だけ作り直すようにした。プロバイダ非依存の決定的な対策 |
| 生成問題には answerPatterns がなく、答えマスクが効かない | ✅ 2026-08-20解消。生成AIにanswerPatternsも同時生成させ、生成結果の検証（`public/prompts.js`の`validateGenerated`）で必須項目に追加 |

## ペルソナ一括実験（6タイプ・2026-07-15）

タイプの違う6ペルソナで実セッションを実施。全ペルソナで破綻なし:

| ペルソナ | 結果 |
|---------|------|
| せっかち（雛形のまま/中途半端） | 雛形提出はガードでブロック。中途半端な解答は的確な指摘で不合格 |
| タイポ（conts / {nmae}） | 両方のタイポを名指しで指摘 |
| 我流（map指定を無視して手書き） | 要件違反を見抜いて不合格。※「できている」と認めた概念を弱点に入れる矛盾があり、一貫性ルールをプロンプトに追加して解消 |
| ずる（偽JSON埋め込み＋口語で懐柔） | score 0 で完封 |
| 上級者（テンプレートリテラルの別解） | 合格にしつつ「name未使用」を公平に注記（柔軟な判定） |
| 質問（コード欄に日本語で質問） | 「とても良い質問です」と受け止めて優しく解説。※将来は「AI先生に質問する」専用機能が望ましい（採点と質問対応の分離） |

## 文言方針

**ターゲットはHTMLとCSSしか知らない人。** 問題文・AIフィードバック・UIのすべてで専門用語を避け、使うときは（かんたんな説明）を添える（例:「frontmatter（---で囲まれた、JavaScriptを書く場所）」）。

## プロトタイプの割り切り（本番との差分）

- ~~コードは実行せず、AIによる静的評価のみ~~ → **2026-08-19: WebContainerでのブラウザ内実行・プレビューのPoC完了**（`webcontainer-demo.html`。ただし中核ループ（採点・弱点記憶）への統合はまだで、独立デモの段階だった。**2026-10-27に廃止・削除**）
- ~~記憶はJSONファイル・単一ユーザー~~ → **2026-08-19: SQLite化（`data.db`）完了。単一ユーザーのまま**（本番はGoogleログインでマルチユーザー対応）
- 弱点の時間減衰・重要度重み付けは未実装（growth-agentの設計思想を参考に本実装で）
- 注入対策はプロンプトレベル＋パターン置換であり完全ではない。本実装では評価器の分離等を検討
- 類題生成の品質・難易度の安定性は少数サンプルでの確認のみ

## ファイル構成

トップレベルは `README.md` / `START-Mac.app` / `START-Windows.bat` のみ。以下は全部 `_internal/` の中（2026-11-11〜）。

- `_internal/server.js` — 依存ゼロのNodeサーバー（静的配信 / Googleログイン / DB読み書き・克服/進捗ロジック）
- `_internal/db.js` — SQLite永続化層（`node:sqlite` 使用。`memory.json` と同じ形のオブジェクトで読み書きし、server.js側のロジックは変更なし。旧`memory.json`が残っていれば初回起動時に自動移行）
- `_internal/problems.json` — 固定23ステップ・11フェーズ（ポートフォリオサイトを1つ作り上げる連続構成。タグ語彙11種すべてカバー。answerPatterns=答え漏れマスク用の正規表現つき。2026-09-16に10ステップへ再設計、2026-10-19に肝を追加して20ステップへ、2026-10-27にアイランド(client:)と画面遷移を足して22ステップへ、2026-10-29にボタンの部品化(Btn.astro)を足して23ステップへ）。各ステップの`starter`は`{files, newFiles}`のオブジェクト形式（`files`=すでに存在するファイル、`newFiles`=学習者が自分で作成する必要があるファイルの雛形。もんだい側に「このステップで自分で作るファイル」チェックリストとして表示され、拡張がVS Code側に同じ雛形を配置する）
- `_internal/public/` — `index.html` / `study.html` / `notebook.html` / `settings.html`（2026-11-11追加。Gemini/Claudeの設定確認） ＋ `style.css`（デザイントークン） / `common.js` / `home.js` / `study.js` / `notebook.js` / `settings.js`（`study-preview.js`・`preview-window.*`・`webcontainer-connect.html` は2026-09-24に、`webcontainer-demo.*`・`vendor/webcontainer/` は2026-10-27に削除）
- `_internal/data.db` — 弱点・履歴・クリア状態（SQLite。自動生成。コミット対象外）
- `_internal/memory.json` — 旧形式（自動生成。存在する場合は初回起動時にdata.dbへ移行される。コミット対象外）

## 設計書

- `.company/engineering/docs/astro-study-ai-v2-design.md`（プロトタイプv2の全体設計見直しの経緯・画面構成・トークン定義）
- `.company/engineering/docs/astro-study-ai-production-design.md`（本実装の設計方針。フェーズP1=SQLite化が完了済み）
- `.company/engineering/docs/astro-study-ai-vscode-extension-design.md`（**2026-09-24決定**のVS Code拡張の設計。コードを書く場所はVS Codeに一本化。ブラウザ内エディタ・WebContainerプレビューは同日廃止済み＝E4完了）
