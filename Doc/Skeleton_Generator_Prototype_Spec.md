# Skeleton Generator — Prototype Specification / スケルトン生成器 プロトタイプ仕様

> Status: **Prototype (experimental, standalone)** / 状態: **プロトタイプ（実験的・独立プログラム）**
> This document specifies a *separate, standalone* program — **not** a feature of NeoCEG (yet).
> 本書は NeoCEG 本体の機能ではなく、*独立した別プログラム* の仕様を定める。将来の統合は §9 を参照。

---

## 1. Purpose & Scope / 目的と範囲

**EN.** Mechanically derive a program control-structure *skeleton* (nested `if/else` plus action stubs)
from a Cause-Effect-Graph **decision table**. The transformation is fully **deterministic** and uses
**no AI/ML** — it is classic "decision table → decision tree → code" compilation.

**JA.** 原因結果グラフの**デシジョンテーブル**から、プログラムの制御構造**スケルトン**
（ネストした `if/else` ＋ 動作スタブ）を機械的に導く。変換は完全に**決定論的**であり、
**AI/ML を一切用いない**。古典的な「デシジョンテーブル → 決定木 → コード」コンパイルである。

### In scope / 対象
- Decision table (feasible/optimized form) → skeleton text / デシジョンテーブル（実行可能・最適化形）→ スケルトン文字列
- Deterministic decision-tree construction with don't-care pruning / don't-care 枝刈り付きの決定論的決定木構成
- One pluggable code emitter (default: pseudo-code) / 差し替え可能なコード出力器（既定: 擬似コード）

### Out of scope / 非対象
- Action *bodies* (the real implementation of each effect) — emitted as `// TODO` stubs
  / 動作の*本体*（各効果の実装）— `// TODO` スタブとして出力
- Globally minimal tree (NP-hard) — only "sufficiently simple" is targeted
  / 大域最小の木（NP困難）— 目標は「十分にシンプル」のみ
- Integration into NeoCEG UI / NeoCEG UI への組み込み

---

## 2. Why this is mechanical / 機械化が成立する根拠

**EN.** The decision table is **already pruned with the same principle as MC/DC coverage**
(admission fee: 256 → 7). Each remaining column is therefore a *necessary control path*, and **the number
of columns is the number of control paths the program needs**. The pruning is **done**; the converter does
**not** re-derive it. Building the skeleton = **rendering the existing columns as control paths**,
optionally factored into a nested `if/else`. Everything needed is in the table:

| Need / 必要な情報 | Source in decision table / テーブル内の出所 |
|---|---|
| Control paths (one per column) / 制御パス（列＝1本） | each non-excluded `conditions[]` column |
| Action that fires on a path / そのパスで起きる動作 | the effect cell at uppercase **`T`** (controlling-true) |
| Conditions evaluated on a path / パス上で評価される条件 | the column's cell values (causes + intermediates) |
| Already-minimal path set / 既に最小化されたパス集合 | the table is pre-pruned (MC/DC-style, 256 → 7) |
| Shared structure for nesting / ネストの共有構造 | conditions shared across columns ↔ shared predecessors in the CEG |

**EN (on cell case).** The `T`/`F` vs `t`/`f` distinction marks, *per node*, whether a value is
**controlling (significant)** or **derived**. It explains *why* the table is already minimal and is *how*
a column's firing effect is identified (its uppercase `T` effect). It is **not** a don't-care signal on
*inputs*: in a test method every cause is a determined input, so there is no native input don't-care to
exploit, and the converter performs no further pruning.

**JA.** デシジョンテーブルは **MC/DC カバレッジと同じ考え方で既に枝刈り済み**（入館料: 256 → 7）。
ゆえに残った各列は*必要な制御パス*であり、**列の数 ＝ プログラムに必要な制御パスの数**。枝刈りは
**完了している**ので、変換器はそれを**やり直さない**。スケルトン構築とは **既存の列を制御パスとして
レンダリングする**ことであり、必要なら `if/else` のネストに factoring するだけ（上表）。

セルの **大文字 `T`/`F`（効いている＝制御値）** と **小文字 `t`/`f`（派生）** の区別は、*ノードごとに*
値が制御値か派生値かを示す。これは*なぜ*テーブルが既に最小かを説明し、*列の動作*（その列で大文字
`T` の効果）を特定する手段でもある。**入力の don't-care 信号ではない** — テスト手法では全原因が確定
入力であり、利用できる入力 don't-care は native に存在せず、変換器は追加の枝刈りを一切行わない。

---

## 3. Input & internal model / 入力と内部モデル

**EN.** The *only* external input is **CSV** — the *same* decision-table layout this tool already exports
(`csvGenerator.generateDecisionTableCSV`). Therefore: tool export → prototype input needs **no
conversion**, and a human can author the same shape in **Excel / Google Sheets**. The CSV is parsed into an
internal data model (`SkeletonInput`, §3.2); that model — *not* an input format — is the structure the
converter operates on and the design anchor for future NeoCEG integration (§9).

**JA.** 外部入力は **CSV** *のみ* — 本ツールが既に出力するデシジョンテーブル形式
（`csvGenerator.generateDecisionTableCSV`）と*同一*。ゆえにツール出力 → プロトタイプ入力は
**無変換**で接続でき、人間も **Excel / Google スプレッドシート**で同じ形を作れる。
CSV は内部データモデル（`SkeletonInput`, §3.2）にパースされる。このモデルは*入力形式ではなく*、
変換器が操作する構造であり、将来の NeoCEG 統合（§9）の設計アンカーでもある。

### 3.1 CSV format / CSV 形式

Layout = **nodes as rows, rules as columns** (this tool's convention).
レイアウト = **ノードが行・規則が列**（本ツールの規約）。

| ID | Classification | Observable | Logical Statement | #1 | #2 | … |
|----|----------------|-----------|-------------------|----|----|---|
| *(Status)* | | | | Adopted | Infeasible | … |  ← optional row / 任意行 |
| n1 | Cause | Fixed | Individual | T | f | … |
| n9 | Intermediate | Yes | n5 AND n7 | t | F | … |
| e1 | Effect | Yes | Free | T | f | … |

Column semantics / 列の意味:
- **ID** → node id / ノードID
- **Classification** → `Cause` / `Intermediate` / `Effect` — drives the row's role (localized values accepted) / 行の役割を決定（ローカライズ値も許容）
- **Observable** → ignored by the converter / 変換器は無視
- **Logical Statement** → used as label/comment; if it is a boolean expression (e.g. `n5 AND n7`) it enables intermediate-variable emission (§6 `keep`) / ラベル/コメント。ブール式なら中間変数出力に使用
- **#1..#N** → per-rule cell value / 規則ごとのセル値

Cell value & don't-care / セル値と don't-care:

| Cell / セル | Meaning / 意味 | Branch? / 分岐 |
|---|---|---|
| `T` / `F` | controlling (significant) / 制御値 | **yes / する** |
| `t` / `f` | derived, tool-computed / 派生（ツール算出） | no — don't-care / しない |
| blank / `-` / `—` | don't-care (hand-authored convention) / don't-care（手書き規約） | no / しない |
| `M` / `I` | indeterminate via MASK / MASK による不定 | rule skipped with comment / 規則をコメント付きでスキップ |

- **Status row** (optional): if present, only `Adopted` columns are converted; others skipped. If absent, every non-empty column is an adopted rule.
  / **Status 行**（任意）: あれば `Adopted` 列のみ変換、他はスキップ。無ければ空でない全列を採用規則とみなす。
- Case is significant (`T` ≠ `t`); Excel preserves text case. / 大文字小文字は有意（`T` ≠ `t`）。Excel はテキストの大小を保持。
- UTF-8, CRLF or LF line endings, RFC-4180 quoting (matches `escapeCSV`). / UTF-8、改行 CRLF/LF、RFC-4180 引用（`escapeCSV` 準拠）。

**Hand-authored tip / 手書きのコツ.** A person building this in Excel only writes `T`/`F` in
controlling cells and **leaves don't-care cells blank** (the classic limited-entry table convention).
The `t`/`f` distinction is produced automatically only when exporting from NeoCEG.
/ Excel で作る人は、効く所に `T`/`F` を入れ、**効かない所は空欄**にすればよい（限定エントリ表の古典規約）。
`t`/`f` の区別は NeoCEG からエクスポートしたときにだけ自動で付く。

### 3.2 Internal data model / 内部データモデル

**EN.** `parseCsv` converts the CSV into this self-contained structure (`SkeletonInput`), which the
converter operates on directly. It is defined in `types.ts` — **not** exposed as an external input format.
Its shape mirrors NeoCEG's in-memory `DecisionTable`, so future integration (§9) can feed that type
directly with no parsing round-trip. Shown as JSON for readability:
**JA.** `parseCsv` は CSV をこの自己完結した構造（`SkeletonInput`）に変換し、変換器はこれを直接扱う。
`types.ts` に定義し、**外部入力形式としては公開しない**。形は NeoCEG のメモリ上 `DecisionTable` に
倣っており、将来の統合（§9）ではその型を無変換で直接渡せる。可読性のため JSON で示す:

```jsonc
{
  // Cause node ids in display order / 原因ノードID（表示順）
  "causeIds":       ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"],
  // Intermediate node ids / 中間ノードID
  "intermediateIds": ["n9", "n10"],
  // Effect node ids / 効果ノードID
  "effectIds":       ["e1", "e2", "e3", "e4", "e5"],

  // OPTIONAL: human labels for readable output / 任意: 可読出力用ラベル
  "labels": { "n1": "Individual", "e1": "Free", "...": "..." },

  // OPTIONAL: expressions enable intermediate-variable emission
  // 任意: 式を与えると中間変数として出力できる
  "expressions": { "n9": "n5 AND n7", "n10": "n5 AND n8",
                   "e1": "n3 OR n6 OR n9", "...": "..." },

  // Decision table columns (feasible/optimized) / デシジョンテーブルの列（実行可能・最適化形）
  "conditions": [
    {
      "id": 1,
      // value per node; absent key = not present in this column
      // ノードごとの値。キーが無い = この列に出現しない
      "values": { "n3": "T", "e1": "T", "n1": "f", "...": "..." },
      "excluded": false
    }
    // ...
  ]
}
```

**Notes / 補足**
- `values` cell domain / セル値の定義域: `T` `F` `t` `f` `M` `I` (per `TruthValue`).
- Excluded columns (`excluded: true`) are ignored by the converter / 除外列は変換器が無視。
- `labels` / `expressions` are optional; absent → ids are used verbatim / 無ければ ID をそのまま使用。

---

## 4. Output / 出力

**EN.** A single skeleton document (text). Default emitter = **language-agnostic pseudo-code**.
Effect leaves become `return <effect>` (or `emit <effect>`); unimplemented action bodies are `// TODO`.

**JA.** スケルトン文書（テキスト）を1つ出力。既定の出力器は**言語非依存の擬似コード**。
効果の葉は `return <effect>`（または `emit <effect>`）になり、未実装の動作本体は `// TODO`。

Example shape / 出力形のイメージ:

```text
function decide(n1..n8, n9, n10):
    # n9, n10 are intermediate conditions. Their definitions
    #   n9 = n5 and n7 ; n10 = n5 and n8
    # are emitted ONLY when expressions are available (internal model /
    # future integration). From CSV they stay named conditions.
    # / 中間条件。定義行は式がある場合のみ出力。CSV からは名前付き条件のまま。

    if n3: return Free        # e1  (column #1)
    if n6: return Free        # e1  (column #2)
    if n9: return Free        # e1  (column #3)
    if n4:                    # shared condition, tested once
        if n1: return 1200    # e2  (column #4)
        if n2: return 1000    # e3  (column #5)
    if n10:
        if n1: return 600     # e4  (column #6)
        if n2: return 500     # e5  (column #7)
    return None               # default: input space reached by no column
    # 7 explicit guarded paths = 7 columns (no effect is the fall-through)
```

---

## 5. Algorithm / アルゴリズム

**EN.** The pruning is **already done** by the decision table (§2). The converter **renders** each column
as an **explicitly-guarded** control path; it does **not** re-prune, and — because the table is a *cover* —
it never lets an effect become the fall-through. Deterministic: a fixed condition ordering gives unique,
reproducible output.

**JA.** 枝刈りは §2 のとおり**既に完了**している。変換器は各列を**明示ガード付き**の制御パスとして
**レンダリング**するだけで、**再枝刈りはしない**。テーブルは*被覆*なので、いかなる効果も
フォールスルーにはしない。決定論的: 条件順序を固定すれば出力は一意かつ再現可能。

1. **Read columns as control paths / 列を制御パスとして読む**
   For each non-excluded column: the **action** = the effect(s) whose cell is uppercase `T`
   (controlling-true); the **conditions** = the column's cause + intermediate cells. Columns whose action
   is `M`/`I` are skipped with a comment.
   各列について、**動作** = セルが大文字 `T` の効果、**条件** = その列の原因・中間セル。動作が `M`/`I` の
   列はコメント付きでスキップ。

2. **Per-column guard (controlling conditions) / 列ごとのガード（制御条件）**
   For each column, greedily build the **minimal set of conditions** whose values distinguish it from every
   column with a *different* action (add the condition that separates the most still-tied columns; tie →
   node order). That conjunction is the column's guard. Conditions are taken from **all rows — causes AND
   intermediates** (intermediates are first-class conditions, keeping the output close to CEG topology).
   各列について、*異なる動作*を持つ全列と区別できる**最小の条件集合**を貪欲に作る（最も多くの未分離列を
   分ける条件を追加。同点 → ノード順）。その連言が列のガード。条件は**全行（原因＋中間）**から取る
   （中間も一級の条件 → 出力が CEG トポロジーに近づく）。

3. **Factor into nesting / ネストへの factoring**
   Group columns by their leading (first-chosen, most-discriminating) guard literal: a shared literal is
   tested once and its columns nested beneath it. A condition that does not distinguish is never tested
   (§8 #2). Factoring **never merges two columns into one path** — path count stays = column count (§8 #5).
   ガードの先頭リテラル（最初に選ばれた最有力条件）で列をグループ化: 共有リテラルは一度だけテストし、
   その列を下にネストする。区別しない条件は使わない（§8#2）。factoring は**2列を1パスに併合しない** —
   パス数は列数に等しいまま（§8#5）。

4. **Default leaf / 既定の葉**
   The table is a *cover*, not a *partition*: every effect is guarded **explicitly**, and only the input
   space reached by no column falls through to a single trailing `return None`. **No effect is ever the
   fall-through** (otherwise it would over-fire on unreached inputs).
   テーブルは*被覆*であり*分割*ではない: 各効果は**明示的に**ガードし、どの列にも到達しない入力空間
   だけが末尾の単一 `return None` に落ちる。**いかなる効果もフォールスルーにしない**（さもないと未到達
   入力で誤発火する）。

5. **Intermediates / 中間ノード**
   Emit each intermediate as a named boolean condition; its **definition** (e.g. `n9 = n5 and n7`) appears
   **only** when `expressions` are available (internal model / future integration). From CSV it stays a
   named condition.
   中間ノードは名前付きブール条件として出す。**定義**（例 `n9 = n5 and n7`）は `expressions` がある場合
   **のみ**出力（内部モデル／将来統合）。CSV からは名前付き条件のまま。

6. **Emit / 出力**
   Walk the structure with the selected emitter to produce text.
   選択した出力器で構造をたどり、テキスト化する。

**Complexity / 計算量.** Bounded by table size, which is already pruned (e.g. admission fee: 256 → 7).
テーブルサイズに比例し、そのテーブルは既に枝刈り済み（例: 入館料 256 → 7）。

---

## 6. Design decisions (defaults, revisable) / 設計判断（既定値・変更可）

| Key / 項目 | Default / 既定 | Alternatives / 代替 |
|---|---|---|
| Input format / 入力形式 | `csv` only (tool/Excel-compatible) / CSV のみ | — (internal model = `SkeletonInput`, §3.2) |
| Emitter / 出力言語 | `pseudo` (language-agnostic) / 擬似コード | `typescript`, `python` |
| Nesting / ネスト方針 | `tree` (nested `if`, factored paths) / ネスト | `flat` (one guard clause per column) / 列ごとガード節 |
| Intermediates / 中間変数 | `keep` (named boolean conditions) / 名前付き条件で残す | `inline` (expand into conditions) / 条件に展開 |
| Condition ordering / 条件順序 | `most-discriminating` (greedy, separates effects) / 効果分離が最大の条件優先 | `input-order`, `topological` |
| Default leaf / 既定の葉 | `return None` | configurable string / 文字列指定 |

**EN.** These are command-line flags / config fields; all deterministic. None require AI. `tree` + `keep`
is the **topology-faithful** combination: it preserves the CEG's intermediate layer as named conditions
and maps shared predecessors to shared nesting (caveat: the CEG is a DAG, so a node feeding several effects
is *re-tested*, not shared, in the `if/else` tree).
**JA.** いずれも CLI フラグ / 設定項目。すべて決定論的で、AI を要しない。`tree` ＋ `keep` が
**トポロジー忠実**な組み合わせ: CEG の中間層を名前付き条件として残し、共有された前段ノードを共有
ネストに対応づける（注: CEG は DAG なので、複数効果に効くノードは `if/else` 木では共有されず*再テスト*
される）。

---

## 7. Limitations & non-goals / 制約と非目標

- **Action bodies are stubs / 動作本体はスタブ.** The tool knows *which* effect fires, not *how* to implement it. Bodies are `// TODO`. / どの効果かは分かるが実装方法は不明。本体は `// TODO`。
- **Not globally optimal / 大域最適ではない.** The greedy condition ordering yields a *simple-enough*, not minimal, nesting. / 貪欲な条件順序は*十分シンプル*なネストであり最小ではない。
- **Determinacy values (`M`/`I`) / 不定値.** Columns whose action is `M`/`I` (MASK untestable) are skipped with a comment. / 動作が `M`/`I`（MASK でテスト不能）の列はコメント付きでスキップ。
- **Multiple simultaneous effects / 複数効果同時成立.** A column firing several effects emits all actions at that leaf. / 複数効果が立つ列は、その葉で全動作を出力。

---

## 8. Validation / 検証

**EN.** Golden example = the admission-fee graph (`Verification/TDD/graphs/17_admission_fee.nceg`):
8 causes, 2 intermediates, 5 effects, 3 `ONE` constraints, **7 feasible columns** (test-verified).
Expected skeleton ≈ §4 example. Acceptance:

**JA.** 基準例 = 入館料グラフ（`Verification/TDD/graphs/17_admission_fee.nceg`）:
原因8・中間2・効果5・`ONE` 制約3、**実行可能列7**（テストで保証済み）。
期待スケルトンは §4 のイメージ。受け入れ基準:

1. Every effect appears in ≥1 reachable leaf / すべての効果が到達可能な葉に1回以上現れる。
2. No branch tests a condition that does not distinguish the columns in its subtree / 部分木の列を区別しない条件を分岐に使わない。
3. Re-running on the same input yields byte-identical output / 同一入力で再実行するとバイト同一の出力。
4. The Free branch does **not** test individual/group: once `n3`/`n6`/`n9` determine Free, recursion stops before `n1`/`n2` / 無料は `n3`/`n6`/`n9` で確定した時点で停止し、`n1`/`n2` をテストしない。
5. Path count = column count: the skeleton realizes exactly the table's control paths (7 for admission fee) / パス数＝列数。スケルトンはテーブルの制御パス（入館料は7）をちょうど実現する。

---

## 9. Implementation outline & future integration / 実装概要と将来の統合

**EN.** Standalone TypeScript (mirrors NeoCEG types for easy later folding-in). Pure functions, no state,
no network. Suggested location: `prototype/skeleton-generator/`.

**JA.** 独立した TypeScript（後で取り込みやすいよう NeoCEG の型に合わせる）。純粋関数・無状態・通信なし。
配置案: `prototype/skeleton-generator/`。

```
prototype/skeleton-generator/
  src/
    types.ts          # SkeletonInput (internal model, mirrors DecisionTable), internal Tree types
    parseCsv.ts       # CSV (decision-table layout) -> SkeletonInput
    paths.ts          # columns -> control paths (action = uppercase-T effect; skip M/I)
    buildTree.ts      # factor paths into nested if/else (most-discriminating, stop when homogeneous)
    emit/
      pseudo.ts       # default emitter
      typescript.ts   # (optional)
    index.ts          # CLI: read CSV -> skeleton string
  test/
    admissionFee.test.ts   # golden example (§8)
    admissionFee.csv       # golden input (tool-exported CSV) / 基準入力（ツール出力CSV）
```

**Future / 将来.** Now validated (§8 golden test passes), the core (`paths` + `buildTree` + an emitter)
folds into NeoCEG as a new pure exporter `src/services/skeletonExporter.ts`, alongside the existing
`csvExporter` / `htmlTableExporter` / `svgExporter`, consuming the in-memory `DecisionTable` directly
(no JSON round-trip). The concrete integration design is **§11**. / 検証済み（§8 ゴールデンテスト合格）。
中核（`paths` ＋ `buildTree` ＋ 出力器）を新しい純粋エクスポータ `src/services/skeletonExporter.ts`
として NeoCEG に統合し、既存の各エクスポータと並べて、メモリ上の `DecisionTable` を直接消費する
（JSON を介さない）。具体的な統合設計は **§11**。

---

## 10. Open decisions to confirm / 確認したい未決事項

1. Emitter default — pseudo-code, or a concrete language (TS/Python)? / 出力既定 — 擬似コードか、具体言語か？
2. Nesting — decision tree (`tree`) or flat guard clauses (`flat`)? / ネスト — 決定木かフラットなガード節か？
3. Intermediates — keep as variables or inline? / 中間ノード — 変数として残すか展開するか？

*Resolved: input = **CSV only**, matching the tool's existing export and Excel authoring (§3.1). The `SkeletonInput` JSON shape is retained as the internal data model (§3.2), not as an input format.*
*解決済み: 入力 = **CSV のみ**。ツール既存エクスポートおよび Excel 作成と一致（§3.1）。`SkeletonInput` の JSON 形は入力形式ではなく内部データモデル（§3.2）として保持。*

*Current defaults (§6) let the prototype run without answering 1–3; answers only tune output.*
*§6 の既定値で 1〜3 未回答のまま動作する。回答は出力の調整のみ。*

---

## 11. Integration into NeoCEG — design draft / 本体統合 設計ドラフト

> Status: **design confirmed** (not yet implemented). / 状態: **設計確定**（未実装）。

### 11.1 Goal / 目的
**EN.** Surface the skeleton inside the app as **one tab** in the existing decision-table panel,
shown as read-only pseudo-code with a **copy** button. Consume the in-memory `DecisionTable` directly —
no CSV round-trip — so the skeleton updates live with the graph.
**JA.** スケルトンをアプリ内の**1タブ**（既存デシジョンテーブルパネル）として表示。読み取り専用の擬似
コード＋**コピー**ボタン。メモリ上の `DecisionTable` を直接消費（CSV 往復なし）し、グラフ編集に追従。

### 11.2 New pure exporter / 新しい純粋エクスポータ
`src/services/skeletonExporter.ts` — ports the prototype core (`paths` + `buildTree` + `emit/pseudo`),
adapted from `Record` to the in-memory `Map<string, TruthValue>` cell model. Pure, no DOM, no state.

```ts
export function generateSkeletonPseudoCode(
  table: DecisionTable,                 // optimized (feasible) table — NOT the learning-mode 2^n table
  nodeLabels: Map<string, string>,      // id -> label, for effect return values
  model?: LogicalModel | null,          // optional; enables intermediate definitions
): string
```

- Algorithm is unchanged from §2–§5 (table already MC/DC-pruned → render columns as guarded paths).
- **Intermediate definitions** (the one upgrade over the CSV path): when `model` is given, emit
  `n9 = n5 AND n7` via `serializeExpression(model.nodes.get(id)?.expression)`. Without `model`, intermediates
  stay named conditions (as from CSV). / 中間定義は `model` があるときだけ式から出力。
- **Node legend & labels** (`nodeLabels` covers *every* node): ids stay the code identifiers (labels can
  contain spaces, e.g. `65+ years old`, so they cannot be identifiers), and the human label is surfaced as
  a comment — a **legend block** for causes/intermediates up front, plus an inline label comment on each
  guard/return. / `nodeLabels` は全ノードを網羅。識別子は `n3` のまま（ラベルは空白を含むため識別子に
  できない）、ラベルはコメントで提示 — 冒頭の**凡例**＋各ガード/戻り値の行内コメント。

Output sketch with labels / ラベル付き出力イメージ:

```text
function decide(n1, n2, n3, n4, n5, n6, n7, n8):
    # n1=Individual  n2=Group  n3=65+ years old  n4=Adult
    # n5=Elementary school  n6=Under 6 years old  n7=Prefecture resident Yes  n8=Prefecture resident No
    n9  = n5 AND n7      # Prefecture resident elementary
    n10 = n5 AND n8      # Non-resident elementary

    if n3: return Free   # 65+ years old → Free  (#1)
    if n6: return Free   # Under 6 years old → Free  (#2)
    if n9: return Free   # Prefecture resident elementary → Free  (#3)
    if n4:               # Adult
        if n1: return 1200 yen   # Individual → e2 (#4)
        if n2: return 1000 yen   # Group → e3 (#5)
    if n10:              # Non-resident elementary
        if n1: return 600 yen    # Individual → e4 (#6)
        if n2: return 500 yen    # Group → e5 (#7)
    return None
```

### 11.3 Data flow / データフロー
`DecisionTablePanel` already builds, in one `useMemo`, exactly the three inputs needed:
`table` (optimized), `nodeLabels`, and `logicalModel`. The new tab feeds them to the exporter via a
`useMemo`. No new store/state, no recomputation of the table.
/ `DecisionTablePanel` の既存 `useMemo` が `table`・`nodeLabels`・`logicalModel` を既に生成済み。新タブは
それを `useMemo` で渡すだけ。新ストア・再計算なし。

### 11.4 UI changes / UI 変更
- `TabType` に `'skeleton'` を追加。`messages.ts` に `TAB_LABELS.skeleton`、`EXPORT_MESSAGES.copySkeleton` /
  `downloadSkeleton` を追加。
- **Copy + Download, in two places — for consistency with CSV/SVG / コピー＋DL を2か所に**（CSV/SVG と一貫）:
  1. **Panel header export menu (the "main menu") / パネルヘッダの書き出しメニュー**: the existing
     `DownloadButton` / `CopyCSVButton` row (`DecisionTablePanel.tsx` ~L1870) gains an
     `activeTab === 'skeleton'` branch with **Download + Copy**. / 既存の DL/コピー行に `skeleton` タブ用の
     分岐を足し、DL＋コピーを出す。
  2. **Inside `PseudoCodeView` (the tab body) / タブ内**: read-only monospace `<textarea>` ＋ **Copy + Download**
     (`ExportView` のアクションボタン列パターンを踏襲)。
- **Download** writes a plain-text file `skeleton_<date>.txt` via a small `downloadText(content, filename)`
  helper (or reuse the blob-download pattern of `downloadCSV`). / DL は `skeleton_<date>.txt`。`downloadText`
  ヘルパ（または `downloadCSV` のパターン流用）。
- Tab placement (proposal): between **Compare** and **NeoCEG Language**. / タブ位置（案）: Compare と NeoCEG Language の間。

### 11.5 Testing / テスト
`src/__tests__/skeletonExporter.test.ts` — build the table from the admission-fee DSL via the in-memory
pipeline (`parseLogicalDSL` → `generateOptimizedDecisionTableWithState`), then assert the §8 criteria
**plus** that intermediate definitions (`n9 = n5 AND n7`, `n10 = n5 AND n8`) are present (expressions
available). Mirrors the prototype golden test.

### 11.6 Out of scope / 非対象
- No algorithm change (§2–§5 reused). / アルゴリズム変更なし。
- Learning-mode (2^n) table is **not** used — the skeleton is built from the optimized feasible table only.
  / 学習モード（2^n）テーブルは使わない。最適化済み実行可能テーブルのみ。
- Language emitters (TS/Python) and `flat` nesting — deferred (§6 options). / 言語出力器・flat は後回し。
  (Download **is** in scope — see §11.4. / DL は対象内、§11.4 参照。)

### 11.7 Decisions (confirmed) / 確定事項
All confirmed — ready to implement on explicit go-ahead. / すべて確定。明示の「実装して」で着手可。

1. **Tab label / タブ名**: `Skeleton`.
2. **Tab position / タブ位置**: between **Compare** and **NeoCEG Language** / Compare と NeoCEG Language の間。
3. **Copy + Download**, in the panel header menu *and* inside the tab (consistency with CSV/SVG)
   / コピー＋DL を、ヘッダメニューとタブ内の両方に。
4. **Intermediate operator case / 中間定義の演算子表記**: `AND` (DSL-consistent) / `AND`（DSL 準拠）。
5. **Empty/invalid graph / 空・不正グラフ時**: placeholder `No decision table to render`
   / プレースホルダ「表示できるデシジョンテーブルがありません」。
6. **Label presentation / ラベルの提示**: legend block (causes + intermediates) up front **plus** an
   inline comment on each guard/return (§11.2) / 冒頭の凡例（原因＋中間）＋各ガード・戻り値の行内コメント。
