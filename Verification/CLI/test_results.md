# NeoCEG CLI Test Results

**Date**: 2026-04-04
**Version**: neoceg 0.1.0
**Node.js**: v20.20.0
**Platform**: Linux (WSL2)

---

## 1. Unit Tests (Regression)

CSV generation logic was extracted from `csvExporter.ts` into `csvGenerator.ts`.
Existing unit tests confirm no regression.

```
 ✓ src/__tests__/problematic-import.test.ts (3 tests)
 ✓ src/__tests__/import-export.test.ts (5 tests)
 ✓ src/__tests__/logicalDsl.test.ts (36 tests)
 ✓ src/__tests__/decisionTable.test.ts (68 tests)
 ✓ src/__tests__/htmlTableExporter.test.ts (8 tests)
 ✓ src/__tests__/cegAlgorithm.test.ts (100 tests)

 Test Files  6 passed (6)
      Tests  220 passed (220)
```

---

## 2. CLI Functional Tests

### 2.1 Help (`--help`)

```
$ node bin/neoceg.mjs --help
NeoCEG CLI — Generate decision tables and coverage tables from .nceg files.

Usage:
  neoceg [options] [input-file]

Input:
  input-file          Path to .nceg file (default: stdin)

Output options:
  -o, --output FILE   Write output to FILE (default: stdout)
  --coverage          Output coverage table CSV instead of decision table
  --svg               Output cause-effect graph as SVG

Information:
  -h, --help          Show help message
  --version           Show version number

Examples:
  neoceg input.nceg                          # Decision table to stdout
  neoceg -o dt.csv input.nceg                # Decision table to file
  neoceg --coverage input.nceg               # Coverage table to stdout
  neoceg --coverage -o cov.csv input.nceg    # Coverage table to file
  neoceg --svg -o graph.svg input.nceg       # Graph SVG to file
  cat input.nceg | neoceg                    # Pipe from stdin
```

**Result**: PASS

### 2.2 Version (`--version`)

```
$ node bin/neoceg.mjs --version
neoceg 0.1.0
```

**Result**: PASS

### 2.3 Decision Table CSV (file input)

```
$ node bin/neoceg.mjs Verification/TDD/graphs/01_and_2input.nceg
ID,Classification (分類),Observable (観測可能),Logical Statement (論理言明),#1,#2,#3
p1,Cause (原因),-,A,T,F,T
p2,Cause (原因),-,B,T,T,F
p3,Effect (結果),Yes,C,T,F,F
```

**Result**: PASS — 3 rules generated for AND 2-input graph (TT, FT, TF)

### 2.4 Decision Table CSV (complex graph)

```
$ node bin/neoceg.mjs Verification/TDD/graphs/17_admission_fee.nceg
ID,Classification (分類),Observable (観測可能),Logical Statement (論理言明),#1,#2,#3,#4,#5,#6,#7
n1,Cause (原因),-,Individual,T,F,T,T,F,T,F
n2,Cause (原因),-,Group,F,T,F,F,T,F,T
n3,Cause (原因),-,65+ years old,T,F,F,F,F,F,F
n4,Cause (原因),-,Adult,F,F,F,T,T,F,F
n5,Cause (原因),-,Elementary school,F,F,T,F,F,T,T
n6,Cause (原因),-,Under 6 years old,F,T,F,F,F,F,F
n7,Cause (原因),-,Prefecture resident Yes,T,F,T,T,T,F,F
n8,Cause (原因),-,Prefecture resident No,F,T,F,F,F,T,T
n9,Intermediate (中間),Yes,Prefecture resident elementary,F,F,T,F,F,F,F
n10,Intermediate (中間),Yes,Non-resident elementary,F,F,F,F,F,T,T
e1,Effect (結果),Yes,Free,T,T,T,F,F,F,F
e2,Effect (結果),Yes,1200 yen,F,f,F,T,F,F,f
e3,Effect (結果),Yes,1000 yen,f,F,f,F,T,f,F
e4,Effect (結果),Yes,600 yen,F,f,F,F,f,T,F
e5,Effect (結果),Yes,500 yen,f,F,f,f,F,F,T
```

**Result**: PASS — 7 rules for admission fee graph with 8 causes, 2 intermediates, 5 effects

### 2.5 Coverage Table CSV (`--coverage`)

```
$ node bin/neoceg.mjs --coverage Verification/TDD/graphs/01_and_2input.nceg
Expr. (論理式),p1: A,p2: B,p3: C,#1,#2,#3,Status (状態),Reason (理由)
Expr.1,T,T,T,#,,,,
Expr.2,F,T,F,,#,,,
Expr.3,T,F,F,,,#,,
```

**Result**: PASS — 3 expressions, all covered (#)

### 2.6 SVG Output (`--svg`)

```
$ node bin/neoceg.mjs --svg Verification/TDD/graphs/01_and_2input.nceg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 550 286" width="550" height="286">
<path d="M 200 68 C 260 68, 290 143, 350 143" fill="none" stroke="#333333" stroke-width="2"/>
<polygon points="350,143 341.33974596215563,148 341.33974596215563,138" fill="#333333"/>
...
<rect x="350" y="125" width="150" height="36" rx="8" ry="8" fill="#f3e5f5" stroke="#7b1fa2" stroke-width="2"/>
<rect x="354" y="135" width="28" height="16" rx="3" ry="3" fill="#1976d2"/>
<text ... font-weight="bold" fill="#fff" ...>AND</text>
<text ... fill="#333" ...>C</text>
</g>
</svg>
```

**Result**: PASS — Valid SVG with cause nodes (blue), effect node (purple), AND badge, bezier edges

### 2.7 SVG with MASK Constraint

Initial build revealed a type error: `MaskConstraint` uses `trigger` (not `source`).
After fixing `cliSvgGenerator.ts`, re-verified with a MASK constraint graph.

```
$ node bin/neoceg.mjs --svg Verification/TDD/graphs/15_mask.nceg | head -3
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 550 286" width="550" height="286">
<path d="M 200 218 C 260 218, 290 143, 350 143" .../>
...
```

```
$ node bin/neoceg.mjs Verification/TDD/graphs/15_mask.nceg
ID,Classification (分類),Observable (観測可能),Logical Statement (論理言明),#1,#2
p1,Cause (原因),-,trigger,,
p2,Cause (原因),-,mask target,T,F
p3,Effect (結果),Yes,result,T,F
```

**Result**: PASS — MASK constraint SVG renders correctly after fix

### 2.8 stdin Pipe

```
$ cat Verification/TDD/graphs/02_or_2input.nceg | node bin/neoceg.mjs
ID,Classification (分類),Observable (観測可能),Logical Statement (論理言明),#1,#2,#3
p1,Cause (原因),-,A,T,F,F
p2,Cause (原因),-,B,F,T,F
p3,Effect (結果),Yes,C,T,T,F
```

**Result**: PASS — stdin pipe produces identical output to file input

### 2.9 Parse Error Handling

```
$ echo 'invalid syntax !!!' | node bin/neoceg.mjs
Error: Parse error:
  line 1: Unexpected character: !
  line 1: Unexpected character: !
  line 1: Unexpected character: !
EXIT_CODE=1
```

**Result**: PASS — Diagnostic to stderr, exit code 1, stdout empty

---

## 3. Web App Build (No Regression)

CSV generation logic was extracted into `csvGenerator.ts` and re-exported from `csvExporter.ts`.
Web app build confirms no import path breakage or bundling issues.

```
$ npm run build
> tsc -b && vite build

vite v7.3.1 building client environment for production...
✓ 221 modules transformed.
dist/index.html                   0.73 kB │ gzip:   0.42 kB
dist/assets/index-mTYc9XIH.css   17.29 kB │ gzip:   3.12 kB
dist/assets/index-BcSDHBgO.js   501.28 kB │ gzip: 154.55 kB
✓ built in 1.38s
```

**Result**: PASS

---

## Summary

| Test | Result |
|------|--------|
| Unit tests (220 tests, 6 files) | PASS |
| `--help` | PASS |
| `--version` | PASS |
| Decision table CSV (simple) | PASS |
| Decision table CSV (complex) | PASS |
| Coverage table CSV | PASS |
| SVG output | PASS |
| SVG with MASK constraint | PASS |
| stdin pipe | PASS |
| Parse error handling | PASS |
| Web app build (`npm run build`) | PASS |
