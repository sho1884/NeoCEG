# NeoCEG DSL Grammar Specification v1.5

**Status**: Finalized (2026-02-08)
**Language**: English (primary) / 日本語 (説明)

---

## Overview / 概要

This document defines the formal grammar for the NeoCEG DSL (Domain-Specific Language) used to describe cause-effect graphs.

本ドキュメントは、NeoCEG DSL（原因結果グラフ記述言語）の正式文法を定義します。

### Key Features / 主要特徴

- **Human-readable syntax** / 人間可読な構文
- **Unicode support for node labels** (Japanese, etc.) / ノードラベルのUnicode対応（日本語等）
- **English-only keywords** / キーワードは英語のみ
- **Optional layout information** / レイアウト情報はオプション

---

## EBNF Grammar / EBNF文法

```ebnf
(* NeoCEG DSL Grammar v1.5 *)
(* Authoring note (incl. AI): to build a graph from requirements, output ONLY    *)
(* .nceg DSL conforming to this grammar — no prose, no code fences, no comments   *)
(* of your own. Names follow the factor = level convention below.                 *)

(* ============================================================================= *)
(* Top-level structure / 最上位構造 *)
(* ============================================================================= *)

program         = { statement } ;

statement       = comment
                | node_definition
                | constraint_stmt
                | layout_stmt ;

comment         = "#" text newline ;

(* ============================================================================= *)
(* Node definitions / ノード定義 *)
(* ============================================================================= *)

(* Cause node (in-degree 0):           n1 : "user clicks login"  *)
(* Effect/Intermediate node (has :=):  n3 := n1 AND n2           *)
node_definition = identifier ( cause_def | effect_def ) ;

cause_def       = ":" string ;
effect_def      = ":=" expression ;

(* --------------------------------------------------------------------------- *)
(* Naming convention — factor = level (shared with NeoCombi's factor/level      *)
(* domain). Name a CAUSE by an ATTRIBUTE and its VALUE, where the value is an   *)
(* EQUIVALENCE CLASS (not a raw value). Name an EFFECT as an output factor =    *)
(* level too. Logic (AND/OR/NOT) lives in the graph, NEVER inside a node name.  *)
(*   天候 = 雨          weather = rainy                                         *)
(*   気温 = 低          temperature = low        (level = equivalence class)    *)
(*   風   = 強い        wind = strong                                           *)
(*   服装 = 上着あり    outfit = coat            (effect: output factor=level)  *)
(* The factor = level text is the node's quoted LABEL; reference it by a short  *)
(* identifier that mirrors it (no spaces/'='):  天候_雨 : "天候 = 雨".          *)
(* Levels of one factor are mutually exclusive -> usually a ONE(...) constraint.*)
(* Name a CAUSE/INTERMEDIATE by its attribute, not a downstream consequence:    *)
(*   ❌ cause 要傘 (a conclusion)      ✅ cause 天候 = 雨 (the attribute)         *)
(* An EFFECT *is* the conclusion, so name it by the outcome (output factor=level)*)
(*   ✅ effect 傘 = 必要 / umbrella = needed                                     *)
(* English-only caution: a level may contain ANY words EXCEPT the grammar's     *)
(* logical keywords or / and / not — they would read as the operators.          *)
(*   ❌ age = 65 or older      ✅ age = 65+   (same meaning, no keyword)          *)
(* (Japanese levels are unaffected: the keywords are English. temp = hot is OK.) *)
(* --------------------------------------------------------------------------- *)

(* ============================================================================= *)
(* Logical expressions / 論理式 *)
(* ============================================================================= *)

(* A node body is exactly ONE gate (single level): an OR of literals, an AND of *)
(* literals, or a single literal. No parentheses, no nesting, and no mixing of  *)
(* AND and OR within one node. Compound logic MUST be decomposed into separate, *)
(* named nodes (see "Single-gate rule" under Semantic Rules).                   *)
expression      = or_gate | and_gate | literal ;

or_gate         = literal "OR"  literal { "OR"  literal } ;

and_gate        = literal "AND" literal { "AND" literal } ;

literal         = [ "NOT" ] identifier ;

(* Examples — these mirror the parser tests (src/__tests__/logicalDsl.test.ts): *)
(* ✅ n3 := n1 OR n2             — OR gate                                       *)
(* ✅ n3 := n1 AND n2            — AND gate                                      *)
(* ✅ n3 := n1 AND NOT n2        — gate with a negated literal                  *)
(* ✅ n2 := NOT n1               — a single literal                            *)
(* ✅ compound logic -> two nodes (separate lines):  m := n2 OR n3   then   n4 := n1 AND m *)
(* ❌ n4 := n1 AND n2 OR n3      — AND and OR mixed in one node (decompose it)   *)
(* ❌ n4 := n1 AND (n2 OR n3)    — parentheses / nesting (decompose it)         *)
(* 例（上記はパーサのテストと一致）: 1ノード＝1ゲート。混在・括弧・ネストは不可、 *)
(* 複合論理は中間ノード m に分解する。                                          *)

(* ============================================================================= *)
(* Constraints / 制約 *)
(* ============================================================================= *)

constraint_stmt = symmetric_constraint
                | directional_constraint ;

(* Symmetric constraints: ONE, EXCL, INCL *)
(* ✅ ONE(n1, n2, n3)   ✅ EXCL(n1, n2)   ✅ INCL(n1, n2)                       *)
symmetric_constraint = ( "ONE" | "EXCL" | "INCL" )
                       "(" member_list ")" ;

(* Directional constraints: REQ, MASK *)
(* REQ: NOT on source or targets, but not both simultaneously *)
(* ✅ REQ(n1 -> n2)   ✅ REQ(NOT n1 -> n2)   ✅ REQ(n1 -> NOT n2)               *)
(* ❌ REQ(NOT n1 -> NOT n2)   — NOT on both source and target                  *)
(* MASK: NOT on trigger only, targets always positive *)
(* ✅ MASK(NOT n1 -> n2)   ❌ MASK(n1 -> NOT n2)   — NOT not allowed on a target *)
req_constraint  = "REQ" "(" constraint_member "->" member_list ")" ;
mask_constraint = "MASK" "(" constraint_member "->" identifier_list ")" ;
directional_constraint = req_constraint | mask_constraint ;

identifier_list = identifier { "," identifier } ;

member_list     = constraint_member { "," constraint_member } ;

constraint_member = [ "NOT" ] identifier ;

(* ============================================================================= *)
(* Layout section (optional) / レイアウトセクション（オプション） *)
(* ============================================================================= *)

layout_stmt     = "@layout" "{" { layout_entry } "}" ;

layout_entry    = identifier ":" "(" number "," number [ "," number ] ")" ;
                  (* x, y, optional width / x座標, y座標, 省略可能な幅 *)
                  (* e.g.  n1: (100, 220)   or with width  n1: (100, 220, 180) *)

(* ============================================================================= *)
(* Lexical elements / 字句要素 *)
(* ============================================================================= *)

identifier      = ( letter | unicode_letter ) { letter | digit | "_" | unicode_letter } ;

string          = '"' { string_char | escape_sequence } '"' ;

string_char     = (* any character except " and \ *) ;

escape_sequence = "\" ( "n" | '"' | "\" ) ;
                  (* e.g.  n1 : "He said \"hi\"\nthen left"  ->  newline + quotes *)

number          = [ "-" ] digit { digit } ;

letter          = "a" - "z" | "A" - "Z" ;

digit           = "0" - "9" ;

unicode_letter  = (* Unicode letters: Hiragana, Katakana, Kanji, etc. *)
                  (* Ranges: U+3040-U+309F, U+30A0-U+30FF, U+4E00-U+9FFF *) ;

text            = (* any character until end of line *) ;

newline         = "\n" | "\r\n" ;
```

---

## Semantic Rules / 意味規則

### Node Roles / ノードの役割

Node roles are **derived from graph structure**, not explicitly specified:

ノードの役割はグラフ構造から**自動判定**され、明示的に指定しません：

| Role / 役割 | Definition / 定義 | DSL Syntax / DSL構文 |
|------------|------------------|---------------------|
| **Cause** / 原因 | No incoming edges (in-degree = 0) / 入力辺なし | `name: "label"` |
| **Effect** / 結果 | No outgoing edges (out-degree = 0) / 出力辺なし | `name := expression` |
| **Intermediate** / 中間 | Has both incoming and outgoing edges / 入出力辺あり | `name := expression` |

### Keywords / キーワード

All keywords are **case-insensitive** but conventionally written in **UPPERCASE**.

キーワードは**大文字小文字を区別しない**が、慣例的に**大文字**で記述します。

| Keyword / キーワード | Purpose / 用途 |
|---------------------|---------------|
| `AND` | Logical conjunction / 論理積 |
| `OR` | Logical disjunction / 論理和 |
| `NOT` | Logical negation / 否定 |
| `ONE` | Exactly-one constraint / 排他的選択制約 |
| `EXCL` | Exclusive constraint / 排他制約 |
| `INCL` | Inclusive constraint / 包含制約 |
| `REQ` | Requires constraint / 要求制約 |
| `MASK` | Masking constraint / マスク制約 |

### Single-gate rule (one gate per node) / 単層ゲート規則（1ノード＝1ゲート）

A node body is **exactly one gate**: an `AND` of literals, an `OR` of literals, or a single literal, where a
literal is an (optionally `NOT`-negated) reference to another node. This mirrors the cause-effect graph
itself, where each node is a single AND/OR gate and inputs are edges (optionally negated).

- **No parentheses, no nesting, no AND/OR mixing within one node.** A compound sub-expression is a *separate
  gate*, so it must be its **own named node**. Example: `E := A OR (B AND C)` is **not allowed**; introduce a
  node `M := B AND C` and write `E := A OR M`.
- The parser **rejects** nested / mixed / parenthesised expressions with a clear, line-numbered error that
  names the offending node and suggests decomposition.
- Because only one operator type appears in a node, no cross-operator precedence is needed; `NOT` applies to
  the single literal it precedes.

ノード本体は**ちょうど1ゲート**（リテラルの `AND`／`OR`／単一リテラル。リテラルは（任意で `NOT` 否定した）
他ノードへの参照）。これは CEG 本体—各ノードが単一の AND/OR ゲートで、入力は（否定可能な）辺—に対応する。

- **括弧・入れ子・AND/OR 混在は不可。** 複合部分式は*別ゲート*なので**それ自体を名前付きノード**にする。
  例: `E := A OR (B AND C)` は**不可**。`M := B AND C` を作り `E := A OR M` と書く。
- パーサは入れ子・混在・括弧を、**該当ノード名と分解の示唆を含む行番号付きエラー**で**拒否**する。
- 1ノードに1種類の演算子しか現れないため、演算子間の優先順位は不要。`NOT` は直後の単一リテラルに適用。

---

## Pragmatics / 語用論（作法）

These conventions **cannot be enforced by the grammar** (a parser cannot judge whether a name is a
meaningful concept). They are the modeling **discipline (作法)** of the cause-effect graph method, to be
followed by the author — human or AI.
これらは**文法では強制できない**（名前が意味のある概念かはパーサに判定できない）。原因結果グラフ法の
**モデリング作法**であり、作成者（人間・AI）が守る。

### P1. A node is a proposition / ノードは命題である
Every node denotes a **logical statement (proposition)** — the condition or effect it represents. **Unlike an
electronic circuit, an intermediate node's meaning must be stated**; it is not an anonymous internal wire.
The statement is the node's identity and is what the tool displays.
すべてのノードは**論理言明（命題）**＝表す条件／効果。**電子回路と違い、中間ノードの意味は明記必須**
（無名の内部配線ではない）。言明がノードの同一性であり、表示されるもの。

### P2. The expression is the definition; each gate is its own named node / 式は定義、各ゲートは名前付きノード
`:= expression` is the node's **definition** (when the effect/intermediate holds) — a **different thing** from
its statement. In CEG, **each gate is its own named node**: decompose compound logic so that every sub-gate
(e.g. `B AND C`) is its own named node and reference it. (The single-gate rule enforces this syntactically.)
`:= 式` は**定義**（成立条件）で、命題とは**別物**。CEG では**各ゲートがそれ自体名前付きノード**：複合論理は
各部分ゲート（例 `B AND C`）をそれぞれ名前付きノードにして参照する（単層ゲート規則で構文的にも保証）。

### P3. Use the expression as a hint for the concept name / 式は概念命名の手がかり
Naming an intermediate means **verbalizing an abstraction**, which can be hard. Use the expression as a hint —
*"what concept is true exactly when `天候_雨 AND 気温_低` holds?"* → e.g. "冷雨" (cold rain). The tool should
present the expression as a **naming aid**, not silently adopt it as the name.
中間ノードの命名は**抽象の言語化**で難しいことがある。式を手がかりに「`天候_雨 AND 気温_低` がちょうど真に
なる概念は？」と考える（例「冷雨」）。ツールは式を**命名補助**として示し、黙って名前に採用しない。

**Name by the attribute the group has / その集合が持つ属性で名づける.** Model attribute-first: first
recognise the condition — *"there are situations that are both rainy and cold"* → "冷雨 (cold rain)" — then
decide the downstream effects (umbrella, coat, …) for it. A name that describes the condition itself stays
meaningful however those effects are later defined. **This applies to causes and intermediates only — an
effect node *is* the outcome, so naming it by the conclusion is correct** (as an output `factor = level`, e.g.
`傘 = 必要` / umbrella = needed).
属性ファーストで考える：まず集合を捉え（「雨かつ寒い状況がある」）→ その集合に対する下流の効果
（傘・上着など）を決める。集合そのものを表す名前は、効果の決め方が後で変わっても意味が保たれる。**これは
原因・中間ノードの話。結果ノードは帰結そのものだから、結論で名づけてよい**（出力 `factor = level`、例
`傘 = 必要`）。

### P4. Prefer a real concept name; expression-as-name is a fallback / 概念名を優先、式の代用は予備
Always aim for a genuine concept name (P3). Only when none can be found, the expression itself may serve as
the name as a fallback — the node still exists; its name slot just holds the formula. A node still named by an
auto-id (e.g. `n1`) or by its expression is **not yet fully modelled**, so the tool surfaces it as an
invitation to name it.
まず本物の概念名を目指す（P3）。どうしても無いときに限り、式を名前の予備として使ってよい（ノードは存在、
名前欄に式が入るだけ）。自動 id（`n1` 等）のまま、または式と同一の名前のノードは**まだモデリング途上**で、
ツールはそれを示して命名を促す。

### P5. Recommended form / 推奨形
Prefer a short reference identifier plus a quoted statement — references stay stable, the displayed concept is
explicit:
参照用の短い識別子＋引用符付き言明を推奨（参照は安定・表示概念は明示）：

    冷雨: "冷たい雨"
    冷雨 := 天候_雨 AND 気温_低

A meaningful identifier may itself serve as the statement when no separate label is given; the tool then
displays the identifier (never the expression).
意味のある識別子は別ラベルが無ければそのまま言明として機能してよい。ツールは識別子を表示する（式は表示しない）。

### P6. Name causes (and effects) by `factor = level` — equivalence class / 原因（と結果）は `因子 = 水準`（同値クラス）で名づける
This is the concrete form of P3 ("name by the attribute"). A **cause** is an atomic proposition: an
**attribute (factor / 因子) at a value (level / 水準)**, where the level is an **equivalence class**, not a raw
value. Name an **effect** as an output `factor = level` too. The compound logic (AND/OR/NOT) is carried by the
**graph** (P2), so a node name is a single `factor = level` proposition — **never an expression, never a raw
comparison**.
P3「属性で名づける」の具体形。**原因**は原子命題＝**属性（因子）に値（水準）**を与えたもので、水準は生値で
なく**同値クラス**。**結果**も出力 `因子 = 水準` で名づける。複合論理（AND/OR/NOT）は**グラフ**が担う（P2）
ので、ノード名は単一の `因子 = 水準` 命題——**式や生比較にしない**。

- **Levels of one factor are mutually exclusive → usually a `ONE(...)`/`EXCL(...)` constraint.** So sibling
  `factor = level` nodes make the constraint structure legible from the names. / 同一因子の水準は相互排他＝
  ふつう `ONE(...)`/`EXCL(...)`。同じ因子の `因子 = 水準` ノード群から制約が読み取れる。
- **NeoCombi unification.** `factor / level (因子 / 水準)` is the shared vocabulary of the sibling tools. In
  NeoCombi a factor is a *parameter*; `factor = level` corresponds to its atomic comparison `[factor] = "level"`
  and a factor's whole level set to a parameter declaration. Keep names **readable** — plain `factor = level`,
  no brackets or quotes; mechanical / AI conversion adds NeoCombi's `[ ]` and `" "`. / 姉妹ツール共通語彙。
  NeoCombi では因子＝パラメータで、`factor = level` は原子比較 `[factor] = "level"` に、因子の水準全体は
  パラメータ宣言に対応。表記は**読みやすさ優先**（素の `因子 = 水準`、括弧・引用なし）、変換側が補う。
- **English-only caution — keep the grammar's logical keywords out of a level name.** An English level name may
  contain **any words except the bare `or` / `and` / `not`**, which would read as the logical operators.
  Rephrase to drop the keyword; the meaning is unchanged. ❌ `age = 65 or older` → ✅ `age = 65+`. A level with
  no keyword is fine as-is (`temp = hot` is perfectly valid). Japanese levels are unaffected — the keywords are
  English. / 英語限定の注意——水準名に文法の論理キーワード `or` / `and` / `not` を入れない（演算子と読めて
  しまう）。キーワードを外して言い換える（意味は不変）。❌ `age = 65 or older` → ✅ `age = 65+`。キーワードを
  含まない水準はそのままでよい（`temp = hot` は問題なし）。日本語の水準は無関係。
- A genuinely **compound** concept is still its own named proposition per P1–P3 (e.g. `冷雨 :=
  天候_雨 AND 気温_低`), built **from** `factor = level` causes — it is not itself a `factor = level`. /
  本当に**複合**の概念は P1–P3 どおり独立の命題として名づけ（`factor = level` の原因から組み立てる）、それ
  自体は `factor = level` にしない。
- **Where it lives.** `factor = level` (with spaces and `=`) is the node's **statement = the quoted label**;
  an identifier cannot contain spaces or `=`. Use a short **identifier that mirrors it with `_`** (e.g.
  `天候_雨`) so it can be referenced in expressions and constraints, and put the `=` form in the label. /
  `factor = level`（空白と `=` を含む）はノードの**言明＝引用符付きラベル**。識別子は空白・`=` を含められない
  ので、それを `_` で写した短い識別子（例 `天候_雨`）で参照し、`=` 形はラベルに書く。

Example / 例:

    天候_晴       : "天候 = 晴"            # identifier mirrors factor_level; label is the statement
    天候_雨       : "天候 = 雨"
    気温_低       : "気温 = 低"             # level = equivalence class, not a raw value
    ONE(天候_晴, 天候_雨)                  # levels of one factor are mutually exclusive
    服装_上着あり : "服装 = 上着あり"        # effect, named as an output factor = level
    服装_上着あり := 天候_雨 OR 気温_低

---

## Example / 使用例

### Basic Example / 基本例

```
# Login feature test design
# ログイン機能のテスト設計

# Causes (inputs)
valid_user_id: "Valid user ID entered"
password_match: "Password matches"
sso_enabled: "SSO is enabled"

# Intermediate nodes
auth_success := valid_user_id AND password_match
sso_auth := sso_enabled AND valid_user_id

# Effects (outputs)
login_result := auth_success OR sso_auth
error_display := NOT auth_success AND NOT sso_auth

# Constraints
ONE(auth_success, sso_auth)
REQ(sso_auth -> sso_enabled)
```

### With Layout / レイアウト付き

```
# Same as above...

# Layout coordinates (optional, width is optional third value)
@layout {
  valid_user_id: (100, 100)
  password_match: (100, 200)
  sso_enabled: (100, 300)
  auth_success: (300, 150, 200)
  sso_auth: (300, 300)
  login_result: (500, 200)
  error_display: (500, 300, 250)
}
```

### Japanese Labels / 日本語ラベル

```
# 日本語ノード名の例

# 原因（入力）
ユーザーID正常: "有効なユーザーIDが入力された"
パスワード一致: "パスワードが一致する"

# 結果（出力）
認証成功 := ユーザーID正常 AND パスワード一致
エラー表示 := NOT 認証成功

# 制約
EXCL(認証成功, エラー表示)
```

---

## Constraints Semantics / 制約の意味

### ONE - Exactly One / 排他的選択制約

Exactly **one** of the members must be true.
メンバーのうち**ちょうど1つ**が真でなければならない。

```
ONE(A, B, C)
```

### EXCL - Exclusive / 排他制約

**At most one** of the members can be true (zero is allowed).
メンバーのうち**最大1つ**が真（0個も可）。

```
EXCL(A, B, C)
```

### INCL - Inclusive / 包含制約

**At least one** of the members must be true.
メンバーのうち**少なくとも1つ**が真でなければならない。

```
INCL(A, B, C)
```

### REQ - Requires / 要求制約

If **source** is satisfied, then **all targets** must satisfy their conditions.
**source**が成立するなら、**すべてのtarget**がその条件を満たさなければならない。

NOT is allowed on the **source side or target side, but not both simultaneously**.
NOTは**ソース側またはターゲット側のいずれか一方のみ**許可。両側同時のNOTは禁止。

> **Why both-sides-NOT is prohibited / 両側NOTを禁止する理由**:
> `REQ(NOT A -> NOT B)` appears to mean "if A=F then B=F", but the double negation makes the intent ambiguous and error-prone.
> This is explicitly prohibited to prevent misunderstanding.
> `REQ(NOT A -> NOT B)` は「A=Fならば B=F」という意味に見えるが、二重否定は意図が曖昧でエラーを招きやすい。
> 誤解防止のため明示的に禁止する。

- `REQ(A -> B, C)` — If A=T then B=T and C=T
- `REQ(NOT A -> B)` — If A=F then B=T
- `REQ(A -> NOT B)` — If A=T then B=F

```
REQ(A -> B, C)        # If A=T then B and C must be T
REQ(NOT A -> B)       # If A=F then B must be T
REQ(A -> NOT B)       # If A=T then B must be F
```

### MASK - Masking / マスク制約

If **trigger** is true, then **all targets** become don't-care (M).
**trigger**が真なら、**すべてのtarget**がdon't-care（M）になる。

> **Note / 注**: NOT is allowed on trigger (left of `->`) only. NOT is prohibited on targets (right of `->`).
> NOTはトリガー（`->`の左側）のみ許可。ターゲット（`->`の右側）のNOTは禁止。
>
> **Why target NOT is prohibited / ターゲットNOTを禁止する理由**:
> The M (Don't Care) value is symmetric under negation — NOT M = M.
> Therefore, `MASK(A -> NOT B)` would have the same effect as `MASK(A -> B)`, making target NOT meaningless.
> M値は否定に対して対称（NOT M = M）であるため、`MASK(A -> NOT B)` は `MASK(A -> B)` と同じ効果になり、ターゲットNOTは無意味。
>
> **REQ vs MASK asymmetry in NOT handling / REQとMASKのNOT処理の非対称性**:
> This contrasts with REQ, where target NOT IS meaningful because REQ sets T/F values:
> これはREQと対照的で、REQはT/F値を設定するためターゲットNOTは意味がある：
> - `REQ(A -> B)`: A=T → B=**T**
> - `REQ(A -> NOT B)`: A=T → B=**F** (different result / 異なる結果)
> - `MASK(A -> B)`: A=T → B=**M**
> - `MASK(A -> NOT B)`: A=T → B=**M** (same result — NOT M = M / 同じ結果)

```
MASK(A -> B, C)       # If A=T then B=M and C=M
MASK(NOT A -> B, C)   # If A=F then B=M and C=M
```

---

## Implementation Notes / 実装ノート

### Parser / パーサー

- Location: [`src/services/logicalDslParser.ts`](../src/services/logicalDslParser.ts)
- Tokenizer supports Unicode identifiers for node names
- トークナイザーはノード名のUnicode識別子をサポート
- Keywords are case-insensitive (converted to uppercase during tokenization)
- キーワードは大文字小文字を区別しない（トークン化時に大文字に変換）

### Serializer / シリアライザー

- Location: [`src/services/logicalDslSerializer.ts`](../src/services/logicalDslSerializer.ts)
- Generates canonical DSL format
- 正規DSL形式を生成
- Optional layout section can be included
- レイアウトセクションをオプションで含めることができる

### Validation / 検証

- All node references in expressions and constraints must be defined
- 式と制約内のすべてのノード参照は定義されている必要がある
- Circular references are allowed (they will be detected at evaluation time)
- 循環参照は許可される（評価時に検出される）
- Constraint members should refer to cause nodes only (checked at runtime)
- 制約のメンバーは原因ノードのみを参照すべき（実行時にチェック）

---

## Compatibility / 互換性

### Not Compatible with CEGTest 1.6 CSV / CEGTest 1.6 CSVとの非互換性

This DSL format is **NOT compatible** with CEGTest 1.6's CSV format.

このDSL形式はCEGTest 1.6のCSV形式と**互換性がありません**。

**Design Decision**: Prioritize human-readability and AI tool integration over legacy compatibility.

**設計判断**: レガシー互換性よりも人間可読性とAIツール連携を優先。

---

## Future Extensions / 将来の拡張

### Planned / 計画中

- **PICT format export** / PICT形式エクスポート
  - Convert constraints to PICT model
  - 制約をPICTモデルに変換
- **@title directive** / @titleディレクティブ
  - Graph title metadata
  - グラフタイトルのメタデータ
- **@attributes section** / @attributesセクション
  - Custom node attributes
  - カスタムノード属性

### Under Consideration / 検討中

- Alternative operator symbols: `&` for AND, `|` for OR, `!` for NOT
- 代替演算子記号: ANDに`&`、ORに`|`、NOTに`!`
- Unicode math symbols: `∧` (AND), `∨` (OR), `¬` (NOT)
- Unicode数学記号: `∧`（AND）、`∨`（OR）、`¬`（NOT）

---

## References / 参照

- [Requirements Specification](./Requirements_Specification.md)
- [Modernization Goals and Design](./Modernization_Goals_and_Design.md)
- [CEGTest 1.6 Feature Analysis](./CEGTest_1.6_Feature_Analysis.md)
- Myers, Badgett, Sandler, "The Art of Software Testing", 3rd Ed., Chapter 4

---

**Document History** / ドキュメント履歴

| Date / 日付 | Version / バージョン | Changes / 変更内容 |
|------------|---------------------|------------------|
| 2026-02-08 | 1.0 | Initial finalized version / 初版確定版 |
| 2026-03-01 | 1.1 | Invert observable flag: `[unobservable]` replaces `[observable]` (backward compat kept) / observable反転：`[unobservable]`に変更（`[observable]`は後方互換維持） |
| 2026-06-13 | 1.2 | Restrict expressions to **one gate per node** (no parentheses / nesting / AND-OR mixing); add **Pragmatics §P1–P5** (node = proposition; expression is a naming hint; expression-as-name is a last resort) / 式を**1ノード1ゲート**に制限（括弧・入れ子・AND/OR混在不可）、**語用論 §P1–P5** を追加（ノード＝命題／式は命名の手がかり／式の名前代用は最後の手段） |
| 2026-06-13 | 1.3 | **Remove the observable flag entirely** (`[unobservable]`/`[observable]` no longer recognised) — feature removed / **観測フラグを完全削除**（`[unobservable]`/`[observable]` は非対応に）— 機能廃止 |
| 2026-03-04 | 1.2 | Add optional width to layout entry: `(x, y, width)` — backward compatible / レイアウトエントリに省略可能な幅を追加：`(x, y, width)` — 後方互換 |
| 2026-06-13 | 1.4 | Add inline ✅/❌ examples to the EBNF comments (single-gate expressions, REQ/MASK NOT rules, constraints, layout, escapes), mirroring the parser tests. Grammar unchanged — illustrative only, aids human and AI authors / EBNFコメントに ✅/❌ 例を追加（単一ゲート式・REQ/MASKのNOT規則・制約・レイアウト・エスケープ）、パーサのテストと一致。文法は不変＝例示のみ、人間とAIの作成を補助 |
| 2026-06-14 | 1.5 | Add the **`factor = level` (equivalence class) naming convention** (Pragmatics §P6) for unification with the sibling tool NeoCombi's factor/level domain; fold a compact digest + an AI output-format note into the EBNF comments. Includes the English-only caution (no `or`/`and`/`not` or raw comparisons inside a level) and the identifier-vs-label rule. Examples use a **deliberately unrelated domain (weather → outfit)** so the spec carries no worked answer for any benchmark used to evaluate AI generation. Grammar unchanged / NeoCombi の factor/level ドメインと統一するため **`factor = level`（同値クラス）命名規則**（語用論 §P6）を追加。圧縮ダイジェストと AI 向け出力体裁メモを EBNF コメントへ畳み込み。英語限定の注意（水準に `or`/`and`/`not` や生比較を入れない）と識別子／ラベルの規則を含む。例は **わざと無関係なドメイン（天候→服装）** を使い、AI 生成の評価に使う題材の答えを仕様に載せない。文法は不変 |
