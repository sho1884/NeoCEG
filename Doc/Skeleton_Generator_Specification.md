# Skeleton Generator — Specification / スケルトン生成器 仕様

> Status: **Implemented & integrated into NeoCEG** (the "Skeleton" tab). This document is the **feature
> specification** — not a prototype. The implementation is `src/services/skeletonExporter.ts` (§11). A
> standalone CSV prototype existed during design and has been **removed**; only its design history remains
> (§9).
> / 状態: **実装済み・NeoCEG 本体に統合済み**（「Skeleton」タブ）。本書はプロトタイプではなく当該**機能の
> 仕様**。実装は `src/services/skeletonExporter.ts`（§11）。設計時の独立 CSV プロトタイプは**削除済み**で、
> 経緯のみ §9 に残す。

---

## 1. Purpose & Scope / 目的と範囲

**EN.** Mechanically derive a program control-structure *skeleton* (nested `if/else` plus action stubs)
from a **Cause-Effect Graph**. Fully **deterministic**, **no AI/ML**. It **reproduces the CEG's control-flow
topology** and simplifies it **under the constraint premise** — "CEG (topology) → control structure → code" —
and is **verified equivalent to the CEG over the feasible input space**. (The CEG's decision table is used as
an MC/DC cross-check, not as the derivation source — see the revised §2/§5.)

**JA.** **原因結果グラフ**から、プログラムの制御構造**スケルトン**（ネストした `if/else` ＋ 動作スタブ）を
機械的に導く。完全に**決定論的**、**AI/ML 不使用**。**CEG の制御フロー・トポロジーを再現**し、**制約を前提**
に単純化する（「CEG（トポロジー）→ 制御構造 → コード」）。そして**実行可能入力空間上で CEG と一致を検証**する。
（デシジョンテーブルは MC/DC 整合チェックに使い、導出源にはしない — 改訂 §2/§5。）

### In scope / 対象
- CEG model (expressions + intermediates + constraints) → skeleton text / CEG モデル（式＋中間＋制約）→ スケルトン文字列
- Topology reproduction (intermediates as computed variables; shared controlling conditions as gates), simplified under the constraint premise / トポロジー再現（中間＝計算変数、共有支配条件＝ゲート）、制約前提で単純化
- Equivalence verification over the feasible input space / 実行可能入力空間での一致検証
- One pluggable code emitter (default: pseudo-code) / 差し替え可能なコード出力器（既定: 擬似コード）

### Out of scope / 非対象
- Action *bodies* (the real implementation of each effect) — emitted as `// TODO` stubs
  / 動作の*本体*（各効果の実装）— `// TODO` スタブとして出力
- Globally minimal nesting (NP-hard) — only "sufficiently simple" is targeted
  / 大域最小のネスト（NP困難）— 目標は「十分にシンプル」のみ
- Constraint-violating inputs (premise, §7) / 制約違反入力（前提・§7）
- *(Integration into NeoCEG is now specified in §11.)* / *(NeoCEG への統合は §11 で規定。)*

---

## 2. Why this is mechanical / 機械化が成立する根拠

**EN.** The skeleton is the CEG's **own control-flow topology**, reproduced under the **constraint premise**.
Three facts make this mechanical:

| Fact / 事実 | Consequence / 帰結 |
|---|---|
| The CEG *is* the program's logic / CEG は被試験プログラムの論理そのもの | Effects are boolean functions of causes via intermediates (`e := …`); reproduce them, don't re-derive. |
| Intermediate nodes *are* the topology / 中間ノードがトポロジー | Shared intermediates/causes become shared gates; multi-level intermediates become topologically-ordered computed variables (depth → prologue, not branch blow-up). |
| Constraints are a **premise**, not a check / 制約は前提（検査しない） | The skeleton may **assume** `ONE`/`EXCL`/… hold; constraint-violating inputs *cannot occur*, so the skeleton never defends against them. This is what lets it simplify (e.g. `if c1 … else` = the other `ONE` member). |

So building the skeleton is **reproducing the topology and simplifying it under the constraint premise** — not
fitting the decision table. The decision table / MC/DC is used **only as a cross-check** (§8): the generated
control paths should number the same as the feasible columns.

**EN (the trap to avoid).** Do **not** derive guards by fitting the decision-table columns (the MC/DC
representative points). A guard that separates the 7 points can still misroute the *other* constraint-valid
inputs that are not among those points. Correctness is defined against the CEG functions over the whole
**feasible input space**, not the columns (§8).

**JA.** スケルトンは **CEG 自身の制御フロー・トポロジー**を、**制約を前提**に再現したもの。機械化が成立する根拠は3つ（上表）：
(1) CEG は被試験プログラムの論理そのもの（効果は原因→中間→効果のブール関数）。再現すればよく、導出し直さない。
(2) 中間ノードがトポロジー。共有中間/原因が共有ゲートになり、多段中間はトポロジカル順の計算変数になる（深さは分岐爆発でなくプロローグへ）。
(3) **制約は前提であって検査ではない**。`ONE`/`EXCL`… は**成立を仮定**してよい。制約違反入力は*起こらない*ので防御しない。これが単純化（`if c1 … else` ＝ もう一方の `ONE` メンバ等）を可能にする。

ゆえにスケルトン構築は **トポロジー再現＋制約前提での単純化**であって、デシジョンテーブルへの当てはめではない。テーブル／MC/DC は **整合チェック専用**（§8）：生成された制御パス数は実行可能列数と一致するはず。

**避けるべき罠.** デシジョンテーブルの列（MC/DC 代表点）に**当てはめてガードを導出してはならない**。7点を分けるガードでも、その7点に**含まれない他の実行可能入力**を誤ルートしうる。正しさは列ではなく、**全実行可能入力空間**上で CEG 関数と一致することで定義する（§8）。

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

> **Superseded for correctness (see revised §2/§5).** A CSV decision table alone **cannot** produce a correct
> skeleton — it only samples MC/DC points and carries no expressions/constraints (the topology). The
> corrected algorithm derives from the **CEG model** (expressions + intermediates + constraints), so the
> integrated path (§11, in-memory model) is primary. CSV stays useful for the decision table itself and as
> the §8 cross-check, not as the skeleton's derivation source.
> / **正しさの観点で見直し（改訂 §2/§5）.** CSV のデシジョンテーブル単独では正しい骨格を作れない（MC/DC
> 点のサンプルで、式・制約＝トポロジーを持たない）。改訂アルゴリズムは **CEG モデル**（式＋中間＋制約）
> から導出するため、統合パス（§11・メモリ上モデル）が主。CSV はデシジョンテーブル自体と §8 整合チェック
> には有用だが、骨格の導出源ではない。

### 3.1 CSV format / CSV 形式

Layout = **nodes as rows, rules as columns** (this tool's convention).
レイアウト = **ノードが行・規則が列**（本ツールの規約）。

| ID | Classification | Logical Statement | #1 | #2 | … |
|----|----------------|-------------------|----|----|---|
| *(Status)* | | | Adopted | Infeasible | … |  ← optional row / 任意行 |
| n1 | Cause | Individual | T | f | … |
| n9 | Intermediate | n5 AND n7 | t | F | … |
| e1 | Effect | Free | T | f | … |

Column semantics / 列の意味:
- **ID** → node id / ノードID
- **Classification** → `Cause` / `Intermediate` / `Effect` — drives the row's role (localized values accepted) / 行の役割を決定（ローカライズ値も許容）
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
function decide(n1..n8):
    # intermediates as computed variables, topological order (defs need expressions)
    n9  = n5 AND n7      # resident elementary      (feeds Free)
    n10 = n5 AND n8      # non-resident elementary  (feeds 600/500)

    if n4:                    # gate: adult — shared by 1200/1000
        if n1: return 1200    # e2 = n1 AND n4
        else:  return 1000    # e3 = n2 AND n4   (else = n2, by ONE(n1,n2))
    if n10:                   # gate: non-resident elementary — shared by 600/500
        if n1: return 600     # e4 = n1 AND n10
        else:  return 500     # e5 = n2 AND n10
    if n3 OR n6 OR n9:        # Free: 65+, under 6, or resident elementary
        return Free           # e1   (OR ⇒ 3 MC/DC control paths)
    return None               # default: no effect fires
    # 7 control paths (2 + 2 + 3) = 7 feasible columns.
    # Gates n4 / n10 / (n3,n6,n9) are mutually exclusive under ONE(n3,n4,n5,n6) & ONE(n7,n8),
    # so ordering is shadow-safe. The else-branches are valid under ONE(n1,n2).
```

---

## 5. Algorithm / アルゴリズム

**EN.** **Reproduce the CEG topology and simplify it under the constraint premise** (§2). The derivation
source is the **model** — causes, intermediates *with their expressions*, effects *with their expressions*,
and the constraints. The decision table is **not** the derivation source; it is the §8 cross-check.
Deterministic.

> Requires expressions + constraints (the in-memory model / §11). A CSV decision table alone is
> insufficient — it samples MC/DC points and cannot supply the topology, so it cannot yield a correct
> skeleton on its own (this is exactly the trap in §2).

1. **Intermediates → computed variables / 中間ノード＝計算変数**
   Emit each intermediate as a named boolean in **topological order** (defined after the nodes it
   references), from its expression. Multi-level intermediates only add definition lines — they never
   expand the branch tree (depth → prologue). A node feeding several effects is computed **once**.
   中間ノードを式から名前付きブールとして**トポロジカル順**に出す（参照先の後に定義）。多段でも定義行が
   増えるだけで分岐木は膨らまない。複数効果に効くノードも**一度だけ**計算。

2. **Gate by a shared controlling condition / 共有支配条件でゲート化**
   Group effects by a controlling condition shared in their expressions — a common intermediate or cause
   (e.g. `e2,e3` share `n4`; `e4,e5` share `n10`). That condition becomes a **gate** tested once; the
   effects nest beneath it. This reproduces the CEG's convergence (topology).
   効果を、式中で共有する支配条件（共通の中間/原因。例 `e2,e3`→`n4`、`e4,e5`→`n10`）でグループ化。
   それを**ゲート**として一度だけテストし、配下にネスト。CEG の合流＝トポロジーを再現する。

3. **Discriminate within a gate under the premise / ゲート内は前提を使って識別**
   Inside a gate, separate the remaining effects by their distinguishing cause using `if c / else`, where a
   `ONE` (or equivalent) constraint makes the alternatives exhaustive (`else` = the other member).
   **Assume constraints hold; never test for their violation.**
   ゲート内は識別原因で `if c / else`。`ONE` 等が網羅を保証するので `else` ＝もう一方のメンバ。
   **制約は成立を仮定し、違反を検査しない。**

4. **Disjunctive effects / 論理和の効果**
   An effect defined by an OR (e.g. `e1 = n3 OR n6 OR n9`) is guarded by that disjunction; each operand is
   one MC/DC control path.
   OR 定義の効果（例 `e1 = n3 OR n6 OR n9`）はその論理和でガード。各項が1つの MC/DC 制御パス。

5. **Default / 既定**
   A single trailing `return None` for inputs that fire no effect (under the constraints this may be
   unreachable; it is never an effect).
   どの効果も立たない入力のための末尾 `return None`（制約下では到達しないこともある。効果には決してしない）。

6. **Emit / 出力**
   Walk the structure with the selected emitter.
   選択した出力器で構造をたどる。

**Correctness is verified, not assumed / 正しさは仮定でなく検証する.** Because steps 2–3 simplify under the
premise, the generator **must confirm the skeleton agrees with the CEG effect functions over the entire
feasible input space** (constraint-valid inputs) — **not** the decision-table columns. If any feasible input
is misrouted, the simplification was unsound → fall back to a more explicit (less-factored) guard for that
effect. **The generator never emits a skeleton that disagrees with the CEG.** (Verifying against the 7
columns only — the original mistake — silently misses non-sampled feasible inputs.)
ステップ2–3は前提下の単純化なので、生成器は**実行可能入力空間の全体で CEG 効果関数と一致するか確認必須**
（列ではない）。誤ルートがあれば簡約は不当 → 当該効果をより明示的なガードに退避。**CEG と食い違う骨格は
出さない。**（7列だけの検証＝当初の誤りは、サンプル外の実行可能入力を見逃す。）

**Determinism / complexity / 決定論・計算量.** A fixed gate-ordering policy ⇒ unique output. Optimal
factoring is NP-hard; a greedy *most-shared-controlling-condition-first* is used (simple-enough, not
minimal — §7). Verification enumerates the feasible space, which the constraints bound (e.g. `ONE` groups ⇒
a product of choices: admission fee 2×4×2 = 16).

---

## 6. Design decisions (defaults, revisable) / 設計判断（既定値・変更可）

| Key / 項目 | Default / 既定 | Alternatives / 代替 |
|---|---|---|
| Derivation source / 導出源 | `model` (expressions + intermediates + constraints) / モデル | — (CSV table alone is insufficient — §3 note) |
| Emitter / 出力言語 | `pseudo` (language-agnostic) / 擬似コード | `typescript`, `python` |
| Nesting / ネスト方針 | `tree` (gated nested `if`) / ゲート付きネスト | `flat` (one guard per effect) / 効果ごとガード |
| Intermediates / 中間変数 | `keep` (named computed variables) / 名前付き計算変数で残す | `inline` (expand into conditions) / 条件に展開 |
| Gate ordering / ゲート順序 | `most-shared-first` (greedy) / 最共有の支配条件優先 | `topological`, `effect-order` |
| Default leaf / 既定の葉 | `return None` | configurable string / 文字列指定 |

**EN.** These are config fields; all deterministic. None require AI. `tree` + `keep` is the
**topology-faithful** combination. Because intermediates are kept as **computed variables** (`n9 = …`), a
node feeding several effects is **computed once and shared** — the DAG sharing is preserved (the earlier
"re-tested in a tree" caveat no longer applies; that was the column-rendering view).
**JA.** いずれも設定項目。すべて決定論的で AI 不要。`tree` ＋ `keep` が**トポロジー忠実**。中間を
**計算変数**（`n9 = …`）として残すので、複数効果に効くノードも**一度計算して共有** — DAG の共有が保たれる
（以前の「木で再テスト」という注は列レンダリング時の話で、もう当てはまらない）。

---

## 7. Limitations & non-goals / 制約と非目標

- **Action bodies are stubs / 動作本体はスタブ.** The tool knows *which* effect fires, not *how* to implement it. Bodies are `// TODO`. / どの効果かは分かるが実装方法は不明。本体は `// TODO`。
- **Constraints are a premise / 制約は前提.** The skeleton assumes the constraints hold; constraint-violating inputs are **out of scope** and are never defended against. / スケルトンは制約成立を仮定。制約違反入力は**対象外**で防御しない。
- **Not globally optimal / 大域最適ではない.** Greedy gate ordering yields a *simple-enough*, not minimal, nesting (optimal factoring is NP-hard). / 貪欲なゲート順序は*十分シンプル*で最小ではない（最適 factoring は NP困難）。
- **Unverifiable simplification falls back / 検証できない単純化は退避.** If a factored guard cannot be verified equivalent to the CEG over the feasible space, the effect is emitted with a more explicit (less-factored) guard — correct but more verbose. / factoring したガードが実行可能空間で CEG と一致すると検証できなければ、その効果はより明示的なガードで出力（正しいが冗長）。
- **Determinacy values (`M`/`I`) / 不定値.** Effects that are `M`/`I` (MASK untestable) are skipped with a comment. / `M`/`I`（MASK でテスト不能）の効果はコメント付きでスキップ。
- **Multiple simultaneous effects / 複数効果同時成立.** A path firing several effects emits all actions at that leaf. / 複数効果が立つパスは、その葉で全動作を出力。

---

## 8. Validation / 検証

**EN.** Golden example = the admission-fee graph (`Verification/TDD/graphs/17_admission_fee.nceg`):
8 causes, 2 intermediates, 5 effects, 3 `ONE` constraints, 7 feasible columns. Expected skeleton ≈ §4.
Acceptance — **#1 is the real criterion; the rest are structural cross-checks:**

**JA.** 基準例 = 入館料グラフ（`Verification/TDD/graphs/17_admission_fee.nceg`）:
原因8・中間2・効果5・`ONE` 制約3、実行可能列7。期待スケルトンは §4。
受け入れ基準 — **#1 が本質。残りは構造の整合チェック:**

1. **Functional equivalence over the whole feasible space (THE criterion) / 全実行可能空間での関数一致（本質基準）.**
   For **every constraint-valid input**, the skeleton returns exactly what the CEG computes. Enumerate the
   feasible inputs (constraints bound them; admission fee = 2×4×2 = 16) and compare against the model.
   **Testing only the 7 columns is insufficient** — it was the original bug (e.g. "group + 65+" must be Free,
   but it is not one of the 7 MC/DC points).
   **全ての制約充足入力**で、スケルトンの戻り値が CEG の計算と一致する。実行可能入力を列挙（制約で有界。
   入館料=2×4×2=16）してモデルと照合。**7列だけの検証は不十分**（当初のバグ。例「団体＋65歳以上」は
   無料だが7点に含まれない）。
2. Deterministic: byte-identical on re-run / 同一入力で再実行するとバイト同一。
3. Path count = feasible column count (7): the topology skeleton realizes the same number of MC/DC control
   paths as the table (2 + 2 + 3) / パス数＝実行可能列数(7)。トポロジー骨格はテーブルと同数の MC/DC 制御パス(2+2+3)を実現。
4. No gate tests a condition that does not discriminate its group; a node feeding several effects is computed
   once / どのゲートも自グループを区別しない条件をテストしない。複数効果に効くノードは一度だけ計算。
5. Reproduces topology: intermediate definitions present (from expressions); shared conditions are gates
   tested once / トポロジー再現: 中間定義が（式から）出る。共有条件はゲートとして一度だけテスト。

---

## 9. Design history (removed prototype) / 設計の経緯（削除済みプロトタイプ）

**EN.** During design, a standalone CSV-input, **column-fitting** prototype lived under
`prototype/skeleton-generator/`. It derived guards by fitting the decision-table columns and was **incorrect**
for feasible inputs outside the 7 MC/DC points (e.g. "group + 65+" returned a fee instead of Free). It has
been **removed** to avoid being mistaken for a correct reference. The current, correct implementation is the
model-based exporter `src/services/skeletonExporter.ts` (§11), which follows the revised §2–§5 (reproduce
topology, assume constraints, verify over the feasible space).

**JA.** 設計時、CSV 入力・**列当てはめ**方式の独立プロトタイプが `prototype/skeleton-generator/` にあった。
列に当てはめてガードを導出していたため、7 MC/DC 点の外の実行可能入力で**誤って**いた（例「団体＋65歳以上」
が無料でなく有料）。正しい参照と誤認されないよう**削除済み**。現行の正しい実装はモデルベースの
`src/services/skeletonExporter.ts`（§11。改訂 §2–§5＝トポロジー再現・制約前提・実行可能空間で検証）。

---

## 10. Open decisions to confirm / 確認したい未決事項

1. Emitter default — pseudo-code, or a concrete language (TS/Python)? / 出力既定 — 擬似コードか、具体言語か？
2. Nesting — decision tree (`tree`) or flat guard clauses (`flat`)? / ネスト — 決定木かフラットなガード節か？
3. Intermediates — keep as variables or inline? / 中間ノード — 変数として残すか展開するか？

*Resolved: derivation source = the **CEG model** (expressions + intermediates + constraints), per the revised
§2/§5. A CSV decision table alone is insufficient for a correct skeleton (§3 note); CSV remains the decision
table's format and the §8 cross-check. The integrated path (§11) is primary.*
*解決済み: 導出源は **CEG モデル**（式＋中間＋制約。改訂 §2/§5）。CSV のデシジョンテーブル単独では正しい
骨格を作れない（§3 注記）。CSV はデシジョンテーブルの形式と §8 整合チェックに残す。統合パス（§11）が主。*

*The confirmed defaults (§6) and §11.7 fix the remaining knobs; 1–3 above default to `pseudo` / `tree` / `keep`.*
*§6 と §11.7 の確定値で残りは決まる。上記 1〜3 は既定 `pseudo` / `tree` / `keep`。*

---

## 11. Integration into NeoCEG — design draft / 本体統合 設計ドラフト

> Status: **redesign confirmed; to be reimplemented.** The first implementation derived guards by fitting
> the decision-table columns and was incorrect for feasible inputs outside the 7 MC/DC points (e.g.
> "group + 65+" returned a fee instead of Free). The design below follows the revised §2–§5 (reproduce
> topology, assume constraints, verify over the feasible space).
> / 状態: **再設計確定・再実装予定。** 初版は列に当てはめてガードを導出し、7点外の実行可能入力で誤って
> いた（例「団体＋65歳以上」が無料でなく有料）。以下は改訂 §2–§5（トポロジー再現・制約前提・実行可能
> 空間で検証）に従う。

### 11.1 Goal / 目的
**EN.** Surface the skeleton inside the app as **one tab** in the existing decision-table panel,
shown as read-only pseudo-code with a **copy** button. Consume the in-memory `DecisionTable` directly —
no CSV round-trip — so the skeleton updates live with the graph.
**JA.** スケルトンをアプリ内の**1タブ**（既存デシジョンテーブルパネル）として表示。読み取り専用の擬似
コード＋**コピー**ボタン。メモリ上の `DecisionTable` を直接消費（CSV 往復なし）し、グラフ編集に追従。

### 11.2 New pure exporter / 新しい純粋エクスポータ
`src/services/skeletonExporter.ts` — derives the skeleton from the **CEG model** (topology) per §5, simplifies
under the constraint premise, and **self-verifies** over the feasible space. Pure, no DOM, no state.

```ts
interface SkeletonResult {
  text: string;                        // the pseudo-code
  status: 'verified' | 'explicit' | 'unverified';
  // verified   : factored topology skeleton verified equivalent over the feasible space
  // explicit   : factored form unverifiable → fell back to explicit per-effect guards (verified)
  // unverified : could not be verified (e.g. simultaneous effects / missing constraints) — drives warning A
  multiEffect: boolean;                // a feasible column fires >= 2 effects — drives warning B
}

export function generateSkeletonPseudoCode(
  model: LogicalModel,                 // topology source: causes/intermediates/effects + expressions + constraints
  table: DecisionTable,                // feasible columns — for the §8 path-count / equivalence cross-check
  nodeLabels: Map<string, string>,     // id -> label, for the legend + effect return values
): SkeletonResult
```

The returned `status` / `multiEffect` drive the **always-visible validity banner** (GUI §7.4), not just a
comment buried in the text. / 戻り値の `status` / `multiEffect` が**常時表示の妥当性バナー**（GUI §7.4）を
駆動する（テキスト中のコメント止まりにしない）。

- **Topology, not columns (§2/§5).** Gates come from controlling conditions shared in the effect
  *expressions* (e.g. `n4` for 1200/1000; `n10` for 600/500); intermediates are topologically-ordered
  computed variables; OR-effects (`e1 = n3 OR n6 OR n9`) are guarded by the disjunction. `model` is
  **required** — expressions + constraints are the source; the table alone cannot drive a correct skeleton.
  / ゲートは効果**式**中の共有支配条件から。中間はトポロジカル順の計算変数。OR 効果は論理和でガード。
  `model` 必須（式＋制約が源。テーブル単独では正しい骨格を作れない）。
- **Self-verification (mandatory, §8 #1).** Enumerate the constraint-valid inputs (bounded by the
  constraints) and confirm the skeleton’s result equals the CEG’s for **every** one. On any mismatch, fall
  back to a more explicit guard for that effect. / 実行可能入力を列挙し、**全件**で CEG と一致を確認。不一致
  なら当該効果を明示ガードへ退避。
- **Node legend & labels.** Ids stay the code identifiers (labels may contain spaces); the human label is a
  comment — a legend block for causes up front, intermediate definitions carry their label, and each
  gate/return gets an inline label comment. / 識別子は `n3` のまま、ラベルはコメント（冒頭の原因凡例＋
  中間定義＋各ゲート/戻り値の行内コメント）。

Output sketch with labels / ラベル付き出力イメージ:

```text
function decide(n1, n2, n3, n4, n5, n6, n7, n8):
    # causes:
    #   n1 = Individual   n2 = Group   n3 = 65+ years old   n4 = Adult
    #   n5 = Elementary school   n6 = Under 6 years old
    #   n7 = Prefecture resident Yes   n8 = Prefecture resident No
    n9  = n5 AND n7      # Prefecture resident elementary
    n10 = n5 AND n8      # Non-resident elementary

    if n4:                       # Adult
        if n1: return 1200 yen   # e2
        else:  return 1000 yen   # e3   (else = Group, by ONE(n1,n2))
    if n10:                      # Non-resident elementary
        if n1: return 600 yen    # e4
        else:  return 500 yen    # e5
    if n3 OR n6 OR n9:           # 65+ / under 6 / resident elementary
        return Free              # e1
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
- **Copy + Download, in three places — for parity with CSV/SVG / コピー＋DL を3か所に**（CSV/SVG と一貫）:
  1. **Panel header export menu / パネルヘッダの書き出しメニュー**: the existing
     `DownloadButton` / `CopyCSVButton` row (`DecisionTablePanel.tsx` ~L1870) gains an
     `activeTab === 'skeleton'` branch with **Download + Copy**. / 既存の DL/コピー行に `skeleton` タブ用の
     分岐を足し、DL＋コピーを出す。
  2. **Inside `PseudoCodeView` (the tab body) / タブ内**: read-only monospace `<textarea>` ＋ **Copy + Download**
     (`ExportView` のアクションボタン列パターンを踏襲)。
  3. **Toolbar File menu (GUI §5) / ツールバーの File メニュー（GUI §5）**: like the CSV/SVG exports, add
     **Download Skeleton** and **Copy Skeleton** entries driven by graph-bound wrappers
     (`*FromGraph`-style, mirroring `downloadDecisionTableCSVFromGraph`). / CSV/SVG と同様、グラフから直接
     計算するラッパ（`downloadDecisionTableCSVFromGraph` 同型）で **Download/Copy Skeleton** を追加。
- **Download** writes a plain-text file `skeleton_<date>.txt` via a small `downloadText(content, filename)`
  helper (or reuse the blob-download pattern of `downloadCSV`). / DL は `skeleton_<date>.txt`。`downloadText`
  ヘルパ（または `downloadCSV` のパターン流用）。
- Tab placement: between **Compare** and **NeoCEG Language**. / タブ位置: Compare と NeoCEG Language の間。
- **Always-visible validity banner (GUI §7.4).** The panel's `useMemo` computes the `SkeletonResult`; its
  `status` (≠ `verified` → warning A) and `multiEffect` (→ warning B) feed the existing panel-level warning
  banner — rendered **outside** the tab switch and the collapse block, so it shows on any tab and even when
  collapsed. The warning is **not** confined to the Skeleton tab. / パネルの `useMemo` が `SkeletonResult` を
  計算し、`status`（≠`verified`→警告A）と `multiEffect`（→警告B）で既存のパネル警告バナーを駆動。バナーは
  タブ切替・開閉ブロックの外に描画し、どのタブでも・折りたたみ時でも表示。Skeleton タブ内に限定しない。

### 11.5 Testing / テスト
`src/__tests__/skeletonExporter.test.ts` — build the model from the admission-fee DSL
(`parseLogicalDSL` → `generateOptimizedDecisionTableWithState`). The **primary** test (§8 #1) **enumerates
every constraint-valid input** (the ONE groups ⇒ 2×4×2 = 16) and asserts the generated skeleton returns the
**same effect as evaluating the CEG model** for each — including non-MC/DC points such as "group + 65+ → Free".
Then the structural cross-checks: path count = 7, intermediate definitions present, gates reproduce topology.
(The original test — checking only the 7 columns — is what let the bug ship; it must not be the basis.)
/ **主テスト**（§8 #1）は**全制約充足入力**（ONE 群 ⇒ 2×4×2=16）を列挙し、各入力で骨格の戻り値が
**CEG モデル評価と一致**することを表明（「団体＋65歳以上→無料」等の非 MC/DC 点を含む）。続いて構造チェック
（パス数7・中間定義・ゲートのトポロジー再現）。7列だけの検証はバグを通した原因なので基準にしない。

### 11.6 Out of scope / 非対象
- Algorithm follows the **revised** §2–§5 (topology + constraint premise + feasible-space verification). The
  first column-fitting implementation is replaced. / アルゴリズムは**改訂** §2–§5（トポロジー＋制約前提＋
  実行可能空間検証）に従う。初版の列当てはめ実装は置き換える。
- Constraint-violating inputs are out of scope (premise, §7). / 制約違反入力は対象外（前提・§7）。
- Learning-mode (2^n) table is **not** used. / 学習モード（2^n）テーブルは使わない。
- Language emitters (TS/Python) and `flat` nesting — deferred (§6 options). / 言語出力器・flat は後回し。
  (Download **is** in scope — see §11.4. / DL は対象内、§11.4 参照。)

### 11.7 Decisions (confirmed) / 確定事項
All confirmed — ready to implement on explicit go-ahead. / すべて確定。明示の「実装して」で着手可。

1. **Tab label / タブ名**: `Skeleton`.
2. **Tab position / タブ位置**: between **Compare** and **NeoCEG Language** / Compare と NeoCEG Language の間。
3. **Copy + Download**, in the panel header menu, inside the tab, *and* the toolbar File menu (parity with CSV/SVG)
   / コピー＋DL を、ヘッダメニュー・タブ内・ツールバー File メニューの3か所に（CSV/SVG と一貫）。
4. **Intermediate operator case / 中間定義の演算子表記**: `AND` (DSL-consistent) / `AND`（DSL 準拠）。
5. **Empty/invalid graph / 空・不正グラフ時**: placeholder `No decision table to render`
   / プレースホルダ「表示できるデシジョンテーブルがありません」。
6. **Label presentation / ラベルの提示**: legend block (causes + intermediates) up front **plus** an
   inline comment on each guard/return (§11.2) / 冒頭の凡例（原因＋中間）＋各ガード・戻り値の行内コメント。
7. **Validity warnings / 妥当性の警告**: surface **both** warning A (skeleton not verified) and B
   (decision-table column firing ≥2 effects) in the **always-visible** panel banner — independent of the
   active tab and collapse state (GUI §7.4). Advisory (amber), never blocking. / 警告 A（スケルトン未検証）
   と B（複数効果列）の**両方**を、**常時表示**のパネルバナーに出す（タブ・開閉非依存。GUI §7.4）。助言的
   （amber）でブロックしない。
