# NeoCEG Requirements Specification / NeoCEG 要求仕様書

| Item / 項目 | Content / 内容 |
|------|---------|
| Document / 文書 | NeoCEG Requirements Specification / NeoCEG 要求仕様書 |
| Version / バージョン | 1.2 (Draft / ドラフト) |
| Created / 作成日 | 2026-01-25 |
| Status / 状態 | Under Review / レビュー中 |

---

## 1. Purpose / 目的

This document defines requirements for NeoCEG, a modern reimplementation of CEGTest.

本文書は NeoCEG（CEGTest の現代的再実装）の要件を定義する。

**Development Approach / 開発方針**: New implementation from scratch (not refactoring CEGTest 1.6).
新規実装（CEGTest 1.6のリファクタリングではない）。

### 1.1 Documentation Structure / ドキュメント構成

| Type / 種別 | Location / 場所 | Purpose / 目的 |
|------|----------|---------|
| Data (YAML) / データ | [requirements/](./requirements/) | Machine-readable, single source of truth / 機械可読、唯一の真実源 |
| View (Markdown) / ビュー | This document / 本文書 | Human-readable summary / 可読性の高い要約 |
| Traceability / トレーサビリティ | [Traceability.md](./Traceability.md) | Hierarchy diagrams with mermaid / mermaid による系統図 |

### 1.2 Writing Conventions / 記述規約

| Level / レベル | Format / 形式 | Example / 例 |
|-------|--------|---------|
| User Requirement / ユーザー要件 | Task expression / タスク表現 | "Review the graph" / "グラフをレビューする" |
| System Requirement / システム要件 | Verb + Object / 動詞＋目的語 | "Place node on canvas" / "ノードをキャンバスに配置する" |
| Rule Scenario / ルールシナリオ | Context → Action → Outcome | See below / 下記参照 |

**Rule Scenario Structure / ルールシナリオ構造**:
```
[Context / 前提]  When ... / ～の場合
[Action / 操作]   User does ... / ユーザーが～を行う
[Outcome / 結果]  System responds ... / システムが～を返す
```

---

## 2. User Requirements / ユーザー要件

> Source / 出典: [user_requirements.yaml](./requirements/user_requirements.yaml)

| ID | Task / タスク | Priority / 優先度 |
|----|------|----------|
| UR-001 | Review AI-generated graph / AIが生成したグラフをレビューする | High / 高 |
| UR-002 | Create cause-effect graph / 原因結果グラフを作成する | High / 高 |
| UR-003 | Derive test conditions / テスト条件を導出する | High / 高 |
| UR-004 | Confirm test condition coverage / テスト条件の網羅性を確認する | Medium / 中 |
| UR-005 | Understand deleted test conditions / 削除されたテスト条件を理解する | Medium / 中 |
| UR-006 | Save and share graph / グラフを保存・共有する | High / 高 |

---

## 3. System Requirements / システム要件

> Source / 出典: [system_requirements.yaml](./requirements/system_requirements.yaml)

### 3.1 Graph Editing / グラフ編集

| ID | Function / 機能 | Parent / 親 |
|----|----------|--------|
| SR-001 | Place node on canvas / ノードをキャンバスに配置する | UR-002 |
| SR-002 | Edit node properties / ノードプロパティを編集する | UR-002 |
| SR-003 | Delete node (with constraint cascade) / ノードを削除する（制約の連鎖削除含む） | UR-002 |
| SR-004 | Move node / ノードを移動する | UR-002 |
| SR-005 | Create logical relation / 論理関係を作成する | UR-002 |
| SR-006 | Edit logical relation / 論理関係を編集する | UR-002 |
| SR-007 | Delete logical relation / 論理関係を削除する | UR-002 |

**Node Properties / ノードプロパティ** (SR-002):
- Node name (label) - Unicode allowed including Japanese propositions/predicates
  ノード名（ラベル）- 日本語の命題・述語論理表現を含むUnicode文字可
- Logical operator (AND/OR) - only valid for nodes with multiple inputs / 論理演算子（AND/OR）- 複数入力を持つノードのみ有効
- Observability / 観測可能性
- Memo / メモ

**Node Display / ノード表示** (SR-002):

| Property / プロパティ | Value / 値 |
|----------|-------|
| Default width / デフォルト幅 | 150px (configurable / 設定可能) |
| Min/Max width / 最小・最大幅 | 80px - 400px |
| Width adjustment / 幅調整 | Mouse drag on border / 枠をマウスドラッグ |
| Text wrap / テキスト折返し | Auto-wrap (newline input not allowed) / 自動折返し（改行入力不可） |

> **Note / 注**: Node role (cause/intermediate/effect) is not editable. Derived from graph structure:
> ノードの役割（原因/中間/結果）は編集不可。グラフ構造から導出される：
> - in-degree 0 → cause / 原因
> - out-degree 0 → effect / 結果
> - otherwise → intermediate / 中間

**Constraint Cascade Rules / 制約の連鎖削除ルール** (SR-003):

| Constraint / 制約 | Min Nodes / 最小ノード数 | Cascade Behavior / 連鎖動作 |
|------------|-----------|------------------|
| ONE | 2 | < 2 nodes → auto-delete / ノード数<2 → 自動削除 |
| EXCL | 2 | < 2 nodes → auto-delete / ノード数<2 → 自動削除 |
| INCL | 2 | < 2 nodes → auto-delete / ノード数<2 → 自動削除 |
| REQ | 2 | Source or target deleted → auto-delete / 起点または終点削除 → 自動削除 |
| MASK | 2 | Trigger deleted → auto-delete; Target deleted → update set / トリガー削除 → 自動削除、ターゲット削除 → 集合更新 |

### 3.2 Constraints / 制約

> Reference / 参考: Myers, Badgett, Sandler "The Art of Software Testing" 3rd Ed., Ch.4

| ID | Function / 機能 | Definition / 定義 | Parent / 親 |
|----|----------|------------|--------|
| SR-010 | ONE constraint / ONE制約 | Exactly one must be true / 厳密に1つが真 | UR-002 |
| SR-011 | EXCL constraint / EXCL制約 | Cannot be true simultaneously / 同時に真になれない | UR-002 |
| SR-012 | INCL constraint / INCL制約 | At least one must be true / 少なくとも1つが真 | UR-002 |
| SR-013 | REQ constraint / REQ制約 | A implies B / AならばB | UR-002 |
| SR-014 | MASK constraint / MASK制約 | A makes {B,C,...} indeterminate / Aが{B,C,...}を不定にする | UR-002 |
| SR-015 | Edit/delete constraint / 制約を編集・削除する | - | UR-002 |
| SR-016 | Detect constraint contradiction / 制約矛盾を検出する | - | UR-002, UR-003 |

**Constraint Representation / 制約の表現**:
Constraints are represented as **dedicated constraint nodes** (not just labels on edges).
制約は**専用の制約ノード**として表現する（エッジ上のラベルではない）。

**Constraint Definitions / 制約定義** (based on Myers / Myers に基づく):

| Constraint | Label | Myers | Logic / 論理 | Cardinality / 多重度 | Direction / 方向 |
|------------|-------|-------|--------------|---------------------|------------------|
| ONE | One | O | ∑(nodes) = 1 | n-ary (n≥2) | Symmetric / 対称 |
| EXCL | Excl | E | ∑(nodes) ≤ 1 | n-ary (n≥2) | Symmetric / 対称 |
| INCL | Incl | I | ∑(nodes) ≥ 1 | n-ary (n≥2) | Symmetric / 対称 |
| REQ | Req | R | A → {B,C,...} | 1:n | Directional / 方向性あり |
| MASK | Mask | M | A=T → {B,C,...}=M | 1:n | Directional / 方向性あり |

**Constraint Details / 制約詳細**:

| Constraint | Formal Definition / 形式的定義 | Example / 例 |
|------------|-------------------------------|--------------|
| ONE | Exactly one of {A,B,...} must be true (forbids all-false) / {A,B,...}の厳密に1つが真（全偽禁止） | `ONE(user_input, file_input, api_input)` |
| EXCL | At most one of {A,B,...} can be true (all-false allowed) / {A,B,...}の高々1つが真（全偽許可） | `EXCL(admin_mode, guest_mode)` |
| INCL | At least one of {A,B,...} must be true (forbids all-false) / {A,B,...}の少なくとも1つが真（全偽禁止） | `INCL(email_notify, sms_notify)` |
| REQ | If A is true, then {B,C,...} must all be true / Aが真なら{B,C,...}すべて真 | `REQ(premium_user -> {advanced_features, priority_support})` |
| MASK | When A is true, {B,C,...} become indeterminate (Don't Care) / Aが真のとき{B,C,...}は不定になる | `MASK(offline_mode -> {server_response, latency})` |

**Contradiction Patterns / 矛盾パターン** (SR-016):

| Pattern / パターン | Reason / 理由 |
|---------|--------|
| ONE(A,B) + REQ(A→B) | ONE requires exactly one true, REQ forces both true when A=T / ONEは厳密に1つ真を要求、REQはA=T時に両方真を強制 |
| ONE(A,B) + ONE(B,C) | Two ONE constraints may require conflicting true nodes / 2つのONE制約が競合する真ノードを要求する可能性 |
| EXCL(A,B) + INCL(A,B) | EXCL forbids both true, INCL forbids both false / EXCLは両方真を禁止、INCLは両方偽を禁止 |
| REQ(A→B) + REQ(B→A) + EXCL(A,B) | REQ pair forces A=B, but EXCL forbids both true / REQペアはA=Bを強制、EXCLは両方真を禁止 |

### 3.3 Decision Table / デシジョンテーブル

| ID | Function / 機能 | Parent / 親 |
|----|----------|--------|
| SR-020 | Generate decision table / デシジョンテーブルを生成する | UR-003 |
| SR-021 | Display table values / テーブル値を表示する | UR-003 |
| SR-022 | Switch display mode / 表示モードを切り替える | UR-005 |
| SR-023 | Calculate indeterminate values correctly / 不定値を正しく計算する | UR-003 |
| SR-024 | Trace calculation result causes / 計算結果の原因を追跡する | UR-003, UR-004, UR-005 |

**Result Traceability / 結果トレーサビリティ** (SR-024):

| Result / 結果 | Traceability Info / トレーサビリティ情報 |
|--------|-------------------|
| I (Indeterminate / 不定) | MASK constraint ID + propagation path / MASK制約ID + 伝播経路 |
| Infeasible / 実行不能 | Violated constraint ID (ONE/EXCL/INCL/REQ) / 違反した制約ID |
| Untestable / テスト不能 | MASK constraint causing I in effect node / 結果ノードでIを引き起こすMASK制約 |
| Weak condition / 弱い条件 | Subsuming condition number(s) / 包含する条件番号 |

> Hover over cells to see cause; related constraints highlighted in graph view.
> セルにマウスオーバーで原因を表示、関連する制約がグラフビューでハイライト。

**Value Definitions / 値の定義** (SR-021):

| Value / 値 | Meaning / 意味 | Color / 色 |
|-------|---------|-------|
| T | The node is true / ノードが真である | Green / 緑 |
| t | Must logically be true (no matching combination in expressions) / 論理上真でならざるを得ない（該当する真偽の組合せが論理式にない） | Light green / 薄緑 |
| F | The node is false / ノードが偽である | Red / 赤 |
| f | Must logically be false (no matching combination in expressions) / 論理上偽でならざるを得ない（該当する真偽の組合せが論理式にない） | Light red / 薄赤 |
| M | Truth value cannot be determined due to MASK constraint / MASK制約により真偽が決定できない | Gray / 灰 |
| I | Truth value cannot be determined (cause-side node indeterminate) / 原因側のノードが真偽不明のため真偽が決定できない | Yellow / 黄 |

> **Note**: The T/t and F/f distinction applies to Practice Mode only. Learning Mode always displays uppercase T/F — it shows "what would happen if tested" without the expression-matching subtlety.
> **注意**：T/tおよびF/fの区別は実務モードのみに適用されます。学習モードでは常に大文字T/Fで表示し、「もしテストしたらどうなるか」を論理式マッチングの区別なしに表示します。

**Indeterminate Calculation Rules / 不定値計算ルール** (SR-023 - CEGTest 1.6 bug fix / バグ修正):

| Operation / 演算 | Result / 結果 | Reason / 理由 |
|-----------|--------|--------|
| M AND M | I | Both indeterminate / 両方不定 |
| M OR M | I | Both indeterminate / 両方不定 |
| M AND T | I | One indeterminate / 片方不定 |
| M AND F | F | F is certain, AND is F / Fは確定、ANDはF |
| M OR T | T | T is certain, OR is T / Tは確定、ORはT |
| M OR F | I | One indeterminate / 片方不定 |
| NOT T | F | Inversion / 反転 |
| NOT F | T | Inversion / 反転 |
| NOT M | M | Masked remains masked / マスクはマスクのまま |
| NOT I | I | Indeterminate remains indeterminate / 不定は不定のまま |

**Constraint NOT Evaluation / 制約NOTの評価**:

When a constraint has NOT on a member, the member's value is inverted before constraint logic is applied.
制約メンバーにNOTがある場合、制約ロジック適用前にメンバーの値を反転する。

| Constraint / 制約 | Case / ケース | Evaluation / 評価 |
|------------------|--------------|------------------|
| EXCL(A, NOT B) | A=T, B=T | effective: A=T, ¬B=F → ∑=1 ≤ 1 ✓ |
| EXCL(A, NOT B) | A=T, B=F | effective: A=T, ¬B=T → ∑=2 > 1 ✗ (infeasible) |
| REQ(A -> NOT B) | A=T, B=T | requires ¬B=T but ¬B=F ✗ (infeasible) |
| ONE(A, NOT B) | A=F, B=F | effective: A=F, ¬B=T → ∑=1 ✓ |

### 3.4 Coverage Table / カバレッジテーブル

| ID | Function / 機能 | Parent / 親 |
|----|----------|--------|
| SR-030 | Display coverage table / カバレッジテーブルを表示する | UR-004 |

**Coverage Markers / カバレッジマーカー** (SR-030):

| Marker / マーカー | Display / 表示 | Meaning / 意味 |
|---|---|---|
| Adopted / 採択 | `#` | First test to cover this expression / この式を最初にカバーするテスト |
| Covered / カバー済み | `x` | Additional test covering an already-covered expression / 既にカバー済みの式を追加でカバー |
| Not covered / 未カバー | (blank / 空白) | Test does not exercise this expression / このテストはこの式を検証しない |
| Infeasible / 実行不能 | `-` | Expression infeasible due to constraint violation / 制約違反のため実行不可 |
| Untestable / テスト不能 | `?` | Untestable due to MASK (result indeterminate) / MASK制約によりテスト不能 |

> **Note**: CEGTest 1.6 uses `||` (vertical hatching) for infeasible and `=` (horizontal hatching) for untestable. NeoCEG uses `-` and `?` as text-compatible alternatives, and distinguishes infeasible from untestable (a CEGTest 1.6 bug fix per 秋山浩一「ソフトウェアテストしようぜ」第236回).

### 3.5 Import/Export / インポート・エクスポート

| ID | Function / 機能 | Parent / 親 |
|----|----------|--------|
| SR-040 | Import DSL / DSLをインポートする | UR-001, UR-006 |
| SR-041 | Export DSL / DSLをエクスポートする | UR-006 |
| SR-042 | Export decision table / デシジョンテーブルをエクスポートする | UR-006 |
| SR-043 | Open from URL / URLから開く | UR-001, UR-006 |

**URL File Parameter / URLファイルパラメータ** (SR-043):

| Item / 項目 | Specification / 仕様 |
|---|---|
| Parameter / パラメータ | `?file=<URL>` |
| Protocol / プロトコル | HTTPS only (HTTP rejected) / HTTPSのみ（HTTP拒否） |
| CORS | Required on file host / ファイルホスト側で許可が必要 |
| On success / 成功時 | Import and display the graph / グラフをインポートして表示 |
| On failure / 失敗時 | Show error, start with empty canvas / エラー表示、空のキャンバスで起動 |
| No parameter / パラメータなし | Normal startup (empty canvas) / 通常起動（空のキャンバス） |

**File Format Specifications / ファイル形式仕様**:

| Format | Extension / 拡張子 | Encoding / 文字コード | Line Ending / 改行 | Note / 備考 |
|--------|-------------------|----------------------|-------------------|-------------|
| DSL | `.nceg` | UTF-8 (no BOM / BOM無し) | LF or CRLF (import) / LF (export) | NeoCEG graph definition / グラフ定義 |
| CSV | `.csv` | UTF-8 (no BOM / BOM無し) | CRLF (Excel compatible) | Decision table export / デシジョンテーブル出力 |

**Import Modes / インポートモード** (SR-040):

| Mode / モード | Behavior / 動作 |
|------|----------|
| Replace / 置換 | Discard existing graph, create new from DSL / 既存グラフを破棄し、DSLから新規作成 |
| Merge / マージ | Add to existing, update duplicate nodes by name / 既存に追加、重複ノードは名前で更新 |

**Error Classification / エラー分類** (SR-040):

| Category / カテゴリ | Error Type / エラー種別 | Handling / 対処 |
|----------|-----------|----------|
| Syntax / 構文 | Lexical/Parse error / 字句・構文エラー | Show line number, abort / 行番号表示、中断 |
| Semantic / 意味 | Undefined reference / 未定義参照 | List nodes, offer create/abort / ノード一覧表示、作成・中断を選択 |
| Semantic / 意味 | Circular reference / 循環参照 | Show path (A→B→C→A), abort / 経路表示、中断 |
| Semantic / 意味 | Self reference / 自己参照 | Show node, abort / ノード表示、中断 |
| Semantic / 意味 | Constraint contradiction / 制約矛盾 | Import with warning (SR-016) / 警告付きでインポート |

### 3.6 Data Persistence / データ永続化

| ID | Function / 機能 | Parent / 親 |
|----|----------|--------|
| SR-050 | Save to local storage / ローカルストレージに保存する | UR-006 |
| SR-051 | Save/load as file / ファイルとして保存・読込する | UR-006 |

### 3.7 Operation Support / 操作支援

| ID | Function / 機能 | Parent / 親 |
|----|----------|--------|
| SR-060 | Undo/redo operations / 操作を元に戻す・やり直す | UR-002 |
| SR-061 | Select elements / 要素を選択する | UR-002 |
| SR-062 | Zoom/pan canvas / キャンバスをズーム・パンする | UR-002 |
| SR-063 | Auto-layout nodes / ノードを自動レイアウトする | UR-001, UR-002 |

**Coordinate Handling / 座標処理** (SR-063):

| Condition / 条件 | Behavior / 動作 |
|-----------------|----------------|
| With coordinates / 座標あり | Place at specified positions / 指定位置に配置 |
| Without coordinates / 座標なし | Auto-layout (no error) / 自動配置（エラーにしない） |
| Partial coordinates / 一部座標あり | Place specified, auto-layout others / 指定分配置、残りは自動配置 |

**Auto-Layout Algorithm / 自動配置アルゴリズム** (SR-063):
- Causes (in-degree 0) on left, effects (out-degree 0) on right / 原因を左、結果を右に配置
- Minimum spacing to prevent overlap / 重ならないよう最小間隔を確保
- Future: GraphViz MCP integration for better hierarchical layout / 将来：GraphViz MCP連携で階層レイアウト改善

### 3.8 Visual Rendering / 描画仕様

**Node Rendering / ノード描画**:

| Role / 役割 | Color Fill / 塗り | Border / 枠線 | Monochrome / モノクロ |
|------------|------------------|--------------|----------------------|
| Cause / 原因 | Light blue (#e3f2fd) / 薄青 | Blue (#1976d2) / 青 | White, solid border / 白、実線枠 |
| Intermediate / 中間 | Light indigo (#e8eaf6) / 薄藍 | Indigo (#3949ab) / 藍 | Light gray, solid / 薄灰、実線 |
| Effect / 結果 | Light purple (#f3e5f5) / 薄紫 | Purple (#7b1fa2) / 紫 | Gray, solid / 灰、実線 |

**Edge Rendering / エッジ描画**:

Logical Relations / 論理関係:

| Type / 種別 | Color / 色 | Width / 太さ | Style / 線種 | Label / ラベル |
|------------|-----------|-------------|-------------|---------------|
| Positive / 正論理 | Dark gray (#333) / 濃灰 | 2px (thick / 太) | Solid / 実線 | - |
| Negative (NOT) / 負論理 | Blue (#1976d2) / 青 | 2px (thick / 太) | Solid / 実線 | "Not" |

Constraint Relations / 制約関係:

| Type / 種別 | Color / 色 | Width / 太さ | Style / 線種 | Label / ラベル |
|------------|-----------|-------------|-------------|---------------|
| Positive / 正論理 | Gray (#9e9e9e) / 灰 | 1px (thin / 細) | Dotted / 点線 | - |
| Negative (NOT) / 負論理 | Light blue (#64b5f6) / 薄青 | 1px (thin / 細) | Dotted / 点線 | "Not" |

> **Design Rationale / 設計根拠**:
> - Blue for NOT provides clear visual distinction from positive logic / 青のNOTは正論理と明確に区別可能
> - Thicker lines for logical relations vs thinner for constraints / 論理関係は太く、制約は細く
> - Both use "Not" label for consistency and monochrome support / 両方"Not"ラベルで一貫性とモノクロ対応

**Constraint Rendering / 制約描画**:

Constraints are displayed as **dedicated constraint nodes** with edges to member nodes.
制約は**専用の制約ノード**として表示し、メンバーノードへエッジを引く。

| Constraint | Color / 色 | Style / 線種 | Node Label | Monochrome / モノクロ |
|------------|-----------|-------------|------------|----------------------|
| ONE | Purple (#9c27b0) / 紫 | Dotted / 点線 | One | Dotted + One label / 点線＋Oneラベル |
| EXCL | Red (#f44336) / 赤 | Dashed / 破線 | Excl | Dashed + Excl label / 破線＋Exclラベル |
| INCL | Green (#4caf50) / 緑 | Dashed / 破線 | Incl | Dash-dot + Incl label / 一点鎖線＋Inclラベル |
| REQ | Blue (#2196f3) / 青 | Dotted / 点線 | Req | Dotted + Req label / 点線＋Reqラベル |
| MASK | Gray (#607d8b) / 灰 | Dotted / 点線 | Mask | Double-dotted + Mask label / 二重点線＋Maskラベル |

**NOT on Constraint Members / 制約メンバーのNOT**:

Symmetric constraints (ONE/EXCL/INCL) support NOT on any member.
対称制約（ONE/EXCL/INCL）は全メンバーにNOTを適用可能。

REQ constraint: NOT is allowed on **source or target side, but not both simultaneously**.
When both sides have NOT (e.g., `REQ(NOT A -> NOT B)`), the meaning becomes ambiguous and error-prone, so this is prohibited.
REQ制約：NOTは**ソース側またはターゲット側のいずれかに適用可能。ただし両方同時は禁止**。
両側にNOTがある場合（例：`REQ(NOT A -> NOT B)`）は意味が曖昧になりやすいため禁止。

MASK constraint: NOT is allowed on **trigger side only**. NOT is prohibited on targets.
MASK制約：NOTは**トリガー側のみ**許可。ターゲット側のNOTは禁止。

> **REQ vs MASK asymmetry in NOT handling / REQとMASKのNOT処理の非対称性**:
> REQ sets T/F values on targets. NOT reverses this (T→F), so target NOT is meaningful:
> REQはターゲットにT/Fを設定する。NOTで反転（T→F）するため、ターゲットNOTは意味がある：
> - `REQ(A -> B)`: A=T → B=**T**
> - `REQ(A -> NOT B)`: A=T → B=**F** (different result / 異なる結果)
>
> MASK sets M (Don't Care) on targets. NOT M = M, so target NOT produces the same result and is meaningless:
> MASKはターゲットにM（Don't Care）を設定する。NOT M = Mのため、ターゲットNOTは同じ結果になり無意味：
> - `MASK(A -> B)`: A=T → B=**M**
> - `MASK(A -> NOT B)`: A=T → B=**M** (same result / 同じ結果)

| Example / 例 | Meaning / 意味 |
|--------------|---------------|
| `EXCL(A, NOT B)` | A and ¬B cannot both be true / Aと¬Bは同時に真になれない |
| `ONE(A, NOT B, C)` | Exactly one of {A, ¬B, C} must be true / {A, ¬B, C}の厳密に1つが真 |
| `REQ(A -> B)` | If A=T then B must be T / A=Tなら B=T |
| `REQ(NOT A -> B)` | If A=F then B must be T / A=Fなら B=T |
| `REQ(A -> NOT B)` | If A=T then B must be F / A=Tなら B=F |
| `MASK(A -> B)` | If A=T then B is masked / A=TならBはマスク |
| `MASK(NOT A -> B)` | If A=F then B is masked / A=FならBはマスク |

> **Note / 注**: All visual elements must be distinguishable in monochrome print. Use line styles and labels, not just colors.
> すべての視覚要素はモノクロ印刷でも区別可能であること。色だけでなく線種とラベルを使用。

---

## 4. Non-Functional Requirements / 非機能要件

> Source / 出典: [nonfunctional_requirements.yaml](./requirements/nonfunctional_requirements.yaml)

### NFR-001: Performance / パフォーマンス

| Item / 項目 | Standard / 基準 |
|------|----------|
| Edit operation response / 編集操作の応答 | Within 100ms (up to 100 nodes) / 100ms以内（100ノードまで） |
| Decision table recalculation / デシジョンテーブル再計算 | Within 1 second (up to 100 nodes) / 1秒以内（100ノードまで） |
| DSL import / DSLインポート | Within 1 second (up to 1000 lines) / 1秒以内（1000行まで） |

### NFR-010: Usability / ユーザビリティ

| Item / 項目 | Standard / 基準 |
|------|----------|
| Main operations / 主要操作 | Completable with mouse only / マウスのみで完結 |
| Help / ヘルプ | Display via tooltips / ツールチップで表示 |
| First use / 初回利用 | Provide onboarding (tutorial) / オンボーディング（チュートリアル）を提供 |

### NFR-011: Error Handling / エラー処理

| Item / 項目 | Standard / 基準 |
|------|----------|
| Error messages / エラーメッセージ | Display in selected language (see NFR-040) / 選択言語で表示（NFR-040参照） |
| Data protection / データ保護 | Data is not lost on error / エラー時にデータを失わない |
| Syntax errors / 構文エラー | Display with line number / 行番号付きで表示 |

### NFR-020: Browser Compatibility / ブラウザ互換性

| Item / 項目 | Standard / 基準 |
|------|----------|
| Primary / 主要 | Chrome latest version / Chrome最新版 |
| Secondary / 副次 | Firefox, Safari, Edge latest versions / Firefox, Safari, Edge 最新版 |
| Out of scope / 対象外 | Mobile browsers (future consideration) / モバイルブラウザ（将来検討） |

### NFR-030: Code Quality / コード品質

| Item / 項目 | Standard / 基準 |
|------|----------|
| Type safety / 型安全性 | Implemented in TypeScript / TypeScriptで実装 |
| Testability / テスト容易性 | Design testable at component level / コンポーネント単位でテスト可能な設計 |
| Modularity / モジュール性 | DSL parser as independent module / DSLパーサーを独立モジュール化 |

### NFR-040: Internationalization / 国際化

| Item / 項目 | Standard / 基準 |
|------|----------|
| Supported languages / 対応言語 | English (EN), Japanese (JA) / 英語、日本語 |
| UI language switch / UI言語切替 | User can switch in settings / 設定で切り替え可能 |
| Default language / デフォルト言語 | Follow browser locale setting / ブラウザのロケール設定に従う |
| DSL keywords / DSLキーワード | English only (AND, OR, NOT, ONE, EXCL, INCL, REQ, MASK) / 英語のみ |
| Node labels / ノードラベル | Unicode characters allowed (including Japanese) / Unicode文字可（日本語含む） |
| Error messages / エラーメッセージ | Display in selected language / 選択言語で表示 |

---

## 5. Glossary / 用語集

| Term / 用語 | Definition / 定義 |
|------|------------|
| Node / ノード | Logical gate (AND/OR) or input point. Has label and logical operator / 論理ゲート（AND/OR）または入力点。ラベルと論理演算子を持つ |
| Node role / ノード役割 | Classification derived from graph structure. in-degree 0=cause, out-degree 0=effect, otherwise=intermediate / グラフ構造から導出される分類。入次数0=原因、出次数0=結果、それ以外=中間 |
| Logical operator / 論理演算子 | Operation combining node inputs (AND/OR). Not needed for in-degree 0 nodes / ノード入力を結合する演算（AND/OR）。入次数0のノードには不要 |
| Logical relation / 論理関係 | AND/OR/NOT connection between nodes (edge) / ノード間のAND/OR/NOT接続（エッジ） |
| NOT (negative logic) / 負論理 | Inversion of truth value. Used on both logical edges and constraint members / 真偽値の反転。論理エッジと制約メンバーの両方で使用 |
| Constraint / 制約 | Restriction on value combinations between nodes / ノード間の値組み合わせに対する制限 |
| Decision table / デシジョンテーブル | Test conditions in table format / テスト条件の表形式 |
| Coverage table / カバレッジテーブル | Coverage status of each logical expression / 各論理式の網羅状況 |
| Weak test condition / 弱いテスト条件 | Condition subsumed by other test conditions / 他のテスト条件に包含される条件 |
| Infeasible / 実行不能 | Condition that cannot be executed due to constraints / 制約により実行できない条件 |
| Untestable / テスト不能 | Condition with indeterminate input, result cannot be judged / 不定入力を持ち、結果が判定できない条件 |
| DSL | Domain Specific Language (NeoCEG-specific language) / ドメイン固有言語（NeoCEG専用言語） |

---

## 6. Related Documents / 関連文書

- [DSL Grammar Specification / DSL文法仕様](./DSL_Grammar_Specification.md) - Formal EBNF definition / 正式EBNF定義
- [Traceability Diagram / トレーサビリティ図](./Traceability.md) - Hierarchy diagram with mermaid / mermaid による系統図
- [Modernization Goals and Design / モダナイゼーション目標と設計](./Modernization_Goals_and_Design.md)
- [CEGTest 1.6 Feature Analysis / CEGTest 1.6 機能分析](./CEGTest_1.6_Feature_Analysis.md)

---

## 7. Change History / 変更履歴

| Date / 日付 | Version / バージョン | Changes / 変更内容 | Author / 著者 |
|------|---------|---------|--------|
| 2026-01-25 | 0.1 | Initial draft / 初版ドラフト | - |
| 2026-01-25 | 0.2 | Rewrite with Value Engineering style / バリューエンジニアリング形式で書き直し | - |
| 2026-01-25 | 0.3 | Fix node concept, DSL English keywords, i18n / ノード概念修正、DSL英語キーワード、i18n | - |
| 2026-01-25 | 0.4 | YAML data + Markdown view structure, traceability diagram / YAML + Markdown構成、トレーサビリティ図 | - |
| 2026-01-26 | 0.5 | Add SR-016 constraint contradiction detection / SR-016 制約矛盾検出追加 | - |
| 2026-01-26 | 0.6 | Add SR-003 constraint cascade rules on node deletion / SR-003 ノード削除時の制約連鎖ルール追加 | - |
| 2026-01-26 | 0.7 | Add SR-024 calculation result traceability / SR-024 計算結果トレーサビリティ追加 | - |
| 2026-01-26 | 0.8 | Enhance SR-040 with error classification and import modes / SR-040 エラー分類とインポートモード強化 | - |
| 2026-02-01 | 0.9 | Convert to bilingual format (EN/JA) / バイリンガル形式（英日）に変換 | - |
| 2026-02-01 | 1.0 | Add constraint definitions (Myers), file formats, rendering specs, auto-layout / 制約定義（Myers）、ファイル形式、描画仕様、自動配置追加 | - |
| 2026-02-01 | 1.1 | REQ 1:n, constraint node representation, labels One/Excl/Incl/Req/Mask, reimplementation approach / REQ 1:n対応、制約ノード表現、ラベル変更、新規実装方針 | - |
| 2026-02-01 | 1.2 | NOT support on both logical and constraint edges / 論理エッジと制約エッジの両方にNOTサポート追加 | - |
| 2026-02-08 | 1.3 | Finalized DSL grammar specification, added reference / DSL文法仕様確定、参照追加 | - |

---

## Appendix A: DSL Syntax Example / 付録A: DSL構文例

**Formal Specification / 正式仕様**: Complete EBNF grammar and semantic rules are defined in [DSL_Grammar_Specification.md](./DSL_Grammar_Specification.md).

**正式仕様**: 完全なEBNF文法と意味規則は [DSL_Grammar_Specification.md](./DSL_Grammar_Specification.md) で定義されています。

```
// NeoCEG DSL
@title "Login Feature Test"

// Logical relations (node roles derived from graph structure)
// 論理関係（ノード役割はグラフ構造から導出）
auth_success := valid_user_id AND password_match
login_result := auth_success OR sso_auth
error_display := NOT auth_success AND NOT sso_auth

// Constraints / 制約
EXCL(admin_mode, guest_mode)
MASK(guest_mode -> {valid_user_id, password_match})

// Layout coordinates (optional) / レイアウト座標（任意）
@layout {
  "valid_user_id": {"x": 100, "y": 50},
  "password_match": {"x": 100, "y": 150}
}
```

**NOT on Constraint Members / 制約メンバーのNOT**:

```
// NOT can be used on constraint member references
// 制約メンバー参照にNOTを使用可能

// EXCL with NOT: premium and ¬free_tier cannot both be true
// → If premium=T, then free_tier must be T (NOT free_tier=F)
EXCL(premium, NOT free_tier)

// ONE with NOT: exactly one of {active, ¬suspended, verified} is true
ONE(active, NOT suspended, verified)

// REQ with NOT on target: if admin=T then guest must be F
REQ(admin -> NOT guest)

// INCL with NOT: at least one of {enabled, ¬disabled} must be true
INCL(enabled, NOT disabled)
```

> **Note / 注**: DSL keywords (AND, OR, NOT, EXCL, etc.) are English only. Node labels can use Unicode characters (including Japanese).
> DSLキーワード（AND, OR, NOT, EXCL等）は英語のみ。ノードラベルはUnicode文字（日本語含む）が使用可能。
