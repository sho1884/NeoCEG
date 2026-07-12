# NeoCEG CLI Requirements Specification / NeoCEG CLI 要求仕様書

| Item / 項目 | Content / 内容 |
|------|---------|
| Document / 文書 | NeoCEG CLI Requirements Specification / NeoCEG CLI 要求仕様書 |
| Version / バージョン | 0.3 (Draft / ドラフト) |
| Created / 作成日 | 2026-03-29 |
| Updated / 更新日 | 2026-07-12 |
| Status / 状態 | Draft / ドラフト |

---

## 1. Purpose / 目的

This document defines requirements for the NeoCEG CLI — a UNIX filter-style command that processes `.nceg` files and outputs decision tables, coverage tables, and graph images, enabling integration into CI/CD pipelines and orchestration workflows.

本文書は NeoCEG CLI の要件を定義する。NeoCEG CLI は `.nceg` ファイルを処理し、デシジョンテーブル、カバレッジ表、グラフ画像を出力する UNIX フィルタ型コマンドであり、CI/CD パイプラインやオーケストレーションワークフローへの組み込みを可能にする。

### 1.1 Background / 背景

In the intended workflow, a human reviewer creates and refines a cause-effect graph using the NeoCEG GUI application. Once the review is complete and the `.nceg` file is finalized, it enters an automated pipeline. The CLI command serves as the bridge between this human-reviewed artifact and the automated downstream processes (data-driven test execution, report generation, etc.).

想定するワークフローでは、人間のレビュアーが NeoCEG GUI アプリケーションで原因結果グラフを作成・修正する。レビューが完了し `.nceg` ファイルが確定したら、自動パイプラインに投入する。CLI コマンドは、この人間がレビュー済みの成果物と、自動化された下流プロセス（データ駆動テスト実行、レポート生成等）をつなぐ役割を果たす。

### 1.2 Scope / スコープ

The CLI reuses the existing core logic (`src/services/`) and adds no new algorithmic functionality. It provides a non-interactive command-line interface to the same processing that the GUI application performs.

CLI は既存のコアロジック（`src/services/`）を再利用し、新たなアルゴリズム機能は追加しない。GUI アプリケーションと同じ処理を、非対話型のコマンドラインインターフェースとして提供する。

The CLI has two modes over the same core: the default **batch mode** (a UNIX filter — read `.nceg`, write one output, exit) and a long-running **serve mode** (an HTTP API for out-of-process callers), triggered by the literal `serve` subcommand. Serve mode adds a network surface only; it introduces no new algorithm and produces, for the same input, output equivalent to batch mode (§6). See §7 for the HTTP API contract.

CLI は同一コア上に2つのモードを持つ：既定の**バッチモード**（UNIX フィルタ。`.nceg` を読み1つの出力を書いて終了）と、長時間稼働する**serve モード**（プロセス外の呼び出し元向けの HTTP API）で、後者はリテラルの `serve` サブコマンドで起動する。serve モードはネットワーク面を追加するだけで、新規アルゴリズムは持たず、同一入力に対してバッチモードと等価な出力（§6）を返す。HTTP API 契約は §7 を参照。

### 1.3 Writing Conventions / 記述規約

Same as [Requirements_Specification.md](./Requirements_Specification.md) §1.2.

[Requirements_Specification.md](./Requirements_Specification.md) §1.2 に準じる。

---

## 2. User Requirements / ユーザー要件

| ID | Task / タスク | Priority / 優先度 |
|----|------|----------|
| CLI-UR-001 | Generate a decision table from a finalized .nceg file in an automated pipeline / 確定済みの .nceg ファイルからデシジョンテーブルを自動パイプラインで生成する | High / 高 |
| CLI-UR-002 | Generate a coverage table for audit and traceability / 監査・トレーサビリティのためにカバレッジ表を生成する | Medium / 中 |
| CLI-UR-003 | Generate a graph image for inclusion in test design documents and reports / テスト設計書やレポートに含めるグラフ画像を生成する | Medium / 中 |
| CLI-UR-004 | Generate the full decision table (all input combinations, with constraint feasibility) headlessly for batch/automation use / 全入力組み合わせ（制約による実行可否付き）の完全デシジョンテーブルを、バッチ・自動化用途でヘッドレスに生成する | Medium / 中 |
| CLI-UR-005 | Call the same processing over HTTP from out-of-process / reactive clients (a GUI, CI dashboard, or sibling service) without spawning a subprocess per request / 同じ処理を、プロセス外／リアクティブなクライアント（GUI・CI ダッシュボード・姉妹サービス）から、リクエストごとにサブプロセスを起動せずに HTTP で呼び出す | Medium / 中 |

> **Note / 注 (CLI-UR-004)**: This is the same capability the GUI already provides via its learning mode plus CSV export. What CLI-UR-004 adds is **a headless means of producing it** — not the capability itself. The interactive case is already covered by the GUI; CLI-UR-004 covers the automation/batch case the GUI cannot reach. See [ADR-001](adr/ADR-001-cli-full-decision-table.yaml).
> / CLI-UR-004 は、GUI が学習モード＋CSV エクスポートで**既に提供している能力**と同一である。CLI-UR-004 が加えるのは**それをヘッドレスで生成する手段**であって、能力そのものではない。対話的な利用は GUI が既にカバーしており、CLI-UR-004 は GUI が届かない自動化・バッチ文脈をカバーする。[ADR-001](adr/ADR-001-cli-full-decision-table.yaml) 参照。

---

## 3. System Requirements / システム要件

### 3.1 Command Interface / コマンドインターフェース

| ID | Requirement / 要件 | Parent / 親 |
|----|----------|--------|
| CLI-SR-001 | Read `.nceg` input from a specified file path / 指定されたファイルパスから `.nceg` 入力を読み込む | CLI-UR-001 |
| CLI-SR-002 | Read `.nceg` input from standard input (stdin) / 標準入力（stdin）から `.nceg` 入力を読み込む | CLI-UR-001 |
| CLI-SR-003 | Write default output (decision table CSV) to standard output (stdout) / デフォルト出力（デシジョンテーブル CSV）を標準出力（stdout）に書き出す | CLI-UR-001 |
| CLI-SR-004 | Write output to a specified file path via option / オプション指定により出力を指定ファイルパスに書き出す | CLI-UR-001 |

**Rule Scenarios / ルールシナリオ**:

CLI-SR-001 + CLI-SR-003:
```
[Context]  A valid .nceg file exists at the specified path
[Action]   User runs: neoceg input.nceg
[Outcome]  Decision table CSV is written to stdout
```

CLI-SR-002 + CLI-SR-003:
```
[Context]  A valid .nceg content is available on stdin
[Action]   User runs: cat input.nceg | neoceg
[Outcome]  Decision table CSV is written to stdout
```

CLI-SR-004:
```
[Context]  User specifies an output file
[Action]   User runs: neoceg -o output.csv input.nceg
[Outcome]  Decision table CSV is written to the specified file
```

### 3.2 Output Modes / 出力モード

| ID | Requirement / 要件 | Parent / 親 |
|----|----------|--------|
| CLI-SR-010 | Output decision table in CSV format (default) / デシジョンテーブルを CSV 形式で出力する（デフォルト） | CLI-UR-001 |
| CLI-SR-011 | Output coverage table in CSV format via `--coverage` option / `--coverage` オプションによりカバレッジ表を CSV 形式で出力する | CLI-UR-002 |
| CLI-SR-012 | Output cause-effect graph in SVG format via `--svg` option / `--svg` オプションにより原因結果グラフを SVG 形式で出力する | CLI-UR-003 |
| CLI-SR-013 | Output the full decision table — all 2^n cause combinations, each column flagged feasible or constraint-excluded — in CSV format via `--all-combinations` option / `--all-combinations` オプションにより、全 2^n 原因組み合わせを各列の実行可否（有効/制約除外）フラグ付きで完全デシジョンテーブルとして CSV 出力する | CLI-UR-004 |
| CLI-SR-014 | Detect 2^n > 256 **before producing any output**, then report an error (non-zero exit) and write **no table at all** — no partial table, no substitute table / 出力を生成する**前に** 2^n > 256 を検出し、エラー（非ゼロ終了）を報告して**表を一切出力しない**（途中までの表も、別の表も出さない） | CLI-UR-004 |
| CLI-SR-015 | On any error, write nothing to stdout and leave any `-o` target file unmodified; emit diagnostics to stderr only and exit non-zero (never emit a partial table) / いかなるエラー時も stdout には何も書かず、`-o` 指定先の既存ファイルも変更しない。診断は stderr のみに出し非ゼロ終了する（途中までの表を決して出さない） | CLI-UR-001 |

**Rule Scenarios / ルールシナリオ**:

CLI-SR-011:
```
[Context]  User needs a coverage table
[Action]   User runs: neoceg --coverage input.nceg
[Outcome]  Coverage table CSV is written to stdout
```

CLI-SR-012:
```
[Context]  User needs a graph image for documentation
[Action]   User runs: neoceg --svg -o graph.svg input.nceg
[Outcome]  SVG file containing the cause-effect graph is written to the specified file
```

CLI-SR-013:
```
[Context]  An automated report needs the complete decision table with feasibility flags
[Action]   User runs: neoceg --all-combinations input.nceg
[Outcome]  Full 2^n decision table CSV is written to stdout, including a status row
           that marks each constraint-excluded (infeasible) column
```

CLI-SR-014 + CLI-SR-015:
```
[Context]  The graph has 9 causes (2^9 = 512 > 256)
[Action]   User runs: neoceg --all-combinations big.nceg -o out.csv
[Outcome]  An error is written to stderr and the command exits non-zero, stating that
           the full table exceeds the 256-column limit. Nothing is written to stdout,
           and out.csv is NOT created or modified — no partial table is ever emitted.
```

#### 3.2.1 Reuse note (full decision table) / 再利用方針（完全デシジョンテーブル）

CLI-SR-013/014 add **no new algorithm** (per §1.2). They reuse the exact core the GUI uses for its learning mode:

- `generateLearningModeTable(model, table)` in `src/services/decisionTableCalculator.ts` (SR-025/SR-026) produces the all-2^n conditions, with constraint-excluded columns flagged, and returns `null` when 2^n > 256.
- `generateDecisionTableCSV(...)` already emits the feasibility **status row** when excluded conditions exist — no change needed.

The CLI's existing decision-table path differs from this only in **one line**: it uses `getFeasibleConditions(table)`. For `--all-combinations`, select `generateLearningModeTable(model, table)?.conditions` instead (this mirrors `csvExporter.ts` `computeTablesFromGraph`'s learning-mode branch). When the helper returns `null`, error out per CLI-SR-014.

This ordering **inherently** satisfies CLI-SR-014/015: `generateLearningModeTable` returns `null` (never a partial table) *before* any CSV is generated, and the CLI writes output exactly once, after the table is fully built. The `null` check therefore happens before a single byte is written — no partial output is structurally possible.

CLI-SR-013/014 は新規アルゴリズムを追加しない（§1.2 準拠）。GUI の学習モードと同一コアを再利用する：

- `src/services/decisionTableCalculator.ts` の `generateLearningModeTable(model, table)`（SR-025/SR-026）が全 2^n 条件を生成し、制約除外列をフラグ付けし、2^n>256 で `null` を返す。
- `generateDecisionTableCSV(...)` は除外条件が存在するとき実行可否の**ステータス行**を既に出力する（変更不要）。

CLI の既存デシジョンテーブル経路との差は **1 行**のみ：現在は `getFeasibleConditions(table)` を使う。`--all-combinations` ではこれを `generateLearningModeTable(model, table)?.conditions` に差し替える（`csvExporter.ts` の `computeTablesFromGraph` 学習モード分岐と同型）。`null` の場合は CLI-SR-014 に従いエラー終了する。

> **Confirmed / 確定**: Flag name is `--all-combinations`. The name makes explicit that it is the **combinations** that are exhaustive (plain `--full` was rejected as ambiguous — full of *what?*). The internal name *learning mode* is deliberately not surfaced as the flag — the CLI user's intent is "give me every combination," not "teach me".
> / **確定**: フラグ名は `--all-combinations`。**組み合わせ**が全網羅であることを明示する（単なる `--full` は「何が full か」が曖昧として不採用）。内部名称「学習モード」はフラグに用いない — CLI 利用者の意図は「全組み合わせが欲しい」であって「学習したい」ではない。

### 3.3 SVG Output / SVG 出力

| ID | Requirement / 要件 | Parent / 親 |
|----|----------|--------|
| CLI-SR-020 | Render graph using `@layout` coordinates from the .nceg file / .nceg ファイルの `@layout` 座標を用いてグラフを描画する | CLI-SR-012 |
| CLI-SR-021 | Render nodes with role-based colors (Cause: blue, Intermediate: indigo, Effect: purple) / ノードを役割に応じた色で描画する（原因: 青、中間: 藍、結果: 紫） | CLI-SR-012 |
| CLI-SR-022 | Render logical edges with AND/OR/NOT notation / 論理エッジを AND/OR/NOT 表記で描画する | CLI-SR-012 |
| CLI-SR-023 | Render constraint edges with constraint type labels / 制約エッジを制約種別ラベル付きで描画する | CLI-SR-012 |
| CLI-SR-024 | Report an error if `@layout` section is absent / `@layout` セクションがない場合はエラーを報告する | CLI-SR-012 |

**Note / 注**: Future versions may integrate GraphViz for automatic layout generation when `@layout` is absent. This is out of scope for v1.0.

将来のバージョンでは、`@layout` がない場合に GraphViz による自動レイアウト生成を統合する構想がある。これは v1.0 のスコープ外とする。

### 3.4 Error Handling / エラー処理

| ID | Requirement / 要件 | Parent / 親 |
|----|----------|--------|
| CLI-SR-030 | Exit with code 0 on success / 成功時は終了コード 0 で終了する | CLI-UR-001 |
| CLI-SR-031 | Exit with code 1 on input/parse error and write diagnostic to stderr / 入力・パースエラー時は終了コード 1 で終了し、診断情報を stderr に出力する | CLI-UR-001 |
| CLI-SR-032 | Exit with code 1 when all rules are infeasible and write diagnostic to stderr / すべてのルールが実行不能な場合は終了コード 1 で終了し、診断情報を stderr に出力する | CLI-UR-001 |
| CLI-SR-033 | Never write diagnostic messages to stdout (preserve pipe cleanliness) / 診断メッセージは stdout に書き出さない（パイプの清潔さを保持する） | CLI-UR-001 |

**Rule Scenarios / ルールシナリオ**:

CLI-SR-031:
```
[Context]  Input .nceg has a syntax error on line 5
[Action]   User runs: neoceg broken.nceg
[Outcome]  stderr: "Error: Parse error at line 5: unexpected token 'XYZ'"
           exit code: 1
           stdout: (empty)
```

CLI-SR-032:
```
[Context]  All cause combinations violate constraints
[Action]   User runs: neoceg contradictory.nceg
[Outcome]  stderr: "Error: No feasible rules — all combinations violate constraints"
           exit code: 1
           stdout: (empty)
```

### 3.5 Help and Version / ヘルプとバージョン

| ID | Requirement / 要件 | Parent / 親 |
|----|----------|--------|
| CLI-SR-040 | Display usage information via `--help` or `-h` / `--help` または `-h` で使用方法を表示する | — |
| CLI-SR-041 | Display version information via `--version` / `--version` でバージョン情報を表示する | — |

### 3.6 Serve Mode (HTTP API) / serve モード（HTTP API）

Triggered by the literal subcommand `serve` as the first argument (`neoceg serve [...]`). In this mode the process does not read stdin or exit after one job; it binds a TCP port and serves the HTTP API defined in §7 until terminated. The batch-mode options (`-o`, `--coverage`, `--svg`, `--all-combinations`) are **not** accepted in serve mode — the equivalent selection is made per-request via the `mode` / `format` body fields (§7.2).

`serve` を第1引数のリテラルサブコマンドとして与えると起動する（`neoceg serve [...]`）。このモードでは stdin を読まず1ジョブで終了もしない。TCP ポートに bind し、終了させるまで §7 の HTTP API を提供する。バッチモードのオプション（`-o`・`--coverage`・`--svg`・`--all-combinations`）は serve モードでは**受け付けない** — 相当する選択はリクエストごとに `mode` / `format` ボディフィールド（§7.2）で行う。

| ID | Requirement / 要件 | Parent / 親 |
|----|----------|--------|
| CLI-SR-050 | Start a long-running HTTP server on the literal `serve` subcommand, reusing the same core (`src/services/`) as batch mode / リテラル `serve` サブコマンドで長時間稼働の HTTP サーバを起動し、バッチモードと同じコア（`src/services/`）を再利用する | CLI-UR-005 |
| CLI-SR-051 | Expose `GET /health` (liveness) and `POST /generate` (process a model), per the §7 contract / §7 の契約に従い `GET /health`（死活）と `POST /generate`（モデル処理）を提供する | CLI-UR-005 |
| CLI-SR-052 | Accept the `.nceg` source in the request body and select the output via `mode` (`decision-table` \| `all-combinations` \| `coverage` \| `svg`) and `format` (`json` \| `csv` \| `svg`) fields — the same four outputs as batch mode / `.nceg` ソースをリクエストボディで受け取り、出力を `mode`（`decision-table`｜`all-combinations`｜`coverage`｜`svg`）と `format`（`json`｜`csv`｜`svg`）フィールドで選択する（バッチモードと同じ4出力） | CLI-UR-005 |
| CLI-SR-053 | For `format: "csv"` and `mode: "svg"`, return bytes identical to the corresponding batch-mode output (CLI-NF-003); `format: "json"` returns the structured shapes in §7.3 over the same underlying table / `format: "csv"` および `mode: "svg"` は対応するバッチ出力とバイト同一を返す（CLI-NF-003）。`format: "json"` は同一の基盤テーブル上で §7.3 の構造化形状を返す | CLI-UR-005 |
| CLI-SR-054 | Return every error as a JSON object `{"error": {"type": "...", "message": "..."}}` with the HTTP status mapped in §7.4; never emit a partial or substitute output (mirrors CLI-SR-015) / すべてのエラーを JSON オブジェクト `{"error": {"type": "...", "message": "..."}}` として §7.4 のステータスで返す。途中までの出力・代替出力を決して出さない（CLI-SR-015 と同型） | CLI-UR-005 |
| CLI-SR-055 | Send CORS headers per `--cors-origin` and answer `OPTIONS` preflight, per §7.5 / `--cors-origin` に従い CORS ヘッダを送出し、`OPTIONS` プリフライトに応答する（§7.5） | CLI-UR-005 |
| CLI-SR-056 | Apply request guardrails — request-body size cap and per-IP rate limit — configurable by environment variable, per §7.6 / リクエストガードレール（ボディサイズ上限・IP 単位のレート制限）を環境変数で構成し適用する（§7.6） | CLI-UR-005 |
| CLI-SR-057 | Add no runtime dependency for the server: implement on Node's built-in `http` module only (consistent with CLI-NF-022) / サーバ用の実行時依存を追加しない。Node 組み込みの `http` モジュールのみで実装する（CLI-NF-022 と整合） | CLI-UR-005 |

**Serve-mode options / serve モードオプション**:

When invoked as `neoceg serve [...]`, only the following options apply:

`neoceg serve [...]` として起動したとき、以下のオプションのみが適用される：

| Option / オプション | Default / 既定 | Purpose / 用途 |
|------|--------|---------|
| `--host HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` for container use. / bind アドレス。コンテナ利用時は `0.0.0.0`。 |
| `--port PORT` | `8091` | TCP port. / TCP ポート。 |
| `--cors-origin ORIGIN` | `*` | Value for `Access-Control-Allow-Origin`. Set explicitly (e.g. the GUI origin) outside dev. / `Access-Control-Allow-Origin` の値。開発以外では明示指定（例：GUI オリジン）。 |

**Rule Scenario / ルールシナリオ**:

CLI-SR-050 + CLI-SR-051:
```
[Context]  A caller needs decision tables over HTTP
[Action]   Operator runs: neoceg serve --host 0.0.0.0 --port 8091
[Outcome]  The process binds 0.0.0.0:8091 and serves GET /health and
           POST /generate until terminated; GET /health returns
           {"status":"ok","version":"<x.y.z>"}
```

---

## 4. Non-Functional Requirements / 非機能要件

### 4.1 Compatibility / 互換性

| ID | Requirement / 要件 |
|----|----------|
| CLI-NF-001 | Run on Node.js LTS (v18+) / Node.js LTS（v18以降）で動作する |
| CLI-NF-002 | Work on Linux, macOS, and Windows / Linux、macOS、Windows で動作する |
| CLI-NF-003 | Produce output identical to the GUI application for the same input / 同一入力に対して GUI アプリケーションと同一の出力を生成する |

### 4.2 Distribution / 配布

| ID | Requirement / 要件 |
|----|----------|
| CLI-NF-010 | Executable via `npx neoceg` without global installation / グローバルインストールなしで `npx neoceg` により実行可能とする |
| CLI-NF-011 | Installable globally via `npm install -g neoceg` / `npm install -g neoceg` によりグローバルインストール可能とする |

### 4.3 Design Constraints / 設計制約

| ID | Constraint / 制約 |
|----|----------|
| CLI-NF-020 | Reuse existing core logic in `src/services/` without modification / `src/services/` の既存コアロジックを変更なしで再利用する |
| CLI-NF-021 | No browser or DOM dependency / ブラウザまたは DOM への依存なし |
| CLI-NF-022 | Minimal additional dependencies / 追加依存パッケージは最小限とする |

---

## 5. Future Considerations / 将来の検討事項

The following are explicitly out of scope for v1.0 but are anticipated for future versions.

以下は v1.0 のスコープ外であるが、将来のバージョンで想定される。

| Item / 項目 | Description / 説明 |
|------|---------|
| GraphViz integration / GraphViz 統合 | Automatic layout generation when `@layout` is absent, producing cleaner graph output / `@layout` がない場合の自動レイアウト生成、より整ったグラフ出力 |
| Multiple output in single invocation / 一回の呼び出しで複数出力 | Generate decision table + coverage table + SVG in a single run / デシジョンテーブル＋カバレッジ表＋SVG を一回の実行で生成 |
| Watch mode / ウォッチモード | Re-run on file change for development workflows / 開発ワークフロー向けのファイル変更時自動再実行 |

> **Promoted / 昇格**: "API server" and "JSON output format", previously listed here, are now specified requirements — serve mode (§3.6) exposes the HTTP API (§7), whose `format: "json"` responses (§7.3) are the structured output. / 従来ここにあった「API サーバー」「JSON 出力形式」は正式要件へ昇格した。serve モード（§3.6）が HTTP API（§7）を提供し、その `format: "json"` 応答（§7.3）が構造化出力である。

---

## 6. Usage Summary / 使用方法概要

```
neoceg [options] [input-file]

Input:
  input-file          Path to .nceg file (default: stdin)

Output options:
  -o, --output FILE   Write output to FILE (default: stdout)
  --coverage          Output coverage table CSV instead of decision table
  --all-combinations              Output the full decision table (all 2^n combinations,
                      with per-column feasibility flags) instead of the
                      optimized one; errors if 2^n > 256
  --svg               Output cause-effect graph as SVG

Information:
  -h, --help          Show help message
  --version           Show version number

Examples:
  neoceg input.nceg                          # Optimized decision table to stdout
  neoceg -o dt.csv input.nceg                # Optimized decision table to file
  neoceg --all-combinations input.nceg                   # Full (2^n) decision table to stdout
  neoceg --all-combinations -o all.csv input.nceg        # Full decision table to file
  neoceg --coverage input.nceg               # Coverage table to stdout
  neoceg --coverage -o cov.csv input.nceg    # Coverage table to file
  neoceg --svg -o graph.svg input.nceg       # Graph SVG to file
  cat input.nceg | neoceg                    # Pipe from stdin
  cat input.nceg | neoceg --svg > graph.svg  # Pipe with SVG output
```

**Serve mode / serve モード**:

```
neoceg serve [options]

Options:
  --host HOST            Bind address (default: 127.0.0.1; use 0.0.0.0 in a container)
  --port PORT            TCP port (default: 8091)
  --cors-origin ORIGIN   Access-Control-Allow-Origin value (default: *)

Examples:
  neoceg serve                                   # Serve on 127.0.0.1:8091
  neoceg serve --host 0.0.0.0 --port 8091        # Container / LAN use
  neoceg serve --cors-origin https://neoceg.app  # Restrict CORS to the GUI origin
```

See §7 for the HTTP API contract. / HTTP API 契約は §7 を参照。

---

## 7. HTTP API Reference / HTTP API リファレンス

Launched with `neoceg serve` (§3.6). Implemented on Node's built-in `http` module — no runtime dependency beyond the Node standard library (CLI-NF-022, CLI-SR-057). Default bind: `127.0.0.1:8091`.

`neoceg serve`（§3.6）で起動する。Node 組み込みの `http` モジュール上に実装し、Node 標準ライブラリ以外の実行時依存を持たない（CLI-NF-022・CLI-SR-057）。既定 bind は `127.0.0.1:8091`。

The server is a JSON/text transport over the same core the batch CLI uses: `parseLogicalDSL` → `generateOptimizedDecisionTableWithState` / `generateLearningModeTable` / `generateCoverageTableFromState` / `generateGraphSVG`. For `format: "csv"` and `mode: "svg"` it reuses the batch CSV/SVG generators verbatim, so those bytes are identical to batch mode (CLI-NF-003). `format: "json"` serializes the same in-memory table (§7.3).

本サーバは、バッチ CLI と同じコア（`parseLogicalDSL` →
`generateOptimizedDecisionTableWithState` / `generateLearningModeTable` /
`generateCoverageTableFromState` / `generateGraphSVG`）上の JSON/テキスト転送層である。`format: "csv"` と `mode: "svg"` はバッチの CSV/SVG 生成器をそのまま再利用するため、バイト単位でバッチモードと同一（CLI-NF-003）。`format: "json"` は同一のメモリ上テーブルを直列化する（§7.3）。

### 7.1 Endpoints / エンドポイント

| Method | Path | Purpose / 目的 |
|---|---|---|
| `GET` | `/health` | Liveness probe. Returns `{"status": "ok", "version": "<x.y.z>"}`. Safe to poll at high frequency. / 死活監視。高頻度ポーリング可。 |
| `POST` | `/generate` | Parse a `.nceg` model and produce the selected output. Body shape in §7.2. / `.nceg` をパースし選択出力を生成。ボディは §7.2。 |
| `OPTIONS` | `*` | CORS preflight. Echoes `Access-Control-Allow-Origin` per `--cors-origin`. / CORS プリフライト。 |

Successful `format: "json"` responses use `Content-Type: application/json; charset=utf-8`; `format: "csv"` uses `text/csv; charset=utf-8`; `mode: "svg"` uses `image/svg+xml; charset=utf-8`. Errors are always JSON (§7.4).

`format: "json"` の成功応答は `application/json; charset=utf-8`、`format: "csv"` は `text/csv; charset=utf-8`、`mode: "svg"` は `image/svg+xml; charset=utf-8`。エラーは常に JSON（§7.4）。

### 7.2 POST /generate — request / リクエスト

```json
{
  "source": "A: \"input\"\nE := A\n@layout {\n  A: (100, 100)\n  E: (300, 100)\n}",
  "mode": "decision-table",
  "format": "json"
}
```

(`source` is NeoCEG DSL: a cause is `id: "label"`, an effect is `id := expression`, and the optional `@layout { id: (x, y[, w]) }` block carries coordinates — required only for `mode: "svg"`. See [DSL_Grammar_Specification.md](./DSL_Grammar_Specification.md).) / (`source` は NeoCEG DSL：原因は `id: "label"`、結果は `id := 式`、任意の `@layout { id: (x, y[, w]) }` が座標を持つ（`mode: "svg"` のときのみ必須）。)

| Field | Type | Default | Notes / 備考 |
|---|---|---|---|
| `source` | string | — (required) | The `.nceg` model text. Required and non-empty. / `.nceg` モデル本文。必須・非空。 |
| `mode` | `"decision-table"` \| `"all-combinations"` \| `"coverage"` \| `"svg"` | `"decision-table"` | Which output to produce — the batch modes of §3.2. / 生成する出力。§3.2 のバッチモードに対応。 |
| `format` | `"json"` \| `"csv"` \| `"svg"` | mode-dependent | Serialization. For `decision-table` / `all-combinations` / `coverage`: `json` (default) or `csv`. For `mode: "svg"`: only `svg` (the default and sole valid value). Any other pairing is `invalid_request` (§7.4). / 直列化。表系は `json`（既定）か `csv`。`mode: "svg"` は `svg` のみ（既定かつ唯一）。それ以外の組合せは `invalid_request`（§7.4）。 |

Callers that just want the optimized decision table as JSON can send only `source` (all other fields default). / 最適化デシジョンテーブルを JSON で得たいだけなら `source` のみ送ればよい（他は既定）。

### 7.3 POST /generate — response (200 OK) / レスポンス

**`mode: "decision-table"` or `"all-combinations"`, `format: "json"`** — mirrors the in-memory `DecisionTable` (`src/types/decisionTable.ts`), with `Map` fields flattened to JSON objects. `decision-table` includes only feasible conditions (as batch mode via `getFeasibleConditions`); `all-combinations` includes all 2^n conditions, each carrying `excluded` + `exclusionReason`:

**`mode: "decision-table"`／`"all-combinations"`, `format: "json"`** — メモリ上の `DecisionTable`（`src/types/decisionTable.ts`）を写し、`Map` フィールドを JSON オブジェクトへ平坦化する。`decision-table` は実行可能条件のみ（バッチの `getFeasibleConditions` と同じ）、`all-combinations` は全 2^n 条件を含み各条件が `excluded` ＋ `exclusionReason` を持つ：

```json
{
  "mode": "decision-table",
  "causes":        [{ "id": "A", "label": "input" }],
  "intermediates": [],
  "effects":       [{ "id": "E", "label": "output" }],
  "conditions": [
    { "id": 1, "excluded": false, "exclusionReason": null,
      "values": { "A": "T", "E": "T" } },
    { "id": 2, "excluded": false, "exclusionReason": null,
      "values": { "A": "F", "E": "F" } }
  ],
  "constraints": [
    { "id": "c1", "type": "ONE", "memberIds": ["A", "B"], "description": "..." }
  ],
  "stats": {
    "totalConditions": 2, "feasibleConditions": 2,
    "infeasibleCount": 0, "weakCount": 0, "untestableCount": 0
  },
  "warnings": []
}
```

- **`causes` / `intermediates` / `effects`** — node id + resolved label, in the same display (y-sorted) order the CSV uses.
- **`conditions[]`** — one decision-table column each. `values` maps node id → `TruthValue` (`"T"`/`"F"`/`"t"`/`"f"`/`"M"`/`"I"`, per `src/types/decisionTable.ts`). `excluded` is `true` only in `all-combinations`; `exclusionReason` is `null` or `{ "type", "constraintId"?, "subsumedBy"?, "explanation" }`.
- **`constraints[]`** — `{ id, type, memberIds, description }` for traceability.
- **`warnings[]`** — non-fatal diagnostics the batch CLI writes to stderr (e.g. unreachable effects), surfaced in-payload; the HTTP status stays `200`. Empty when there are none.

**`mode: "coverage"`, `format: "json"`** — mirrors the in-memory `CoverageTable` (`src/types/coverageTable.ts`):

**`mode: "coverage"`, `format: "json"`** — メモリ上の `CoverageTable`（`src/types/coverageTable.ts`）を写す：

```json
{
  "mode": "coverage",
  "nodes": [{ "id": "A", "label": "input" }, { "id": "E", "label": "output" }],
  "conditionIds": [1, 2],
  "rows": [
    {
      "expressionIndex": 1,
      "edge": { "source": "A", "target": "E", "negated": false, "label": "A→E", "type": "logical" },
      "requiredValues": { "A": "T" },
      "coverage": { "1": "covered", "2": "not_covered" },
      "isCovered": true, "isInfeasible": false, "isUntestable": false, "reason": ""
    }
  ],
  "stats": {
    "totalExpressions": 1, "coveredExpressions": 1,
    "infeasibleExpressions": 0, "untestableExpressions": 0, "coveragePercent": 100
  }
}
```

- **`coverage`** maps condition id (as a string key) → `CoverageMarker` (`"adopted"` / `"covered"` / `"not_covered"` / `"infeasible"` / `"untestable"`).

**`format: "csv"`** (any table/coverage mode) — the raw CSV, byte-identical to the corresponding batch output (`text/csv`). **`mode: "svg"`** — the raw SVG document (`image/svg+xml`), byte-identical to `neoceg --svg`.

**`format: "csv"`**（表・カバレッジ系）は生 CSV で、対応するバッチ出力とバイト同一（`text/csv`）。**`mode: "svg"`** は生 SVG 文書（`image/svg+xml`）で `neoceg --svg` とバイト同一。

### 7.4 POST /generate — error responses / エラー応答

All errors are `{"error": {"type": "...", "message": "..."}}`. No partial or substitute output is ever emitted (CLI-SR-054), mirroring the batch atomicity rule (CLI-SR-015).

すべてのエラーは `{"error": {"type": "...", "message": "..."}}`。途中までの出力・代替出力は一切出さない（CLI-SR-054）。バッチの原子性規則（CLI-SR-015）と同型。

| HTTP | `error.type` | Trigger / 契機 | Batch analogue / バッチ相当 |
|---|---|---|---|
| `400` | `parse_error` | The `.nceg` source is rejected by `parseLogicalDSL`. `message` carries the line/reason. / `.nceg` が `parseLogicalDSL` に拒否された。行と理由を `message` に含む。 | exit 1 (CLI-SR-031) |
| `400` | `invalid_request` | Malformed JSON, missing/empty `source`, unknown `mode`/`format`, or an invalid `mode`×`format` pairing. / JSON 不正、`source` 欠落/空、未知の `mode`/`format`、不正な `mode`×`format` 組合せ。 | — |
| `422` | `unsatisfiable` | The model parses but cannot yield the requested output: **all rules infeasible** (`decision-table`/`coverage`), **2^n > 256** (`all-combinations`), or **`@layout` absent** (`svg`). `message` states which. / パースは通るが要求出力を生成不能：全ルール実行不能（表/カバレッジ）、2^n>256（all-combinations）、`@layout` 欠如（svg）。 | exit 1 (CLI-SR-032 / CLI-SR-014 / CLI-SR-024) |
| `405` | `method_not_allowed` | Wrong HTTP method for the path. / パスに対する誤った HTTP メソッド。 | — |
| `500` | `internal_error` | Unexpected exception. Logged server-side; response carries a generic message. / 予期しない例外。サーバ側でログし、応答は一般化メッセージ。 | — |

### 7.5 CORS

- `Access-Control-Allow-Origin`: value of `--cors-origin` (default `*`).
- `Access-Control-Allow-Methods`: `GET, POST, OPTIONS`.
- `Access-Control-Allow-Headers`: `Content-Type`.
- Preflight responses are `204 No Content`.

The default `*` is for local development. In production set `--cors-origin` to the GUI origin. / 既定の `*` はローカル開発向け。本番では GUI オリジンを `--cors-origin` に設定する。

### 7.6 Guardrails / ガードレール

The API is designed to be **public and unauthenticated** (like the sibling demo APIs), so it is protected by guardrails, configurable by environment variable. Unlike a native-binary wrapper, NeoCEG runs pure in-process JS and invokes no subprocess, and `all-combinations` is already capped at 256 columns (CLI-SR-014) — so generation is inherently bounded and needs no execution timeout.

本 API は（姉妹デモ API と同様に）**公開・無認証**を前提とするため、環境変数で構成するガードレールで守る。ネイティブバイナリのラッパと異なり NeoCEG は純粋にインプロセスの JS で動きサブプロセスを起動しない。`all-combinations` は 256 列で既に上限化（CLI-SR-014）されており、生成は本質的に有界で実行タイムアウトを要しない。

| Variable / 変数 | Default / 既定 | Purpose / 用途 |
|---|---|---|
| `PORT` | (falls back to `--port`, `8091`) | HTTP listen port; read when a host platform injects it. / ホストが注入する待受けポート。 |
| `NEOCEG_ALLOWED_ORIGIN` | (falls back to `--cors-origin`, `*`) | CORS allow-origin when set via env instead of the flag. / フラグの代わりに env で指定する CORS オリジン。 |
| `NEOCEG_MAX_BODY_BYTES` | `2097152` (2 MiB) | Reject a larger request body with `413`. / これを超えるボディは `413` で拒否。 |
| `NEOCEG_RATE_LIMIT_PER_MIN` | `60` | Per-IP requests/min on `/generate` (`0` = off) → `429` over the cap. / `/generate` の IP 単位毎分上限（`0`=無効）→超過で `429`。 |

`413 payload_too_large` and `429 rate_limited` follow the §7.4 error shape. / `413 payload_too_large` と `429 rate_limited` も §7.4 のエラー形状に従う。

### 7.7 Determinism / 決定性

Identical request bodies yield byte-identical responses. The server sets no HTTP caching headers; clients MAY cache keyed by a hash of the request JSON. / 同一リクエストボディはバイト同一応答を返す。サーバは HTTP キャッシュヘッダを設定しない。クライアントはリクエスト JSON のハッシュをキーにキャッシュしてよい。

### 7.8 Deployment / デプロイ

Serve mode is containerized and co-located behind the shared reverse proxy alongside the sibling demo APIs (path-based, public, no auth), reached through a `/neoceg` prefix — the same pattern the sibling N-switch (`/nswitch`) and PICT (`/pict`) services use. The concrete wiring (a `neoceg-api` container running `neoceg serve --host 0.0.0.0 --port 8091` and a reverse-proxy `handle_path /neoceg/*` rule) lives in the shared deploy stack, added during implementation. The container binds `0.0.0.0`, runs as a non-root user, and sets `--cors-origin` to the GUI origin.

serve モードはコンテナ化し、姉妹デモ API と同居する形で共有リバースプロキシの背後に配置する（パスベース・公開・無認証）。到達は `/neoceg` プレフィックス経由 — 姉妹の N-switch（`/nswitch`）・PICT（`/pict`）と同一パターン。具体配線（`neoceg serve --host 0.0.0.0 --port 8091` を動かす `neoceg-api` コンテナと、リバースプロキシの `handle_path /neoceg/*` ルール）は共有デプロイスタックに置き、実装時に追加する。コンテナは `0.0.0.0` に bind し、非 root で動作し、`--cors-origin` を GUI オリジンに設定する。

### 7.9 Examples / 例

Liveness / 疎通:

```bash
curl http://localhost:8091/health
# → {"status": "ok", "version": "0.1.0"}
```

Optimized decision table as JSON (only `source` sent) / 最適化デシジョンテーブルを JSON で:

```bash
curl -X POST http://localhost:8091/generate \
  -H 'Content-Type: application/json' \
  -d '{ "source": "A: \"input\"\nE := A\n@layout {\n  A: (100, 100)\n  E: (300, 100)\n}" }'
```

Coverage table as CSV / カバレッジ表を CSV で:

```bash
curl -X POST http://localhost:8091/generate \
  -H 'Content-Type: application/json' \
  -d '{ "source": "...", "mode": "coverage", "format": "csv" }'
```

Graph SVG / グラフ SVG:

```bash
curl -X POST http://localhost:8091/generate \
  -H 'Content-Type: application/json' \
  -d '{ "source": "...", "mode": "svg" }' > graph.svg
```

---

## Document History / 変更履歴

| Date / 日付 | Version / バージョン | Change / 変更 |
|---|---|---|
| 2026-03-29 | 0.1 | Initial draft / 初版ドラフト |
| 2026-06-19 | 0.2 | Add full decision table output (CLI-UR-004, CLI-SR-013/014, `--all-combinations`), reusing the GUI learning-mode core. See ADR-001. / 完全デシジョンテーブル出力（CLI-UR-004・CLI-SR-013/014・`--all-combinations`）を追加。GUI 学習モードのコアを再利用。ADR-001 参照。 |
| 2026-07-12 | 0.3 | Add serve mode / HTTP API (CLI-UR-005, CLI-SR-050–057, §3.6, §7): `serve` subcommand exposing `GET /health` + `POST /generate` with JSON/CSV/SVG output over the same core, CORS and guardrails, deployed co-located behind the shared proxy at `/neoceg`. Promotes the former Future Considerations "API server" and "JSON output format". Contract mirrors the sibling N-switch HTTP API. / serve モード／HTTP API（CLI-UR-005・CLI-SR-050〜057・§3.6・§7）を追加：`serve` サブコマンドが同一コア上で `GET /health`＋`POST /generate`（JSON/CSV/SVG 出力）を提供し、CORS・ガードレールを備え、共有プロキシ背後の `/neoceg` に同居デプロイ。将来検討事項の「API サーバー」「JSON 出力形式」を昇格。契約は姉妹の N-switch HTTP API に準拠。 |
