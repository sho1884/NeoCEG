# NeoCEG Internal Design Specification / 内部詳細設計仕様

**Status**: Draft / ドラフト (2026-06-14)
**Audience**: Implementers only — not end users / 実装者向け（エンドユーザー向けではない）

---

## Purpose / 目的

This document records **internal implementation invariants** that are intentionally
**absent from the user-facing specifications** (`Requirements_Specification.md`,
`GUI_Specification.md`, `DSL_Grammar_Specification.md`).

本書は、**ユーザー向け仕様にあえて書かれていない内部実装の不変条件**を記録する。

**Why a separate document (altitude) / なぜ別文書か（階層）**: At the user-requirements
altitude, a tool user does not see and cannot distinguish a node's internal **identifier**
from its **label** — that distinction is an internal concern. Recording it in a user-facing
spec would mix altitudes. It belongs here.

ユーザー要求の階層では、利用者は内部の**識別子**を見ず、**ラベル**と区別もできない ──
その区別は内部の都合。ユーザー向け仕様に書くと階層が混ざる。だからここに置く。

---

## Scope / 範囲

Currently: **node identity and its preservation across representations**. The document may
grow to cover other internal invariants. / 当面は**ノードの同一性と、表現をまたいだ保持**。
将来、他の内部不変条件にも拡張しうる。

---

## 1. Representations of one graph / 1つのグラフの3つの表現

The same graph exists in three forms, with conversions between them:
同一のグラフが3つの形で存在し、相互変換される：

| Representation / 表現 | Identity field / 同一性の置き場 | Defined in / 定義 |
|----------------------|------------------------------|------------------|
| **DSL** (`.nceg` text) | the identifier token (e.g. `結果_無料`) | `DSL_Grammar_Specification.md` |
| **LogicalModel** (logical layer) | `LogicalNode.name` | `src/types/logical.ts` |
| **GraphData** (React Flow / UI) | — (see §3) | `src/types/graph.ts` |

Conversions / 変換: `parseLogicalDSL`, `serializeLogicalModel`, `logicalToGraph`,
`graphToLogical` (`src/services/modelConverter.ts`).

---

## 2. Node identity invariants / ノード同一性の不変条件

A node's three attributes are **distinct** (the grammar already separates them; this doc only
fixes their *internal handling*): / ノードの3属性は**別物**（文法が既に分離。本書は*内部の扱い*のみ規定）：

- **identifier (identity)** — the stable handle. The DSL author's name; internal/hidden to GUI users.
- **label** — optional human statement (proposition) shown on screen. May be absent.
- **expression** — the `:=` definition. Never an identity, never the display name.

> **INV-1 — Every node has a stable identifier.** / **全ノードは安定した識別子を持つ。**
> Assigned **at creation** (DSL parse *or* GUI node creation), unique within the graph,
> and **never silently regenerated**. A node is never identity-less.
> 生成時（DSLパース*または*GUIでの作成）に付与し、グラフ内で一意、**勝手に振り直さない**。
> 識別子の無いノードは存在しない。

> **INV-2 — Identity is preserved across every conversion and export.** / **同一性は全変換・全出力で保持される。**
> No conversion (`logicalToGraph`, `graphToLogical`) or export (DSL, CSV) may **invent, drop,
> or reassign** a node's identifier. Round-trip `DSL → graph → DSL` must return the original
> identifiers. / いかなる変換・出力も識別子を**作り直し・破棄・置換してはならない**。
> `DSL → グラフ → DSL` の往復で元の識別子が戻ること。

> **INV-3 — Identity/matching keys on the identifier, never the label.** / **同一性判定は識別子で行い、ラベルでは行わない。**
> Identifiers are unique; **labels are not** (a user may give two nodes the same label, or
> none). Any dedup/merge/lookup keyed on the label is incorrect.
> 識別子は一意、**ラベルは非一意**（同名ラベルや空も可）。ラベルで突き合わせる処理は誤り。

---

## 3. Current violations (to be fixed) / 現状の違反（要修正）

Reproduced 2026-06-14 with an identifier-only DSL (no labels on `:=` nodes):
ラベル無しの `:=` ノードを含むDSLで再現（2026-06-14）：

- **`graphToLogical` reassigns `p1, p2, …`**, discarding the identifier → violates **INV-2**.
  Round-trip export yields `p1: "..."`, `p9: "p9"` instead of the author's identifiers.
  `graphToLogical` が `p1, p2…` を振り直し識別子を捨てる → **INV-2 違反**。
- **`graphStore.addNode` creates a node with a `label` only — no identifier** → violates **INV-1**.
  The GUI has no identifier concept; only labels. / GUIに識別子の概念が無く、ラベルだけ。

These are the root of the "identifiers turn into `p9`" bug. The display fallback
(`label ?? identifier`) is **not** a fix — it hides INV violations. Do not lead with it.
これらが「識別子が `p9` 化する」バグの根。表示フォールバックは修正ではなく症状隠し。先に手を付けない。

---

## 4. Target design / あるべき設計

- **GUI node creation** assigns a stable identifier at creation time (stored on the node),
  independent of the typed label. / GUIノード作成時に、入力ラベルとは独立した安定識別子を付与・保持する。
- **GraphData carries the identifier** as a first-class field (not only the React Flow element id,
  which is a UI artifact). / GraphData が識別子を一級フィールドとして保持する（UI都合の要素IDとは別）。
- **`graphToLogical` uses the stored identifier**; generated names (`p…`) are only the
  creation-time generator for as-yet-unnamed GUI nodes — never a per-conversion reassignment.
  `graphToLogical` は保持済み識別子を使う。`p…` 採番は未命名GUIノードの*生成時*生成器に限り、変換ごとの振り直しに使わない。

---

## 5. GUI node identifier assignment / GUIノードの識別子付与

**Context / 背景**: In the GUI a user types a single free-text string, which may contain spaces
or `=` (e.g. `年齢 = 小学生`). That text is a **label/statement**, not a valid identifier
(identifiers disallow spaces and `=`). Yet INV-1 requires an identifier at creation, so the GUI
must supply one. / GUIでは利用者は1つの自由文字列を打ち、空白や `=` を含みうる（例 `年齢 = 小学生`）。
それは**ラベル（言明）**であって識別子ではない（識別子は空白・`=` 不可）。だが INV-1 によりノードは
生成時に識別子を持たねばならず、GUIがそれを用意する必要がある。

**Policy / 方針**:

- **GUI-typed text is the label, not the identifier.** GUI users work visually with statements;
  the identifier stays internal/hidden. / **GUIで打つ文字列はラベル**。識別子は内部に隠れたまま。
- At creation the system **auto-generates a stable identifier** (e.g. `n1, n2, …`): unique in the
  graph, assigned **once**, stored on the node, and **never regenerated by a conversion** (this is
  what fixes the `p1/p2` reassignment bug). The prefix is an implementation detail.
  生成時に**安定識別子を自動採番**（例 `n1, n2…`）：グラフ内一意・一度だけ付与・ノードに保持・
  **変換で振り直さない**（これが `p1/p2` バグの修正点）。接頭辞は実装詳細。
- **DSL-imported nodes keep the author's identifier** (`結果_無料`); no auto-generation.
  **DSL取り込みノードは作者の識別子を維持**（`結果_無料`）。自動採番しない。
- Editing the label, or a role change (cause→intermediate→effect), **does not change the
  identifier**. / ラベル編集や役割変更で**識別子は変わらない**。
- The generator **avoids collisions** with existing identifiers (imported or previously generated).
  採番は既存識別子（取り込み・既採番）と**衝突しない**こと。
- **Display is unchanged** (`GUI_Specification §2.4`): a node shows its label; with none, it shows
  its identifier — and an auto id like `n1` reads as an invitation to name (`§P4`).
  **表示は不変**：ノードはラベルを表示、無ければ識別子を表示。`n1` 等は命名を促す表示として機能。

**Consequence on export / エクスポートへの帰結**: a GUI-built graph serializes as
`n1: "年齢 = 小学生"` … (the conventional *identifier + quoted-label* form, matching existing
fixtures). A DSL-built graph round-trips with its **original** identifiers.
GUIで作ったグラフは `n1: "年齢 = 小学生"` …（従来の*識別子＋引用ラベル*形、既存フィクスチャと同形）で
出力。DSLで作ったグラフは**元の**識別子のまま往復する。

## 6. An author-given symbol IS the statement (label = identifier) / 作者が書いた記号が言明（label = identifier）

When a node is defined by an identifier and an expression with **no separate quoted
label** (e.g. `結果_無料 := …`), the **identifier itself is the author's logical
statement**. Writing a proposition as a short symbol is normal and complete in logic; it
is **not** a missing label, an incomplete / "to-be-named" node, or a display-only fallback.
The tool must **respect the author's string and never rewrite it** — rewriting would turn
it into a different expression (the author's wording is lost) and obscure the
identifier ↔ statement correspondence.

ラベル行を書かずに識別子＋論理式でノードを定義したとき（例 `結果_無料 := …`）、**識別子そのものが
作者の論理言明**。命題を短い記号で書くのは論理学では正規かつ完全で、「ラベル欠落」「未命名」「表示だけの
代替」ではない。ツールは**作者の文字列を尊重し、勝手に書き換えない**（書き換えると別表現になり作者の表現が
失われ、識別子↔言明の対応も不明瞭になる）。

**Rules / 規則**:

- For a node whose statement was given **only as the identifier** (no separate label),
  assign the **same string to both `name` (identifier) and `label`**, at parse time. Both
  fields hold the author's one string. / 言明が識別子だけで与えられたノードは、**`name` と `label`
  の両方に同じ文字列**を代入（パース時）。両フィールドが作者の同一文字列を持つ。
- The serializer **emits both** the proposition line (`name: "label"`) and the `:=` line,
  **consistently** — it does **not** try to reconstruct the author's original minimal DSL.
  Once the identifier is adopted as the statement there is nothing to hide; and the label
  may be **edited on the graph later**, after which it diverges from the identifier — so any
  "suppress when `label === name`" rule would be inconsistent, and the original identifier
  could even become noise. Export reflects the **current model state**, not the original input.
  シリアライザは命題行（`name: "label"`）と `:=` 行を**両方・一貫して出力**し、作者の元の最小DSLを
  復元しようとはしない。識別子を言明として採用した以上隠す必要はなく、ラベルは後で**グラフ上で編集**され
  うる（編集後は識別子と乖離する）。よって「`label === name` なら省略」は一貫性を欠き、元の識別子はノイズに
  なりうる。出力は**現在のモデルの状態**を反映する（元の入力ではない）。
- This copy applies **only to author-given identifiers**. A system-auto-generated GUI id
  (`n1`, see §5) is not an author statement: it is **not** copied into the label and still
  reads as "to be named". / この代入は**作者が与えた識別子のみ**。GUI自動採番 (`n1`, §5) は作者の
  言明ではないので**代入せず**、「命名を促す」対象のまま。

**Net effect / 帰結**: the author's symbol shows on screen as the statement; export reflects
the current model (both the identifier and its label — equal until the user edits the label);
the identifier ↔ label correspondence is explicit.
作者の記号が画面に言明として表示され、出力は現在のモデルを反映（識別子とそのラベル＝編集前は同一）。
識別子↔ラベルの対応は明示。

---

## References / 参照
- `DSL_Grammar_Specification.md` §P5–P6 (identifier vs label) / 識別子とラベル
- `GUI_Specification.md` §2.4 (display: label, else identifier) / 表示規則
- `Requirements_Specification.md` (node = proposition; user-altitude) / ノード＝命題（ユーザー階層）
