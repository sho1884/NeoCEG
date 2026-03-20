# 原因結果グラフ法 デシジョンテーブル生成アルゴリズム設計書

---

## アルゴリズム参照元

本ドキュメントで説明するアルゴリズムは、**CEGTest 1.6** (加瀬正樹氏開発) のアルゴリズムの方法を理解し、参考としている。

| 項目 | 内容 |
|------|------|
| 参照元ソフトウェア | CEGTest 1.6 (2013-08-04) |
| 作者 | 加瀬正樹 (Masaki KASE) |

**NeoCEGの実装方針:**
- コードのコピー: なし（TypeScriptで全面書き直し）
- アーキテクチャ: 異なる（関数型・型安全 vs グローバル状態・OOP）
- アルゴリズム概念: CEGTestの方法を理解して参考とする

---

## 1. 概要

### 1.1 目的

原因結果グラフ法（CEG: Cause-Effect Graphing）に基づき、**最小限のテスト条件**でグラフ内の全論理式を網羅するデシジョンテーブルを生成する。

### 1.2 参考文献

- Myers, Badgett, Sandler "The Art of Software Testing" 3rd Ed., Ch.4
- ISO/IEC/IEEE 29119-4 Software Testing - Part 4: Test Techniques
- CEGTest 1.6 (加瀬正樹)

### 1.3 アルゴリズムの全体像

アルゴリズムは3つのフェーズで構成される:

1. **論理式網羅フェーズ**: 全論理式が少なくとも1つのテスト条件でカバーされるまで、テスト条件を生成する
2. **敗者復活フェーズ**: 全原因ノードがT/t・F/fの両方の値を持つことを保証する
3. **弱テスト削除フェーズ**: いずれかの論理式を唯一カバーしているテスト条件のみを残し、そうでないテスト条件を削除する

---

## 2. 真理値の体系

### 2.1 値の種類と意味

本アルゴリズムでは6種類の真理値を使い分ける。**大文字と小文字は意味が異なり、厳密に区別する。**

| 値 | 名称 | 意味 | 設定される場面 |
|----|------|------|--------------|
| `T` | 明示的真 | 論理式定義、または制約演繹により**明示的に**Trueと決定された | `getLogicValue()`, 制約 `deduceLogic()` |
| `t` | 推論的真 | 論理伝播、または原因ノード割り当てにより**推論的に**Trueと判明した | `deduceValue()`, `chooseCauseValue()` |
| `F` | 明示的偽 | 論理式定義、または制約演繹により**明示的に**Falseと決定された | `getLogicValue()`, 制約 `deduceLogic()` |
| `f` | 推論的偽 | 論理伝播、または原因ノード割り当てにより**推論的に**Falseと判明した | `deduceValue()`, `chooseCauseValue()` |
| `M` | マスク | MASK制約により値が不問（マスクされている）| `maskLogic()` |
| `I` | 不確定 | マスクまたは不確定な入力により、出力が確定しない | `deduceValue()` |
| `""` | 未設定 | まだ値が割り当てられていない | 初期状態 |

### 2.2 カバレッジ判定と大文字/小文字の関係

カバレッジ判定（論理式がテスト条件にカバーされるか）は**完全一致比較**で行う:

```
カバー条件: 論理式の全値セルについて work[k] == logics[l][k]
```

この比較は**大文字と小文字を区別する**。すなわち:
- `"T" != "t"`: 論理式が `"T"` を要求している場合、作業配列が `"t"` では一致しない
- `"F" != "f"`: 同様

これにより、論理式定義の値（大文字）と推論値（小文字）が区別され、
テスト条件が論理式の意図する状況を正確に反映しているかが検証される。

### 2.3 論理演算における値の扱い

#### 2.3.1 AND演算

AND演算の「満足」とは、各入力が**有効な値**であること:
- NOT無しエッジ: T/t が満足、F/f が非満足
- NOT有りエッジ: F/f が満足、T/t が非満足

```
FUNCTION evaluateAND(inputs[]) -> value:
    FOR each input IN inputs:
        IF input is 非満足:
            RETURN "f"  // 短絡: 1つでも非満足なら偽（推論的）
        IF input is M or I:
            mark 不確定
    IF 不確定:
        RETURN "I"
    RETURN "t"  // 全入力が満足（推論的）
```

#### 2.3.2 OR演算

```
FUNCTION evaluateOR(inputs[]) -> value:
    FOR each input IN inputs:
        IF input is 満足:
            RETURN "t"  // 短絡: 1つでも満足なら真（推論的）
        IF input is M or I:
            mark 不確定
    IF 不確定:
        RETURN "I"
    RETURN "f"  // 全入力が非満足（推論的）
```

#### 2.3.3 重要な注意: 推論値は常に小文字

`deduceValue()` の出力は常に小文字 (`"t"`, `"f"`) または `"I"` である。
大文字の `"T"`, `"F"` は論理式定義（`getLogicValue()`）と制約演繹（`deduceLogic()`）のみが設定する。

### 2.4 MASK値を含む演算（NeoCEGでのバグ修正）

CEGTest 1.6では、M（マスク）値の論理演算に不正確な部分がある。

| 演算 | CEGTest 1.6 | NeoCEG (正解) | 根拠 |
|------|-------------|---------------|------|
| M ∧ M | 不定（T/Fになりうる） | I（不確定） | M∧M の結果は確定しない |
| M ∧ T | 不定 | I（不確定） | Mの値次第でT/F両方ありうる |
| M ∧ F | F | f（偽確定） | F が吸収元なので M に関わらずF |
| M ∨ T | T | t（真確定） | T が吸収元なので M に関わらずT |
| M ∨ F | 不定 | I（不確定） | Mの値次第でT/F両方ありうる |
| M ∨ M | 不定 | I（不確定） | M∧M の結果は確定しない |

**参考**: CEGTest 1.6 における既知の不具合

---

## 3. データ構造

### 3.1 論理式配列 `logics[l][k]`

2次元配列。各論理式（式番号 `l`）について、各ノード（ノード番号 `k`）の要求値を格納する。

- `l`: 論理式の通し番号（0始まり）
- `k`: ノード番号（0始まり）
- 値: `"T"`, `"F"`, または `""`（無関係）

**重要**: logics配列の値は常に**大文字** (`"T"`, `"F"`) である。

**例**: `A AND B → C` の場合（A=ノード0, B=ノード1, C=ノード2）

| 式番号 | A (k=0) | B (k=1) | C (k=2) | 説明 |
|-------|---------|---------|---------|------|
| l=0 | T | T | T | 全入力が満足 → 出力T |
| l=1 | F | T | F | Aが非満足 → 出力F |
| l=2 | T | F | F | Bが非満足 → 出力F |

### 3.2 作業配列 `work[k]`

1次元配列。テスト条件生成中の各ノードの現在の値を保持する。

- `k`: ノード番号
- 値: `"T"`, `"t"`, `"F"`, `"f"`, `"M"`, `"I"`, `""`

### 3.3 テスト結果配列 `tests[t][k]`

生成された全テスト条件を格納する2次元配列。

- `t`: テスト条件番号
- `k`: ノード番号
- 値: `"T"`, `"t"`, `"F"`, `"f"`, `"M"`, `"I"`

### 3.4 カバレッジ配列 `covs[t][l]`

各テスト条件が各論理式をカバーするかを記録する2次元配列。

- `t`: テスト条件番号
- `l`: 論理式番号
- 値: `0`（カバーしない）, `1`（カバーする）

### 3.5 当該テストカバレッジ `vtestcov[l]`

現在生成中のテスト条件が各論理式をカバーするかの一時配列。

- `l`: 論理式番号
- 値: `0` または `1`

### 3.6 採用履歴 `turns[]`

現在のテスト条件生成で採用した選択を記録する配列。

- 値が `lnum` 未満: 論理式番号（論理式を採用した）
- 値が `lnum` 以上: 原因ノードの値選択をエンコード
  - `lnum + nodeIndex * 2`: ノードにTを割り当て
  - `lnum + nodeIndex * 2 + 1`: ノードにFを割り当て

**注意**: `chooseCauseValue()`は小文字 `"t"`/`"f"` で呼ばれるため、
大文字 `"T"`/`"F"` の条件チェックに合致せず、実際には原因ノードの選択は
`turns[]` に記録されない。これは敗者復活フェーズでのみ明示的に記録される。

### 3.7 不適切マーク `unsuitables[i]`

バックトラッキングで不適切とマークされた選択。

- `i < lnum`: 論理式番号
- `i >= lnum`: 原因ノードの値選択（turnsと同じエンコーディング）
- 値: `0`（適切）, `1`（不適切）

### 3.8 テスト不可能マーク `infeasibles[l]`

テスト不可能な論理式。

- `l`: 論理式番号
- 値: `""`（テスト可能）, または不可能理由の文字列

### 3.9 弱テストマーク `weaks[t]`

弱テスト条件（一意的カバレッジを持たない）。

- `t`: テスト条件番号
- 値: `0`（強テスト）, `1`（弱テスト＝削除対象）

### 3.10 `lnum`（論理式総数）

全ノードの論理式数の合計。原因ノードはゼロ、中間/結果ノードはそれぞれ `(入力数 + 1)` 個。

---

## 4. 論理式の抽出

### 4.1 概要

各ノード（中間ノード・結果ノード）の論理演算に対して、`(入力数 + 1)` 個の論理式を生成する。

- ANDノード: 1個の「全入力満足」式 + 入力数個の「1入力非満足」式
- ORノード: 入力数個の「1入力満足」式 + 1個の「全入力非満足」式

### 4.2 ノードの接続情報

各ノードは接続情報（`seq`）を持つ。これは各ノードについて:
1. 接続フラグ（このノードが入力か）
2. NOT（否定）フラグ

から構成される。

### 4.3 ANDノードの論理式生成

ANDノード `N` が入力 `I_0, I_1, ..., I_{n-1}` を持つ場合:

```
FUNCTION generateANDExpressions(node N, inputs I[0..n-1]) -> expressions[0..n]:

    // 式 0: 全入力が満足 → ノードT
    expressions[0]:
        FOR each input I[j]:
            IF I[j] is NOT-connected:
                expressions[0][I[j]] = "F"  // NOT付き: Fが満足
            ELSE:
                expressions[0][I[j]] = "T"  // NOT無し: Tが満足
        expressions[0][N] = "T"

    // 式 1〜n: i番目の入力が非満足、残りは満足 → ノードF
    FOR i = 1 TO n:
        // (i-1) 番目の入力が非満足
        target_input = i番目の入力（順番に対応）
        FOR each input I[j]:
            IF j == target_input:
                IF I[j] is NOT-connected:
                    expressions[i][I[j]] = "T"  // NOT付き: Tが非満足
                ELSE:
                    expressions[i][I[j]] = "F"  // NOT無し: Fが非満足
            ELSE:
                IF I[j] is NOT-connected:
                    expressions[i][I[j]] = "F"  // 残りは満足
                ELSE:
                    expressions[i][I[j]] = "T"  // 残りは満足
        expressions[i][N] = "F"
```

### 4.4 ORノードの論理式生成

ORノード `N` が入力 `I_0, I_1, ..., I_{n-1}` を持つ場合:

```
FUNCTION generateORExpressions(node N, inputs I[0..n-1]) -> expressions[0..n]:

    // 式 0〜n-1: i番目の入力が満足、残りは非満足 → ノードT
    FOR i = 0 TO n-1:
        target_input = i番目の入力
        FOR each input I[j]:
            IF j == target_input:
                IF I[j] is NOT-connected:
                    expressions[i][I[j]] = "F"  // NOT付き: Fが満足
                ELSE:
                    expressions[i][I[j]] = "T"  // NOT無し: Tが満足
            ELSE:
                IF I[j] is NOT-connected:
                    expressions[i][I[j]] = "T"  // NOT付き: Tが非満足
                ELSE:
                    expressions[i][I[j]] = "F"  // NOT無し: Fが非満足
        expressions[i][N] = "T"

    // 式 n: 全入力が非満足 → ノードF
    expressions[n]:
        FOR each input I[j]:
            IF I[j] is NOT-connected:
                expressions[n][I[j]] = "T"  // NOT付き: Tが非満足
            ELSE:
                expressions[n][I[j]] = "F"  // NOT無し: Fが非満足
        expressions[n][N] = "F"
```

### 4.5 論理式の番号付け

論理式はノードの走査順に通し番号が付けられる:
- ノード0の式0, 式1, ..., 式m_0
- ノード1の式0, 式1, ..., 式m_1
- ...

原因ノード（入力を持たないノード）は論理式を生成しない（`lnum = 0`）。

### 4.6 要求値の範囲

各論理式の `logics[l][k]` は、**そのノード自身と直接の入力ノード**のみに値を持つ。
他のノードのセルは `""` （無関係）となる。

**例**: `A AND B → I AND C → E` の場合（A,B,C=原因、I=中間、E=結果）

ノードIの論理式:
| 式番号 | A | B | C | I | E |
|--------|---|---|---|---|---|
| l=0 | T | T | | T | |
| l=1 | F | T | | F | |
| l=2 | T | F | | F | |

ノードEの論理式:
| 式番号 | A | B | C | I | E |
|--------|---|---|---|---|---|
| l=3 | | | T | T | T |
| l=4 | | | F | T | F |
| l=5 | | | T | F | F |

**注意**: 式l=3〜l=5にはA, Bの値がない（`""`）。これは、Eの論理式は
Eの直接入力（I, C）のみに関心があるためである。マージ時に矛盾がなければ、
間接的な整合性は `isPossible()` で検証される。

---

## 5. メインループ

### 5.1 calcTABLE: テーブル生成のエントリポイント

```
FUNCTION calcTABLE():
    // 初期化
    tests = []
    covs = []
    lnum = 全ノードの論理式数の合計
    vtestcov = Array(lnum, 初期値 0)
    unsuitables = Array(lnum + 2 * nodeCount, 初期値 0)
    infeasibles = Array(lnum, 初期値 "")

    // === フェーズ1: 論理式網羅 ===
    uncover = -1
    FOR iteration = 0 TO lnum - 1:
        // 各テスト条件生成ごとにリセット
        vtest = Array(nodeCount, 初期値 "")
        vtestcov = Array(lnum, 初期値 0)
        unsuitables = Array(lnum + 2*nodeCount, 初期値 0)
        turns = []

        IF nextCondition(vtest, lnum) == TRUE:
            tests.append(copy of vtest)
        ELSE:
            // テスト条件生成失敗（全てテスト不可能）
            BREAK

        // 網羅完成チェック
        complete = TRUE
        FOR l = 0 TO lnum - 1:
            IF infeasibles[l] != "":
                CONTINUE
            IF countCoverage(l) == 0:
                IF uncover == l:
                    ERROR "論理式(l+1)が網羅できません"
                    RETURN
                uncover = l
                complete = FALSE
                BREAK
        IF complete:
            BREAK

    // === フェーズ2: 敗者復活（結果網羅）===
    FOR each causeNode i:
        IF causeNode i is 孤立（どのノードの入力にもなっていない）:
            CONTINUE

        // T/t と F/f のカウント
        countT = tests中でノードiがT/tである数
        countF = tests中でノードiがF/fである数

        IF countT == 0:
            // Tが不足: t を設定してテスト条件生成
            vtest = Array(nodeCount, 初期値 "")
            vtest[i] = "t"
            turns = [lnum + i * 2]  // 明示的にturnsに記録
            IF nextCondition(vtest, lnum) == TRUE:
                tests.append(copy of vtest)

        IF countF == 0:
            // Fが不足: f を設定してテスト条件生成
            vtest = Array(nodeCount, 初期値 "")
            vtest[i] = "f"
            turns = [lnum + i * 2 + 1]  // 明示的にturnsに記録
            IF nextCondition(vtest, lnum) == TRUE:
                tests.append(copy of vtest)

    // === フェーズ3: 弱テスト削除 ===
    weaks = Array(tests.length, 初期値 0)
    FOR t = 0 TO tests.length - 1:
        IF checkStrong(t) == FALSE:
            weaks[t] = 1  // 弱テスト → 削除対象
```

### 5.2 フェーズ間の関係

```
フェーズ1: 論理式網羅
    ├── 全論理式に対して最低1つのテスト条件を生成
    └── テスト数の最小化（マージによる最適化）

フェーズ2: 敗者復活
    ├── 全原因ノードのT/F両方の出現を保証
    ├── フェーズ1で片方しか出現しなかった原因を補完
    └── 追加テスト条件を生成

フェーズ3: 弱テスト削除
    ├── 一意的カバレッジ(#)を持たないテストを識別
    ├── 削除しても全論理式がカバーされることを確認
    └── 冗長テストを削除してテスト数を削減
```

---

## 6. テスト条件生成 (nextCondition)

### 6.1 全体フロー

```
FUNCTION nextCondition(base, lnum) -> BOOLEAN:
    work = copy of base

    // 最大 lnum 回のバックトラックを許容
    FOR attempt = 0 TO lnum - 1:

        // ステップ(1): 未網羅の論理式を選択・マージ
        ret = chooseCondition(work, mode=0)  // 未網羅のみ
        IF turns.length == 0 AND ret == 0:
            RETURN FALSE  // 全て網羅済みまたはテスト不可能

        // ステップ(2): MASK制約による値決定
        FOR each constraint:
            constraint.maskLogic(work)

        // ステップ(3): 既網羅の論理式も追加マージ
        chooseCondition(work, mode=1)  // 既網羅も含む

        // ステップ(4): 原因ノードに値を割り当て
        match = TRUE
        FOR each causeNode j:
            IF work[j] != "":
                CONTINUE  // 既に値がある
            IF causeNode j is 孤立:
                CONTINUE  // どのノードの入力にもなっていない

            // まず "t" を試す
            IF chooseCauseValue(work, j, "t", lnum) == FALSE:
                // "f" を試す
                IF chooseCauseValue(work, j, "f", lnum) == FALSE:
                    // 両方失敗 → バックトラック

                    // 最後の採用を不適切としてマーク
                    lastTurn = turns[turns.length - 1]
                    IF lastTurn < lnum:
                        vtestcov[lastTurn] = 0  // カバレッジ解除
                    unsuitables[lastTurn] = 1

                    IF turns.length == 1:
                        infeasibles[turns[0]] = "テスト不可能"

                    turns.pop()

                    // 作業配列を再構築
                    reCalc(work, lnum)
                    match = FALSE
                    BREAK

        IF match == FALSE:
            CONTINUE  // ステップ(1)に戻って再試行

        // ステップ(5): 演繹計算で残りの値を決定
        deduce(work)

        // ステップ(6): カバレッジ再計算
        //   MASK等により値が変わった可能性があるため、
        //   全論理式について改めてカバーしているか確認
        FOR l = 0 TO lnum - 1:
            match = TRUE
            FOR k = 0 TO nodeCount - 1:
                IF work[k] != "" AND logics[l][k] != "":
                    IF work[k] != logics[l][k]:  // 大文字/小文字区別
                        match = FALSE
                        BREAK
            vtestcov[l] = (match ? 1 : 0)

        // ステップ(7): カバレッジ情報を保存
        covs.append(copy of vtestcov)
        base = copy of work
        RETURN TRUE

    RETURN TRUE
```

### 6.2 各ステップの詳細

#### ステップ(1): 未網羅論理式の選択

`chooseCondition(work, mode=0)` を呼び出す。mode=0 は「まだ全テスト条件を通じて一度もカバーされていない論理式」のみを選択対象とする。

複数の論理式が矛盾しなければ、1回の呼び出しで複数の論理式をマージ（同時採用）できる。

#### ステップ(2): MASK制約

全MASK制約に対して、トリガー条件が満たされていれば対象ノードに `"M"` を設定する。

#### ステップ(3): 既網羅論理式のマージ

`chooseCondition(work, mode=1)` を呼び出す。mode=1 は「既にカバーされている論理式」も含めて選択し、現在の作業配列に矛盾しないものをマージする。

**目的**: 1つのテスト条件でできるだけ多くの論理式をカバーすることで、テスト数を削減する。

#### ステップ(4): 原因ノードへの値割り当て

未設定の原因ノードに対して、まず `"t"` を試し、失敗すれば `"f"` を試す。
両方失敗した場合は、最後に採用した選択（論理式または原因値）を不適切としてマークし、
バックトラックする。

#### ステップ(5): 演繹計算

全ての未設定ノードに対して、入力ノードの値からAND/OR演算で出力値を推論する。
推論結果は小文字 (`"t"`, `"f"`) または `"I"` となる。

#### ステップ(6): カバレッジ再計算

ステップ(2)のMASK制約やステップ(5)の演繹計算により、値が変更された可能性がある。
そのため、全論理式について改めてカバレッジを判定する。

**重要**: この判定は**大文字/小文字を区別した完全一致比較**である。

#### ステップ(7): 保存

カバレッジ情報を `covs` 配列に追加し、テスト条件の値を返す。

---

## 7. 論理式の選択とマージ (chooseCondition)

### 7.1 アルゴリズム

```
FUNCTION chooseCondition(base, mode) -> adoptedCount:
    work = copy of base
    ret = 0

    // 全論理式を走査
    l = 0
    FOR each node i:
        lnum = node i の論理式数
        FOR j = 0 TO lnum - 1:
            // --- フィルタリング ---

            // (a) mode=0 の場合、既にカバー済みの論理式はスキップ
            IF mode == 0 AND countCoverage(l) > 0:
                l++; CONTINUE

            // (b) 今回のテスト条件で既にカバー済みならスキップ
            IF vtestcov[l] > 0:
                l++; CONTINUE

            // (c) 不適切としてマーク済みならスキップ
            IF unsuitables[l] > 0:
                l++; CONTINUE

            // (d) テスト不可能ならスキップ
            IF infeasibles[l] != "":
                l++; CONTINUE

            // --- マージ可能性チェック ---

            // (e) 値の矛盾チェック
            mergeable = TRUE
            FOR k = 0 TO nodeCount - 1:
                IF work[k] != "" AND logics[l][k] != "":
                    IF work[k] != logics[l][k]:
                        mergeable = FALSE
                        BREAK
            IF NOT mergeable:
                l++; CONTINUE

            // --- マージ実行 (一時配列で) ---
            tmp = copy of work
            FOR k = 0 TO nodeCount - 1:
                IF logics[l][k] != "":
                    tmp[k] = logics[l][k]

            // (f) 制約による演繹・検算
            FOR each constraint:
                IF constraint.deduceLogic(tmp) == FALSE:
                    mergeable = FALSE; BREAK
            IF NOT mergeable:
                l++; CONTINUE

            // (g) 制約不整合チェック
            reason = checkConstr(tmp)
            IF reason != "":
                IF turns.length == 0:
                    infeasibles[l] = reason  // 最初の論理式なので不可能確定
                l++; CONTINUE

            // (h) 論理関係不整合チェック
            reason = isPossible(tmp)
            IF reason != "":
                IF turns.length == 0:
                    infeasibles[l] = reason
                l++; CONTINUE

            // --- 採用 ---
            work = tmp
            vtestcov[l] = 1
            turns.append(l)
            ret++
            l++

    base = work
    RETURN ret
```

### 7.2 マージの順序

論理式はノード走査順に試行される。この順序がテスト条件の最終的な値に影響する。

### 7.3 infeasibles の判定タイミング

論理式が不可能（infeasible）と判定されるのは、**最初の論理式として選択された場合のみ**
（`turns.length == 0` のとき）。既に他の論理式が採用された状態での失敗は、
マージ不可能として単にスキップされる。

---

## 8. 原因ノードへの値割り当て (chooseCauseValue)

### 8.1 アルゴリズム

```
FUNCTION chooseCauseValue(work, nodeIndex, value, lnum) -> BOOLEAN:
    // value は "t" または "f"（小文字）

    // 不適切チェック
    IF value is "T" or "t":
        IF unsuitables[lnum + 2 * nodeIndex] == 1:
            RETURN FALSE
    ELSE IF value is "F" or "f":
        IF unsuitables[lnum + 2 * nodeIndex + 1] == 1:
            RETURN FALSE

    // 一時配列で試行
    tmp = copy of work
    tmp[nodeIndex] = value

    // 演繹計算
    deduce(tmp)

    // 制約による演繹・検算
    FOR each constraint:
        IF constraint.deduceLogic(tmp) == FALSE:
            RETURN FALSE
        IF constraint.maskLogic(tmp) == FALSE:
            RETURN FALSE

    // 制約不整合チェック
    IF checkConstr(tmp) != "":
        RETURN FALSE

    // 論理関係不整合チェック
    IF isPossible(tmp) != "":
        RETURN FALSE

    // 成功: 作業配列に反映
    work[nodeIndex] = value

    // turnsへの記録（注: 大文字チェックのため小文字では記録されない）
    IF value == "T":
        turns.append(lnum + nodeIndex * 2)
    ELSE IF value == "F":
        turns.append(lnum + nodeIndex * 2 + 1)

    RETURN TRUE
```

### 8.2 注意点: turnsへの記録

`chooseCauseValue()` は `nextCondition()` から `"t"` / `"f"`（小文字）で呼び出される。
しかし、turnsへの記録は `"T"` / `"F"`（大文字）チェックで行われるため、
**通常のテスト条件生成では原因値はturnsに記録されない**。

敗者復活フェーズでは、呼び出し側が明示的にturnsに記録する。

---

## 9. 値伝播 (deduce / deduceValue)

### 9.1 deduce: 全ノードの伝播

```
FUNCTION deduce(src):
    FOR each node i:
        IF src[i] != "":
            CONTINUE  // 既に値がある
        deduceValue(src, i)
```

### 9.2 deduceValue: 1ノードの値推論

```
FUNCTION deduceValue(src, nodeIndex):
    node = nodes[nodeIndex]
    IF node has no operator or no connections:
        RETURN

    IF node.op == "AND":
        isImpossible = FALSE
        FOR each input i of node:
            IF src[i] == "":
                deduceValue(src, i)  // 再帰的に入力を解決

            satisfyValue = (NOT-connected ? "F"/"f" : "T"/"t")
            nonSatisfyValue = (NOT-connected ? "T"/"t" : "F"/"f")

            IF src[i] is nonSatisfyValue:
                src[nodeIndex] = "f"  // 短絡: 1つの非満足でAND=偽
                RETURN
            IF src[i] is "M" or "I":
                isImpossible = TRUE

        IF isImpossible:
            src[nodeIndex] = "I"
        ELSE:
            src[nodeIndex] = "t"  // 全入力が満足

    ELSE IF node.op == "OR":
        isImpossible = FALSE
        FOR each input i of node:
            IF src[i] == "":
                deduceValue(src, i)

            satisfyValue = (NOT-connected ? "F"/"f" : "T"/"t")

            IF src[i] is satisfyValue:
                src[nodeIndex] = "t"  // 短絡: 1つの満足でOR=真
                RETURN
            IF src[i] is "M" or "I":
                isImpossible = TRUE

        IF isImpossible:
            src[nodeIndex] = "I"
        ELSE:
            src[nodeIndex] = "f"  // 全入力が非満足
```

### 9.3 重要: 出力値は常に小文字

`deduceValue()` は常に小文字 (`"t"`, `"f"`) または `"I"` を出力する。
大文字 (`"T"`, `"F"`) は設定しない。

---

## 10. 論理整合性チェック (isPossible / checkRelation)

### 10.1 isPossible

全ノードについて `checkRelation()` を呼び、1つでも不整合があれば不可能と判定する。

```
FUNCTION isPossible(src) -> reason:
    FOR each node i:
        IF checkRelation(src, i) == FALSE:
            RETURN node i の式の説明（不整合理由）
    RETURN ""  // 整合
```

### 10.2 checkRelation

ノードの値が、その入力ノードの値と論理的に整合するかを検証する。

```
FUNCTION checkRelation(src, nodeIndex) -> BOOLEAN:
    node = nodes[nodeIndex]

    IF src[nodeIndex] == "":
        RETURN TRUE  // 未設定なら整合
    IF node has no operator:
        RETURN TRUE  // 原因ノードなら整合

    IF node.op == "AND":
        expect = ""
        unknown = 0
        mask = 0

        FOR each input i of node:
            IF input is NOT-connected:
                IF src[i] is "T"/"t": expect = "F"; BREAK  // 非満足発見
                IF src[i] is "M": mask++
                IF src[i] is "F"/"f": expect = "T"         // 満足
                IF src[i] is "": unknown++
            ELSE:
                IF src[i] is "F"/"f": expect = "F"; BREAK  // 非満足発見
                IF src[i] is "M": mask++
                IF src[i] is "T"/"t": expect = "T"         // 満足
                IF src[i] is "": unknown++

        // ノード値T/tなのに入力からFが期待される → 不整合
        IF src[nodeIndex] is "T"/"t" AND expect == "F" AND unknown == 0:
            RETURN FALSE
        // ノード値F/fなのに入力からTが期待される → 不整合
        IF src[nodeIndex] is "F"/"f" AND expect == "T" AND unknown == 0:
            RETURN FALSE
        // ノード値Mなのに確定値がある → 不整合
        IF src[nodeIndex] == "M":
            IF unknown == 0 AND mask == 0:
                RETURN FALSE  // 全入力確定なのにM
            IF expect == "F":
                RETURN FALSE  // 確定的にFなのにM

        RETURN TRUE

    ELSE IF node.op == "OR":
        // ANDと対称的なロジック
        // 満足入力発見 → expect = "T" (BREAK)
        // 非満足入力のみ → expect = "F"
        // 同様の整合性チェック
        (ANDと対称的に実装)
        RETURN TRUE
```

---

## 11. 制約処理

### 11.1 制約の種類

| 制約 | 意味 | メンバー |
|------|------|---------|
| ONE | メンバーの中でちょうど1つが真 | 2個以上のノード |
| EXCL | メンバーの中で最大1つが真（排他） | 2個以上のノード |
| INCL | メンバーの中で少なくとも1つが真（包含） | 2個以上のノード |
| REQ | トリガーが真ならターゲットも真（要求） | トリガー1個 + ターゲット1個以上 |
| MASK | トリガーが真ならターゲットをマスク | トリガー1個 + ターゲット1個以上 |

制約メンバーにはNOT（否定）を付けることができる。NOT付きの場合、「真」の判定が反転する:
- NOT無し: T/t が「満足」
- NOT有り: F/f が「満足」

**方向性制約のNOT制限**:
- REQ: ソース側またはターゲット側のいずれかにNOT可。**両方同時は禁止**（意味が曖昧になるため）。
  - `REQ(A -> B)`: A=T ならば B=T
  - `REQ(NOT A -> B)`: A=F ならば B=T
  - `REQ(A -> NOT B)`: A=T ならば B=F
  - `REQ(NOT A -> NOT B)`: **禁止**
- MASK: トリガー側のみNOT可。ターゲット側はNOT禁止（M値は否定しても変わらないため無意味）。
  - `MASK(A -> B)`: A=T ならば B=M（マスク）
  - `MASK(NOT A -> B)`: A=F ならば B=M（マスク）

### 11.2 制約演繹 (deduceLogic)

制約に基づいて、未設定ノードの値を自動的に決定する。
**制約演繹で設定される値は大文字 (`"T"`, `"F"`) である。**

#### ONE制約

```
FUNCTION deduceONE(src):
    ondata = 0  // 満足メンバー数
    nodata = 0  // 未設定メンバー数

    FOR each member m:
        IF m is 満足: ondata = 1; BREAK
        IF src[m] == "": nodata++

    IF ondata == 1:
        // 1つ満足 → 残りは全て非満足
        FOR each member m:
            IF src[m] == "":
                src[m] = 非満足値 (大文字 "T" or "F")

    IF nodata == 1:
        // 残り1つ → それが満足
        FOR each member m:
            IF src[m] == "":
                src[m] = 満足値 (大文字 "T" or "F")
                BREAK
```

#### EXCL制約

```
FUNCTION deduceEXCL(src):
    // ONEと同様だが、最後の1つを強制的に満足にはしない
    IF 1つが満足:
        残りの未設定メンバーを非満足に (大文字)
```

#### INCL制約

```
FUNCTION deduceINCL(src):
    ondata = 0   // 満足メンバー数
    nodata = 0   // 未設定メンバー数

    FOR each member m:
        IF m is 満足: ondata++
        IF src[m] == "": nodata++

    IF ondata == 0 AND nodata == (nodeCount - 1):
        // 全メンバーが非満足で、残り1つが未設定
        // → 最後の1つを満足に設定
        FOR each member m:
            IF src[m] == "":
                src[m] = 満足値 (大文字)
```

**注意**: CEGTest 1.6のINCL制約の発動条件 `nodata == (nodeCount - 1)` は
全ノード数（制約メンバー数ではなく）に基づいている。

**INCL敗者復活について（設計検討: Issue #7, 2026-02-28）**:

秋山浩一氏のフィードバックにより、INCL制約の「敗者復活」メカニズムの
実装を検討した（参照: https://note.com/akiyama924/n/n9b1d485d0c4b ）。

敗者復活とは、INCL制約によりテスト不可能（infeasible）となった論理式に
対して、INCLメンバー1つを非満足→満足に反転した代替テストを生成する
手法である。例えば INCL(A,B,C) の下で論理式「D=T, A=F, B=F, C=F → OR=T」
がテスト不可能な場合、Cを F→T に反転して「D=T, C=T → OR=T」という
代替テストを生成する。

検討の結果、以下の理由から当面の実装を見送る判断とした:

1. **効果が限定的**: 敗者復活テストは元の論理式を厳密にはカバーしない
   （どの入力が結果に影響しているか特定できない）。秋山氏自身も
   「敗者復活したテストケースは他のテストケースよりも優先度は下がった
   テストとなります」と述べている。
2. **既存のフェーズ2（結果網羅）が代替手段を提供**: INCL不可能な論理式の
   キー入力（例: D=T）が他のテストに出現しない場合、フェーズ2が
   T/F両方の出現を保証するテストを自動生成する。敗者復活よりも精度は
   低い（全原因がTになりがち）が、テスト自体は存在する。
3. **実装の複雑性とバグリスク**: 秋山氏も「会社でつくった原因結果グラフの
   ツールでは実装したのですが、かなり複雑なロジックとなってしまい、
   それはそれで問題（ツールに実装したロジック自体にバグがある可能性が
   ある）」と述べている。CEGTest 1.6でも未実装である。
4. **カバレッジ表との整合性**: 敗者復活テストはisCoveredByがfalseとなるため、
   カバレッジ表上での表現が困難であり、弱テスト削除との整合性確保にも
   追加の仕組み（revivals[]フラグ等）が必要となる。

将来的に実装する場合は、フェーズ1（論理式網羅）とフェーズ2（結果網羅）
の間に「フェーズ1.5: INCL敗者復活」を追加する設計が妥当と考えられる。

#### REQ制約

```
FUNCTION deduceREQ(src):
    // トリガーが満足かチェック
    IF trigger is 満足:
        FOR each target:
            IF src[target] == "":
                src[target] = 指定値 (大文字 "T" or "F")
```

### 11.3 MASK制約 (maskLogic)

```
FUNCTION maskLogic(src) -> BOOLEAN:
    IF trigger is 満足:
        FOR each target:
            IF src[target] != "" AND src[target] != "M":
                RETURN FALSE  // 既に確定値がある → 矛盾
            src[target] = "M"
    RETURN TRUE
```

### 11.4 制約検証 (checkConstr)

制約違反を検出する。

```
FUNCTION checkConstr(src) -> reason:
    work = copy of src

    // まずMASK適用
    FOR each constraint:
        constraint.maskLogic(work)

    // 演繹・検証
    FOR each constraint:
        constraint.deduceLogic(work)
        reason = constraint.checkConstraint(work)
        IF reason != "":
            RETURN reason

    RETURN ""
```

#### checkConstraint (個別制約の違反チェック)

```
FOR ONE/EXCL/INCL:
    count = 満足メンバー数
    blank = 未設定メンバー数
    mask = Mメンバー数

    ONE違反: mask==0 AND (count==0 AND blank==0) OR count>1
    EXCL違反: mask==0 AND count>1
    INCL違反: mask==0 AND count==0 AND blank==0

FOR REQ:
    IF trigger is 満足:
        FOR each target:
            IF target is 非満足:
                RETURN 違反

FOR MASK:
    IF trigger is 満足:
        FOR each target:
            IF src[target] is not "M" and not "":
                RETURN 違反
```

---

## 12. バックトラッキング

### 12.1 概要

テスト条件生成中に矛盾（原因ノードにT/Fどちらも割り当てられない）が
発生した場合、最後の選択を取り消して再試行する。

### 12.2 バックトラック処理

```
// nextCondition のステップ(4)で T/F 両方失敗した場合:

lastTurn = turns[turns.length - 1]

// 最後の採用が論理式の場合、カバレッジを解除
IF lastTurn < lnum:
    vtestcov[lastTurn] = 0

// 不適切としてマーク
unsuitables[lastTurn] = 1

// 最初の論理式が失敗した場合、その論理式はテスト不可能
IF turns.length == 1:
    infeasibles[turns[0]] = "テスト不可能"

// 最後の選択を取り消す
turns.pop()

// 作業配列を再構築
reCalc(work, lnum)
```

### 12.3 reCalc: 作業配列の再構築

```
FUNCTION reCalc(src, lnum):
    // 全ノードをクリア
    FOR k = 0 TO nodeCount - 1:
        src[k] = ""

    // turnsに残っている選択を順に適用
    FOR each turn in turns:
        IF turn < lnum:
            // 論理式の値を適用
            FOR k = 0 TO nodeCount - 1:
                IF logics[turn][k] != "":
                    src[k] = logics[turn][k]  // 大文字 T/F
        ELSE:
            // 原因ノードの値を適用
            nodeIndex = (turn - lnum)
            IF nodeIndex is even:
                src[nodeIndex / 2] = "T"     // 大文字
            ELSE:
                src[(nodeIndex - 1) / 2] = "F"  // 大文字
```

**注意**: `reCalc()` は大文字 (`"T"`, `"F"`) で値を復元する。
これは論理式の定義値に合わせるためである。

---

## 13. カバレッジ表の生成

### 13.1 カバレッジの判定

各論理式 `l` に対して、各テスト条件 `t` がカバーするかを判定する。

```
FUNCTION isCoveredBy(expressionIndex l, testIndex t) -> BOOLEAN:
    FOR k = 0 TO nodeCount - 1:
        IF tests[t][k] != "" AND logics[l][k] != "":
            IF tests[t][k] != logics[l][k]:  // 大文字/小文字区別!
                RETURN FALSE
    RETURN TRUE
```

### 13.2 カバレッジシンボル

各論理式について、テスト条件の順序（左から右）に基づきシンボルを決定する。
各論理式をカバーする**最初の非弱テスト**が `#`（初回カバレッジ）、
それ以降のカバーテストが `x`（追加カバレッジ）となる:

```
FOR each expression l:
    firstCovered = FALSE
    FOR each test t (テスト順、左から右):
        IF covs[t][l] == 0:
            表示[t][l] = (空白)   // このテストはこの式をカバーしていない
        ELSE IF weaks[t] == 1:
            表示[t][l] = "x"      // 弱テストは常に追加カバレッジ
        ELSE IF NOT firstCovered:
            表示[t][l] = "#"      // 初回カバレッジ（この式を初めてカバーした非弱テスト）
            firstCovered = TRUE
        ELSE:
            表示[t][l] = "x"      // 追加カバレッジ（既に別テストでカバー済み）
```

### 13.3 シンボルの意味

| シンボル | 名称 | 意味 |
|---------|------|------|
| `#` | 初回カバレッジ | この論理式を**初めてカバーした**非弱テスト条件（各論理式につき1つ） |
| `x` | 追加カバレッジ | この論理式を**追加で**カバーしたテスト条件（既にカバー済み） |
| (空白) | 未カバー | このテスト条件はこの論理式をカバーしていない |

**活用方法**: カバレッジ表を**縦方向に集計**し、`#` が多いテスト条件から
優先的にテストすることで、効率的なテスト実行順序を決定できる。
`#` が多いテスト条件ほど、新たな論理式を多くカバーしている。

**注意**: `#` / `x` は表示上のシンボルであり、弱テスト削除の判定（§14）は
別のロジック（式を唯一カバーするテストの有無）で行う。

### 13.4 実行不可（Infeasible）とテスト不可（Untestable）の区別

カバレッジ表では、カバーされない論理式を以下の2種類に区別する。

#### 13.4.1 定義

| 種類 | 英語 | 意味 | 例 |
|------|------|------|-----|
| **実行不可** | Infeasible | 制約により論理的に成立し得ない組み合わせ。テスト自体を実行できない | ONE(A,B) で A=F かつ B=F |
| **テスト不可** | Untestable | テストは実行できるが、MASK制約により入力が不定(M)となり、結果の正しさを判断できない | MASK(C→A,B) で C=T のとき A=M, B=M |

参考: 秋山浩一「ソフトウェアテストしようぜ」第236回

#### 13.4.2 テスト不可の判定アルゴリズム

ある論理式が「テスト不可」であるかを判定するため、**緩和カバレッジ判定**を使用する。
通常のカバレッジ判定（§13.1）は大文字/小文字を厳密に比較するが、
緩和判定ではM（マスク）およびI（不定）の値をワイルドカード（任意の値に合致）として扱う。

```
FUNCTION isRelaxedCoveredBy(expressionIndex l, testIndex t) -> BOOLEAN:
    FOR k = 0 TO nodeCount - 1:
        IF tests[t][k] == "M" OR tests[t][k] == "I":
            CONTINUE    // M, I はワイルドカードとして無視
        IF tests[t][k] != "" AND logics[l][k] != "":
            IF tests[t][k] != logics[l][k]:
                RETURN FALSE
    RETURN TRUE
```

論理式の状態判定:

```
FOR each expression l:
    IF infeasibles[l] != null:
        状態 = "実行不可"    // 制約違反で実行不可能
    ELSE IF いずれかの非弱テストが厳密カバー (§13.1):
        状態 = "カバー済"    // 正常にカバーされている
    ELSE IF いずれかの非弱テストが緩和カバー:
        状態 = "テスト不可"  // MASKにより検証不能
    ELSE:
        状態 = "未カバー"    // その他の理由で未カバー
```

#### 13.4.3 カバレッジ表での表示

| 状態 | 備考欄 | カバレッジセル | 行スタイル |
|------|--------|-------------|----------|
| カバー済 | (空白) | `#` / `x` / 空白 | 通常 |
| 実行不可 | 理由表示（赤） | `-`（ハイフン） | 灰色背景 |
| テスト不可 | "MASK" 表示（橙） | `?`（クエスチョン） | 薄黄色背景 |
| 未カバー | (空白) | 空白 | 通常 |

**記号の区別**:
- `-`（ハイフン）: 実行不可。制約違反のため、このテスト条件は実行できない
- `?`（クエスチョン）: テスト不可。テストは実行できるが、MASK により結果が不明

#### 13.4.4 デシジョンテーブルとの関係

秋山氏の提言に基づき、テスト不可のテスト条件（M値を含む列）は
デシジョンテーブルから除外せず残す。ただし、テスト不可であることが
ユーザーに伝わるように表示する（§15参照）。

テスト不可の列はテスト対象の故障を発見するために有用である:
テスターは結果がユーザーに受け入れられるものかどうかで合否を判断する。

---

## 14. 弱テスト削除 (checkStrong)

### 14.1 概要

いずれの論理式も唯一カバーしていないテスト条件は「弱テスト」として
削除候補になる。ただし、削除しても全論理式がカバーされることを確認する。

**注意**: この判定は表示シンボル（`#`/`x`）とは独立である。
表示では `#` は「初回カバレッジ」を意味するが（§13.2）、
弱テスト判定では `ccount`（その式をカバーする非弱テスト数）が1であるか否かを使う。

### 14.2 アルゴリズム

```
FUNCTION checkStrong(testIndex) -> BOOLEAN:
    strong = 0  // 唯一カバー数（ccount==1の式の数）
    weak = 0    // 非唯一カバー数（ccount>1の式の数）

    FOR each expression l:
        IF covs[testIndex][l] == 0:
            CONTINUE  // このテストはこの式をカバーしていない

        // この式を何個のテストがカバーしているか
        ccount = 0
        FOR each test t:
            ccount += covs[t][l]

        IF ccount == 1:
            strong++
        ELSE IF ccount > 1:
            weak++

    IF strong == 0 AND weak > 0:
        // 唯一カバーがゼロ → 削除候補
        // ただし、削除しても全式がカバーされるか確認
        FOR each expression l:
            IF infeasibles[l] != "":
                CONTINUE

            // このテスト以外、かつ既に弱でないテストでカバーされるか
            otherCoverage = 0
            FOR each test t:
                IF t == testIndex: CONTINUE
                IF weaks[t] == 1: CONTINUE
                otherCoverage += covs[t][l]

            IF otherCoverage == 0:
                RETURN TRUE  // この式がカバーされなくなる → 削除不可

        RETURN FALSE  // 全式が他テストでカバーされる → 削除可能

    ELSE:
        RETURN TRUE  // 唯一カバーあり → 削除しない
```

### 14.3 注意: checkStrongの戻り値

- `TRUE`: このテストは**強テスト**（削除しない）
- `FALSE`: このテストは**弱テスト**（削除可能）

名前が `checkStrong` であるため、`TRUE` = 強い = 維持、`FALSE` = 弱い = 削除可能。

---

## 15. デシジョンテーブルの表示

### 15.1 テーブル構造

```
デシジョンテーブル
┌──────┬───────┬──┬──┬──┬──┬──┬──┬──┐
│ 区分 │ ノード│#1│#2│#3│#4│#5│#6│#7│
├──────┼───────┼──┼──┼──┼──┼──┼──┼──┤
│ 原因:│ ノード│値│値│値│値│値│値│値│
│      │ ...   │  │  │  │  │  │  │  │
├──────┼───────┼──┼──┼──┼──┼──┼──┼──┤
│ 中間:│ ノード│値│値│値│値│値│値│値│
│      │ ...   │  │  │  │  │  │  │  │
├──────┼───────┼──┼──┼──┼──┼──┼──┼──┤
│ 結果:│ ノード│値│値│値│値│値│値│値│
│      │ ...   │  │  │  │  │  │  │  │
└──────┴───────┴──┴──┴──┴──┴──┴──┴──┘
```

### 15.2 表示される値

デシジョンテーブルには `tests[t][k]` の値がそのまま表示される:
- `T`: 明示的真（論理式定義・制約演繹由来）
- `t`: 推論的真（演繹計算・原因割り当て由来）
- `F`: 明示的偽
- `f`: 推論的偽
- `M`: マスク（MASK制約により値が不定）
- `I`: 不定（入力が M のため真偽を決定できない。§13.4参照）

弱テスト（`weaks[t] == 1`）はテーブルに表示しない。

**テスト不可の列**: M や I を含む列はテスト不可であるが、
デシジョンテーブルから除外せず残す（§13.4.4参照）。
テスト不可であることがユーザーに伝わるよう、ヘッダーにバッジを表示する。

---

## 16. カバレッジ表の表示

### 16.1 カバレッジ表構造

```
カバレッジ表
┌───────┬──┬──┬──┬───┬──┬──┬──┬──┬──┬──┬──┬────┐
│ 論理式│n1│n2│n3│...│#1│#2│#3│#4│#5│#6│#7│備考│
├───────┼──┼──┼──┼───┼──┼──┼──┼──┼──┼──┼──┼────┤
│論理式1│T │T │  │ T │# │  │  │  │  │  │  │    │
│論理式2│F │T │  │ F │  │# │  │  │  │  │  │    │
│論理式3│F │F │  │ F │  │  │  │  │  │  │  │ONE │  ← 実行不可
│論理式4│  │  │T │ T │  │  │  │? │  │  │  │MASK│  ← テスト不可
│ ...   │  │  │  │   │  │  │  │  │  │  │  │    │
└───────┴──┴──┴──┴───┴──┴──┴──┴──┴──┴──┴──┴────┘
```

### 16.2 論理式の値列

各論理式の要求値（`logics[l][k]`）を表示する。
値は常に大文字 (`"T"`, `"F"`) または空白 (`""`)。

### 16.3 カバレッジ列

各テスト条件について `#`、`x`、`-`、`?`、または空白を表示する（§13.2, §13.4参照）。

### 16.4 論理式の状態表示

論理式の状態に応じて表示が異なる（§13.4参照）:

| 状態 | 行スタイル | カバレッジセル | 備考欄 |
|------|----------|-------------|--------|
| **カバー済** | 通常 | `#` / `x` / 空白 | (空白) |
| **実行不可** (Infeasible) | 灰色背景 | `-`（ハイフン） | 制約名（赤） |
| **テスト不可** (Untestable) | 薄黄色背景 | `?`（クエスチョン） | "MASK"（橙） |
| **未カバー** | 通常 | 空白 | (空白) |

**実行不可**: 制約違反（ONE, EXCL等）により、この論理式の要求値の組み合わせは
論理的に成立し得ない。テスト自体を実行できない。

**テスト不可**: MASK制約により入力ノードが不定(M)となり、中間・結果ノードが
不定(I)となるため、テストは実行できるが結果の正しさを判断できない。
テスト不可の列はデシジョンテーブルに残し、テスターの判断に委ねる（§13.4.4参照）。

---

## 付録A: CEGTest 1.6のバグ一覧

### A.1 MASK制約による論理演算のバグ

M値を含むAND/OR演算が不正確。§2.4参照。

### A.2 INCL制約のdeduceLogicの条件

`nodata == (nodeCount - 1)` は全ノード数に基づいている。
制約メンバー数に基づくべきと思われるが、CEGTest 1.6の挙動として記録。

### A.3 chooseCauseValueのturns記録

小文字 `"t"`/`"f"` で呼び出されるが、大文字 `"T"`/`"F"` でturns記録の条件判定が
行われるため、通常のテスト条件生成では原因値がturnsに記録されない。§8.2参照。

---

**作成日**: 2026-02-05
**更新日**: 2026-02-07
**作成者**: Claude (AI Assistant)
**レビュー状態**: レビュー待ち
