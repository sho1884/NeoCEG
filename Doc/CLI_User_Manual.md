# NeoCEG CLI User Manual / NeoCEG CLI ユーザーマニュアル

**Version**: 1.0
**Date**: 2026-04-04
**Status**: Initial release / 初版

---

## 1. Overview / 概要

The NeoCEG CLI is a command-line tool that processes `.nceg` files and outputs decision tables, coverage tables, and graph images. It is designed to be embedded in CI/CD pipelines and orchestration workflows as a UNIX filter.

NeoCEG CLI は `.nceg` ファイルを処理し、デシジョンテーブル、カバレッジ表、グラフ画像を出力するコマンドラインツールです。UNIX フィルタとして、CI/CD パイプラインやオーケストレーションワークフローへの組み込みを想定しています。

### Typical Workflow / 典型的なワークフロー

1. A test designer creates and reviews a cause-effect graph using the NeoCEG GUI application
2. The finalized `.nceg` file is committed to version control
3. The CLI generates artifacts (decision tables, coverage tables, graph images) in an automated pipeline
4. The generated decision table is fed into a data-driven testing framework

テスト設計者が NeoCEG GUI で原因結果グラフを作成・レビューし、確定した `.nceg` ファイルをバージョン管理にコミットします。CLI は自動パイプラインでデシジョンテーブル、カバレッジ表、グラフ画像を生成し、生成されたデシジョンテーブルをデータ駆動テストフレームワークに投入します。

---

## 2. Installation / インストール

### Prerequisites / 前提条件

- Node.js v18 or later / Node.js v18 以降

### From the repository / リポジトリから

```bash
git clone https://github.com/sho1884/NeoCEG.git
cd NeoCEG
npm install
```

After installation, the CLI is available via:

インストール後、CLI は以下で利用できます：

```bash
node bin/neoceg.mjs [options] [input-file]
```

### Global installation (future) / グローバルインストール（将来）

```bash
npm install -g neoceg    # Not yet published to npm
npx neoceg [options]     # Not yet published to npm
```

---

## 3. Usage / 使い方

### Basic Syntax / 基本構文

```
neoceg [options] [input-file]
```

- If `input-file` is specified, reads from that file
- If omitted, reads from standard input (stdin)
- Output is written to standard output (stdout) by default

`input-file` を指定するとそのファイルから読み込みます。省略すると標準入力（stdin）から読み込みます。出力はデフォルトで標準出力（stdout）に書き出されます。

### Options / オプション

| Option | Description / 説明 |
|--------|----------|
| `-o FILE`, `--output FILE` | Write output to FILE instead of stdout / stdout の代わりに FILE に出力 |
| `--coverage` | Output coverage table CSV instead of decision table / デシジョンテーブルの代わりにカバレッジ表 CSV を出力 |
| `--all-combinations` | Output the full **learning-mode** decision table — all 2^n cause combinations with a per-column feasibility (Status) row, instead of the optimized table. Errors if 2^n > 256 (the learning-mode column limit). / 最適化表の代わりに、全 2^n 原因組合せを列ごとの実行可否（Status 行）付きで出力する**学習モード**表。2^n > 256（学習モードの列上限）でエラー。 |
| `--svg` | Output cause-effect graph as SVG / 原因結果グラフを SVG として出力 |
| `-h`, `--help` | Show help message / ヘルプメッセージを表示 |
| `--version` | Show version number / バージョン番号を表示 |

---

## 4. Examples / 使用例

### 4.1 Decision Table to stdout / デシジョンテーブルを標準出力へ

```bash
node bin/neoceg.mjs input.nceg
```

Output / 出力:
```csv
ID,Classification (分類),Logical Statement (論理言明),#1,#2,#3
p1,Cause (原因),A,T,F,T
p2,Cause (原因),B,T,T,F
p3,Effect (結果),C,T,F,F
```

### 4.2 Decision Table to file / デシジョンテーブルをファイルへ

```bash
node bin/neoceg.mjs -o decision_table.csv input.nceg
```

### 4.3 Coverage Table / カバレッジ表

```bash
node bin/neoceg.mjs --coverage input.nceg
```

Output / 出力:
```csv
Expr. (論理式),p1: A,p2: B,p3: C,#1,#2,#3,Status (状態),Reason (理由)
Expr.1,T,T,T,#,,,,
Expr.2,F,T,F,,#,,,
Expr.3,T,F,F,,,#,,
```

### 4.4 All Combinations (Learning Mode) / 全組合せ（学習モード）

```bash
node bin/neoceg.mjs --all-combinations input.nceg
```

Output / 出力:
```csv
ID,Classification (分類),Logical Statement (論理言明),#1,#2,#3,#4
,Status,,Infeasible,Adopted,Adopted,Infeasible
A,Cause (原因),A,T,T,F,F
B,Cause (原因),B,T,F,T,F
E,Effect (結果),E,T,F,F,F
```

Every one of the 2^n cause combinations becomes a column (here 2^2 = 4). The extra **Status** row flags each column — `Adopted` (a feasible test) or `Infeasible` (violates a constraint). This is the same **Learning Mode** view as the GUI. It errors if 2^n exceeds **256 columns** (i.e. more than 8 causes), matching the GUI's learning-mode limit — use the optimized default or `--coverage` for larger models.

2^n 個の原因組合せがすべて列になります（ここでは 2^2 = 4）。追加の **Status** 行が各列を `Adopted`（実行可能なテスト）か `Infeasible`（制約違反）で示します。GUI の**学習モード**と同じ表示です。2^n が **256 列**（＝原因が 8 個超）を超えるとエラーになります（GUI の学習モード上限と一致）。大きいモデルには最適化された既定表か `--coverage` を使ってください。

### 4.5 Graph SVG / グラフ SVG

```bash
node bin/neoceg.mjs --svg -o graph.svg input.nceg
```

The SVG output requires `@layout` coordinates in the `.nceg` file. Files saved from the NeoCEG GUI always include layout information.

SVG 出力には `.nceg` ファイル内の `@layout` 座標が必要です。NeoCEG GUI から保存されたファイルには常にレイアウト情報が含まれています。

### 4.6 Piping from stdin / stdin からのパイプ

```bash
cat input.nceg | node bin/neoceg.mjs
cat input.nceg | node bin/neoceg.mjs --coverage > coverage.csv
cat input.nceg | node bin/neoceg.mjs --svg > graph.svg
```

### 4.7 Combining with other tools / 他のツールとの組み合わせ

The CLI outputs clean CSV to stdout and diagnostics to stderr, making it safe to pipe into other tools.

CLI はクリーンな CSV を stdout に、診断情報を stderr に出力するため、他のツールへのパイプが安全に行えます。

```bash
# Extract only cause rows / 原因行のみ抽出
node bin/neoceg.mjs input.nceg | grep 'Cause'

# Count the number of test rules / テストルール数をカウント
node bin/neoceg.mjs input.nceg | head -1 | awk -F, '{print NF - 4}'

# Transpose and post-process for test framework
node bin/neoceg.mjs input.nceg | your_transpose_script.py | your_factor_mapper.py
```

---

## 5. Output Format / 出力フォーマット

### 5.1 Decision Table CSV / デシジョンテーブル CSV

Each row represents a node. Each column after the header columns represents a test rule.

各行がノードを、ヘッダー列以降の各列がテストルールを表します。

| Column / 列 | Description / 説明 |
|--------|----------|
| ID | Node identifier / ノード識別子 |
| Classification / 分類 | Cause, Intermediate, or Effect / 原因、中間、または結果 |
| Logical Statement / 論理言明 | Node label / ノードラベル |
| #1, #2, ... | Truth values for each test rule / 各テストルールの真理値 |

**Truth values / 真理値**:

| Value / 値 | Meaning / 意味 |
|------|----------|
| T | True (explicitly set) / 真（明示的に設定） |
| F | False (explicitly set) / 偽（明示的に設定） |
| t | True (deduced — no matching expression exists) / 真（演繹 — 対応する論理式なし） |
| f | False (deduced — no matching expression exists) / 偽（演繹 — 対応する論理式なし） |
| M | Masked (Don't Care — MASK constraint active) / マスク（Don't Care — MASK 制約有効） |
| I | Indeterminate (cannot determine due to M propagation) / 不定（M 伝播により確定不能） |
| - | Don't-care — the cause is unconstrained here and affects no result; any value works (distinct from `M`, which is MASK-driven) / 不問 — 制約でも定まらず結果に影響しない原因。どの値でも成立（MASK 由来の `M` とは別） |

### 5.2 Coverage Table CSV / カバレッジ表 CSV

Each row represents a logical expression (edge) that should be covered.

各行がカバーされるべき論理式（エッジ）を表します。

| Column / 列 | Description / 説明 |
|--------|----------|
| Expr. / 論理式 | Expression identifier (Expr.1, Expr.2, ...) / 論理式識別子 |
| Node columns / ノード列 | Required truth values for this expression / この論理式に必要な真理値 |
| #1, #2, ... | Coverage markers for each test rule / 各テストルールのカバレッジマーカー |
| Status / 状態 | Infeasible or Untestable (if applicable) / 実行不能またはテスト不能（該当する場合） |
| Reason / 理由 | Explanation for special status / 特殊状態の理由 |

**Coverage markers / カバレッジマーカー**:

| Marker / マーカー | Meaning / 意味 |
|------|----------|
| `#` | Adopted — this test rule covers this expression / 採用 — このテストルールがこの論理式をカバー |
| `x` | Also covered — expression already covered by another rule / 追加カバー — 別のルールで既にカバー済み |
| `!` | Infeasible — the expression can never hold (constraint violation) / 実行不能 — 制約違反で成立し得ない |
| `?` | Untestable — feasible but the result is indeterminate under MASK / テスト不能 — 実行可能だが MASK により結果が不定 |
| (blank) | Not covered by this rule / このルールではカバーされない |

The coverage table's infeasible marker is `!` (not `-`); `-` is the decision table's don't-care marker (§5.1), so the two tables never share a glyph.

カバレッジ表の実行不能は `!`（`-` ではない）。`-` はデシジョンテーブルの不問記号（§5.1）なので、両表で字形が衝突しません。

---

## 6. Error Handling / エラー処理

The CLI uses standard UNIX conventions for error reporting.

CLI はエラー報告に標準的な UNIX 規約を使用します。

| Exit Code / 終了コード | Meaning / 意味 |
|------|----------|
| 0 | Success / 成功 |
| 1 | Error (parse error, no feasible rules, missing @layout for SVG, etc.) / エラー |

- Diagnostic messages are written to **stderr** (never to stdout)
- stdout remains clean for piping even when errors occur

診断メッセージは **stderr** に出力されます（stdout には出力されません）。エラー発生時でも stdout はパイプのためにクリーンな状態を保ちます。

### Common Errors / よくあるエラー

**Parse error / パースエラー**:
```
Error: Parse error:
  line 5: Unexpected character: !
```
The `.nceg` file contains a syntax error. Check the indicated line for typos, missing quotes, or invalid keywords.

`.nceg` ファイルに構文エラーがあります。指定行のタイプミス、引用符の不足、無効なキーワードを確認してください。

**SVG without layout / レイアウトなしの SVG**:
```
Error: SVG output requires @layout coordinates in the .nceg file
```
The `--svg` option requires node position data. Save the graph from the NeoCEG GUI, which always includes `@layout` coordinates.

`--svg` オプションにはノード位置データが必要です。NeoCEG GUI からグラフを保存すると、`@layout` 座標が常に含まれます。

**Too many causes for --all-combinations / --all-combinations で原因が多すぎる**:
```
Error: Too many causes for --all-combinations: 2^9 exceeds the 256-column limit. No table emitted.
```
The learning-mode full table is capped at 256 columns (8 causes). Use the optimized default decision table or `--coverage`, which have no such limit.

学習モードの全組合せ表は 256 列（原因 8 個）が上限です。この上限のない最適化デシジョンテーブル（既定）または `--coverage` を使ってください。

---

## 7. Notes / 備考

### Output Consistency / 出力の一貫性

The CLI produces the same decision table and coverage table as the NeoCEG GUI application for the same `.nceg` input. The core algorithm and CSV generation logic are shared between the two.

CLI は同じ `.nceg` 入力に対して、NeoCEG GUI アプリケーションと同じデシジョンテーブル・カバレッジ表を生成します。コアアルゴリズムと CSV 生成ロジックは両者で共有されています。

### SVG Output / SVG 出力について

The CLI generates SVG independently from the GUI (no browser required). Node colors follow the same conventions: Cause (blue), Intermediate (indigo), Effect (purple). AND/OR badges and NOT labels are rendered identically.

CLI は GUI とは独立して SVG を生成します（ブラウザ不要）。ノードの色は GUI と同じ規約に従います：原因（青）、中間（藍）、結果（紫）。AND/OR バッジと NOT ラベルも同一の描画です。

---

## 8. Try It as an API (Demo) / API として試す（デモ）

The same engine is exposed over HTTP by the CLI's **serve mode**, and a public demo instance is hosted so you can try it with a single `curl` — no clone, no install.

CLI の **serve モード**は同じエンジンを HTTP で公開します。公開デモが動いているので、クローンもインストールも不要で `curl` 一発で試せます。

> **Demo — best-effort.** `https://modellogue.com/neoceg` is a **public, unauthenticated demo** for evaluation. It has **no SLA**, may **change or stop without notice**, and applies the guardrails below. For anything beyond a quick trial — automation, CI, private data — **run your own instance** with `neoceg serve` from the NeoCEG source and point your client at it.
>
> **デモ（ベストエフォート）。** `https://modellogue.com/neoceg` は評価用の**公開・無認証デモ**です。**SLA なし**、**予告なく変更/停止**、下記のガードレールが適用されます。試用を超える用途（自動化・CI・機微データ）では、NeoCEG ソースの `neoceg serve` で**自分のインスタンスを起動**し、そこへ接続してください。

### 8.1 Endpoints / エンドポイント

| Method | Path | Purpose / 用途 |
|---|---|---|
| `GET` | `/neoceg/health` | Liveness + version / 死活確認とバージョン |
| `POST` | `/neoceg/generate` | Process a `.nceg` model / `.nceg` モデルを処理 |

`POST /neoceg/generate` takes a JSON body. Only `source` is required; the rest default:

`POST /neoceg/generate` は JSON ボディを取ります。必須は `source` のみで、他は既定値です：

| Field / フィールド | Values / 値 | Default / 既定 |
|---|---|---|
| `source` | The `.nceg` text / `.nceg` テキスト | — (required / 必須) |
| `mode` | `decision-table` \| `all-combinations` \| `coverage` \| `svg` | `decision-table` |
| `format` | `json` \| `csv` \| `svg` | `json` (tables) / `svg` (mode `svg`) |

`mode: "all-combinations"` is the learning-mode full table and is limited to **2^n ≤ 256** (≤ 8 causes); a larger model returns `422 unsatisfiable`. This is separate from — and stricter than — the model-size guardrails below (§8.3).

`mode: "all-combinations"` は学習モードの全組合せ表で、**2^n ≤ 256**（原因 8 個以下）に制限されます。超過は `422 unsatisfiable`。これは下記のモデル規模ガードレール（§8.3）とは別で、より厳しい制限です。

### 8.2 Examples / 使用例

**Liveness / 疎通:**
```bash
curl -sS https://modellogue.com/neoceg/health
# → {"status":"ok","version":"0.1.0"}
```

**Optimized decision table as JSON (send only `source`) / 最適化デシジョンテーブルを JSON で（`source` のみ）:**
```bash
curl -sS -X POST https://modellogue.com/neoceg/generate \
  -H 'Content-Type: application/json' \
  -d '{ "source": "A: \"A\"\nB: \"B\"\nE := A AND B\nONE(A, B)" }'
```

**Coverage table as CSV / カバレッジ表を CSV で:**
```bash
curl -sS -X POST https://modellogue.com/neoceg/generate \
  -H 'Content-Type: application/json' \
  -d '{ "source": "...", "mode": "coverage", "format": "csv" }'
```

**Graph as SVG / グラフを SVG で:**
```bash
curl -sS -X POST https://modellogue.com/neoceg/generate \
  -H 'Content-Type: application/json' \
  -d '{ "source": "...", "mode": "svg" }' > graph.svg
```

**From a `.nceg` file (build the JSON with `jq`) / `.nceg` ファイルから（`jq` で JSON 化）:**
```bash
jq -Rs '{source: .}' input.nceg \
  | curl -sS -X POST https://modellogue.com/neoceg/generate \
      -H 'Content-Type: application/json' --data @-
```

### 8.3 Guardrails / ガードレール

The demo is public compute with no secrets, protected by env-tunable limits (self-hosted defaults shown):

デモは秘密を持たない公開計算で、env で調整可能な上限で守られています（セルフホスト時の既定値）：

| Limit / 上限 | Default / 既定 | Over the limit / 超過時 |
|---|---|---|
| Request body size / ボディサイズ | 2 MiB | `413 payload_too_large` |
| Per-IP rate / IP 単位レート | 60 req/min | `429 rate_limited` |
| Model nodes / モデルのノード数 | 512 | `422 model_too_large` |
| Model causes / モデルの原因数 | 64 | `422 model_too_large` |

Errors are always JSON: `{"error": {"type": "...", "message": "..."}}`.

エラーは常に JSON：`{"error": {"type": "...", "message": "..."}}`。

---

## Document History / 変更履歴

| Date / 日付 | Change / 変更 |
|---|---|
| 2026-04-04 | Initial version / 初版作成 |
| 2026-07-24 | Add §8 Demo API (serve mode) with the public demo URL, curl examples, and guardrails / §8 デモ API（serve モード）を追加：公開デモ URL・curl 例・ガードレール |
| 2026-07-24 | Document `--all-combinations` (learning mode) and its 256-column limit to match the core; remove the stale Observable column (the observable flag was removed in 2026-06) / コアに合わせ `--all-combinations`（学習モード）と 256 列上限を記載。廃止済みの Observable 列を削除（観測フラグは 2026-06 に削除） |
| 2026-07-24 | Symbol alignment: decision-table don't-care is `-`; coverage-table infeasible is `!` (was `-`), untestable `?` — added the missing coverage markers and the DT `-` legend / 記号統一：DTの不問は `-`、カバレッジの実行不能は `!`（旧 `-`）・テスト不能 `?`。欠けていたカバレッジ記号と DT `-` の凡例を追加 |
